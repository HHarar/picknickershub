/**
 * Draw & Guess — Player Controller
 */

/* ─── STATE ───────────────────────────────────────────────── */
const SESSION_KEY = 'dgPlayer';

let ps = {
  name: '',
  roomCode: '',
  myTeam: null,
  unsub: null,
  canvasUnsub: null,
  drawing: {
    buffer: [],
    strokeId: 0,
    pushTimer: null,
    color: '#1e293b',
    width: 6,
    isEraser: false,
    isDrawing: false,
    localCtx: null,
    localStrokes: [],
    currentPts: [],
  },
};

/* ─── VIEW MANAGEMENT ─────────────────────────────────────── */
const VIEWS = ['viewJoin','viewWaiting','viewDrawing','viewGuessing','viewWatching','viewRoundOver','viewGameover'];

function setView(id) {
  VIEWS.forEach(v => {
    const el = document.getElementById(v);
    if (el) el.classList.toggle('hidden', v !== id);
  });
}

/* ─── SESSION STORAGE ─────────────────────────────────────── */
function saveSession() {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ name: ps.name, roomCode: ps.roomCode }));
}

function tryRejoin() {
  try {
    const s = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
    if (s && s.name && s.roomCode) return s;
  } catch {}
  return null;
}

/* ─── JOIN FORM ───────────────────────────────────────────── */
function initJoinForm() {
  const params = new URLSearchParams(location.search);
  const roomParam = params.get('room');
  const roomInput = document.getElementById('joinRoom');
  const joinBtn = document.getElementById('joinBtn');
  const nameSection = document.getElementById('namePickerSection');
  const nameSelect = document.getElementById('joinNameSelect');
  const nameMsg = document.getElementById('namePickerMsg');
  const roomMsg = document.getElementById('roomStatusMsg');

  if (roomParam) {
    roomInput.value = roomParam.toUpperCase();
    loadRoomPlayers(roomParam.toUpperCase());
  }

  roomInput.addEventListener('input', () => {
    const code = roomInput.value.trim().toUpperCase();
    roomInput.value = code;
    nameSection.classList.add('hidden');
    joinBtn.disabled = true;
    if (code.length === 5) loadRoomPlayers(code);
    else { roomMsg.textContent = ''; roomMsg.className = 'room-status-msg'; }
  });

  nameSelect.addEventListener('change', () => {
    joinBtn.disabled = !nameSelect.value;
    nameMsg.textContent = '';
  });

  async function loadRoomPlayers(code) {
    roomMsg.textContent = 'Looking up room…';
    roomMsg.className = 'room-status-msg';
    try {
      const game = await DgDB.getState(code);
      if (!game) {
        roomMsg.textContent = 'Room not found.';
        roomMsg.className = 'room-status-msg room-status--error';
        nameSection.classList.add('hidden');
        joinBtn.disabled = true;
        return;
      }
      if (game.status === 'over') {
        roomMsg.textContent = 'This game has ended.';
        roomMsg.className = 'room-status-msg room-status--error';
        return;
      }
      roomMsg.textContent = 'Room found!';
      roomMsg.className = 'room-status-msg room-status--ok';

      const allPlayers = [
        ...(game.teamA?.players || []),
        ...(game.teamB?.players || []),
      ];
      const joined = game.joined || {};

      nameSelect.innerHTML = '<option value="">— pick your name —</option>';
      allPlayers.forEach(name => {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        if (joined[name]) {
          opt.disabled = true;
          opt.textContent += ' (taken)';
        }
        nameSelect.appendChild(opt);
      });
      nameSection.classList.remove('hidden');
      joinBtn.disabled = true;
    } catch (err) {
      roomMsg.textContent = 'Could not reach server.';
      roomMsg.className = 'room-status-msg room-status--error';
    }
  }

  document.getElementById('joinForm').addEventListener('submit', async e => {
    e.preventDefault();
    const code = roomInput.value.trim().toUpperCase();
    const name = nameSelect.value;
    if (!code || !name) return;

    joinBtn.disabled = true;
    joinBtn.textContent = 'Joining…';
    try {
      await DgDB.joinGame(code, name);
      ps.name = name;
      ps.roomCode = code;
      saveSession();
      await connectToGame(code);
    } catch (err) {
      if (err.status === 409) {
        nameMsg.textContent = 'That name was just taken. Pick another.';
        const opt = nameSelect.querySelector(`option[value="${CSS.escape(name)}"]`);
        if (opt) { opt.disabled = true; opt.textContent += ' (taken)'; }
        nameSelect.value = '';
        joinBtn.disabled = true;
        joinBtn.textContent = 'Join Game 🎮';
      } else {
        nameMsg.textContent = 'Join failed: ' + (err.message || 'Unknown error');
        joinBtn.disabled = false;
        joinBtn.textContent = 'Join Game 🎮';
      }
    }
  });
}

/* ─── CONNECT TO GAME ─────────────────────────────────────── */
async function connectToGame(code) {
  if (ps.unsub) ps.unsub();

  // Get initial state to determine team
  const game = await DgDB.getState(code);
  if (game) {
    const teamA = game.teamA?.players || [];
    const teamB = game.teamB?.players || [];
    if (teamA.includes(ps.name)) ps.myTeam = 'A';
    else if (teamB.includes(ps.name)) ps.myTeam = 'B';
  }

  setView('viewWaiting');
  updateWaiting('Get ready!', 'Waiting for the host…');

  ps.unsub = DgDB.subscribePlayer(code, {
    playerName: ps.name,
    onState(g) {
      if (g.status === 'lobby' || g.status === 'active') {
        setView('viewWaiting');
        updateWaiting('Get ready!', 'Waiting for the host to start…');
      } else if (g.status === 'drawing') {
        handleRoundStart(g);
      } else if (g.status === 'guessed' || g.status === 'timeout') {
        handleRoundEnd(g);
      } else if (g.status === 'over') {
        handleGameOver(g.scores);
      }
    },
    onRoundStart(g) {
      handleRoundStart(g);
    },
    onRoundEnd(g) {
      handleRoundEnd(g);
    },
    onGameOver(scores) {
      handleGameOver(scores);
    },
  });
}

function updateWaiting(title, sub) {
  const t = document.getElementById('waitingTitle');
  const s = document.getElementById('waitingSub');
  if (t) t.textContent = title;
  if (s) s.textContent = sub;
}

/* ─── ROUND START ─────────────────────────────────────────── */
function handleRoundStart(game) {
  // Clear previous canvas subscription
  if (ps.canvasUnsub) { ps.canvasUnsub(); ps.canvasUnsub = null; }

  const round = game.round;
  if (!round) return;

  const isDrawer = round.drawer === ps.name;
  const isMyTeamDrawing = round.drawingTeam === ps.myTeam;

  if (isDrawer) {
    showDrawingView(round, game);
  } else if (isMyTeamDrawing) {
    showGuessingView(round, game);
  } else {
    showWatchingView(round, game);
  }
}

/* ─── DRAWING VIEW ───────────────────────────────────────── */
function showDrawingView(round, game) {
  document.getElementById('drawingWord').textContent = round.word;
  document.getElementById('drawingRoundBadge').textContent = `Round ${round.num}/${round.total}`;
  setView('viewDrawing');

  // Reset drawing state
  ps.drawing.buffer = [];
  ps.drawing.strokeId = 0;
  ps.drawing.isEraser = false;
  ps.drawing.color = '#1e293b';
  ps.drawing.width = 6;
  ps.drawing.isDrawing = false;
  ps.drawing.localStrokes = [];
  ps.drawing.currentPts = [];

  // Reset color buttons
  document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
  const firstColor = document.querySelector('.color-btn[data-color="#1e293b"]');
  if (firstColor) firstColor.classList.add('active');

  // Reset size buttons
  document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
  const firstSize = document.querySelector('.size-btn[data-size="6"]');
  if (firstSize) firstSize.classList.add('active');

  initDrawingCanvas();
}

function initDrawingCanvas() {
  const canvas = document.getElementById('drawingCanvas');
  if (!canvas) return;

  // Size the canvas
  canvas.width = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ps.drawing.localCtx = ctx;

  // Register onDisconnect
  if (DgDB.db) {
    DgDB.db.ref(`dg/${ps.roomCode}/canvas/live`).onDisconnect().set(null);
  }

  // Remove old listeners by replacing canvas
  const newCanvas = canvas.cloneNode(true);
  canvas.parentNode.replaceChild(newCanvas, canvas);

  const c = document.getElementById('drawingCanvas');
  c.width = newCanvas.width;
  c.height = newCanvas.height;
  const ctx2 = c.getContext('2d');
  ctx2.fillStyle = '#ffffff';
  ctx2.fillRect(0, 0, c.width, c.height);
  ps.drawing.localCtx = ctx2;

  c.addEventListener('touchstart', e => { e.preventDefault(); startStroke(getPos(e, c)); }, { passive: false });
  c.addEventListener('touchmove',  e => { e.preventDefault(); if (ps.drawing.isDrawing) continueStroke(getPos(e, c)); }, { passive: false });
  c.addEventListener('touchend',   e => { e.preventDefault(); endStroke(); }, { passive: false });
  c.addEventListener('mousedown',  e => { startStroke(getPos(e, c)); });
  c.addEventListener('mousemove',  e => { if (ps.drawing.isDrawing) continueStroke(getPos(e, c)); });
  c.addEventListener('mouseup',    () => endStroke());
  c.addEventListener('mouseleave', () => { if (ps.drawing.isDrawing) endStroke(); });
}

function getPos(e, canvas) {
  const rect = canvas.getBoundingClientRect();
  const src = e.touches ? e.touches[0] : e;
  return {
    vx: Math.round((src.clientX - rect.left) / rect.width * 1000),
    vy: Math.round((src.clientY - rect.top) / rect.height * 750),
  };
}

function startStroke({ vx, vy }) {
  ps.drawing.isDrawing = true;
  ps.drawing.strokeId = Date.now();
  ps.drawing.buffer = [`${vx},${vy}`];
  ps.drawing.currentPts = [{ vx, vy }];

  // Register onDisconnect
  if (DgDB.db) {
    DgDB.db.ref(`dg/${ps.roomCode}/canvas/live`).onDisconnect().set(null);
  }

  drawFullCanvas();
}

function continueStroke({ vx, vy }) {
  if (!ps.drawing.isDrawing) return;
  ps.drawing.buffer.push(`${vx},${vy}`);
  ps.drawing.currentPts.push({ vx, vy });

  // Auto-split at 400 points — commit segment, keep drawing locally
  if (ps.drawing.buffer.length >= 400) {
    const color = ps.drawing.isEraser ? '#ffffff' : ps.drawing.color;
    DgDB.commitStroke(ps.roomCode, `s_${ps.drawing.strokeId}`, {
      c: color, w: ps.drawing.width, p: ps.drawing.buffer.join(';'),
    });
    // Archive this segment into localStrokes so redraw includes it
    ps.drawing.localStrokes.push({
      c: color, w: ps.drawing.width, pts: [...ps.drawing.currentPts],
    });
    const lastPt = ps.drawing.currentPts[ps.drawing.currentPts.length - 1];
    ps.drawing.buffer = [`${lastPt.vx},${lastPt.vy}`];
    ps.drawing.currentPts = [lastPt];
    ps.drawing.strokeId = Date.now();
  }

  drawFullCanvas();

  // Throttled push to Firebase
  if (!ps.drawing.pushTimer) {
    ps.drawing.pushTimer = setTimeout(() => {
      ps.drawing.pushTimer = null;
      if (ps.drawing.buffer.length < 1) return;
      const color = ps.drawing.isEraser ? '#ffffff' : ps.drawing.color;
      DgDB.pushLiveStroke(ps.roomCode, {
        c: color,
        w: ps.drawing.width,
        p: ps.drawing.buffer.join(';'),
        id: ps.drawing.strokeId,
      });
    }, 100);
  }
}

function endStroke() {
  if (!ps.drawing.isDrawing) return;
  ps.drawing.isDrawing = false;

  if (ps.drawing.pushTimer) {
    clearTimeout(ps.drawing.pushTimer);
    ps.drawing.pushTimer = null;
  }

  if (ps.drawing.buffer.length < 2) {
    ps.drawing.buffer = [];
    ps.drawing.currentPts = [];
    DgDB.pushLiveStroke(ps.roomCode, null).catch(() => {});
    return;
  }

  const color = ps.drawing.isEraser ? '#ffffff' : ps.drawing.color;
  const key = `s_${ps.drawing.strokeId}`;

  // Archive into localStrokes so future redraws include it
  const finishedPts = [...ps.drawing.currentPts];
  ps.drawing.localStrokes.push({ c: color, w: ps.drawing.width, pts: finishedPts });
  ps.drawing.currentPts = [];
  ps.drawing.buffer = [];

  DgDB.commitStroke(ps.roomCode, key, {
    c: color,
    w: ps.drawing.width,
    p: finishedPts.map(pt => `${pt.vx},${pt.vy}`).join(';'),
  });
}

/** Redraw the entire local canvas from scratch using localStrokes + currentPts. */
function drawFullCanvas() {
  const canvas = document.getElementById('drawingCanvas');
  const ctx = ps.drawing.localCtx;
  if (!canvas || !ctx) return;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const scaleX = canvas.width / 1000;
  const scaleY = canvas.height / 750;

  // Draw committed strokes
  ps.drawing.localStrokes.forEach(stroke => drawLocalStroke(ctx, stroke, scaleX, scaleY));

  // Draw in-progress stroke
  if (ps.drawing.currentPts.length >= 2) {
    drawLocalStroke(ctx, {
      c: ps.drawing.isEraser ? '#ffffff' : ps.drawing.color,
      w: ps.drawing.width,
      pts: ps.drawing.currentPts,
    }, scaleX, scaleY);
  }
}

function drawLocalStroke(ctx, stroke, scaleX, scaleY) {
  const pts = stroke.pts;
  if (!pts || pts.length < 2) return;
  const scale = Math.min(scaleX, scaleY);
  ctx.beginPath();
  ctx.strokeStyle = stroke.c;
  ctx.lineWidth = Math.max(1, stroke.w * scale);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.moveTo(pts[0].vx * scaleX, pts[0].vy * scaleY);
  for (let i = 1; i < pts.length; i++) {
    ctx.lineTo(pts[i].vx * scaleX, pts[i].vy * scaleY);
  }
  ctx.stroke();
}

/* ─── DRAWING CONTROLS ────────────────────────────────────── */
function initDrawingControls() {
  // Color buttons
  document.querySelectorAll('.color-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.color-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (btn.dataset.color === 'eraser') {
        ps.drawing.isEraser = true;
      } else {
        ps.drawing.isEraser = false;
        ps.drawing.color = btn.dataset.color;
      }
    });
  });

  // Size buttons
  document.querySelectorAll('.size-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      ps.drawing.width = parseInt(btn.dataset.size, 10);
    });
  });

  // Clear button
  const clearBtn = document.getElementById('clearCanvasBtn');
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      ps.drawing.localStrokes = [];
      ps.drawing.currentPts = [];
      DgDB.clearCanvas(ps.roomCode);
      drawFullCanvas();
    });
  }
}

/* ─── GUESSING VIEW ──────────────────────────────────────── */
function showGuessingView(round, game) {
  const teamName = round.drawingTeam === 'A'
    ? (game.teamA?.name || 'Team A')
    : (game.teamB?.name || 'Team B');

  document.getElementById('guessingTeamBadge').textContent = `${teamName} is drawing`;
  document.getElementById('guessingRound').textContent = `Round ${round.num}/${round.total}`;
  document.getElementById('guessInput').value = '';
  document.getElementById('guessInput').disabled = false;
  document.getElementById('guessSubmitBtn').disabled = false;
  document.getElementById('wrongGuesses').innerHTML = '';
  document.getElementById('guessResult').innerHTML = '';
  setView('viewGuessing');

  // Init two-canvas stack
  initTwoCanvas('guessPermanentCanvas', 'guessLiveCanvas');

  // Subscribe to canvas
  ps.canvasUnsub = DgDB.subscribeCanvas(ps.roomCode, {
    onStrokeAdded(stroke) {
      const perm = document.getElementById('guessPermanentCanvas');
      if (perm) {
        const ctx = perm.getContext('2d');
        drawVirtualStroke(ctx, stroke, perm);
      }
    },
    onLiveStroke(stroke) {
      const live = document.getElementById('guessLiveCanvas');
      if (!live) return;
      const ctx = live.getContext('2d');
      ctx.clearRect(0, 0, live.width, live.height);
      if (stroke) drawVirtualStroke(ctx, stroke, live);
    },
    onClear() {
      const perm = document.getElementById('guessPermanentCanvas');
      const live = document.getElementById('guessLiveCanvas');
      if (perm) {
        const ctx = perm.getContext('2d');
        ctx.clearRect(0, 0, perm.width, perm.height);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, perm.width, perm.height);
      }
      if (live) {
        const ctx = live.getContext('2d');
        ctx.clearRect(0, 0, live.width, live.height);
      }
    },
  });

  // Guess input handler
  const guessInput = document.getElementById('guessInput');
  const guessBtn = document.getElementById('guessSubmitBtn');

  function submitGuess() {
    const text = guessInput.value.trim();
    if (!text) return;
    guessInput.value = '';
    DgDB.submitGuess(ps.roomCode, ps.name, text).catch(err => console.error('Guess submit error:', err));
    // Show in wrong guesses (host will confirm if correct)
    addWrongGuess(text);
  }

  guessInput.onkeydown = e => { if (e.key === 'Enter') submitGuess(); };
  guessBtn.onclick = submitGuess;
}

function addWrongGuess(text) {
  const container = document.getElementById('wrongGuesses');
  if (!container) return;
  const item = document.createElement('div');
  item.className = 'wrong-guess-item';
  item.textContent = text;
  container.appendChild(item);
  // Keep only last 5
  while (container.children.length > 5) container.removeChild(container.firstChild);
}

/* ─── WATCHING VIEW ──────────────────────────────────────── */
function showWatchingView(round, game) {
  const drawingTeamName = round.drawingTeam === 'A'
    ? (game.teamA?.name || 'Team A')
    : (game.teamB?.name || 'Team B');
  document.getElementById('watchingHeader').textContent = `${drawingTeamName} is drawing — ${round.drawer}…`;
  setView('viewWatching');

  initTwoCanvas('watchPermanentCanvas', 'watchLiveCanvas');

  ps.canvasUnsub = DgDB.subscribeCanvas(ps.roomCode, {
    onStrokeAdded(stroke) {
      const perm = document.getElementById('watchPermanentCanvas');
      if (perm) drawVirtualStroke(perm.getContext('2d'), stroke, perm);
    },
    onLiveStroke(stroke) {
      const live = document.getElementById('watchLiveCanvas');
      if (!live) return;
      const ctx = live.getContext('2d');
      ctx.clearRect(0, 0, live.width, live.height);
      if (stroke) drawVirtualStroke(ctx, stroke, live);
    },
    onClear() {
      const perm = document.getElementById('watchPermanentCanvas');
      const live = document.getElementById('watchLiveCanvas');
      if (perm) { const c = perm.getContext('2d'); c.clearRect(0, 0, perm.width, perm.height); c.fillStyle = '#ffffff'; c.fillRect(0, 0, perm.width, perm.height); }
      if (live) live.getContext('2d').clearRect(0, 0, live.width, live.height);
    },
  });
}

/* ─── TWO-CANVAS INIT ─────────────────────────────────────── */
function initTwoCanvas(permId, liveId) {
  const perm = document.getElementById(permId);
  const live = document.getElementById(liveId);
  if (!perm || !live) return;
  perm.width = perm.offsetWidth;
  perm.height = perm.offsetHeight;
  live.width = live.offsetWidth;
  live.height = live.offsetHeight;
  const ctx = perm.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, perm.width, perm.height);
}

/* ─── VIRTUAL STROKE DRAW ─────────────────────────────────── */
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

/* ─── ROUND END ───────────────────────────────────────────── */
function handleRoundEnd(game) {
  if (ps.canvasUnsub) { ps.canvasUnsub(); ps.canvasUnsub = null; }

  const round = game.round;
  const word = round?.word || '';
  const guesser = round?.guesser || null;
  const result = game.status;
  const drawingTeam = round?.drawingTeam;

  const bannerEl = document.getElementById('roundOverBanner');
  const wordEl = document.getElementById('roundOverWord');

  if (guesser === ps.name) {
    // I guessed it!
    bannerEl.innerHTML = `<div class="round-over-banner round-over--win">🎉 YOU GOT IT!</div>`;
    launchConfetti();
  } else if (guesser) {
    // Someone else guessed it
    bannerEl.innerHTML = `<div class="round-over-banner round-over--ok">${guesser} got it!</div>`;
    if (drawingTeam === ps.myTeam) {
      bannerEl.innerHTML += `<div class="round-over-sub">Your team scores a point!</div>`;
    }
  } else if (result === 'timeout') {
    bannerEl.innerHTML = `<div class="round-over-banner round-over--miss">⏰ Time's up!</div>`;
  } else {
    bannerEl.innerHTML = `<div class="round-over-banner round-over--miss">No one guessed it!</div>`;
  }

  if (wordEl) wordEl.innerHTML = `The word was: <strong>${word}</strong>`;

  setView('viewRoundOver');
}

/* ─── GAME OVER ───────────────────────────────────────────── */
function handleGameOver(scores) {
  if (ps.canvasUnsub) { ps.canvasUnsub(); ps.canvasUnsub = null; }
  const resultEl = document.getElementById('gameoverResult');
  if (resultEl) {
    const myScore = ps.myTeam === 'A' ? (scores?.A || 0) : (scores?.B || 0);
    const oppScore = ps.myTeam === 'A' ? (scores?.B || 0) : (scores?.A || 0);
    const won = myScore > oppScore;
    const tie = myScore === oppScore;
    resultEl.innerHTML = `
      <div class="gameover-result-msg ${won ? 'gameover--win' : tie ? 'gameover--tie' : 'gameover--loss'}">
        ${won ? '🏆 Your team wins!' : tie ? "🤝 It's a tie!" : '😔 Your team lost'}
      </div>
      <div class="gameover-scores">
        <div>Your team: ${myScore}</div>
        <div>Opponents: ${oppScore}</div>
      </div>
    `;
  }
  setView('viewGameover');
}

/* ─── CONFETTI ────────────────────────────────────────────── */
function launchConfetti() {
  const canvas = document.getElementById('confettiCanvas');
  if (!canvas) return;
  canvas.style.display = 'block';
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  const ctx = canvas.getContext('2d');
  const colors = ['#6366f1','#3b82f6','#f97316','#10b981','#f59e0b','#ec4899'];
  const pieces = Array.from({ length: 150 }, () => ({
    x: Math.random() * canvas.width,
    y: -20 - Math.random() * 100,
    w: 8 + Math.random() * 8,
    h: 4 + Math.random() * 6,
    color: colors[Math.floor(Math.random() * colors.length)],
    speed: 3 + Math.random() * 4,
    angle: Math.random() * Math.PI * 2,
    spin: (Math.random() - 0.5) * 0.2,
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
    if (any && Date.now() - startTime < 3500) {
      frame = requestAnimationFrame(draw);
    } else {
      cancelAnimationFrame(frame);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      canvas.style.display = 'none';
    }
  }
  draw();
}

/* ─── INIT ────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initDrawingControls();

  const saved = tryRejoin();
  if (saved) {
    ps.name = saved.name;
    ps.roomCode = saved.roomCode;
    DgDB.getState(saved.roomCode).then(game => {
      if (game && game.status !== 'over' && game.joined && game.joined[saved.name]) {
        // Determine team
        if (game.teamA?.players?.includes(saved.name)) ps.myTeam = 'A';
        else if (game.teamB?.players?.includes(saved.name)) ps.myTeam = 'B';
        connectToGame(saved.roomCode);
      } else {
        sessionStorage.removeItem(SESSION_KEY);
        initJoinForm();
        setView('viewJoin');
      }
    }).catch(() => {
      initJoinForm();
      setView('viewJoin');
    });
  } else {
    initJoinForm();
    setView('viewJoin');
  }
});
