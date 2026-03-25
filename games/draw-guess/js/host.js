/**
 * Draw & Guess — Host Controller
 */

/* ─── CHANNEL ─────────────────────────────────────────────── */
const channel = new BroadcastChannel('draw-guess-game');

/* ─── STATE ───────────────────────────────────────────────── */
let state = {
  roomCode: '',
  teamA: { name: 'Team A', players: [] },
  teamB: { name: 'Team B', players: [] },
  difficulty: 'mixed',
  totalRounds: 10,
  timerDuration: 90,
  currentRound: 0,
  round: null,
  scores: { A: 0, B: 0 },
  usedWords: new Set(),
  drawOrder: [],
  currentWord: '',
  timerHandle: null,
  timerEnd: null,
  unsub: null,
  tvConnected: false,
  playerUrl: '',
  guessLog: [],
};

/* ─── HELPERS ─────────────────────────────────────────────── */
function $(sel) { return document.querySelector(sel); }
function $$(sel) { return document.querySelectorAll(sel); }

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function pickWord(difficulty) {
  let pool = [];
  if (difficulty === 'mixed') {
    pool = [...DG_WORDS.easy, ...DG_WORDS.medium, ...DG_WORDS.hard];
  } else {
    pool = [...(DG_WORDS[difficulty] || DG_WORDS.easy)];
  }
  const available = pool.filter(w => !state.usedWords.has(w));
  if (available.length === 0) {
    // All words used — reset used words (except current)
    state.usedWords.clear();
    return pool[Math.floor(Math.random() * pool.length)];
  }
  return available[Math.floor(Math.random() * available.length)];
}

function buildDrawOrder(teamA, teamB, totalRounds) {
  const order = [];
  let ai = 0, bi = 0;
  for (let i = 0; i < totalRounds; i++) {
    if (i % 2 === 0) {
      order.push({ team: 'A', drawer: teamA.players[ai % teamA.players.length] });
      ai++;
    } else {
      order.push({ team: 'B', drawer: teamB.players[bi % teamB.players.length] });
      bi++;
    }
  }
  return order;
}

/* ─── SERVER STATUS ───────────────────────────────────────── */
function updateServerStatus() {
  const bar = document.getElementById('serverStatusBar');
  if (!bar) return;
  if (DgDB.isFirebase) {
    bar.textContent = '✓ Firebase connected';
    bar.className = 'server-status-bar server-status--ok';
  } else {
    bar.textContent = '⚠ Firebase not configured — game requires Firebase';
    bar.className = 'server-status-bar server-status--warn';
  }
}

/* ─── SETUP FORM ──────────────────────────────────────────── */
function initSetupForm() {
  updateServerStatus();

  // Add initial player rows
  addPlayerRow('A');
  addPlayerRow('B');

  // Difficulty buttons
  $$('.diff-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.diff-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.difficulty = btn.dataset.diff;
    });
  });

  // Round buttons
  $$('.round-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.round-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.totalRounds = parseInt(btn.dataset.rounds, 10);
    });
  });

  // Timer select
  document.getElementById('timerSelect').addEventListener('change', e => {
    state.timerDuration = parseInt(e.target.value, 10);
  });

  // Add player buttons
  $$('.btn-add-player').forEach(btn => {
    btn.addEventListener('click', () => addPlayerRow(btn.dataset.team));
  });

  // Form submit
  document.getElementById('setupForm').addEventListener('submit', async e => {
    e.preventDefault();
    await startGame();
  });
}

function addPlayerRow(team) {
  const container = document.getElementById(`team${team}Players`);
  const rows = container.querySelectorAll('.player-row');
  if (rows.length >= 6) return;

  const idx = rows.length + 1;
  const row = document.createElement('div');
  row.className = 'player-row';
  row.innerHTML = `
    <input type="text" class="player-input" placeholder="Player ${idx}" maxlength="20" />
    <button type="button" class="player-remove-btn" title="Remove">✕</button>
  `;
  row.querySelector('.player-remove-btn').addEventListener('click', () => {
    row.remove();
    renumberPlayers(team);
  });
  container.appendChild(row);
}

function renumberPlayers(team) {
  const container = document.getElementById(`team${team}Players`);
  container.querySelectorAll('.player-input').forEach((inp, i) => {
    if (!inp.value) inp.placeholder = `Player ${i + 1}`;
  });
}

function getTeamPlayers(team) {
  const container = document.getElementById(`team${team}Players`);
  return Array.from(container.querySelectorAll('.player-input'))
    .map(inp => inp.value.trim())
    .filter(Boolean);
}

/* ─── START GAME ──────────────────────────────────────────── */
async function startGame() {
  const teamAName = document.getElementById('teamAName').value.trim() || 'Team A';
  const teamBName = document.getElementById('teamBName').value.trim() || 'Team B';
  const teamAPlayers = getTeamPlayers('A');
  const teamBPlayers = getTeamPlayers('B');

  if (teamAPlayers.length < 1 || teamBPlayers.length < 1) {
    alert('Each team needs at least one player!');
    return;
  }
  if (teamAPlayers.length + teamBPlayers.length < 2) {
    alert('Need at least 2 players total!');
    return;
  }

  const submitBtn = $('#setupForm button[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Creating game…';

  try {
    const code = generateRoomCode();
    state.roomCode = code;
    state.teamA = { name: teamAName, players: teamAPlayers };
    state.teamB = { name: teamBName, players: teamBPlayers };
    state.scores = { A: 0, B: 0 };
    state.currentRound = 0;
    state.usedWords = new Set();
    state.drawOrder = buildDrawOrder(state.teamA, state.teamB, state.totalRounds);
    state.guessLog = [];

    await DgDB.createGame(code, state.teamA, state.teamB, state.totalRounds);

    // Build player URL
    const playerUrl = `${location.origin}${location.pathname.replace('host.html', 'player.html')}?room=${code}`;
    state.playerUrl = playerUrl;

    // Open TV
    const tvUrl = `${location.pathname.replace('host.html', 'tv.html')}?room=${code}`;
    window.open(tvUrl, '_blank');

    // Switch to game screen
    document.body.className = 'dg-host-body';
    document.getElementById('setupScreen').classList.add('hidden');
    document.getElementById('gameScreen').classList.remove('hidden');

    // Update UI
    document.getElementById('roomCodeDisplay').textContent = code;
    document.getElementById('teamANameDisplay').textContent = teamAName;
    document.getElementById('teamBNameDisplay').textContent = teamBName;
    document.getElementById('scoreA').textContent = '0';
    document.getElementById('scoreB').textContent = '0';

    // Wire header buttons
    document.getElementById('openTvBtn').addEventListener('click', () => {
      window.open(tvUrl, '_blank');
    });
    document.getElementById('showScoresBtn').addEventListener('click', () => {
      channel.postMessage({ type: 'SCORES_UPDATE', scores: state.scores, teamAName: state.teamA.name, teamBName: state.teamB.name });
    });
    document.getElementById('endGameBtn').addEventListener('click', () => {
      if (confirm('End the game now?')) endGame();
    });
    document.getElementById('startRoundBtn').addEventListener('click', () => beginGame());
    document.getElementById('endRoundBtn').addEventListener('click', () => {
      if (confirm('End round early?')) handleTimeout();
    });
    document.getElementById('nextRoundBtn').addEventListener('click', () => nextRound());
    document.getElementById('endFromResultBtn').addEventListener('click', () => endGame());

    // Show lobby overlay
    document.getElementById('lobbyOverlay').classList.remove('hidden');
    document.getElementById('beginGameBtn').addEventListener('click', () => {
      if (state.teamA.players.length + state.teamB.players.length < 2) return;
      beginGame();
    });

    // Show round setup
    showRoundSetupInfo();
    initHostSubscription();

    // Broadcast GAME_INIT after a moment (TV needs to load)
    setTimeout(() => {
      channel.postMessage({ type: 'GAME_INIT', roomCode: code, playerUrl });
    }, 800);

    // Watch for TV heartbeat
    window.addEventListener('message', e => {
      if (e.data === 'dg-tv-ready') setTvConnected(true);
    });

  } catch (err) {
    console.error('startGame error:', err);
    alert('Failed to create game: ' + err.message);
    submitBtn.disabled = false;
    submitBtn.textContent = '🎮 Create Game';
  }
}

function setTvConnected(val) {
  state.tvConnected = val;
  const el = document.getElementById('tvStatus');
  if (el) {
    el.textContent = val ? 'TV: connected ✓' : 'TV: not connected';
    el.className = 'tv-status' + (val ? ' tv-status--ok' : '');
  }
}

/* ─── HOST SUBSCRIPTION ───────────────────────────────────── */
function initHostSubscription() {
  if (state.unsub) state.unsub();
  state.unsub = DgDB.subscribeHost(state.roomCode, {
    onPlayerJoined(name, joined) {
      const names = Object.keys(joined);
      updateLobbyChips(names);
      channel.postMessage({ type: 'PLAYER_JOINED', name, joinedNames: names });
      setTvConnected(true);
    },
    onGuessSubmitted(guess) {
      addGuessToLog(guess);
      if (state.round && guess.text.trim().toLowerCase() === state.currentWord.toLowerCase()) {
        handleCorrectGuess(guess.player);
      }
    },
  });
}

function updateLobbyChips(names) {
  const chips = document.getElementById('lobbyChips');
  const count = document.getElementById('lobbyCount');
  if (!chips) return;
  chips.innerHTML = names.map(n => `<span class="lobby-chip">${n}</span>`).join('');
  if (count) count.textContent = `${names.length} player${names.length !== 1 ? 's' : ''} joined`;
}

function addGuessToLog(guess) {
  const isCorrect = state.round && guess.text.trim().toLowerCase() === state.currentWord.toLowerCase();
  state.guessLog.push({ ...guess, isCorrect });

  const logEl = document.getElementById('guessLog');
  const listEl = document.getElementById('guessLogList');
  if (logEl) logEl.classList.remove('hidden');
  if (listEl) {
    const item = document.createElement('div');
    item.className = 'guess-item' + (isCorrect ? ' guess-item--correct' : '');

    const textSpan = document.createElement('span');
    textSpan.className = 'guess-item-text';
    textSpan.textContent = `${guess.player}: ${guess.text}${isCorrect ? ' ✓' : ''}`;
    item.appendChild(textSpan);

    if (!isCorrect) {
      const btn = document.createElement('button');
      btn.className = 'guess-correct-btn';
      btn.textContent = '✓ Correct';
      btn.addEventListener('click', () => handleCorrectGuess(guess.player));
      item.appendChild(btn);
    }

    listEl.appendChild(item);
    listEl.scrollTop = listEl.scrollHeight;
  }
}

/* ─── BEGIN GAME ──────────────────────────────────────────── */
function beginGame() {
  document.getElementById('lobbyOverlay').classList.add('hidden');
  DgDB.beginGame(state.roomCode);
  channel.postMessage({ type: 'BEGIN_GAME' });
  showNextRound();
}

/* ─── ROUND SETUP INFO ────────────────────────────────────── */
function showRoundSetupInfo() {
  const nextIdx = state.currentRound; // 0-based index of NEXT round
  const infoEl = document.getElementById('roundSetupInfo');
  if (!infoEl) return;
  if (nextIdx >= state.totalRounds) {
    infoEl.textContent = 'All rounds complete!';
    return;
  }
  const next = state.drawOrder[nextIdx];
  const teamName = next.team === 'A' ? state.teamA.name : state.teamB.name;
  const roundNum = nextIdx + 1;
  infoEl.innerHTML = `Round <strong>${roundNum}/${state.totalRounds}</strong> — <span class="team-${next.team.toLowerCase()}-text">${teamName}</span> draws next — <strong>${next.drawer}</strong> is the drawer`;

  // Show/hide end from result button based on whether this is last round
  const endFromResult = document.getElementById('endFromResultBtn');
  if (endFromResult) {
    endFromResult.classList.toggle('hidden', nextIdx < state.totalRounds - 1);
  }
}

/* ─── NEXT ROUND ──────────────────────────────────────────── */
function showNextRound() {
  state.currentRound++;

  if (state.currentRound > state.totalRounds) {
    endGame();
    return;
  }

  // Reset guess log for this round
  state.guessLog = [];
  const listEl = document.getElementById('guessLogList');
  if (listEl) listEl.innerHTML = '';
  const logEl = document.getElementById('guessLog');
  if (logEl) logEl.classList.add('hidden');

  // Get drawer info
  const drawInfo = state.drawOrder[state.currentRound - 1];
  const word = pickWord(state.difficulty);
  state.currentWord = word;
  state.usedWords.add(word);

  const drawingTeam = drawInfo.team;
  const drawer = drawInfo.drawer;

  const timerEnd = Date.now() + state.timerDuration * 1000 + 3000;
  const roundObj = {
    num: state.currentRound,
    total: state.totalRounds,
    drawingTeam,
    drawer,
    word,
    timerEnd,
    duration: state.timerDuration,
    guesser: null,
  };
  state.round = roundObj;

  DgDB.startRound(state.roomCode, roundObj);

  // Broadcast to TV (no word!)
  channel.postMessage({
    type: 'ROUND_START',
    drawingTeam,
    teamAName: state.teamA.name,
    teamBName: state.teamB.name,
    drawer,
    num: state.currentRound,
    total: state.totalRounds,
    duration: state.timerDuration,
    timerEnd,
    wordLength: word.length,
    wordSpaces: word.split('').map(c => c === ' ' ? ' ' : '_').join(' '),
  });

  // Update host UI
  showRoundPanel(drawingTeam, drawer, word, state.currentRound, state.totalRounds);

  // Start timer
  startTimer(timerEnd);
}

function showRoundPanel(drawingTeam, drawer, word, num, total) {
  $('#roundSetup').classList.add('hidden');
  $('#roundResult').classList.add('hidden');
  $('#roundPanel').classList.remove('hidden');

  const teamName = drawingTeam === 'A' ? state.teamA.name : state.teamB.name;
  document.getElementById('roundProgress').textContent = `Round ${num} / ${total}`;
  document.getElementById('roundTeamBadge').textContent = `${teamName} draws — ${drawer}`;
  document.getElementById('roundTeamBadge').className = `round-drawing-team team-${drawingTeam.toLowerCase()}-badge`;
  document.getElementById('roundWord').textContent = word;
}

/* ─── TIMER ───────────────────────────────────────────────── */
function startTimer(timerEnd) {
  if (state.timerHandle) clearInterval(state.timerHandle);
  state.timerEnd = timerEnd;
  state.timerHandle = setInterval(() => {
    const remaining = Math.max(0, Math.ceil((state.timerEnd - Date.now()) / 1000));
    document.getElementById('roundTimerDisplay').textContent = remaining + 's';
    if (remaining <= 0) {
      clearInterval(state.timerHandle);
      state.timerHandle = null;
      handleTimeout();
    }
  }, 500);
}

function stopTimer() {
  if (state.timerHandle) clearInterval(state.timerHandle);
  state.timerHandle = null;
}

/* ─── CORRECT GUESS ───────────────────────────────────────── */
function handleCorrectGuess(guesserName) {
  stopTimer();

  // Use Firebase transaction to handle race conditions
  DgDB.db.ref(`dg/${state.roomCode}/round/guesser`).transaction(current => {
    if (current === null) return guesserName;
    return undefined; // abort if already set
  }).then(result => {
    if (result.committed) {
      // Disable all manual-correct buttons so host can't double-score
      document.querySelectorAll('.guess-correct-btn').forEach(b => { b.disabled = true; });

      const newScores = { ...state.scores };
      newScores[state.round.drawingTeam] = (newScores[state.round.drawingTeam] || 0) + 1;
      state.scores = newScores;

      DgDB.setGuessed(state.roomCode, guesserName, state.round.drawingTeam, newScores);

      channel.postMessage({
        type: 'ROUND_OVER',
        result: 'guessed',
        word: state.currentWord,
        guesser: guesserName,
        drawingTeam: state.round.drawingTeam,
        scores: newScores,
      });

      updateScoreDisplay(newScores);
      showRoundResult('guessed', state.currentWord, guesserName);
    }
  }).catch(err => {
    // If no Firebase transaction available (shouldn't happen), fallback
    console.error('Transaction error:', err);
    const newScores = { ...state.scores };
    newScores[state.round.drawingTeam] = (newScores[state.round.drawingTeam] || 0) + 1;
    state.scores = newScores;
    DgDB.setGuessed(state.roomCode, guesserName, state.round.drawingTeam, newScores);
    channel.postMessage({ type: 'ROUND_OVER', result: 'guessed', word: state.currentWord, guesser: guesserName, drawingTeam: state.round.drawingTeam, scores: newScores });
    updateScoreDisplay(newScores);
    showRoundResult('guessed', state.currentWord, guesserName);
  });
}

/* ─── TIMEOUT ─────────────────────────────────────────────── */
function handleTimeout() {
  stopTimer();
  DgDB.setTimeout_(state.roomCode);
  channel.postMessage({
    type: 'ROUND_OVER',
    result: 'timeout',
    word: state.currentWord,
    drawingTeam: state.round ? state.round.drawingTeam : null,
    scores: state.scores,
  });
  showRoundResult('timeout', state.currentWord, null);
}

function showRoundResult(result, word, guesser) {
  $('#roundPanel').classList.add('hidden');
  $('#roundSetup').classList.add('hidden');
  const resultEl = $('#roundResult');
  resultEl.classList.remove('hidden');

  const textEl = document.getElementById('roundResultText');
  const wordEl = document.getElementById('roundResultWord');

  if (result === 'guessed') {
    textEl.innerHTML = `<span class="result-guessed">✓ ${guesser} guessed it!</span>`;
  } else {
    textEl.innerHTML = `<span class="result-timeout">⏰ Time's up!</span>`;
  }
  wordEl.innerHTML = `The word was: <strong class="result-word">${word}</strong>`;

  // Show next/end buttons
  const nextBtn = document.getElementById('nextRoundBtn');
  const endBtn = document.getElementById('endFromResultBtn');
  if (state.currentRound >= state.totalRounds) {
    nextBtn.classList.add('hidden');
    endBtn.classList.remove('hidden');
  } else {
    nextBtn.classList.remove('hidden');
    endBtn.classList.add('hidden');
  }
}

/* ─── NEXT ROUND BUTTON ───────────────────────────────────── */
function nextRound() {
  DgDB.nextRound(state.roomCode);
  channel.postMessage({ type: 'NEXT_ROUND' });
  document.getElementById('guessLogList').innerHTML = '';
  document.getElementById('guessLog').classList.add('hidden');
  $('#roundResult').classList.add('hidden');
  $('#roundPanel').classList.add('hidden');
  $('#roundSetup').classList.remove('hidden');
  showRoundSetupInfo();
  setTimeout(() => showNextRound(), 500);
}

/* ─── END GAME ────────────────────────────────────────────── */
function endGame() {
  stopTimer();
  DgDB.endGame(state.roomCode);
  const winner = state.scores.A > state.scores.B
    ? state.teamA.name
    : state.scores.B > state.scores.A
      ? state.teamB.name
      : 'Tie!';
  channel.postMessage({
    type: 'GAME_OVER',
    scores: state.scores,
    teamAName: state.teamA.name,
    teamBName: state.teamB.name,
    winner,
  });

  // Show game over on host
  document.getElementById('gameScreen').innerHTML = `
    <div class="host-gameover">
      <div class="host-gameover-trophy">🏆</div>
      <h1>Game Over!</h1>
      <div class="host-gameover-winner">${winner}</div>
      <div class="host-gameover-scores">
        <div class="host-go-score team-a-go">${state.teamA.name}: ${state.scores.A}</div>
        <div class="host-go-score team-b-go">${state.teamB.name}: ${state.scores.B}</div>
      </div>
      <button class="btn btn-primary" onclick="location.reload()">Play Again</button>
    </div>
  `;
}

/* ─── SCORE DISPLAY ───────────────────────────────────────── */
function updateScoreDisplay(scores) {
  document.getElementById('scoreA').textContent = scores.A || 0;
  document.getElementById('scoreB').textContent = scores.B || 0;
}

/* ─── INIT ────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  document.body.className = 'dg-setup-body';
  initSetupForm();
});
