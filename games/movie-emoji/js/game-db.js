/**
 * GameDB — transport abstraction for Movie Emoji Game
 *
 * Uses Firebase Realtime Database when firebase-config.js has real values,
 * falls back to local Node server API + SSE otherwise.
 *
 * Firebase game schema:
 *   games/{code}/{ mode, playerNames, status, joined, answers,
 *                  reveals, results, currentQuestion, scores }
 *
 * status values: lobby → active → question → active (loop) → over
 */
window.GameDB = (() => {
  const _cfg = window.FIREBASE_CONFIG;
  const _isFirebase = !!(
    _cfg &&
    _cfg.apiKey && _cfg.apiKey !== 'REPLACE_ME' &&
    _cfg.databaseURL && !_cfg.databaseURL.includes('REPLACE_ME')
  );

  /* ══════════════════════════════════════════════════════
     FIREBASE
     ══════════════════════════════════════════════════════ */
  if (_isFirebase) {
    firebase.initializeApp(_cfg);
    const _db = firebase.database();

    function _ref(code) { return _db.ref(`games/${code}`); }

    function _norm(g) {
      if (!g) return null;
      g.joined   = g.joined   || {};
      g.answers  = g.answers  || {};
      g.reveals  = g.reveals  || {};
      g.results  = g.results  || {};
      if (g.playerNames && !Array.isArray(g.playerNames))
        g.playerNames = Object.values(g.playerNames);
      return g;
    }

    return {
      isFirebase: true,

      async createGame(code, mode, playerNames) {
        const scores = {};
        playerNames.forEach(n => { scores[n] = 0; });
        await _ref(code).set({
          mode, playerNames, scores,
          status: 'lobby', joined: {}, answers: {},
          reveals: {}, results: {}, currentQuestion: null,
        });
      },

      async getState(code) {
        const snap = await _ref(code).once('value');
        return snap.exists() ? _norm(snap.val()) : null;
      },

      async joinGame(code, name) {
        const snap = await _ref(code).once('value');
        if (!snap.exists()) { const e = new Error('Not found'); e.status = 404; throw e; }
        if ((snap.val().joined || {})[name]) { const e = new Error('Taken'); e.status = 409; throw e; }
        await _ref(code).child('joined').child(name).set(true);
      },

      async beginGame(code) {
        await _ref(code).update({ status: 'active' });
      },

      async pushQuestion(code, question, timerEnd) {
        await _ref(code).update({
          status: 'question',
          currentQuestion: { ...question, timerEnd: timerEnd || null },
          answers: {}, reveals: {}, results: {},
        });
      },

      async pushReveal(code, part, text) {
        await _ref(code).child('reveals').child(part).set(text);
      },

      async pushResult(code, playerName, result) {
        await _ref(code).child('results').child(playerName).set(result);
      },

      async submitAnswer(code, name, answer) {
        await _ref(code).child('answers').child(name).set(answer);
      },

      async nextQuestion(code) {
        await _ref(code).update({
          status: 'active', currentQuestion: null,
          reveals: {}, results: {}, answers: {},
        });
      },

      async updateScores(code, scores) {
        await _ref(code).child('scores').update(scores);
      },

      async endGame(code, scores) {
        await _ref(code).update({ status: 'over', scores: scores || {} });
      },

      subscribeHost(code, { onPlayerJoined, onPlayerSubmitted, onAnswersUpdated }) {
        let prevJoined = null, prevAnswers = null;
        const r = _ref(code);
        function fn(snap) {
          if (!snap.exists()) return;
          const g = _norm(snap.val());
          if (prevJoined !== null) {
            Object.keys(g.joined).filter(k => !prevJoined[k])
              .forEach(n => onPlayerJoined?.(n, g.joined));
          }
          prevJoined = { ...g.joined };
          if (prevAnswers !== null) {
            const newA = Object.keys(g.answers).filter(k => !prevAnswers[k]);
            if (newA.length) {
              const tj = Object.keys(g.joined).length;
              const ts = Object.keys(g.answers).length;
              newA.forEach(n => onPlayerSubmitted?.(n, ts, tj));
              onAnswersUpdated?.(g.answers);
            }
          }
          prevAnswers = { ...g.answers };
        }
        r.on('value', fn);
        return () => r.off('value', fn);
      },

      setHostRoom(hostId, roomCode) {
        return _db.ref(`me/hosts/${hostId}/room`).set(roomCode);
      },
      watchHostRoom(hostId, callback) {
        const ref = _db.ref(`me/hosts/${hostId}/room`);
        ref.on('value', snap => callback(snap.val() || null));
        return () => ref.off('value');
      },

      subscribePlayer(code, opts) {
        const { playerName, onQuestionStart, onNextQuestion, onGameOver,
                onState, onReveal, onResult, onLobby } = opts;
        let prevStatus = null, prevRevStr = '{}', prevResult = null, isFirst = true;
        const r = _ref(code);
        function fn(snap) {
          if (!snap.exists()) return;
          const g = _norm(snap.val());
          if (isFirst) {
            isFirst = false;
            prevStatus  = g.status;
            prevRevStr  = JSON.stringify(g.reveals);
            prevResult  = playerName ? (g.results[playerName] || null) : null;
            onState?.(g);
            return;
          }
          if (g.status !== prevStatus) {
            if (g.status === 'question' && g.currentQuestion)   onQuestionStart?.(g.currentQuestion);
            else if (g.status === 'active')                      onNextQuestion?.();
            else if (g.status === 'lobby')                       onLobby?.();
            else if (g.status === 'over')                        onGameOver?.(g.scores || {});
            prevStatus = g.status;
          }
          const revStr = JSON.stringify(g.reveals);
          if (revStr !== prevRevStr && Object.keys(g.reveals).length > 0) {
            onReveal?.(g.reveals);
            prevRevStr = revStr;
          }
          if (playerName) {
            const myR = g.results[playerName] || null;
            if (myR !== prevResult && myR) { onResult?.(myR); prevResult = myR; }
          }
        }
        r.on('value', fn);
        return () => r.off('value', fn);
      },
    };
  }

  /* ══════════════════════════════════════════════════════
     LOCAL SERVER FALLBACK
     ══════════════════════════════════════════════════════ */
  async function _post(ep, data) {
    try {
      await fetch(ep, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    } catch (e) { console.warn('[GameDB]', ep, e); }
  }

  return {
    isFirebase: false,
    async createGame(code, mode, names) { await _post('/api/game/create', { roomCode: code, mode, playerNames: names }); },
    async getState(code) {
      let res;
      try { res = await fetch(`/api/game/state?room=${encodeURIComponent(code)}`); }
      catch { const e = new Error('No server'); e.code = 'NO_SERVER'; throw e; }
      if (!res.ok) {
        if (!res.headers.get('content-type')?.includes('application/json')) {
          const e = new Error('No server'); e.code = 'NO_SERVER'; throw e;
        }
        return null;
      }
      return res.json();
    },
    async joinGame(code, name) {
      const res = await fetch('/api/game/join', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ room: code, name }) });
      if (res.status === 409) { const e = new Error('Taken'); e.status = 409; throw e; }
      if (!res.ok) throw new Error('Join failed');
    },
    async beginGame(code)             { await _post('/api/game/begin',  { room: code }); },
    async pushQuestion(code, q, te)   { await _post('/api/game/question', { room: code, question: q, timerEnd: te }); },
    async pushReveal(code, part, txt) { await _post('/api/game/reveal',   { room: code, part, text: txt }); },
    async pushResult(code, name, res) { await _post('/api/game/result',   { room: code, name, result: res }); },
    async submitAnswer(code, name, a) { await _post('/api/game/submit',   { room: code, name, answer: a }); },
    async nextQuestion(code)          { await _post('/api/game/next',     { room: code }); },
    async updateScores(code, scores)  { /* no-op for local server; host tracks scores in memory */ },
    async endGame(code, scores)       { await _post('/api/game/over',     { room: code }); },

    subscribeHost(code, { onPlayerJoined, onPlayerSubmitted, onAnswersUpdated }) {
      const sse = new EventSource(`/api/events?room=${encodeURIComponent(code)}`);
      sse.addEventListener('player_joined',    e => { const { name, joined } = JSON.parse(e.data); onPlayerJoined?.(name, joined); });
      sse.addEventListener('player_submitted', e => { const d = JSON.parse(e.data); onPlayerSubmitted?.(d.name, d.totalSubmitted, d.totalJoined); if (d.answers) onAnswersUpdated?.(d.answers); });
      sse.onerror = () => console.warn('[GameDB] SSE error');
      return () => sse.close();
    },

    setHostRoom() { return Promise.resolve(); },
    watchHostRoom() { return () => {}; },

    subscribePlayer(code, opts) {
      const { playerName, onQuestionStart, onNextQuestion, onGameOver, onState, onReveal, onResult } = opts;
      const sse = new EventSource(`/api/events?room=${encodeURIComponent(code)}`);
      sse.addEventListener('question_start', e => { const { question } = JSON.parse(e.data); if (question) onQuestionStart?.(question); });
      sse.addEventListener('next_question',  () => onNextQuestion?.());
      sse.addEventListener('game_over',      e => { const { scores } = JSON.parse(e.data); onGameOver?.(scores || {}); });
      sse.addEventListener('state',          e => onState?.(JSON.parse(e.data)));
      sse.addEventListener('reveal',         e => { const { reveals } = JSON.parse(e.data); onReveal?.(reveals); });
      sse.addEventListener('result',         e => { const d = JSON.parse(e.data); if (d.name === playerName) onResult?.(d.result); });
      sse.onerror = () => console.warn('[GameDB] SSE error');
      return () => sse.close();
    },
  };
})();
