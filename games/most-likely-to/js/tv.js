/**
 * Most Likely To — TV Display Controller
 */

/* ─── CONSTANTS ──────────────────────────────────────────── */
const CHANNEL_NAME = 'most-likely-to-game';

/* ─── STATE ───────────────────────────────────────────────── */
let tvState = {
  roomCode: '',
  playerNames: [],
  currentQuestion: null,
  votesByChoice: {},
  _tvDb: null,
};

/* ─── BROADCAST CHANNEL ───────────────────────────────────── */
const channel = new BroadcastChannel(CHANNEL_NAME);

channel.onmessage = (e) => {
  const { type, payload } = e.data;
  switch (type) {
    case 'GAME_INIT':       handleGameInit(payload);       break;
    case 'PLAYER_JOINED':   handlePlayerJoined(payload);   break;
    case 'BEGIN_GAME':      handleBeginGame(payload);      break;
    case 'QUESTION_START':  handleQuestionStart(payload);  break;
    case 'VOTE_UPDATE':     handleVoteUpdate(payload);     break;
    case 'VOTING_CLOSED':   handleVotingClosed(payload);   break;
    case 'NEXT_QUESTION':   handleNextQuestion(payload);   break;
    case 'SCORES_UPDATE':   handleScoresUpdate(payload);   break;
    case 'GAME_OVER':       handleGameOver(payload);       break;
  }
};

/* ─── VIEW MANAGEMENT ─────────────────────────────────────── */
function setView(view) {
  document.getElementById('tvLobby').classList.toggle('hidden', view !== 'lobby');
  document.getElementById('tvQuestion').classList.toggle('hidden', view !== 'question');
  document.getElementById('tvGameover').classList.toggle('hidden', view !== 'gameover');
}

/* ─── HANDLERS ────────────────────────────────────────────── */
function handleGameInit(payload) {
  tvState.roomCode = payload.roomCode;
  tvState.playerNames = payload.playerNames || [];

  document.getElementById('tvRoomCode').textContent = payload.roomCode;
  document.getElementById('tvQProgress').style.display = 'none';

  setView('lobby');

  // Generate QR code
  const qrEl = document.getElementById('tvQrCode');
  qrEl.innerHTML = '';
  if (payload.playerUrl && window.QRCode) {
    new QRCode(qrEl, {
      text: payload.playerUrl,
      width: 220,
      height: 220,
      colorDark: '#1e293b',
      colorLight: '#ffffff',
    });
  }

  const urlEl = document.getElementById('tvPlayerUrl');
  if (urlEl) urlEl.textContent = (payload.playerUrl || '').replace(/^https?:\/\//, '');

  // Show current joined players (if any)
  renderLobbyChips(tvState.playerNames.map(() => null));
}

function handlePlayerJoined(payload) {
  renderLobbyChips(payload.joinedNames || []);
  document.getElementById('tvLobbyStatus').textContent =
    `${(payload.joinedNames || []).length} player${(payload.joinedNames || []).length !== 1 ? 's' : ''} joined — waiting for host…`;
}

function handleBeginGame() {
  document.getElementById('tvLobbyStatus').textContent = 'Game starting!';
  document.getElementById('tvLobbyStatus').style.fontWeight = '700';
}

function handleQuestionStart(payload) {
  tvState.currentQuestion = payload;
  tvState.playerNames = payload.playerNames || tvState.playerNames;
  tvState.votesByChoice = {};
  tvState.playerNames.forEach(n => { tvState.votesByChoice[n] = 0; });

  document.getElementById('tvQuestionText').textContent = payload.text;

  const progressEl = document.getElementById('tvQProgress');
  progressEl.textContent = `Q ${payload.index} / ${payload.total}`;
  progressEl.style.display = 'block';

  renderVoteCards(false, null);
  setView('question');
}

function handleVoteUpdate(payload) {
  tvState.votesByChoice = payload.votesByChoice || {};
  renderVoteCards(false, null);
}

function handleVotingClosed(payload) {
  const result = payload.result;
  tvState.votesByChoice = result.votesByChoice || {};
  renderVoteCards(true, result);
}

function handleNextQuestion() {
  setView('lobby');
  document.getElementById('tvLobbyStatus').textContent = 'Next question coming up…';
  document.getElementById('tvQProgress').style.display = 'none';
}

function handleScoresUpdate(payload) {
  showScoresOverlay(payload.scores);
}

function handleGameOver(payload) {
  const scores = payload.scores || {};
  const winners = Array.isArray(payload.winner) ? payload.winner : [payload.winner];

  document.getElementById('tvWinner').innerHTML =
    `<div class="tv-gameover-label">Winner${winners.length > 1 ? 's' : ''}!</div>
     <div class="tv-gameover-names">${winners.join(' & ')}</div>`;

  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  document.getElementById('tvFinalScores').innerHTML = sorted
    .map(([name, pts], i) => `
      <div class="tv-final-score-row ${winners.includes(name) ? 'tv-final-score-row--winner' : ''}">
        <span class="tv-final-rank">${i + 1}</span>
        <span class="tv-final-name">${name}</span>
        <span class="tv-final-pts">${pts} pt${pts !== 1 ? 's' : ''}</span>
      </div>
    `).join('');

  document.getElementById('tvQProgress').style.display = 'none';
  setView('gameover');
}

/* ─── LOBBY CHIPS ─────────────────────────────────────────── */
function renderLobbyChips(names) {
  const container = document.getElementById('tvPlayerChips');
  container.innerHTML = '';
  names.forEach(name => {
    const chip = document.createElement('div');
    chip.className = 'tv-player-chip';
    chip.textContent = name;
    container.appendChild(chip);
  });
}

/* ─── VOTE CARDS ──────────────────────────────────────────── */
function renderVoteCards(revealed, result) {
  const grid = document.getElementById('tvVoteGrid');
  const names = tvState.playerNames;
  const vbc = tvState.votesByChoice;

  const totalVotes = Object.values(vbc).reduce((s, v) => s + v, 0);
  const maxVotes = Math.max(...Object.values(vbc), 0);
  const winners = result ? result.winners : [];

  // Build allVotes map for showing who voted for whom
  const allVotes = result ? (result.allVotes || {}) : {};

  grid.innerHTML = '';
  names.forEach(name => {
    const votes = vbc[name] || 0;
    const pct = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
    const isWinner = revealed && winners.includes(name);

    // Voters who chose this person
    const voterNames = revealed
      ? Object.entries(allVotes).filter(([, choice]) => choice === name).map(([voter]) => voter)
      : [];

    const card = document.createElement('div');
    card.className = `tv-vote-card${isWinner ? ' tv-vote-card--winner' : ''}`;

    card.innerHTML = `
      <div class="tv-vote-card-name">${name}</div>
      <div class="tv-vote-bar-wrap">
        <div class="tv-vote-bar" style="--bar-pct: ${pct}%"></div>
      </div>
      <div class="tv-vote-count">${votes} vote${votes !== 1 ? 's' : ''}</div>
      ${revealed && voterNames.length ? `<div class="tv-vote-voters">${voterNames.join(', ')}</div>` : ''}
    `;

    if (isWinner) {
      card.style.animation = 'winner-glow 1.2s ease-in-out infinite';
    }

    grid.appendChild(card);
  });
}

/* ─── SCORES OVERLAY ──────────────────────────────────────── */
function showScoresOverlay(scores) {
  const overlay = document.getElementById('tvScoresOverlay');
  const content = document.getElementById('tvScoresContent');
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  content.innerHTML = `
    <h2 class="scores-overlay-title">Scores</h2>
    ${sorted.map(([name, pts], i) => `
      <div class="scores-overlay-row">
        <span class="scores-rank">${i + 1}</span>
        <span class="scores-name">${name}</span>
        <span class="scores-pts">${pts} pt${pts !== 1 ? 's' : ''}</span>
      </div>
    `).join('')}
  `;
  overlay.classList.remove('hidden');
  setTimeout(() => overlay.classList.add('hidden'), 8000);
}

/* ─── FIREBASE DIRECT SUBSCRIPTION ───────────────────────── */
function initTvFirebase() {
  const cfg = window.FIREBASE_CONFIG;
  if (!window.firebase || !cfg || cfg.apiKey === 'REPLACE_ME') return;
  try {
    let app;
    try { app = firebase.app('mlt-tv'); }
    catch { app = firebase.initializeApp(cfg, 'mlt-tv'); }
    tvState._tvDb = firebase.database(app);
  } catch(e) {
    console.warn('TV Firebase init failed:', e);
  }
}

/* ─── INIT ROOM ───────────────────────────────────────────── */
function initRoom(roomCode) {
  if (!roomCode || roomCode === tvState.roomCode) return;
  tvState.roomCode = roomCode;
  document.getElementById('tvRoomCode').textContent = roomCode;

  if (!tvState._tvDb) { setView('lobby'); return; }

  tvState._tvDb.ref(`mlt/${roomCode}`).once('value').then(snap => {
    if (!snap.exists()) { setView('lobby'); return; }
    const g = snap.val();
    tvState.playerNames = g.playerNames
      ? (Array.isArray(g.playerNames) ? g.playerNames : Object.values(g.playerNames))
      : [];

    if (g.status === 'question' && g.currentQuestion) {
      handleGameInit({ roomCode, playerNames: tvState.playerNames, playerUrl: '' });
      handleQuestionStart(g.currentQuestion);
    } else if (g.status === 'results' && g.lastResult) {
      handleGameInit({ roomCode, playerNames: tvState.playerNames, playerUrl: '' });
      handleVotingClosed({ result: g.lastResult });
    } else if (g.status === 'over') {
      const scores = g.scores || {};
      const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
      const winners = sorted.length ? sorted.filter(([, v]) => v === sorted[0][1]).map(([k]) => k) : [];
      handleGameOver({ scores, winner: winners });
    } else {
      handleGameInit({ roomCode, playerNames: tvState.playerNames, playerUrl: '' });
    }
  }).catch(() => setView('lobby'));
}

/* ─── INIT ────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initTvFirebase();
  setView('lobby');

  // Signal host that TV is ready
  channel.postMessage({ type: 'TV_READY', payload: {}, ts: Date.now() });

  // Read URL params
  const params = new URLSearchParams(window.location.search);
  const hostId = params.get('host');
  const roomFromUrl = params.get('room');

  if (hostId && tvState._tvDb) {
    // Watch for host's current room — auto-updates when new game starts
    tvState._tvDb.ref(`mlt/hosts/${hostId}/room`).on('value', snap => {
      const newRoom = snap.val();
      if (newRoom && newRoom !== tvState.roomCode) {
        initRoom(newRoom);
      }
    });
  } else if (roomFromUrl) {
    initRoom(roomFromUrl);
  }
});
