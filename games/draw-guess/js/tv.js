/**
 * Draw & Guess — TV Display Controller
 * Receives BroadcastChannel messages from host.js
 * Subscribes to Firebase canvas for live drawing
 */

/* ─── CHANNEL ─────────────────────────────────────────────── */
const channel = new BroadcastChannel('draw-guess-game');

/* ─── STATE ───────────────────────────────────────────────── */
let tvState = {
  roomCode: '',
  teamAName: 'Team A',
  teamBName: 'Team B',
  scores: { A: 0, B: 0 },
  canvasUnsub: null,
  permanentCtx: null,
  liveCtx: null,
  timerHandle: null,
  timerTotal: 90,
  timerEnd: null,
};

/* ─── HELPERS ─────────────────────────────────────────────── */
function $(sel) { return document.querySelector(sel); }
function setView(view) {
  ['tvLobby','tvQuestion','tvGameover'].forEach(id => {
    document.getElementById(id).classList.toggle('hidden', id !== view);
  });
  const footer = document.getElementById('tvFooter');
  if (footer) footer.style.display = view === 'tvQuestion' ? 'flex' : 'none';
  const header = document.querySelector('.dg-tv-header');
  if (header) {
    document.getElementById('tvProgress').style.display = view === 'tvQuestion' ? '' : 'none';
    document.getElementById('tvTimerWrap').style.display = view === 'tvQuestion' ? '' : 'none';
  }
}

/* ─── TV FIREBASE (for persistence on reload) ─────────────── */
let _tvDB = null;
function initTvFirebase() {
  const cfg = window.FIREBASE_CONFIG;
  if (!window.firebase || !cfg || !cfg.apiKey || cfg.apiKey === 'REPLACE_ME') return;
  try {
    let app;
    try { app = firebase.app('dg-tv'); }
    catch (e) { app = firebase.initializeApp(cfg, 'dg-tv'); }
    _tvDB = firebase.database(app);
  } catch (e) { console.warn('[TV] Firebase init error:', e); }
}

/* ─── TIMER RING ───────────────────────────────────────────── */
function buildTimerRing() {
  return `
    <div class="timer-ring" id="tvTimerRing">
      <svg viewBox="0 0 100 100" width="80" height="80">
        <circle class="timer-ring-track" cx="50" cy="50" r="45"/>
        <circle class="timer-ring-fill" cx="50" cy="50" r="45" id="tvTimerFill"/>
      </svg>
      <div class="timer-ring-text" id="tvTimerText">—</div>
    </div>
  `;
}

function updateTimerRing(remaining, total) {
  const fill = document.getElementById('tvTimerFill');
  const text = document.getElementById('tvTimerText');
  const ring = document.getElementById('tvTimerRing');
  if (!fill || !text) return;
  const pct = Math.max(0, remaining / total);
  const offset = 283 * (1 - pct);
  fill.style.strokeDashoffset = offset;
  text.textContent = remaining;
  fill.classList.toggle('urgent', remaining <= 10);
  if (ring) ring.classList.toggle('urgent', remaining <= 10);
}

function startTvTimer(timerEnd, duration) {
  stopTvTimer();
  tvState.timerEnd = timerEnd;
  tvState.timerTotal = duration;
  tvState.timerHandle = setInterval(() => {
    const remaining = Math.max(0, Math.ceil((tvState.timerEnd - Date.now()) / 1000));
    updateTimerRing(remaining, tvState.timerTotal);
    if (remaining <= 0) stopTvTimer();
  }, 250);
}

function stopTvTimer() {
  if (tvState.timerHandle) clearInterval(tvState.timerHandle);
  tvState.timerHandle = null;
}

/* ─── CANVAS ──────────────────────────────────────────────── */
function initCanvases() {
  const perm = document.getElementById('permanentCanvas');
  const live = document.getElementById('liveCanvas');
  if (!perm || !live) return;
  perm.width = perm.offsetWidth;
  perm.height = perm.offsetHeight;
  live.width = live.offsetWidth;
  live.height = live.offsetHeight;
  tvState.permanentCtx = perm.getContext('2d');
  tvState.liveCtx = live.getContext('2d');
  tvState.permanentCtx.fillStyle = '#ffffff';
  tvState.permanentCtx.fillRect(0, 0, perm.width, perm.height);
}

function drawVirtualStroke(ctx, stroke, canvas) {
  if (!stroke || !stroke.p) return;
  const scaleX = canvas.width / 1000;
  const scaleY = canvas.height / 750;
  const scale = Math.min(scaleX, scaleY);
  const pts = stroke.p.split(';').map(s => s.split(',').map(Number));
  if (pts.length < 1) return;
  ctx.save();
  ctx.strokeStyle = stroke.c || '#1e293b';
  ctx.lineWidth = Math.max(1, stroke.w * scale);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(pts[0][0] * scaleX, pts[0][1] * scaleY);
  for (let i = 1; i < pts.length; i++) {
    ctx.lineTo(pts[i][0] * scaleX, pts[i][1] * scaleY);
  }
  ctx.stroke();
  ctx.restore();
}

function subscribeCanvas(roomCode) {
  if (tvState.canvasUnsub) tvState.canvasUnsub();
  tvState.canvasUnsub = DgDB.subscribeCanvas(roomCode, {
    onStrokeAdded(stroke) {
      const perm = document.getElementById('permanentCanvas');
      if (perm && tvState.permanentCtx) {
        drawVirtualStroke(tvState.permanentCtx, stroke, perm);
      }
    },
    onLiveStroke(stroke) {
      const live = document.getElementById('liveCanvas');
      if (!live || !tvState.liveCtx) return;
      tvState.liveCtx.clearRect(0, 0, live.width, live.height);
      if (stroke) drawVirtualStroke(tvState.liveCtx, stroke, live);
    },
    onClear() {
      const perm = document.getElementById('permanentCanvas');
      const live = document.getElementById('liveCanvas');
      if (perm && tvState.permanentCtx) {
        tvState.permanentCtx.clearRect(0, 0, perm.width, perm.height);
        tvState.permanentCtx.fillStyle = '#ffffff';
        tvState.permanentCtx.fillRect(0, 0, perm.width, perm.height);
      }
      if (live && tvState.liveCtx) {
        tvState.liveCtx.clearRect(0, 0, live.width, live.height);
      }
    },
  });
}

/* ─── WORD HINT ────────────────────────────────────────────── */
function buildWordHint(wordSpaces) {
  // wordSpaces is like "_ _ _ _ _ _ _ _" from host (spaces for multi-word)
  return `<div class="tv-word-hint">${wordSpaces}</div>`;
}

/* ─── SCORE UPDATE ANIMATION ──────────────────────────────── */
function updateScores(scores) {
  tvState.scores = scores;
  const aEl = document.getElementById('tvScoreAVal');
  const bEl = document.getElementById('tvScoreBVal');
  if (aEl) {
    const prevA = parseInt(aEl.textContent, 10) || 0;
    aEl.textContent = scores.A || 0;
    if ((scores.A || 0) > prevA) { aEl.classList.add('score-pop'); setTimeout(() => aEl.classList.remove('score-pop'), 600); }
  }
  if (bEl) {
    const prevB = parseInt(bEl.textContent, 10) || 0;
    bEl.textContent = scores.B || 0;
    if ((scores.B || 0) > prevB) { bEl.classList.add('score-pop'); setTimeout(() => bEl.classList.remove('score-pop'), 600); }
  }
}

/* ─── ROUND OVER OVERLAY ──────────────────────────────────── */
function showRoundOver(result, word, guesser, drawingTeam, scores) {
  stopTvTimer();
  updateTimerRing(0, tvState.timerTotal);

  const overlay = document.getElementById('tvRoundOver');
  const content = document.getElementById('tvRoundOverContent');
  overlay.classList.remove('hidden');

  const teamName = drawingTeam === 'A' ? tvState.teamAName : tvState.teamBName;
  const teamClass = drawingTeam === 'A' ? 'team-a' : 'team-b';

  if (result === 'guessed') {
    content.innerHTML = `
      <div class="round-over-result ${teamClass}">
        <div class="round-over-emoji">✓</div>
        <div class="round-over-guesser">${guesser} got it!</div>
        <div class="round-over-word-reveal">${word}</div>
        <div class="round-over-team">${teamName} scores a point!</div>
      </div>
    `;
  } else {
    content.innerHTML = `
      <div class="round-over-result timeout">
        <div class="round-over-emoji">⏰</div>
        <div class="round-over-guesser">Time's up!</div>
        <div class="round-over-word-reveal">${word}</div>
      </div>
    `;
  }

  if (scores) updateScores(scores);

  // Auto-hide after 6 seconds
  setTimeout(() => overlay.classList.add('hidden'), 6000);
}

/* ─── QR CODE ─────────────────────────────────────────────── */
function generateQr(url) {
  const container = document.getElementById('tvQrCode');
  if (!container) return;
  container.innerHTML = '';
  if (typeof QRCode === 'undefined') {
    container.textContent = url;
    return;
  }
  new QRCode(container, {
    text: url,
    width: 200,
    height: 200,
    colorDark: '#1e293b',
    colorLight: '#ffffff',
    correctLevel: QRCode.CorrectLevel.M,
  });
}

/* ─── BROADCAST CHANNEL HANDLERS ──────────────────────────── */
channel.onmessage = ({ data }) => {
  switch (data.type) {
    case 'GAME_INIT': {
      tvState.roomCode = data.roomCode;
      document.getElementById('tvRoomCode').textContent = data.roomCode;
      document.getElementById('tvPlayerUrl').textContent = data.playerUrl;
      document.getElementById('tvTeamAName').textContent = tvState.teamAName;
      document.getElementById('tvTeamBName').textContent = tvState.teamBName;
      generateQr(data.playerUrl);
      setView('tvLobby');
      break;
    }
    case 'PLAYER_JOINED': {
      tvState.teamAName = data.teamAName || tvState.teamAName;
      tvState.teamBName = data.teamBName || tvState.teamBName;
      const chips = document.getElementById('tvLobbyChips');
      if (chips) {
        chips.innerHTML = (data.joinedNames || []).map(n => `<span class="tv-player-chip">${n}</span>`).join('');
      }
      document.getElementById('tvLobbyStatus').textContent = `${(data.joinedNames || []).length} player${(data.joinedNames || []).length !== 1 ? 's' : ''} joined`;
      break;
    }
    case 'BEGIN_GAME': {
      document.getElementById('tvLobbyStatus').textContent = 'Game starting!';
      break;
    }
    case 'ROUND_START': {
      tvState.teamAName = data.teamAName || tvState.teamAName;
      tvState.teamBName = data.teamBName || tvState.teamBName;

      // Update name displays
      document.getElementById('tvTeamAName').textContent = tvState.teamAName;
      document.getElementById('tvTeamBName').textContent = tvState.teamBName;

      // Progress
      document.getElementById('tvProgress').textContent = `${data.num} / ${data.total}`;

      // Team banner
      const teamName = data.drawingTeam === 'A' ? tvState.teamAName : tvState.teamBName;
      const teamClass = data.drawingTeam === 'A' ? 'team-a' : 'team-b';
      const bannerEl = document.getElementById('tvDrawingTeamBanner');
      bannerEl.className = `tv-team-banner ${teamClass}`;
      bannerEl.innerHTML = `<span class="tv-drawer-badge">${teamName}</span> is drawing! — <span class="tv-drawer-name">${data.drawer}</span>`;

      // Word hint
      const hintEl = document.getElementById('tvWordHint');
      hintEl.innerHTML = buildWordHint(data.wordSpaces || '');

      // Timer
      const timerWrap = document.getElementById('tvTimerWrap');
      timerWrap.innerHTML = buildTimerRing();
      updateTimerRing(data.duration, data.duration);
      startTvTimer(data.timerEnd, data.duration);

      // Switch view
      setView('tvQuestion');

      // Init canvases after view is visible
      requestAnimationFrame(() => {
        initCanvases();
        subscribeCanvas(tvState.roomCode);
      });

      // Hide round over overlay if still showing
      document.getElementById('tvRoundOver').classList.add('hidden');
      break;
    }
    case 'ROUND_OVER': {
      showRoundOver(data.result, data.word, data.guesser, data.drawingTeam, data.scores);
      break;
    }
    case 'NEXT_ROUND': {
      document.getElementById('tvRoundOver').classList.add('hidden');
      if (tvState.canvasUnsub) { tvState.canvasUnsub(); tvState.canvasUnsub = null; }
      stopTvTimer();
      break;
    }
    case 'SCORES_UPDATE': {
      const overlay = document.getElementById('tvScoresOverlay');
      const content = document.getElementById('tvScoresContent');
      if (overlay && content) {
        content.innerHTML = `
          <h2>Scores</h2>
          <div class="scores-overlay-row team-a">${data.teamAName}: <strong>${(data.scores && data.scores.A) || 0}</strong></div>
          <div class="scores-overlay-row team-b">${data.teamBName}: <strong>${(data.scores && data.scores.B) || 0}</strong></div>
        `;
        overlay.classList.remove('hidden');
        setTimeout(() => overlay.classList.add('hidden'), 5000);
      }
      break;
    }
    case 'GAME_OVER': {
      stopTvTimer();
      if (tvState.canvasUnsub) { tvState.canvasUnsub(); tvState.canvasUnsub = null; }
      setView('tvGameover');

      const winnerEl = document.getElementById('tvWinner');
      if (winnerEl) {
        winnerEl.textContent = data.winner === 'Tie!' ? "It's a Tie! 🤝" : `🏆 ${data.winner} Wins!`;
      }
      const scoresEl = document.getElementById('tvFinalScores');
      if (scoresEl) {
        scoresEl.innerHTML = `
          <div class="tv-final-score team-a">${data.teamAName}: <strong>${(data.scores && data.scores.A) || 0}</strong></div>
          <div class="tv-final-score team-b">${data.teamBName}: <strong>${(data.scores && data.scores.B) || 0}</strong></div>
        `;
      }
      launchTvConfetti();
      break;
    }
  }
};

/* ─── CONFETTI (TV) ───────────────────────────────────────── */
function launchTvConfetti() {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9999;';
  document.body.appendChild(canvas);
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const ctx = canvas.getContext('2d');
  const colors = ['#6366f1','#3b82f6','#f97316','#10b981','#f59e0b','#ec4899'];
  const pieces = Array.from({ length: 200 }, () => ({
    x: Math.random() * canvas.width,
    y: -20 - Math.random() * 200,
    w: 10 + Math.random() * 10,
    h: 5 + Math.random() * 8,
    color: colors[Math.floor(Math.random() * colors.length)],
    speed: 3 + Math.random() * 4,
    angle: Math.random() * Math.PI * 2,
    spin: (Math.random() - 0.5) * 0.15,
    drift: (Math.random() - 0.5) * 2,
  }));
  const startTime = Date.now();
  let frame;
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let any = false;
    pieces.forEach(p => {
      p.y += p.speed; p.x += p.drift; p.angle += p.spin;
      if (p.y < canvas.height + 20) any = true;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.angle);
      ctx.fillStyle = p.color; ctx.fillRect(-p.w/2, -p.h/2, p.w, p.h);
      ctx.restore();
    });
    if (any && Date.now() - startTime < 5000) {
      frame = requestAnimationFrame(draw);
    } else {
      cancelAnimationFrame(frame);
      canvas.remove();
    }
  }
  draw();
}

/* ─── CANVAS RESIZE ─────────────────────────────────────────── */
window.addEventListener('resize', () => {
  if (!tvState.permanentCtx) return;
  const perm = document.getElementById('permanentCanvas');
  const live = document.getElementById('liveCanvas');
  if (!perm || !live) return;

  // Save permanent canvas content
  const tempCanvas = document.createElement('canvas');
  tempCanvas.width = perm.width;
  tempCanvas.height = perm.height;
  tempCanvas.getContext('2d').drawImage(perm, 0, 0);

  perm.width = perm.offsetWidth;
  perm.height = perm.offsetHeight;
  live.width = live.offsetWidth;
  live.height = live.offsetHeight;

  // Restore permanent canvas
  tvState.permanentCtx.fillStyle = '#ffffff';
  tvState.permanentCtx.fillRect(0, 0, perm.width, perm.height);
  tvState.permanentCtx.drawImage(tempCanvas, 0, 0, perm.width, perm.height);
});

/* ─── INIT ROOM ───────────────────────────────────────────── */
function initRoom(roomCode) {
  if (!roomCode || roomCode === tvState.roomCode) return;

  // Tear down old subscriptions
  if (tvState.canvasUnsub) { tvState.canvasUnsub(); tvState.canvasUnsub = null; }
  stopTvTimer();

  tvState.roomCode = roomCode;
  document.getElementById('tvRoomCode').textContent = roomCode;

  if (!_tvDB) { setView('tvLobby'); return; }

  _tvDB.ref(`dg/${roomCode}`).once('value').then(snap => {
    if (!snap.exists()) { setView('tvLobby'); return; }
    const g = snap.val();
    tvState.teamAName = g.teamA?.name || 'Team A';
    tvState.teamBName = g.teamB?.name || 'Team B';
    tvState.scores = g.scores || { A: 0, B: 0 };
    updateScores(tvState.scores);
    document.getElementById('tvTeamAName').textContent = tvState.teamAName;
    document.getElementById('tvTeamBName').textContent = tvState.teamBName;

    if (g.status === 'drawing' && g.round) {
      document.getElementById('tvProgress').textContent = `${g.round.num} / ${g.round.total}`;
      const teamName = g.round.drawingTeam === 'A' ? tvState.teamAName : tvState.teamBName;
      const teamClass = g.round.drawingTeam === 'A' ? 'team-a' : 'team-b';
      const bannerEl = document.getElementById('tvDrawingTeamBanner');
      bannerEl.className = `tv-team-banner ${teamClass}`;
      bannerEl.innerHTML = `<span class="tv-drawer-badge">${teamName}</span> is drawing! — <span class="tv-drawer-name">${g.round.drawer}</span>`;
      const hintEl = document.getElementById('tvWordHint');
      hintEl.innerHTML = `<div class="tv-word-hint">${'_ '.repeat(g.round.word.length).trim()}</div>`;
      const timerWrap = document.getElementById('tvTimerWrap');
      timerWrap.innerHTML = buildTimerRing();
      const remaining = Math.max(0, Math.ceil((g.round.timerEnd - Date.now()) / 1000));
      updateTimerRing(remaining, g.round.duration);
      if (remaining > 0) startTvTimer(g.round.timerEnd, g.round.duration);
      setView('tvQuestion');
      requestAnimationFrame(() => { initCanvases(); subscribeCanvas(roomCode); });
    } else if (g.status === 'lobby' || g.status === 'active') {
      setView('tvLobby');
    } else if (g.status === 'over') {
      setView('tvGameover');
    } else {
      setView('tvLobby');
    }
  }).catch(() => setView('tvLobby'));
}

/* ─── INIT ────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initTvFirebase();

  // Check URL params
  const params = new URLSearchParams(location.search);
  const hostId = params.get('host');
  const room = params.get('room');

  setView('tvLobby');

  // Notify host we're ready
  setTimeout(() => {
    if (window.opener) {
      try { window.opener.postMessage('dg-tv-ready', '*'); } catch (e) {}
    }
    channel.postMessage({ type: 'TV_READY' });
  }, 500);

  if (hostId && _tvDB) {
    // Watch for host's current room — auto-updates when new game starts
    _tvDB.ref(`dg/hosts/${hostId}/room`).on('value', snap => {
      const newRoom = snap.val();
      if (newRoom && newRoom !== tvState.roomCode) {
        initRoom(newRoom);
      }
    });
  } else if (room) {
    initRoom(room);
  }
});
