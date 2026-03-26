/**
 * Movie Emoji Game — Host Controller
 *
 * New in this version:
 *  - Origin filter: All / Bollywood / Hollywood
 *  - Genre filter: multi-select chips (setup) → dropdown (in-game)
 *  - Question mode: Manual (host picks) or Random (auto-playlist)
 *  - 🎲 Random Pick button: picks unused question from filtered pool
 *  - Playlist mode: pre-shuffled ordered list, reshuffling supported
 */

/* ─── CONSTANTS ──────────────────────────────────────────── */
const CHANNEL_NAME = 'movie-emoji-game';
const TEAM_COLORS  = ['team-a', 'team-b', 'team-c', 'team-d'];
const TEAM_PALETTE = ['var(--clr-primary)', 'var(--clr-secondary)', 'var(--clr-success)', 'var(--clr-warning)'];

/* ─── STATE ───────────────────────────────────────────────── */
let state = {
  mode:           'teams',
  entities:       [],
  roomCode:       generateRoomCode(),
  timerDefault:   60,
  usedIds:        new Set(),
  currentQ:       null,
  currentCat:     'easy',
  revealedParts:  new Set(),
  tvConnected:    false,
  timerHandle:    null,
  timerValue:     0,
  showingSentToTv: false,

  // ── Filter state ──
  filter: {
    origin: 'all',       // 'all' | 'bollywood' | 'hollywood'
    genres: ['all'],     // ['all'] or array like ['romance','action']
  },

  // ── Question selection mode ──
  qMode:       'manual',   // 'manual' | 'random'
  playlist:    [],         // Question[] — ordered list for random mode
  playlistIdx: -1,         // current playlist position (-1 = not started)
  playlistTotal: 15,       // total questions in playlist

  // ── Cross-device ──
  playerUrl:        '',    // URL for player.html shown in QR code
  tvUrl:            '',    // Stable TV URL (host-based)
  sseUnsub:         null,  // unsubscribe fn for GameDB subscription
  serverAvailable:  false, // true when server/Firebase is reachable
  awardedPlayers:   new Set(),   // players who received points this round
  submittedAnswers: {},          // latest answers from GameDB subscription
};

/* ─── BROADCAST CHANNEL ───────────────────────────────────── */
const channel = new BroadcastChannel(CHANNEL_NAME);

channel.onmessage = (e) => {
  const { type, payload } = e.data;
  if (type === 'TV_READY') {
    state.tvConnected = true;
    updateTVStatus(true);
    broadcast('GAME_INIT', buildGameInitPayload());
    if (state.currentQ && state.showingSentToTv) {
      broadcast('QUESTION_START', buildQuestionPayload());
      state.revealedParts.forEach(part => broadcast(revealMsg(part), { text: revealText(part) }));
    }
  }
};

function broadcast(type, payload = {}) {
  channel.postMessage({ type, payload, ts: Date.now() });
}

function revealMsg(part)  { return { title: 'REVEAL_TITLE', actor: 'REVEAL_ACTOR', quote: 'REVEAL_QUOTE' }[part]; }
function revealText(part) { return state.currentQ?.answer[part] || ''; }

/* ─── UTILITIES ───────────────────────────────────────────── */
function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function getMeHostId() {
  let id = localStorage.getItem('me_host_id');
  if (!id) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    id = Array.from({ length: 8 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    localStorage.setItem('me_host_id', id);
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

function $(sel, root = document) { return root.querySelector(sel); }
function $$(sel, root = document) { return [...root.querySelectorAll(sel)]; }

function buildGameInitPayload() {
  return {
    mode: state.mode, entities: state.entities,
    roomCode: state.roomCode, usedIds: [...state.usedIds],
    playerUrl: state.playerUrl,
  };
}

/* ─── SERVER / FIREBASE STATUS ────────────────────────────── */
async function fetchConfig() {
  if (window.GameDB?.isFirebase) {
    state.playerUrl       = new URL('player.html', location.href).href;
    state.serverAvailable = true;
    setServerStatus(true, 'firebase');
    return;
  }
  try {
    const res = await fetch('/api/config');
    if (!res.ok) throw new Error('no server');
    const cfg = await res.json();
    state.playerUrl       = cfg.playerUrl || '';
    state.serverAvailable = true;
    setServerStatus(true, 'server');
  } catch {
    state.playerUrl       = new URL('player.html', location.href).href;
    state.serverAvailable = false;
    setServerStatus(false);
  }
}

function setServerStatus(online, mode) {
  const dot     = document.getElementById('serverDot');
  const text    = document.getElementById('serverStatusText');
  const warning = document.getElementById('serverWarning');
  if (!dot || !text) return;
  dot.classList.toggle('online',  online);
  dot.classList.toggle('offline', !online);
  if (mode === 'firebase' && online) {
    text.textContent = '✓ Cloud server ready — players can join from anywhere';
    warning?.classList.add('hidden');
  } else if (mode === 'server' && online) {
    text.textContent = '✓ Local server running — players can join on this network';
    warning?.classList.add('hidden');
  } else {
    text.textContent = 'Game server not available';
    warning?.classList.remove('hidden');
  }
}

/* ─── SUBSCRIBE TO PLAYER EVENTS ─────────────────────────── */
function initPlayerSubscription() {
  if (state.sseUnsub) state.sseUnsub();
  state.sseUnsub = GameDB.subscribeHost(state.roomCode, {
    onPlayerJoined: (name, joined) => {
      updateJoinStatus(joined);
      broadcast('PLAYER_JOINED', { name, joined });
      updateLobbyCount(joined);
    },
    onPlayerSubmitted: (name, totalSubmitted, totalJoined) => {
      markSubmitted(name, totalSubmitted, totalJoined);
      broadcast('PLAYER_SUBMITTED', { name, totalSubmitted, totalJoined });
    },
    onAnswersUpdated: (answers) => {
      state.submittedAnswers = answers || {};
      renderPlayerAnswers(answers);
    },
  });
}

/* ─── LOBBY ────────────────────────────────────────────────── */
function showLobbyOverlay() {
  document.getElementById('hostLobbyOverlay')?.classList.remove('hidden');
  updateLobbyCount(state.entities.reduce((acc, e) => { acc[e.name] = false; return acc; }, {}));
}

function updateLobbyCount(joined) {
  const overlay = document.getElementById('hostLobbyOverlay');
  if (!overlay || overlay.classList.contains('hidden')) return;
  const count  = Object.keys(joined).length;
  const total  = state.entities.length;
  const countEl = document.getElementById('hostLobbyCount');
  const listEl  = document.getElementById('hostLobbyPlayers');
  if (countEl) countEl.textContent = `${count} / ${total} player${total !== 1 ? 's' : ''} joined`;
  if (listEl) {
    listEl.innerHTML = state.entities.map(e => {
      const has = !!joined[e.name];
      return `<span class="lobby-player-chip${has ? ' joined' : ''}">${e.name}${has ? ' ✓' : ''}</span>`;
    }).join('');
  }
}

function beginGame() {
  document.getElementById('hostLobbyOverlay')?.classList.add('hidden');
  GameDB.beginGame(state.roomCode);
  broadcast('BEGIN_GAME', {});
}

/* ─── PLAYER ANSWERS DISPLAY ───────────────────────────────── */
function renderPlayerAnswers(answers) {
  const area = document.getElementById('hostAnswersArea');
  const list = document.getElementById('hostAnswersList');
  if (!area || !list) return;
  if (!answers || Object.keys(answers).length === 0) {
    area.classList.add('hidden');
    return;
  }
  area.classList.remove('hidden');
  list.innerHTML = Object.entries(answers).map(([name, ans]) => `
    <div class="host-answer-row-item">
      <strong>${name}</strong>
      <span>${[ans.movie, ans.actor, ans.quote].filter(Boolean).join(' · ') || '(no answer)'}</span>
    </div>
  `).join('');
}

/* ─── PLAYER JOIN STATUS ──────────────────────────────────── */
function updateJoinStatus(joined) {
  state.entities.forEach(entity => {
    const dot = document.getElementById(`joinDot-${entity.id}`);
    if (!dot) return;
    const hasJoined = !!joined[entity.name];
    dot.classList.toggle('lit', hasJoined);
    dot.title = hasJoined ? `${entity.name} ✓ joined` : `${entity.name} — not joined`;
  });
}

/* ─── SUBMISSION BUBBLES ──────────────────────────────────── */
function clearSubmissions() {
  const area    = document.getElementById('hostSubsArea');
  const bubbles = document.getElementById('hostSubsBubbles');
  if (area) area.classList.add('hidden');
  if (bubbles) bubbles.innerHTML = '';
}

function markSubmitted(name, totalSubmitted, totalJoined) {
  const area    = document.getElementById('hostSubsArea');
  const bubbles = document.getElementById('hostSubsBubbles');
  if (!area || !bubbles) return;
  area.classList.remove('hidden');
  const label = area.querySelector('.host-subs-label');
  if (label) label.textContent = `Answered ${totalSubmitted} / ${totalJoined}`;
  // Don't add duplicate
  if (bubbles.querySelector(`[data-name="${CSS.escape(name)}"]`)) return;
  const b = document.createElement('span');
  b.className  = 'sub-bubble anim-pop-in';
  b.dataset.name = name;
  b.textContent = name;
  bubbles.appendChild(b);
}

function buildQuestionPayload() {
  if (!state.currentQ) return {};
  const allQ = Object.values(MOVIE_EMOJI_QUESTIONS).flat();
  return {
    id:         state.currentQ.id,
    difficulty: state.currentQ.difficulty,
    origin:     state.currentQ.origin,
    emojis:     state.currentQ.emojis,
    points:     state.currentQ.points,
    index:      state.usedIds.size + 1,
    total:      state.qMode === 'random' ? state.playlist.length : allQ.length,
  };
}

/* ─── FILTER HELPERS ──────────────────────────────────────── */
/**
 * Apply current state.filter to an array of questions.
 */
function applyFilter(questions) {
  return filterQuestions(questions, state.filter.origin, state.filter.genres);
}

/**
 * Get filtered questions for the current category.
 */
function getFilteredForCat(cat) {
  return applyFilter(MOVIE_EMOJI_QUESTIONS[cat] || []);
}

/* ─── TV STATUS ───────────────────────────────────────────── */
function updateTVStatus(connected) {
  const el  = $('#hostTvStatus');
  const txt = $('#tvStatusText');
  if (!el || !txt) return;
  el.classList.toggle('connected', connected);
  txt.textContent = connected ? 'TV: Connected ✓' : 'TV: Not connected';
}

/* ══════════════════════════════════════════════════════════
   SETUP
   ══════════════════════════════════════════════════════════ */
function initSetup() {
  const form         = $('#setupForm');
  const teamsConfig  = $('#teamsConfig');
  const indivConfig  = $('#individualConfig');
  const playersList  = $('#playersList');
  const addPlayerBtn = $('#addPlayerBtn');

  /* ── Game mode toggle ── */
  $$('input[name="mode"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const isTeams = radio.value === 'teams';
      teamsConfig.classList.toggle('hidden', !isTeams);
      indivConfig.classList.toggle('hidden', isTeams);
      $('#modeTeamsOption').classList.toggle('selected', isTeams);
      $('#modeIndividualOption').classList.toggle('selected', !isTeams);
    });
  });

  /* ── Origin pills ── */
  $$('.origin-pill', $('#originPills')).forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.origin-pill', $('#originPills')).forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.filter.origin = btn.dataset.origin;
    });
  });

  /* ── Genre chips ── */
  const genreChips = $('#genreChips');
  genreChips.addEventListener('change', (e) => {
    const allChip = genreChips.querySelector('input[value="all"]');
    if (e.target.value === 'all') {
      // Deselect all others
      $$('input[type="checkbox"]', genreChips).forEach(cb => {
        cb.checked = cb.value === 'all';
        cb.parentElement.classList.toggle('selected', cb.value === 'all');
      });
    } else {
      // Deselect "All" if a specific genre is picked
      if (e.target.checked) {
        allChip.checked = false;
        allChip.parentElement.classList.remove('selected');
      }
      // If nothing is checked, re-check All
      const anyChecked = $$('input[type="checkbox"]', genreChips).some(cb => cb.value !== 'all' && cb.checked);
      if (!anyChecked) {
        allChip.checked = true;
        allChip.parentElement.classList.add('selected');
      }
      e.target.parentElement.classList.toggle('selected', e.target.checked);
    }
    // Update state
    const selected = $$('input[type="checkbox"]:checked', genreChips).map(cb => cb.value);
    state.filter.genres = selected.length ? selected : ['all'];
  });

  /* ── Question mode toggle ── */
  const playlistField = $('#playlistLengthField');
  $$('input[name="qmode"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const isRandom = radio.value === 'random';
      playlistField.classList.toggle('hidden', !isRandom);
      $('#qModeManualOption').classList.toggle('selected', !isRandom);
      $('#qModeRandomOption').classList.toggle('selected', isRandom);
      state.qMode = radio.value;
    });
  });

  /* ── Playlist length buttons ── */
  $$('.length-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.length-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.playlistTotal = parseInt(btn.dataset.total, 10);
    });
  });

  /* ── Add / remove player rows ── */
  addPlayerBtn.addEventListener('click', () => {
    if ($$('.setup-player-row', playersList).length >= 16) return;
    const row = document.createElement('div');
    row.className = 'setup-player-row';
    row.innerHTML = `
      <input class="setup-input player-name-input" placeholder="Player or couple name" maxlength="24" />
      <button type="button" class="btn btn-ghost btn-sm remove-player" aria-label="Remove player">✕</button>
    `;
    playersList.appendChild(row);
    row.querySelector('input').focus();
  });

  playersList.addEventListener('click', (e) => {
    if (e.target.classList.contains('remove-player')) {
      const rows = $$('.setup-player-row', playersList);
      if (rows.length <= 1) return;
      e.target.closest('.setup-player-row').remove();
    }
  });

  /* ── Form submit ── */
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const mode = $('input[name="mode"]:checked')?.value || 'teams';
    state.mode       = mode;
    state.roomCode   = generateRoomCode();
    state.timerDefault = parseInt($('#timerDuration').value, 10) || 0;
    state.qMode      = $('input[name="qmode"]:checked')?.value || 'manual';

    if (mode === 'teams') {
      const t1 = $('#team1Name').value.trim() || 'Team A';
      const t2 = $('#team2Name').value.trim() || 'Team B';
      state.entities = [
        { id: 'team-0', name: t1, score: 0, colorClass: TEAM_COLORS[0], color: TEAM_PALETTE[0] },
        { id: 'team-1', name: t2, score: 0, colorClass: TEAM_COLORS[1], color: TEAM_PALETTE[1] },
      ];
    } else {
      const names = $$('.player-name-input').map(inp => inp.value.trim()).filter(Boolean);
      if (!names.length) { alert('Add at least one player name.'); return; }
      state.entities = names.map((name, i) => ({
        id: `player-${i}`, name, score: 0,
        colorClass: TEAM_COLORS[i % TEAM_COLORS.length],
        color:      TEAM_PALETTE[i % TEAM_PALETTE.length],
      }));
    }

    startGame();
  });
}

/* ══════════════════════════════════════════════════════════
   GAME START
   ══════════════════════════════════════════════════════════ */
function startGame() {
  const hostId = getMeHostId();

  $('#hostSetup').classList.add('hidden');
  $('#hostGame').classList.remove('hidden');
  $('#hostRoomCode').textContent = state.roomCode;

  // Build playlist if random mode
  if (state.qMode === 'random') {
    state.playlist    = buildRandomPlaylist(state.playlistTotal, state.filter.origin, state.filter.genres);
    state.playlistIdx = -1;
  }

  // Register game on server / Firebase (enables cross-device player join)
  const playerNames = state.entities.map(e => e.name);
  GameDB.createGame(state.roomCode, state.mode, playerNames);
  GameDB.setHostRoom(hostId, state.roomCode);
  initPlayerSubscription();
  showLobbyOverlay();

  renderScores();
  initCategoryTabs();
  initInGameFilters();
  initControlButtons();
  renderQuestionGrid(state.currentCat);

  if (state.timerDefault > 0) $('#timerBtn').classList.remove('hidden');

  // Build stable TV URL and show link panel
  const tvUrl = `tv.html?host=${hostId}`;
  state.tvUrl = tvUrl;
  showTvLinkPanel(tvUrl);

  broadcast('GAME_INIT', buildGameInitPayload());
}

/* ── Open TV window ── */
function openTvWindow() {
  showTvLinkPanel(state.tvUrl || `tv.html?host=${getMeHostId()}`);
}

/* ══════════════════════════════════════════════════════════
   IN-GAME FILTERS
   ══════════════════════════════════════════════════════════ */
function initInGameFilters() {
  /* ── Origin pills ── */
  $$('.origin-pill', $('#inGameOriginPills')).forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.origin-pill', $('#inGameOriginPills')).forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.filter.origin = btn.dataset.origin;
      renderQuestionGrid(state.currentCat);
    });
  });

  /* ── Genre dropdown ── */
  const genreSel = $('#inGameGenreSelect');
  if (genreSel) {
    genreSel.addEventListener('change', () => {
      state.filter.genres = [genreSel.value]; // single-select in-game
      renderQuestionGrid(state.currentCat);
    });
  }

  /* ── Random Pick button ── */
  $('#randomPickBtn')?.addEventListener('click', pickRandomQuestion);

  /* ── Reshuffle button (random mode only) ── */
  $('#reshuffleBtn')?.addEventListener('click', () => {
    if (!confirm('Reshuffle the remaining unplayed questions?')) return;
    const played = state.playlist.slice(0, state.playlistIdx + 1);
    const remaining = state.playlist.slice(state.playlistIdx + 1);
    state.playlist = [...played, ...remaining.sort(() => Math.random() - 0.5)];
    renderQuestionGrid(state.currentCat);
  });

  /* ── Show/hide playlist bar ── */
  if (state.qMode === 'random') {
    $('#hostPlaylistBar').classList.remove('hidden');
    $('#hostQPickerHeading').textContent = 'Playlist — click to play';
    updatePlaylistProgress();
  }
}

function updatePlaylistProgress() {
  const bar = $('#playlistProgress');
  if (!bar) return;
  const done  = state.usedIds.size;
  const total = state.playlist.length;
  bar.textContent = `${done} / ${total} played`;
}

/* ══════════════════════════════════════════════════════════
   SCORES
   ══════════════════════════════════════════════════════════ */
function renderScores() {
  const container = $('#hostScores');
  container.innerHTML = '<div class="scores-heading">Scores</div>';
  state.entities.forEach(entity => {
    const dot = state.mode === 'individual'
      ? `<span class="join-dot" id="joinDot-${entity.id}" title="${entity.name} — not joined"></span>`
      : '';
    const card = document.createElement('div');
    card.className = `score-card ${entity.colorClass}`;
    card.id = `scoreCard-${entity.id}`;
    card.innerHTML = `
      <div style="display:flex;align-items:center;gap:.4rem">
        ${dot}
        <div class="score-card-name">${entity.name}</div>
      </div>
      <div class="score-card-pts ${entity.colorClass}" id="scorePts-${entity.id}">${entity.score}</div>
      <div class="score-card-sub">points</div>
    `;
    container.appendChild(card);
  });
}

function updateScore(entityId, delta) {
  const entity = state.entities.find(e => e.id === entityId);
  if (!entity) return;
  entity.score = Math.max(0, entity.score + delta);
  const el = $(`#scorePts-${entityId}`);
  if (el) {
    el.textContent = entity.score;
    el.classList.remove('anim-pop-in');
    void el.offsetWidth;
    el.classList.add('anim-pop-in');
  }
  // Persist latest scores to Firebase so TV can always read them
  const scores = {};
  state.entities.forEach(e => { scores[e.name] = e.score; });
  GameDB.updateScores(state.roomCode, scores);
  broadcast('SCORES_UPDATE', { entities: state.entities, delta: { entityId, points: delta } });
}

/* ══════════════════════════════════════════════════════════
   CATEGORY TABS
   ══════════════════════════════════════════════════════════ */
function initCategoryTabs() {
  $$('.host-cat-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      $$('.host-cat-tab').forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected','false'); });
      tab.classList.add('active');
      tab.setAttribute('aria-selected','true');
      state.currentCat = tab.dataset.cat;
      renderQuestionGrid(state.currentCat);
    });
  });
}

/* ══════════════════════════════════════════════════════════
   QUESTION GRID
   ══════════════════════════════════════════════════════════ */
function renderQuestionGrid(category) {
  const grid = $('#hostQGrid');
  grid.innerHTML = '';

  /* ── Random mode: show playlist ── */
  if (state.qMode === 'random') {
    renderPlaylistGrid();
    return;
  }

  /* ── Manual mode: filtered question cards ── */
  const questions = getFilteredForCat(category);

  if (questions.length === 0) {
    grid.innerHTML = '<p style="color:var(--clr-text-muted);font-size:.8rem;padding:.5rem 0">No questions match the current filter.</p>';
    return;
  }

  questions.forEach((q, i) => {
    const isUsed    = state.usedIds.has(q.id);
    const isCurrent = state.currentQ?.id === q.id;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = ['q-btn', isUsed ? 'used' : '', isCurrent ? 'selected' : ''].filter(Boolean).join(' ');
    btn.setAttribute('aria-label', `Q${i+1}: ${q.emojis} (${q.origin === 'bollywood' ? 'Bollywood' : 'Hollywood'})`);
    btn.setAttribute('role', 'listitem');
    btn.innerHTML = `
      <span class="q-btn-emoji">${q.emojis.split(' ').slice(0,2).join('')}</span>
      <span class="q-btn-origin">${q.origin === 'bollywood' ? '🇮🇳' : '🌍'}</span>
      <span class="q-btn-num">${isUsed ? '<span class="q-btn-check">✓</span>' : `#${i+1}`}</span>
    `;
    btn.addEventListener('click', () => selectQuestion(q));
    grid.appendChild(btn);
  });

  updatePlaylistProgress();
}

/* ── Playlist grid (random mode) ── */
function renderPlaylistGrid() {
  const grid = $('#hostQGrid');
  grid.innerHTML = '';

  if (state.playlist.length === 0) {
    grid.innerHTML = '<p style="color:var(--clr-text-muted);font-size:.8rem;padding:.5rem 0">No questions match filter. Adjust origin/genre and restart.</p>';
    return;
  }

  state.playlist.forEach((q, i) => {
    const isUsed    = state.usedIds.has(q.id);
    const isCurrent = state.currentQ?.id === q.id;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = ['q-btn', isUsed ? 'used' : '', isCurrent ? 'selected' : ''].filter(Boolean).join(' ');
    btn.setAttribute('aria-label', `Playlist Q${i+1}: ${q.emojis}`);
    btn.setAttribute('role', 'listitem');
    btn.innerHTML = `
      <span class="q-btn-emoji">${q.emojis.split(' ').slice(0,2).join('')}</span>
      <span class="q-btn-origin">${q.origin === 'bollywood' ? '🇮🇳' : '🌍'}</span>
      <span class="q-btn-num">${isUsed ? '<span class="q-btn-check">✓</span>' : `#${i+1}`}</span>
    `;
    btn.addEventListener('click', () => { state.playlistIdx = i; selectQuestion(q); });
    grid.appendChild(btn);
  });

  updatePlaylistProgress();
}

/* ── Random Pick (manual mode shortcut) ── */
function pickRandomQuestion() {
  const pool = getFilteredForCat(state.currentCat).filter(q => !state.usedIds.has(q.id));
  if (pool.length === 0) {
    alert('All questions in this category/filter have been used! Try a different filter or category.');
    return;
  }
  selectQuestion(pool[Math.floor(Math.random() * pool.length)]);
}

/* ══════════════════════════════════════════════════════════
   QUESTION SELECTION
   ══════════════════════════════════════════════════════════ */
function selectQuestion(q) {
  stopTimer();
  clearSubmissions();
  state.currentQ       = q;
  state.revealedParts  = new Set();
  state.showingSentToTv = false;

  // Show panel
  $('#hostQEmpty').classList.add('hidden');
  $('#hostQDisplay').classList.remove('hidden');

  // Category badge + meta
  const badge = $('#hostQCatBadge');
  badge.textContent = q.difficulty.charAt(0).toUpperCase() + q.difficulty.slice(1);
  badge.className   = `cat-badge ${q.difficulty}`;
  $('#hostQId').textContent = `${q.origin === 'bollywood' ? '🇮🇳' : '🌍'} ${q.id} · ${q.genre}`;
  $('#hostQEmoji').textContent = q.emojis;

  // Answer (host view)
  $('#hostAnswerTitle').textContent = `🎬 ${q.answer.title}`;
  if (q.answer.actor) {
    $('#hostAnswerActor').textContent = `🎭 ${q.answer.actor}`;
    $('#hostAnswerActor').classList.remove('hidden');
  } else {
    $('#hostAnswerActor').classList.add('hidden');
  }
  if (q.answer.quote) {
    $('#hostAnswerQuote').textContent = `💬 ${q.answer.quote}`;
    $('#hostAnswerQuote').classList.remove('hidden');
  } else {
    $('#hostAnswerQuote').classList.add('hidden');
  }

  // Reset send-to-TV button
  const sendBtn = $('#sendToTvBtn');
  sendBtn.textContent = '📺 Show on TV';
  sendBtn.disabled = false;

  renderRevealButtons(q);
  renderAwardButtons(q);
  lockRevealUntilSent(true);
  renderQuestionGrid(state.currentCat); // refresh grid highlight
}

/* ── Reveal buttons ── */
function renderRevealButtons(q) {
  const container = $('#hostRevealBtns');
  container.innerHTML = '';
  const parts = [
    { key: 'title', label: '🎬 Title',    pts: q.points.title },
    ...(q.answer.actor ? [{ key: 'actor', label: '🎭 Actor',  pts: q.points.actor }] : []),
    ...(q.answer.quote ? [{ key: 'quote', label: '💬 Quote',  pts: q.points.quote }] : []),
  ];
  parts.forEach(({ key, label, pts }) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-secondary btn-sm reveal-btn';
    btn.dataset.part = key;
    btn.textContent = `${label} (+${pts}pts)`;
    btn.addEventListener('click', () => revealPart(key));
    container.appendChild(btn);
  });
}

function lockRevealUntilSent(lock) {
  $$('.reveal-btn').forEach(btn => { btn.disabled = lock; });
  $$('.award-comp-btn').forEach(btn => { btn.disabled = lock; });
}

/* ── Award buttons ── */
function renderAwardButtons(q) {
  const grid = $('#hostAwardGrid');
  grid.innerHTML = '';
  const parts = [
    { key: 'title', label: 'Title', pts: q.points.title },
    ...(q.answer.actor ? [{ key: 'actor', label: 'Actor', pts: q.points.actor }] : []),
    ...(q.answer.quote ? [{ key: 'quote', label: 'Quote', pts: q.points.quote }] : []),
  ];
  parts.forEach(({ key, label, pts }) => {
    const row = document.createElement('div');
    row.className = 'host-award-row hidden';
    row.id = `awardRow-${key}`;
    const partLabel = document.createElement('div');
    partLabel.style.cssText = 'font-size:.75rem;color:var(--clr-text-muted);min-width:48px;flex-shrink:0';
    partLabel.textContent = `${label}:`;
    const btnGroup = document.createElement('div');
    btnGroup.className = 'award-comp-btns';
    state.entities.forEach(entity => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-sm award-comp-btn';
      btn.style.cssText = `background:${entity.color};color:#fff;opacity:.85`;
      btn.textContent = `+${pts} ${entity.name}`;
      btn.dataset.entityId = entity.id;
      btn.addEventListener('click', () => {
        btn.disabled = true; btn.style.opacity = '.4';
        updateScore(entity.id, pts);
        // Mark player as correct for cross-device feedback
        if (state.mode === 'individual') {
          state.awardedPlayers.add(entity.name);
          GameDB.pushResult(state.roomCode, entity.name, 'correct');
        }
      });
      btnGroup.appendChild(btn);
    });
    row.appendChild(partLabel);
    row.appendChild(btnGroup);
    grid.appendChild(row);
  });
}

/* ══════════════════════════════════════════════════════════
   SEND TO TV
   ══════════════════════════════════════════════════════════ */
function sendToTV() {
  if (!state.currentQ) return;
  state.showingSentToTv = true;
  broadcast('QUESTION_START', buildQuestionPayload());

  // Push question to player phones
  const timerEnd = state.timerDefault > 0 ? Date.now() + state.timerDefault * 1000 : null;
  GameDB.pushQuestion(state.roomCode, {
    emojis:     state.currentQ.emojis,
    difficulty: state.currentQ.difficulty,
    id:         state.currentQ.id,
  }, timerEnd);

  const btn = $('#sendToTvBtn');
  btn.textContent = '📺 Shown on TV ✓';
  btn.disabled = true;
  lockRevealUntilSent(false);

  // Auto-start timer when question is shown
  if (state.timerDefault > 0) startTimer();
}

/* ══════════════════════════════════════════════════════════
   REVEAL PARTS
   ══════════════════════════════════════════════════════════ */
function revealPart(part) {
  if (!state.currentQ || state.revealedParts.has(part)) return;
  state.revealedParts.add(part);
  const btn = $(`.reveal-btn[data-part="${part}"]`);
  if (btn) { btn.classList.add('revealed'); btn.disabled = true; }
  const row = $(`#awardRow-${part}`);
  if (row) row.classList.remove('hidden');
  broadcast(revealMsg(part), { text: revealText(part) });
  GameDB.pushReveal(state.roomCode, part, revealText(part));
}

/* ══════════════════════════════════════════════════════════
   TIMER
   ══════════════════════════════════════════════════════════ */
function startTimer() {
  if (state.timerHandle) stopTimer();
  state.timerValue = state.timerDefault;
  const bar     = $('#hostTimerBar');
  const display = $('#hostTimerDisplay');
  bar.classList.remove('hidden');
  display.classList.remove('urgent');
  updateTimerDisplay(state.timerValue, display);
  broadcast('TIMER_START', { seconds: state.timerValue });
  state.timerHandle = setInterval(() => {
    state.timerValue--;
    updateTimerDisplay(state.timerValue, display);
    if (state.timerValue <= 10) display.classList.add('urgent');
    if (state.timerValue <= 0) { stopTimer(); broadcast('TIMER_END', {}); }
  }, 1000);
}

function stopTimer() {
  if (state.timerHandle) { clearInterval(state.timerHandle); state.timerHandle = null; }
  $('#hostTimerBar')?.classList.add('hidden');
  broadcast('TIMER_STOP', {});
}

function updateTimerDisplay(val, el) {
  if (!el) return;
  const m = Math.floor(Math.abs(val) / 60);
  const s = Math.abs(val) % 60;
  el.textContent = val <= 0 ? '0:00' : `${m}:${s.toString().padStart(2,'0')}`;
}

/* ══════════════════════════════════════════════════════════
   NEXT / END
   ══════════════════════════════════════════════════════════ */
function nextQuestion() {
  if (state.currentQ) {
    state.usedIds.add(state.currentQ.id);
    // Push 'wrong' to players who answered but weren't awarded
    if (state.mode === 'individual') {
      Object.keys(state.submittedAnswers || {}).forEach(name => {
        if (!state.awardedPlayers.has(name)) {
          GameDB.pushResult(state.roomCode, name, 'wrong');
        }
      });
    }
  }
  state.awardedPlayers   = new Set();
  state.submittedAnswers = {};
  stopTimer();
  state.currentQ        = null;
  state.revealedParts   = new Set();
  state.showingSentToTv = false;
  document.getElementById('hostAnswersArea')?.classList.add('hidden');
  $('#hostQEmpty').classList.remove('hidden');
  $('#hostQDisplay').classList.add('hidden');
  broadcast('NEXT_QUESTION', {});
  GameDB.nextQuestion(state.roomCode);

  // In random mode, auto-advance to next playlist item
  if (state.qMode === 'random') {
    state.playlistIdx++;
    if (state.playlistIdx < state.playlist.length) {
      selectQuestion(state.playlist[state.playlistIdx]);
    } else {
      renderQuestionGrid(state.currentCat);
      alert('🎉 Playlist complete! All questions have been played.');
    }
  } else {
    renderQuestionGrid(state.currentCat);
  }
}

function endGame() {
  if (!confirm('End the game and show final scores?')) return;
  stopTimer();
  const sorted = [...state.entities].sort((a, b) => b.score - a.score);
  const winner = sorted[0]?.name || '—';
  broadcast('GAME_OVER', { entities: sorted, winner });
  const scores = {};
  state.entities.forEach(e => { scores[e.name] = e.score; });
  GameDB.endGame(state.roomCode, scores);
  const panel = $('#hostQPanel');
  panel.innerHTML = `
    <div class="host-q-empty" style="flex:1;gap:1rem">
      <span style="font-size:3rem">🏆</span>
      <strong style="font-size:1.5rem">Game Over!</strong>
      <p>Winner: <strong style="color:var(--clr-secondary)">${winner}</strong></p>
      <div style="display:flex;flex-direction:column;gap:.4rem;text-align:left;width:100%;max-width:240px">
        ${sorted.map((e,i) => `<div style="display:flex;justify-content:space-between;padding:.4rem .6rem;background:var(--clr-surface);border-radius:.5rem"><span>#${i+1} ${e.name}</span><strong>${e.score}pts</strong></div>`).join('')}
      </div>
      <button class="btn btn-primary" onclick="location.href='host.html'">Play Again</button>
    </div>
  `;
}

/* ══════════════════════════════════════════════════════════
   WIRE UP BUTTONS
   ══════════════════════════════════════════════════════════ */
function initControlButtons() {
  $('#openTvBtn').addEventListener('click', openTvWindow);
  $('#sendToTvBtn').addEventListener('click', sendToTV);
  $('#timerBtn').addEventListener('click', startTimer);
  $('#stopTimerBtn').addEventListener('click', stopTimer);
  $('#nextQBtn').addEventListener('click', nextQuestion);
  $('#endGameBtn').addEventListener('click', endGame);
  document.getElementById('beginGameBtn')?.addEventListener('click', beginGame);
  document.getElementById('copyTvLinkBtn')?.addEventListener('click', () => {
    navigator.clipboard.writeText(state.tvUrl).then(() => {
      document.getElementById('copyTvLinkBtn').textContent = 'Copied!';
      setTimeout(() => { document.getElementById('copyTvLinkBtn').textContent = 'Copy Link'; }, 2000);
    });
  });
  document.getElementById('closeTvLinkBtn')?.addEventListener('click', () => {
    document.getElementById('tvLinkPanel').classList.add('hidden');
  });
}

/* ══════════════════════════════════════════════════════════
   BOOT
   ══════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  fetchConfig();  // pre-load network IP for QR code
  initSetup();
});
