/**
 * GameDB — transport abstraction for Movie Emoji Game
 *
 * Picks Firebase Realtime Database when firebase-config.js has real values,
 * falls back to the local Node server API + SSE otherwise.
 *
 * Public API (window.GameDB):
 *   .isFirebase          — boolean
 *   .createGame(code, mode, playerNames)
 *   .getState(code)      — null if room not found; throws {code:'NO_SERVER'} if unreachable
 *   .joinGame(code, name) — throws {status:409} if name taken
 *   .pushQuestion(code, question, timerEnd)
 *   .submitAnswer(code, name, answer)
 *   .nextQuestion(code)
 *   .endGame(code, scores)
 *   .subscribeHost(code, { onPlayerJoined, onPlayerSubmitted }) → unsub()
 *   .subscribePlayer(code, { onQuestionStart, onNextQuestion, onGameOver, onState }) → unsub()
 */
window.GameDB = (() => {
  /* ── Detect Firebase ──────────────────────────────────── */
  const _cfg = window.FIREBASE_CONFIG;
  const _isFirebase = !!(
    _cfg &&
    _cfg.apiKey && _cfg.apiKey !== 'REPLACE_ME' &&
    _cfg.databaseURL && !_cfg.databaseURL.includes('REPLACE_ME')
  );

  /* ══════════════════════════════════════════════════════
     FIREBASE IMPLEMENTATION
     ══════════════════════════════════════════════════════ */
  if (_isFirebase) {
    firebase.initializeApp(_cfg);
    const _db = firebase.database();

    function _ref(roomCode) {
      return _db.ref(`games/${roomCode}`);
    }

    function _norm(game) {
      if (!game) return null;
      game.joined  = game.joined  || {};
      game.answers = game.answers || {};
      // Firebase may convert dense arrays to objects; normalize
      if (game.playerNames && !Array.isArray(game.playerNames)) {
        game.playerNames = Object.values(game.playerNames);
      }
      return game;
    }

    return {
      isFirebase: true,

      async createGame(roomCode, mode, playerNames) {
        const scores = {};
        playerNames.forEach(n => { scores[n] = 0; });
        await _ref(roomCode).set({
          mode,
          playerNames,
          status:          'lobby',
          joined:          {},
          answers:         {},
          currentQuestion: null,
          scores,
        });
      },

      async getState(roomCode) {
        const snap = await _ref(roomCode).once('value');
        return snap.exists() ? _norm(snap.val()) : null;
      },

      async joinGame(roomCode, playerName) {
        const snap = await _ref(roomCode).once('value');
        if (!snap.exists()) {
          const e = new Error('Room not found'); e.status = 404; throw e;
        }
        const joined = snap.val().joined || {};
        if (joined[playerName]) {
          const e = new Error('Name taken'); e.status = 409; throw e;
        }
        await _ref(roomCode).child('joined').child(playerName).set(true);
      },

      async pushQuestion(roomCode, question, timerEnd) {
        await _ref(roomCode).update({
          status:          'question',
          currentQuestion: { ...question, timerEnd: timerEnd || null },
          answers:         {},
        });
      },

      async submitAnswer(roomCode, playerName, answer) {
        await _ref(roomCode).child('answers').child(playerName).set(answer);
      },

      async nextQuestion(roomCode) {
        await _ref(roomCode).update({ status: 'between', currentQuestion: null });
      },

      async endGame(roomCode, scores) {
        await _ref(roomCode).update({ status: 'over', scores: scores || {} });
      },

      subscribeHost(roomCode, { onPlayerJoined, onPlayerSubmitted }) {
        let prevJoined  = null;
        let prevAnswers = null;
        const gameRef   = _ref(roomCode);

        function listener(snap) {
          if (!snap.exists()) return;
          const game    = _norm(snap.val());
          const joined  = game.joined;
          const answers = game.answers;

          if (prevJoined !== null) {
            Object.keys(joined)
              .filter(k => !prevJoined[k])
              .forEach(name => onPlayerJoined && onPlayerJoined(name, joined));
          }
          prevJoined = { ...joined };

          if (prevAnswers !== null) {
            const newAnswerers = Object.keys(answers).filter(k => !prevAnswers[k]);
            if (newAnswerers.length) {
              const totalJoined    = Object.keys(joined).length;
              const totalSubmitted = Object.keys(answers).length;
              newAnswerers.forEach(name =>
                onPlayerSubmitted && onPlayerSubmitted(name, totalSubmitted, totalJoined));
            }
          }
          prevAnswers = { ...answers };
        }

        gameRef.on('value', listener);
        return () => gameRef.off('value', listener);
      },

      subscribePlayer(roomCode, { onQuestionStart, onNextQuestion, onGameOver, onState }) {
        let prevStatus = null;
        let isFirst    = true;
        const gameRef  = _ref(roomCode);

        function listener(snap) {
          if (!snap.exists()) return;
          const game = _norm(snap.val());

          if (isFirst) {
            isFirst = false;
            onState && onState(game);
            prevStatus = game.status;
            return;
          }

          if (game.status !== prevStatus) {
            if (game.status === 'question' && game.currentQuestion) {
              onQuestionStart && onQuestionStart(game.currentQuestion);
            } else if (game.status === 'between') {
              onNextQuestion && onNextQuestion();
            } else if (game.status === 'over') {
              onGameOver && onGameOver(game.scores || {});
            }
            prevStatus = game.status;
          }
        }

        gameRef.on('value', listener);
        return () => gameRef.off('value', listener);
      },
    };
  }

  /* ══════════════════════════════════════════════════════
     LOCAL SERVER FALLBACK (SSE + REST)
     ══════════════════════════════════════════════════════ */
  async function _post(endpoint, data) {
    try {
      await fetch(endpoint, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(data),
      });
    } catch (e) {
      console.warn('[GameDB] API error:', endpoint, e);
    }
  }

  return {
    isFirebase: false,

    async createGame(roomCode, mode, playerNames) {
      await _post('/api/game/create', { roomCode, mode, playerNames });
    },

    async getState(roomCode) {
      let res;
      try {
        res = await fetch(`/api/game/state?room=${encodeURIComponent(roomCode)}`);
      } catch {
        const e = new Error('No server'); e.code = 'NO_SERVER'; throw e;
      }
      if (!res.ok) {
        const isJson = res.headers.get('content-type')?.includes('application/json');
        if (!isJson) {
          const e = new Error('No server'); e.code = 'NO_SERVER'; throw e;
        }
        return null; // 404 JSON → room not found
      }
      return res.json();
    },

    async joinGame(roomCode, playerName) {
      const res = await fetch('/api/game/join', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ room: roomCode, name: playerName }),
      });
      if (res.status === 409) {
        const e = new Error('Name taken'); e.status = 409; throw e;
      }
      if (!res.ok) throw new Error('Join failed');
    },

    async pushQuestion(roomCode, question, timerEnd) {
      await _post('/api/game/question', { room: roomCode, question, timerEnd });
    },

    async submitAnswer(roomCode, playerName, answer) {
      await _post('/api/game/submit', { room: roomCode, name: playerName, answer });
    },

    async nextQuestion(roomCode) {
      await _post('/api/game/next', { room: roomCode });
    },

    async endGame(roomCode) {
      await _post('/api/game/over', { room: roomCode });
    },

    subscribeHost(roomCode, { onPlayerJoined, onPlayerSubmitted }) {
      const sse = new EventSource(`/api/events?room=${encodeURIComponent(roomCode)}`);
      sse.addEventListener('player_joined', (e) => {
        const { name, joined } = JSON.parse(e.data);
        onPlayerJoined && onPlayerJoined(name, joined);
      });
      sse.addEventListener('player_submitted', (e) => {
        const d = JSON.parse(e.data);
        onPlayerSubmitted && onPlayerSubmitted(d.name, d.totalSubmitted, d.totalJoined);
      });
      sse.onerror = () => console.warn('[GameDB] SSE error — will auto-reconnect');
      return () => sse.close();
    },

    subscribePlayer(roomCode, { onQuestionStart, onNextQuestion, onGameOver, onState }) {
      const sse = new EventSource(`/api/events?room=${encodeURIComponent(roomCode)}`);
      sse.addEventListener('question_start', (e) => {
        const { question } = JSON.parse(e.data);
        if (question) onQuestionStart && onQuestionStart(question);
      });
      sse.addEventListener('next_question', () => onNextQuestion && onNextQuestion());
      sse.addEventListener('game_over', (e) => {
        const { scores } = JSON.parse(e.data);
        onGameOver && onGameOver(scores || {});
      });
      sse.addEventListener('state', (e) => onState && onState(JSON.parse(e.data)));
      sse.onerror = () => console.warn('[GameDB] SSE error — will auto-reconnect');
      return () => sse.close();
    },
  };
})();
