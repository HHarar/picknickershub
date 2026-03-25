/**
 * MltDB — Firebase transport for Most Likely To game
 * Firebase path: mlt/{roomCode}/...
 */
window.MltDB = (() => {
  const _cfg = window.FIREBASE_CONFIG;
  const _isFirebase = !!(
    _cfg &&
    _cfg.apiKey && _cfg.apiKey !== 'REPLACE_ME' &&
    _cfg.databaseURL && !_cfg.databaseURL.includes('REPLACE_ME')
  );

  if (_isFirebase) {
    let _app;
    try { _app = firebase.app('mlt'); }
    catch { _app = firebase.initializeApp(_cfg, 'mlt'); }
    const _db = firebase.database(_app);

    function _ref(code) { return _db.ref(`mlt/${code}`); }

    function _norm(g) {
      if (!g) return null;
      g.joined   = g.joined   || {};
      g.votes    = g.votes    || {};
      g.scores   = g.scores   || {};
      if (g.playerNames && !Array.isArray(g.playerNames))
        g.playerNames = Object.values(g.playerNames);
      return g;
    }

    return {
      isFirebase: true,

      async createGame(code, playerNames, totalQuestions) {
        const scores = {};
        playerNames.forEach(n => { scores[n] = 0; });
        await _ref(code).set({
          playerNames, scores, totalQuestions,
          status: 'lobby',
          joined: {}, votes: {}, lastResult: null, currentQuestion: null,
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

      async pushQuestion(code, question) {
        await _ref(code).update({
          status: 'question',
          currentQuestion: question,
          votes: {}, lastResult: null,
        });
      },

      async submitVote(code, voterName, choiceName) {
        await _ref(code).child('votes').child(voterName).set(choiceName);
      },

      async closeVoting(code, result) {
        await _ref(code).update({
          status: 'results',
          lastResult: result,
          scores: result.scores,
        });
      },

      async nextQuestion(code) {
        await _ref(code).update({
          status: 'active',
          currentQuestion: null,
          votes: {}, lastResult: null,
        });
      },

      async endGame(code) {
        await _ref(code).update({ status: 'over' });
      },

      subscribeHost(code, { onPlayerJoined, onVoteSubmitted }) {
        let prevJoined = null, prevVotes = null;
        const r = _ref(code);
        function fn(snap) {
          if (!snap.exists()) return;
          const g = _norm(snap.val());

          if (prevJoined !== null) {
            Object.keys(g.joined).filter(k => !prevJoined[k])
              .forEach(n => onPlayerJoined?.(n, g.joined));
          }
          prevJoined = { ...g.joined };

          if (prevVotes !== null) {
            const newVoters = Object.keys(g.votes).filter(k => !(k in prevVotes));
            if (newVoters.length) {
              const totalJoined = Object.keys(g.joined).length;
              const totalVoted  = Object.keys(g.votes).length;
              newVoters.forEach(n => onVoteSubmitted?.(n, totalVoted, totalJoined, g.votes));
            }
          }
          prevVotes = { ...g.votes };
        }
        r.on('value', fn);
        return () => r.off('value', fn);
      },

      subscribePlayer(code, opts) {
        const { playerName, onState, onQuestionStart, onNextQuestion, onResult, onGameOver } = opts;
        let prevStatus = null, prevQText = null, prevResultId = null, isFirst = true;
        const r = _ref(code);
        function fn(snap) {
          if (!snap.exists()) return;
          const g = _norm(snap.val());

          if (isFirst) {
            isFirst = false;
            prevStatus   = g.status;
            prevQText    = g.currentQuestion?.text || null;
            prevResultId = g.lastResult?.questionText || null;
            onState?.(g);
            return;
          }

          if (g.status !== prevStatus) {
            if (g.status === 'question' && g.currentQuestion) {
              onQuestionStart?.(g.currentQuestion);
            } else if (g.status === 'active') {
              onNextQuestion?.();
            } else if (g.status === 'over') {
              onGameOver?.(g.scores || {});
            }
            prevStatus = g.status;
          }

          // New question while already in 'question' status (edge case)
          if (g.status === 'question' && g.currentQuestion?.text !== prevQText) {
            onQuestionStart?.(g.currentQuestion);
            prevQText = g.currentQuestion?.text || null;
          }

          // Result arrived
          if (g.lastResult && g.lastResult.questionText !== prevResultId) {
            onResult?.(g.lastResult);
            prevResultId = g.lastResult.questionText;
          }
        }
        r.on('value', fn);
        return () => r.off('value', fn);
      },
    };
  }

  // Fallback stub
  return {
    isFirebase: false,
    async createGame() { throw Object.assign(new Error('Firebase required'), { code: 'NO_FIREBASE' }); },
    async getState() { return null; },
    async joinGame() { throw Object.assign(new Error('Firebase required'), { code: 'NO_FIREBASE' }); },
    async beginGame() {},
    async pushQuestion() {},
    async submitVote() {},
    async closeVoting() {},
    async nextQuestion() {},
    async endGame() {},
    subscribeHost() { return () => {}; },
    subscribePlayer() { return () => {}; },
  };
})();
