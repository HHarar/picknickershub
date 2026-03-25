/**
 * Draw & Guess — Firebase Transport Layer
 * Named app: 'dg'
 * Path prefix: dg/{roomCode}
 */

window.DgDB = (() => {
  const _cfg = window.FIREBASE_CONFIG;
  const _isFirebase = !!(_cfg && _cfg.apiKey && _cfg.apiKey !== 'REPLACE_ME' && _cfg.databaseURL && !_cfg.databaseURL.includes('REPLACE_ME'));

  if (_isFirebase) {
    let _app;
    try { _app = firebase.app('dg'); } catch (e) { _app = firebase.initializeApp(_cfg, 'dg'); }
    const _db = firebase.database(_app);
    function _ref(code) { return _db.ref(`dg/${code}`); }

    return {
      isFirebase: true,
      db: _db,

      async createGame(code, teamA, teamB, totalRounds) {
        await _ref(code).set({
          teamA, teamB,
          status: 'lobby',
          joined: {}, scores: { A: 0, B: 0 },
          round: null, guesses: null,
          canvas: { strokes: null, live: null, ver: 0 },
          totalRounds,
        });
      },

      async getState(code) {
        const snap = await _ref(code).once('value');
        if (!snap.exists()) return null;
        const g = snap.val();
        if (g.teamA?.players && !Array.isArray(g.teamA.players))
          g.teamA.players = Object.values(g.teamA.players);
        if (g.teamB?.players && !Array.isArray(g.teamB.players))
          g.teamB.players = Object.values(g.teamB.players);
        return g;
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

      async startRound(code, round) {
        await _ref(code).update({
          status: 'drawing',
          round,
          guesses: null,
          'canvas/strokes': null,
          'canvas/live': null,
          'canvas/ver': firebase.database.ServerValue.increment(1),
        });
      },

      pushLiveStroke(code, stroke) {
        return _db.ref(`dg/${code}/canvas/live`).set(stroke);
      },

      async commitStroke(code, key, stroke) {
        await _db.ref(`dg/${code}/canvas`).update({
          [`strokes/${key}`]: stroke,
          live: null,
        });
      },

      clearCanvas(code) {
        return _db.ref(`dg/${code}/canvas`).update({
          strokes: null, live: null,
          ver: firebase.database.ServerValue.increment(1),
        });
      },

      async submitGuess(code, player, text) {
        await _db.ref(`dg/${code}/guesses`).push({ player, text, ts: Date.now() });
      },

      async setGuessed(code, guesserName, drawingTeam, newScores) {
        await _ref(code).update({
          status: 'guessed',
          scores: newScores,
          'round/guesser': guesserName,
        });
      },

      async setTimeout_(code) {
        await _ref(code).update({ status: 'timeout' });
      },

      async nextRound(code) {
        await _ref(code).update({ status: 'active', round: null, guesses: null });
      },

      async endGame(code) {
        await _ref(code).update({ status: 'over' });
      },

      subscribeHost(code, { onPlayerJoined, onGuessSubmitted }) {
        let prevJoined = {};
        const r = _ref(code);
        r.child('joined').on('value', snap => {
          const joined = snap.val() || {};
          Object.keys(joined).filter(k => !prevJoined[k]).forEach(n => onPlayerJoined?.(n, joined));
          prevJoined = joined;
        });
        r.child('guesses').on('child_added', snap => {
          if (snap.val()) onGuessSubmitted?.(snap.val());
        });
        return () => { r.child('joined').off(); r.child('guesses').off(); };
      },

      subscribePlayer(code, opts) {
        const { onState, onRoundStart, onRoundEnd, onGameOver } = opts;
        let prevStatus = null, isFirst = true;
        const r = _ref(code);
        r.on('value', snap => {
          if (!snap.exists()) return;
          const g = snap.val();
          if (g.teamA?.players && !Array.isArray(g.teamA.players)) g.teamA.players = Object.values(g.teamA.players);
          if (g.teamB?.players && !Array.isArray(g.teamB.players)) g.teamB.players = Object.values(g.teamB.players);
          g.joined = g.joined || {};
          if (isFirst) { isFirst = false; prevStatus = g.status; onState?.(g); return; }
          if (g.status !== prevStatus) {
            if (g.status === 'drawing') onRoundStart?.(g);
            else if (g.status === 'guessed' || g.status === 'timeout') onRoundEnd?.(g);
            else if (g.status === 'over') onGameOver?.(g.scores);
            else onState?.(g);
            prevStatus = g.status;
          }
        });
        return () => r.off('value');
      },

      subscribeCanvas(code, { onStrokeAdded, onLiveStroke, onClear }) {
        const r = _db.ref(`dg/${code}/canvas`);
        let prevVer = null;
        let seenStrokes = new Set();

        r.child('ver').on('value', snap => {
          const ver = snap.val() || 0;
          if (prevVer !== null && ver !== prevVer) {
            seenStrokes.clear();
            onClear?.();
          }
          prevVer = ver;
        });

        r.child('strokes').on('child_added', snap => {
          if (!snap.val()) return;
          const key = snap.key;
          if (seenStrokes.has(key)) return;
          seenStrokes.add(key);
          onStrokeAdded?.(snap.val());
        });

        r.child('live').on('value', snap => onLiveStroke?.(snap.exists() ? snap.val() : null));

        return () => { r.child('ver').off(); r.child('strokes').off(); r.child('live').off(); };
      },
    };
  }

  // Fallback: no Firebase
  return {
    isFirebase: false,
    db: null,
    async createGame() { throw Object.assign(new Error('Firebase required'), { code: 'NO_FIREBASE' }); },
    async getState() { return null; },
    async joinGame() { throw Object.assign(new Error('Firebase required'), { code: 'NO_FIREBASE' }); },
    async beginGame() {},
    async startRound() {},
    pushLiveStroke() {},
    async commitStroke() {},
    clearCanvas() {},
    async submitGuess() {},
    async setGuessed() {},
    async setTimeout_() {},
    async nextRound() {},
    async endGame() {},
    subscribeHost() { return () => {}; },
    subscribePlayer() { return () => {}; },
    subscribeCanvas() { return () => {}; },
  };
})();
