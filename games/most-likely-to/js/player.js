/**
 * Most Likely To — Player Controller
 */

/* ─── STATE ───────────────────────────────────────────────── */
let playerState = {
  name: '',
  roomCode: '',
  myVote: null,
  score: 0,
  unsub: null,
  voteHistory: [],
  musicCtx: null,
  musicInterval: null,
  currentQuestion: null,
};

const SESSION_KEY = 'mltPlayer';

/* ─── VIEW MANAGEMENT ─────────────────────────────────────── */
function setView(view) {
  const views = ['viewJoin', 'viewWaiting', 'viewVoting', 'viewVoted', 'viewResult', 'viewGameover'];
  views.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('hidden', id !== view);
  });

  if (view === 'viewWaiting') {
    startWaitingMusic();
  } else {
    stopWaitingMusic();
  }
}

/* ─── SESSION STORAGE ─────────────────────────────────────── */
function saveSession() {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({
    name: playerState.name,
    roomCode: playerState.roomCode,
  }));
}

function tryRejoin() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
    if (saved && saved.name && saved.roomCode) return saved;
  } catch {}
  return null;
}

/* ─── WAITING MUSIC ───────────────────────────────────────── */
function startWaitingMusic() {
  if (playerState.musicCtx) return;
  try {
    playerState.musicCtx = new (window.AudioContext || window.webkitAudioContext)();
  } catch { return; }

  const ctx = playerState.musicCtx;
  const notes = [523, 659, 784, 880, 523, 659, 784, 880, 1047];
  let noteIndex = 0;

  function playNote(freq) {
    if (!playerState.musicCtx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.85);
    } catch {}
  }

  playerState.musicInterval = setInterval(() => {
    playNote(notes[noteIndex % notes.length]);
    noteIndex++;
  }, 600);
}

function stopWaitingMusic() {
  if (playerState.musicInterval) {
    clearInterval(playerState.musicInterval);
    playerState.musicInterval = null;
  }
  if (playerState.musicCtx) {
    try { playerState.musicCtx.close(); } catch {}
    playerState.musicCtx = null;
  }
}

/* ─── JOIN FORM ───────────────────────────────────────────── */
function initJoinForm() {
  const params = new URLSearchParams(window.location.search);
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
  });

  nameSelect.addEventListener('change', () => {
    joinBtn.disabled = !nameSelect.value;
    nameMsg.textContent = '';
  });

  async function loadRoomPlayers(code) {
    roomMsg.textContent = 'Looking up room…';
    roomMsg.className = 'room-status-msg';
    try {
      const game = await MltDB.getState(code);
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

      // Populate name select
      nameSelect.innerHTML = '<option value="">— pick your name —</option>';
      const joined = game.joined || {};
      (game.playerNames || []).forEach(name => {
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

  document.getElementById('joinForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = roomInput.value.trim().toUpperCase();
    const name = nameSelect.value;
    if (!code || !name) return;

    joinBtn.disabled = true;
    joinBtn.textContent = 'Joining…';
    try {
      await MltDB.joinGame(code, name);
      playerState.name = name;
      playerState.roomCode = code;
      playerState.score = 0;
      saveSession();
      connectToGame(code);
    } catch (err) {
      if (err.status === 409) {
        nameMsg.textContent = 'That name was just taken. Please pick another.';
        const opt = nameSelect.querySelector(`option[value="${CSS.escape(name)}"]`);
        if (opt) { opt.disabled = true; opt.textContent += ' (taken)'; }
        nameSelect.value = '';
        joinBtn.disabled = true;
        joinBtn.textContent = 'Start Playing 🎉';
      } else {
        nameMsg.textContent = 'Join failed: ' + err.message;
        joinBtn.disabled = false;
        joinBtn.textContent = 'Start Playing 🎉';
      }
    }
  });
}

/* ─── CONNECT TO GAME ─────────────────────────────────────── */
function connectToGame(room) {
  if (playerState.unsub) playerState.unsub();

  updateScoreDisplays();
  setView('viewWaiting');

  playerState.unsub = MltDB.subscribePlayer(room, {
    playerName: playerState.name,

    onState(game) {
      if (game.status === 'question' && game.currentQuestion) {
        // Merge top-level playerNames into question if not present
        const q = { ...game.currentQuestion };
        if (!q.playerNames || q.playerNames.length === 0) {
          q.playerNames = game.playerNames || [];
        }
        playerState.currentQuestion = q;
        showVotingScreen(q);
      } else if (game.status === 'results' && game.lastResult) {
        showResultScreen(game.lastResult);
      } else if (game.status === 'over') {
        showGameoverScreen(game.scores || {});
      } else {
        setView('viewWaiting');
        document.getElementById('waitingTitle').textContent = 'Get ready!';
        document.getElementById('waitingSub').textContent = 'Waiting for the host to start…';
      }
    },

    onQuestionStart(q) {
      playerState.myVote = null;
      playerState.currentQuestion = q;
      showVotingScreen(q);
    },

    onNextQuestion() {
      playerState.myVote = null;
      setView('viewWaiting');
      document.getElementById('waitingTitle').textContent = 'Nice!';
      document.getElementById('waitingSub').textContent = 'Next question coming up…';
    },

    onResult(result) {
      // Check if I got a point
      const gotPoint = result.pointGetters.includes(playerState.name);
      if (gotPoint) {
        playerState.score += 1;
        updateScoreDisplays();
        launchConfetti();
      }

      // Record history
      playerState.voteHistory.push({
        questionText: result.questionText,
        myVote: playerState.myVote,
        winners: result.winners,
        gotPoint,
      });

      showResultScreen(result);
    },

    onGameOver(scores) {
      showGameoverScreen(scores);
    },
  });
}

/* ─── UPDATE SCORE DISPLAYS ───────────────────────────────── */
function updateScoreDisplays() {
  const score = playerState.score;
  const els = ['waitingScore', 'votingScore', 'votedScore', 'resultScore', 'gameoverScore'];
  els.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = score;
  });
}

/* ─── VOTING SCREEN ───────────────────────────────────────── */
function showVotingScreen(question) {
  document.getElementById('votingProgress').textContent = `Q ${question.index}/${question.total}`;
  document.getElementById('votingQuestion').textContent = question.text;
  updateScoreDisplays();

  const choices = document.getElementById('votingChoices');
  choices.innerHTML = '';

  // All players are choices (can vote for yourself too)
  const playerNames = question.playerNames || [];
  playerNames.forEach((name, i) => {
    const btn = document.createElement('button');
    btn.className = 'choice-btn';
    btn.dataset.colorIndex = i % 6;
    btn.textContent = name;
    btn.addEventListener('click', () => castVote(name));
    choices.appendChild(btn);
  });

  setView('viewVoting');
}

async function castVote(chosenName) {
  if (playerState.myVote) return; // already voted
  playerState.myVote = chosenName;

  try {
    await MltDB.submitVote(playerState.roomCode, playerState.name, chosenName);
    document.getElementById('myVoteDisplay').textContent = chosenName;
    updateScoreDisplays();
    setView('viewVoted');
  } catch (err) {
    console.error('Vote failed:', err);
    playerState.myVote = null;
  }
}

/* ─── RESULT SCREEN ───────────────────────────────────────── */
function showResultScreen(result) {
  const gotPoint = result.pointGetters.includes(playerState.name);
  const winnerText = result.winners.length ? result.winners.join(' & ') : 'No one';

  const banner = document.getElementById('resultPointBanner');
  if (gotPoint) {
    banner.innerHTML = '<div class="point-banner point-banner--yes">🎉 You got a point!</div>';
  } else {
    const myVote = playerState.myVote;
    if (myVote && result.winners.length && !result.winners.includes(myVote)) {
      banner.innerHTML = `<div class="point-banner point-banner--no">You voted for ${myVote} — winner was ${winnerText}</div>`;
    } else if (!myVote) {
      banner.innerHTML = '<div class="point-banner point-banner--neutral">You didn\'t vote this round</div>';
    } else {
      banner.innerHTML = '';
    }
  }

  document.getElementById('resultWinnerName').textContent = winnerText;

  // Vote summary
  const summary = document.getElementById('resultVoteSummary');
  const vbc = result.votesByChoice || {};
  const lines = Object.entries(vbc)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([name, votes]) => `
      <div class="result-vote-line ${result.winners.includes(name) ? 'result-vote-line--winner' : ''}">
        <span>${name}</span><span>${votes} vote${votes !== 1 ? 's' : ''}</span>
      </div>
    `).join('');
  summary.innerHTML = lines || '<p>No votes were cast.</p>';

  updateScoreDisplays();
  setView('viewResult');
}

/* ─── GAMEOVER SCREEN ─────────────────────────────────────── */
function showGameoverScreen(scores) {
  updateScoreDisplays();

  const historyList = document.getElementById('voteHistoryList');
  if (playerState.voteHistory.length === 0) {
    historyList.innerHTML = '<p>No vote history.</p>';
  } else {
    historyList.innerHTML = playerState.voteHistory.map((entry, i) => `
      <div class="history-entry ${entry.gotPoint ? 'history-entry--point' : ''}">
        <div class="history-q">Q${i + 1}: ${entry.questionText}</div>
        <div class="history-meta">
          <span>You voted: <strong>${entry.myVote || '—'}</strong></span>
          <span>Winner: <strong>${entry.winners.join(' & ') || 'No one'}</strong></span>
          ${entry.gotPoint ? '<span class="history-point-badge">+1 ✓</span>' : ''}
        </div>
      </div>
    `).join('');
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
  const colors = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#f97316'];

  const pieces = Array.from({ length: 120 }, () => ({
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

  let frame;
  const startTime = Date.now();

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let anyVisible = false;
    pieces.forEach(p => {
      p.y += p.speed;
      p.x += p.drift;
      p.angle += p.spin;
      if (p.y < canvas.height + 20) anyVisible = true;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    });

    const elapsed = Date.now() - startTime;
    if (anyVisible && elapsed < 3500) {
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
  // Try to rejoin from session
  const saved = tryRejoin();
  if (saved) {
    playerState.name = saved.name;
    playerState.roomCode = saved.roomCode;
    // Verify session is still valid
    MltDB.getState(saved.roomCode).then(game => {
      if (game && game.status !== 'over' && game.joined && game.joined[saved.name]) {
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
