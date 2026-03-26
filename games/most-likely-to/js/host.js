/**
 * Most Likely To — Host Controller
 */

/* ─── CONSTANTS ──────────────────────────────────────────── */
const CHANNEL_NAME = 'most-likely-to-game';

/* ─── STATE ───────────────────────────────────────────────── */
let state = {
  roomCode: '',
  playerNames: [],
  questions: [],
  questionIndex: 0,
  totalQuestions: 10,
  currentQuestion: null,
  votes: {},
  scores: {},
  unsub: null,
  tvConnected: false,
  timerDuration: 60,
  timerHandle: null,
  timerEnd: null,
  votingOpen: false,
  playerUrl: '',
  tvUrl: '',
};

/* ─── BROADCAST CHANNEL ───────────────────────────────────── */
const channel = new BroadcastChannel(CHANNEL_NAME);

channel.onmessage = (e) => {
  const { type, payload } = e.data;
  if (type === 'TV_READY') {
    state.tvConnected = true;
    updateTvStatus(true);
    broadcast('GAME_INIT', {
      roomCode: state.roomCode,
      playerUrl: state.playerUrl,
      playerNames: state.playerNames,
    });
  }
};

function broadcast(type, payload = {}) {
  channel.postMessage({ type, payload, ts: Date.now() });
}

/* ─── UTILITIES ───────────────────────────────────────────── */
function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function getMltHostId() {
  let id = localStorage.getItem('mlt_host_id');
  if (!id) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    id = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    localStorage.setItem('mlt_host_id', id);
  }
  return id;
}

function showTvLinkPanel(url) {
  const panel = document.getElementById('tvLinkPanel');
  const urlEl = document.getElementById('tvLinkUrl');
  if (!panel || !urlEl) return;
  urlEl.textContent = url;
  panel.classList.toggle('hidden');
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function updateTvStatus(connected) {
  const el = document.getElementById('tvStatus');
  if (!el) return;
  el.textContent = connected ? 'TV: connected ✓' : 'TV: not connected';
  el.className = connected ? 'tv-status tv-status--connected' : 'tv-status';
}

/* ─── SETUP FORM ──────────────────────────────────────────── */
function initSetupForm() {
  const form = document.getElementById('setupForm');
  const addPlayerBtn = document.getElementById('addPlayerBtn');
  const playerList = document.getElementById('playerList');

  // Show Firebase status
  updateServerStatus();

  // Add initial player rows
  addPlayerRow();
  addPlayerRow();

  addPlayerBtn.addEventListener('click', () => {
    const rows = playerList.querySelectorAll('.player-row');
    if (rows.length >= 8) return;
    addPlayerRow();
    if (playerList.querySelectorAll('.player-row').length >= 8) {
      addPlayerBtn.disabled = true;
      addPlayerBtn.textContent = 'Max 8 players';
    }
  });

  // Q count buttons
  document.querySelectorAll('.q-count-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.q-count-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.totalQuestions = parseInt(btn.dataset.count, 10);
    });
  });

  // Timer select
  const timerSelect = document.getElementById('timerSelect');
  timerSelect.addEventListener('change', () => {
    state.timerDuration = parseInt(timerSelect.value, 10);
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    startGame();
  });
}

function addPlayerRow() {
  const playerList = document.getElementById('playerList');
  const idx = playerList.querySelectorAll('.player-row').length + 1;
  const row = document.createElement('div');
  row.className = 'player-row';
  row.innerHTML = `
    <input type="text" class="player-name-input" placeholder="Player ${idx}" maxlength="20" />
    <button type="button" class="btn-remove-player" title="Remove">✕</button>
  `;
  row.querySelector('.btn-remove-player').addEventListener('click', () => {
    row.remove();
    const addBtn = document.getElementById('addPlayerBtn');
    addBtn.disabled = false;
    addBtn.textContent = '+ Add Player';
    renumberPlayerRows();
  });
  playerList.appendChild(row);
}

function renumberPlayerRows() {
  document.querySelectorAll('.player-name-input').forEach((inp, i) => {
    if (!inp.value) inp.placeholder = `Player ${i + 1}`;
  });
}

function updateServerStatus() {
  const bar = document.getElementById('serverStatusBar');
  if (!bar) return;
  if (MltDB.isFirebase) {
    bar.className = 'server-status-bar server-status--ok';
    bar.textContent = 'Firebase connected — multiplayer ready';
  } else {
    bar.className = 'server-status-bar server-status--warn';
    bar.textContent = 'Firebase not configured — multiplayer unavailable';
  }
}

/* ─── START GAME ──────────────────────────────────────────── */
async function startGame() {
  // Collect player names
  const names = [];
  document.querySelectorAll('.player-name-input').forEach((inp, i) => {
    const val = inp.value.trim() || `Player ${i + 1}`;
    names.push(val);
  });

  if (names.length < 2) {
    alert('Add at least 2 players.');
    return;
  }

  state.roomCode = generateRoomCode();
  state.playerNames = names;
  state.scores = {};
  names.forEach(n => { state.scores[n] = 0; });
  state.questionIndex = 0;
  state.votes = {};
  state.votingOpen = false;

  // Select and shuffle questions
  const shuffled = shuffle(MLT_QUESTIONS);
  state.questions = shuffled.slice(0, Math.min(state.totalQuestions, shuffled.length));

  // Build player URL
  const base = window.location.href.replace('host.html', 'player.html');
  state.playerUrl = `${base}?room=${state.roomCode}`;

  const hostId = getMltHostId();

  try {
    await MltDB.createGame(state.roomCode, state.playerNames, state.questions.length);
    await MltDB.setHostRoom(hostId, state.roomCode);
  } catch (err) {
    alert('Failed to create game: ' + err.message);
    return;
  }

  // Build TV URL (stable host-based URL)
  const tvUrl = `tv.html?host=${hostId}`;
  state.tvUrl = tvUrl;

  // Show game screen
  document.getElementById('setupScreen').classList.add('hidden');
  document.getElementById('gameScreen').classList.remove('hidden');
  document.getElementById('roomCodeDisplay').textContent = state.roomCode;

  // Show TV link panel
  showTvLinkPanel(tvUrl);

  // Wire copy/close buttons
  document.getElementById('copyTvLinkBtn').addEventListener('click', () => {
    navigator.clipboard.writeText(state.tvUrl).then(() => {
      document.getElementById('copyTvLinkBtn').textContent = 'Copied!';
      setTimeout(() => { document.getElementById('copyTvLinkBtn').textContent = 'Copy Link'; }, 2000);
    });
  });
  document.getElementById('closeTvLinkBtn').addEventListener('click', () => {
    document.getElementById('tvLinkPanel').classList.add('hidden');
  });

  // Init subscription
  initHostSubscription();

  // Update scores panel
  renderScoresPanel();

  // Broadcast init
  broadcast('GAME_INIT', {
    roomCode: state.roomCode,
    playerUrl: state.playerUrl,
    playerNames: state.playerNames,
  });

  // Show lobby overlay
  showLobbyOverlay();

  // Wire buttons
  document.getElementById('openTvBtn').addEventListener('click', () => {
    showTvLinkPanel(state.tvUrl);
  });
  document.getElementById('showScoresBtn').addEventListener('click', () => {
    broadcast('SCORES_UPDATE', { scores: state.scores });
  });
  document.getElementById('endGameBtn').addEventListener('click', () => {
    if (confirm('End the game now?')) endGame();
  });
  document.getElementById('beginGameBtn').addEventListener('click', beginGame);
  document.getElementById('closeVotingBtn').addEventListener('click', closeVoting);
  document.getElementById('nextQBtn').addEventListener('click', nextQuestion);
  document.getElementById('endFromResultBtn').addEventListener('click', () => {
    if (confirm('End the game now?')) endGame();
  });
}

/* ─── LOBBY ───────────────────────────────────────────────── */
function showLobbyOverlay() {
  const overlay = document.getElementById('lobbyOverlay');
  overlay.classList.remove('hidden');
  updateLobbyCount(0);
}

function updateLobbyCount(count) {
  const el = document.getElementById('lobbyCount');
  if (el) el.textContent = `${count} player${count !== 1 ? 's' : ''} joined`;
  const joined = document.getElementById('hostJoinedCount');
  if (joined) joined.textContent = `${count} joined`;
}

/* ─── SUBSCRIPTION ────────────────────────────────────────── */
function initHostSubscription() {
  if (state.unsub) state.unsub();
  state.unsub = MltDB.subscribeHost(state.roomCode, {
    onPlayerJoined(name, joined) {
      const count = Object.keys(joined).length;
      updateLobbyCount(count);
      addLobbyPlayerChip(name);
      broadcast('PLAYER_JOINED', { name, joinedNames: Object.keys(joined) });
    },
    onVoteSubmitted(name, totalVoted, totalJoined, votes) {
      state.votes = votes;
      markVoterChip(name);
      document.getElementById('voteCount').textContent = totalVoted;
      document.getElementById('voteTotal').textContent = totalJoined;

      // Build votesByChoice (counts only, not who voted for whom)
      const votesByChoice = {};
      state.playerNames.forEach(p => { votesByChoice[p] = 0; });
      Object.values(votes).forEach(choice => {
        votesByChoice[choice] = (votesByChoice[choice] || 0) + 1;
      });
      broadcast('VOTE_UPDATE', { votesByChoice });

      // Auto-close if everyone voted
      if (totalVoted >= totalJoined && state.votingOpen) {
        clearTimer();
        closeVoting();
      }
    },
  });
}

function addLobbyPlayerChip(name) {
  const container = document.getElementById('lobbyPlayerChips');
  if (!container) return;
  if (container.querySelector(`[data-name="${CSS.escape(name)}"]`)) return;
  const chip = document.createElement('span');
  chip.className = 'lobby-chip';
  chip.dataset.name = name;
  chip.textContent = name;
  container.appendChild(chip);
}

/* ─── BEGIN GAME ──────────────────────────────────────────── */
async function beginGame() {
  document.getElementById('lobbyOverlay').classList.add('hidden');
  await MltDB.beginGame(state.roomCode);
  broadcast('BEGIN_GAME', {});
  showNextQuestion();
}

/* ─── QUESTION ────────────────────────────────────────────── */
async function showNextQuestion() {
  if (state.questionIndex >= state.questions.length) {
    endGame();
    return;
  }

  const text = state.questions[state.questionIndex];
  const index = state.questionIndex + 1;
  const total = state.questions.length;
  state.currentQuestion = { text, index, total };
  state.votes = {};
  state.votingOpen = true;

  await MltDB.pushQuestion(state.roomCode, { text, index, total, playerNames: state.playerNames });

  broadcast('QUESTION_START', { text, index, total, playerNames: state.playerNames });

  // Update UI
  document.getElementById('hostWaiting').classList.add('hidden');
  document.getElementById('questionPanel').classList.remove('hidden');
  document.getElementById('qProgress').textContent = `Q ${index} / ${total}`;
  document.getElementById('questionText').textContent = text;
  document.getElementById('resultDisplay').classList.add('hidden');
  document.getElementById('nextQBtn').classList.add('hidden');
  document.getElementById('endFromResultBtn').classList.add('hidden');
  document.getElementById('closeVotingBtn').classList.remove('hidden');

  // Vote tracker
  renderVoteTracker();

  // Timer
  if (state.timerDuration > 0) {
    startTimer(state.timerDuration);
  }
}

/* ─── VOTE TRACKER ────────────────────────────────────────── */
function renderVoteTracker() {
  const tracker = document.getElementById('voteTracker');
  const chips = document.getElementById('voterChips');
  tracker.classList.remove('hidden');
  chips.innerHTML = '';

  // Get joined players (all of them)
  state.playerNames.forEach(name => {
    const chip = document.createElement('div');
    chip.className = 'voter-chip';
    chip.id = `voter-${name.replace(/\s+/g, '_')}`;
    chip.innerHTML = `<span class="voter-name">${name}</span><span class="voter-mark">○</span>`;
    chips.appendChild(chip);
  });

  document.getElementById('voteCount').textContent = '0';
  document.getElementById('voteTotal').textContent = state.playerNames.length;
}

function markVoterChip(name) {
  const id = `voter-${name.replace(/\s+/g, '_')}`;
  const chip = document.getElementById(id);
  if (!chip) return;
  chip.classList.add('voted');
  chip.querySelector('.voter-mark').textContent = '✓';
}

/* ─── TIMER ───────────────────────────────────────────────── */
function startTimer(seconds) {
  clearTimer();
  state.timerEnd = Date.now() + seconds * 1000;

  const header = document.getElementById('mltHeader');
  let timerEl = document.getElementById('timerDisplay');
  if (!timerEl) {
    timerEl = document.createElement('div');
    timerEl.id = 'timerDisplay';
    timerEl.className = 'timer-display';
    header.appendChild(timerEl);
  }
  timerEl.classList.remove('hidden', 'timer-urgent');

  function tick() {
    const remaining = Math.max(0, Math.ceil((state.timerEnd - Date.now()) / 1000));
    timerEl.textContent = `⏱ ${remaining}s`;
    if (remaining <= 10) timerEl.classList.add('timer-urgent');
    if (remaining <= 0) {
      clearTimer();
      timerEl.classList.add('hidden');
      if (state.votingOpen) closeVoting();
      return;
    }
    state.timerHandle = setTimeout(tick, 500);
  }
  tick();
}

function clearTimer() {
  if (state.timerHandle) {
    clearTimeout(state.timerHandle);
    state.timerHandle = null;
  }
  const timerEl = document.getElementById('timerDisplay');
  if (timerEl) timerEl.classList.add('hidden');
}

/* ─── CLOSE VOTING ────────────────────────────────────────── */
async function closeVoting() {
  if (!state.votingOpen) return;
  state.votingOpen = false;
  clearTimer();

  document.getElementById('closeVotingBtn').classList.add('hidden');

  const votes = state.votes;
  const playerNames = state.playerNames;

  // Count votes per player
  const votesByChoice = {};
  playerNames.forEach(p => { votesByChoice[p] = 0; });
  Object.values(votes).forEach(choice => {
    votesByChoice[choice] = (votesByChoice[choice] || 0) + 1;
  });

  const maxVotes = Math.max(...Object.values(votesByChoice), 0);
  const winners = maxVotes > 0 ? playerNames.filter(p => votesByChoice[p] === maxVotes) : [];

  // Point getters: winners + voters who voted for a winner
  const winnerSet = new Set(winners);
  const pointGetters = new Set(winners);
  Object.entries(votes).forEach(([voter, choice]) => {
    if (winnerSet.has(choice)) pointGetters.add(voter);
  });

  // Update scores
  const newScores = { ...state.scores };
  pointGetters.forEach(name => {
    newScores[name] = (newScores[name] || 0) + 1;
  });
  state.scores = newScores;

  const result = {
    questionText: state.currentQuestion.text,
    winners: [...winners],
    maxVotes,
    votesByChoice,
    pointGetters: [...pointGetters],
    allVotes: { ...votes },
    scores: newScores,
  };

  await MltDB.closeVoting(state.roomCode, result);
  broadcast('VOTING_CLOSED', { result });

  renderResultDisplay(result);
  renderScoresPanel();

  document.getElementById('nextQBtn').classList.remove('hidden');
  document.getElementById('endFromResultBtn').classList.remove('hidden');
}

function renderResultDisplay(result) {
  const panel = document.getElementById('resultDisplay');
  panel.classList.remove('hidden');

  const winnerText = result.winners.length
    ? result.winners.join(' & ')
    : 'No one';

  const voteLines = state.playerNames
    .filter(p => result.votesByChoice[p] > 0)
    .sort((a, b) => result.votesByChoice[b] - result.votesByChoice[a])
    .map(p => `<div class="result-row ${result.winners.includes(p) ? 'result-row--winner' : ''}">
      <span class="result-name">${p}</span>
      <span class="result-votes">${result.votesByChoice[p]} vote${result.votesByChoice[p] !== 1 ? 's' : ''}</span>
    </div>`)
    .join('');

  panel.innerHTML = `
    <div class="result-winner-display">
      <div class="result-winner-label">Most Likely To…</div>
      <div class="result-winner-name">${winnerText}</div>
      <div class="result-winner-votes">${result.maxVotes} vote${result.maxVotes !== 1 ? 's' : ''}</div>
    </div>
    <div class="result-vote-rows">${voteLines || '<p class="no-votes">No votes cast</p>'}</div>
    <div class="result-point-getters">
      Points to: ${result.pointGetters.length ? result.pointGetters.join(', ') : 'No one'}
    </div>
  `;
}

/* ─── NEXT QUESTION ───────────────────────────────────────── */
async function nextQuestion() {
  state.questionIndex++;
  if (state.questionIndex >= state.questions.length) {
    endGame();
    return;
  }
  await MltDB.nextQuestion(state.roomCode);
  broadcast('NEXT_QUESTION', {});
  document.getElementById('resultDisplay').classList.add('hidden');
  document.getElementById('nextQBtn').classList.add('hidden');
  document.getElementById('endFromResultBtn').classList.add('hidden');
  setTimeout(() => showNextQuestion(), 800);
}

/* ─── SCORES PANEL ────────────────────────────────────────── */
function renderScoresPanel() {
  const panel = document.getElementById('scoresPanel');
  if (!panel) return;

  const sorted = [...state.playerNames].sort((a, b) => (state.scores[b] || 0) - (state.scores[a] || 0));
  panel.innerHTML = `<div class="scores-panel-title">Scores</div>` +
    sorted.map((name, i) => `
      <div class="score-row ${i === 0 ? 'score-row--leader' : ''}">
        <span class="score-rank">${i + 1}</span>
        <span class="score-name">${name}</span>
        <span class="score-pts">${state.scores[name] || 0}</span>
      </div>
    `).join('');
}

/* ─── END GAME ────────────────────────────────────────────── */
async function endGame() {
  clearTimer();
  state.votingOpen = false;
  await MltDB.endGame(state.roomCode);

  const sorted = [...state.playerNames].sort((a, b) => (state.scores[b] || 0) - (state.scores[a] || 0));
  const topScore = state.scores[sorted[0]] || 0;
  const winners = sorted.filter(n => (state.scores[n] || 0) === topScore);

  broadcast('GAME_OVER', { scores: state.scores, winner: winners });

  // Show game over in host UI
  document.getElementById('questionPanel').classList.add('hidden');
  document.getElementById('hostWaiting').classList.remove('hidden');
  document.getElementById('hostWaiting').innerHTML = `
    <div class="gameover-host">
      <div class="gameover-trophy">🏆</div>
      <h2>Game Over!</h2>
      <div class="gameover-winner">Winner${winners.length > 1 ? 's' : ''}: ${winners.join(' & ')}</div>
      <div class="gameover-scores">
        ${sorted.map((n, i) => `<div class="score-row"><span>${i+1}. ${n}</span><span>${state.scores[n] || 0} pts</span></div>`).join('')}
      </div>
    </div>
  `;
}

/* ─── INIT ────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initSetupForm();
});
