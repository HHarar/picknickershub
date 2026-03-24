/**
 * Movie Emoji Game — Host Controller
 *
 * Responsibilities:
 *  - Setup form → game configuration
 *  - BroadcastChannel sender (→ tv.html)
 *  - Question selection, reveal control, point awarding
 *  - Timer management
 *  - Game state persistence via localStorage
 */

/* ─── CONSTANTS ──────────────────────────────────────────── */
const CHANNEL_NAME = 'movie-emoji-game';
const STORAGE_KEY  = 'mego-host-state';
const TEAM_COLORS  = ['team-a', 'team-b', 'team-c', 'team-d'];
const TEAM_PALETTE = ['var(--clr-primary)', 'var(--clr-secondary)', 'var(--clr-success)', 'var(--clr-warning)'];

/* ─── STATE ───────────────────────────────────────────────── */
let state = {
  mode:         'teams',        // 'teams' | 'individual'
  entities:     [],             // [{id, name, score, colorClass}] — teams or players
  roomCode:     generateRoomCode(),
  timerDefault: 60,             // seconds, 0 = no timer
  usedIds:      new Set(),
  currentQ:     null,           // current Question object
  currentCat:   'easy',
  revealedParts: new Set(),     // which parts have been revealed: 'title','actor','quote'
  tvConnected:  false,
  timerHandle:  null,           // setInterval reference
  timerValue:   0,
  showingSentToTv: false,       // has the current Q been sent to TV?
};

/* ─── BROADCAST CHANNEL ───────────────────────────────────── */
const channel = new BroadcastChannel(CHANNEL_NAME);

channel.onmessage = (e) => {
  const { type, payload } = e.data;
  if (type === 'TV_READY') {
    state.tvConnected = true;
    updateTVStatus(true);
    // Resync TV with current game state
    broadcast('GAME_INIT', buildGameInitPayload());
    if (state.currentQ && state.showingSentToTv) {
      broadcast('QUESTION_START', buildQuestionPayload());
      // Re-send any already-revealed parts
      state.revealedParts.forEach(part => broadcast(revealMsg(part), { text: revealText(part) }));
    }
  }
};

function broadcast(type, payload = {}) {
  channel.postMessage({ type, payload, ts: Date.now() });
}

function revealMsg(part)  { return { title: 'REVEAL_TITLE', actor: 'REVEAL_ACTOR', quote: 'REVEAL_QUOTE' }[part]; }
function revealText(part) {
  if (!state.currentQ) return '';
  return state.currentQ.answer[part] || '';
}

/* ─── UTILITIES ───────────────────────────────────────────── */
function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function $(sel, root = document) { return root.querySelector(sel); }
function $$(sel, root = document) { return [...root.querySelectorAll(sel)]; }

function buildGameInitPayload() {
  return {
    mode:     state.mode,
    entities: state.entities,
    roomCode: state.roomCode,
    usedIds:  [...state.usedIds],
  };
}

function buildQuestionPayload() {
  if (!state.currentQ) return {};
  return {
    id:         state.currentQ.id,
    difficulty: state.currentQ.difficulty,
    emojis:     state.currentQ.emojis,
    points:     state.currentQ.points,
    index:      [...state.usedIds].length,
    total:      Object.values(MOVIE_EMOJI_QUESTIONS).flat().length,
  };
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
  const form          = $('#setupForm');
  const teamsConfig   = $('#teamsConfig');
  const indivConfig   = $('#individualConfig');
  const playersList   = $('#playersList');
  const addPlayerBtn  = $('#addPlayerBtn');

  // Mode toggle
  $$('input[name="mode"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const isTeams = radio.value === 'teams';
      teamsConfig.classList.toggle('hidden', !isTeams);
      indivConfig.classList.toggle('hidden', isTeams);
      $('#modeTeamsOption').classList.toggle('selected', isTeams);
      $('#modeIndividualOption').classList.toggle('selected', !isTeams);
    });
  });

  // Add player row
  addPlayerBtn.addEventListener('click', () => {
    const rows = $$('.setup-player-row', playersList);
    if (rows.length >= 16) return; // max 16 players
    const row = document.createElement('div');
    row.className = 'setup-player-row';
    row.innerHTML = `
      <input class="setup-input player-name-input" placeholder="Player or couple name" maxlength="24" />
      <button type="button" class="btn btn-ghost btn-sm remove-player" title="Remove" aria-label="Remove player">✕</button>
    `;
    playersList.appendChild(row);
    row.querySelector('input').focus();
  });

  // Remove player row (delegated)
  playersList.addEventListener('click', (e) => {
    if (e.target.classList.contains('remove-player')) {
      const rows = $$('.setup-player-row', playersList);
      if (rows.length <= 1) return; // keep at least 1
      e.target.closest('.setup-player-row').remove();
    }
  });

  // Form submit
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const mode = $('input[name="mode"]:checked')?.value || 'teams';
    state.mode       = mode;
    state.roomCode   = generateRoomCode();
    state.timerDefault = parseInt($('#timerDuration').value, 10) || 0;

    if (mode === 'teams') {
      const t1 = $('#team1Name').value.trim() || 'Team A';
      const t2 = $('#team2Name').value.trim() || 'Team B';
      state.entities = [
        { id: 'team-0', name: t1, score: 0, colorClass: TEAM_COLORS[0], color: TEAM_PALETTE[0] },
        { id: 'team-1', name: t2, score: 0, colorClass: TEAM_COLORS[1], color: TEAM_PALETTE[1] },
      ];
    } else {
      const names = $$('.player-name-input')
        .map(inp => inp.value.trim())
        .filter(Boolean);
      if (names.length === 0) { alert('Add at least one player name.'); return; }
      state.entities = names.map((name, i) => ({
        id: `player-${i}`, name, score: 0,
        colorClass: TEAM_COLORS[i % TEAM_COLORS.length],
        color: TEAM_PALETTE[i % TEAM_PALETTE.length],
      }));
    }

    startGame();
  });
}

/* ══════════════════════════════════════════════════════════
   GAME START
   ══════════════════════════════════════════════════════════ */
function startGame() {
  $('#hostSetup').classList.add('hidden');
  $('#hostGame').classList.remove('hidden');
  $('#hostRoomCode').textContent = state.roomCode;

  renderScores();
  renderQuestionGrid('easy');
  initCategoryTabs();
  initControlButtons();

  if (state.timerDefault > 0) {
    $('#timerBtn').classList.remove('hidden');
  }

  broadcast('GAME_INIT', buildGameInitPayload());
}

/* ── Open TV window ── */
function openTvWindow() {
  const tv = window.open('tv.html', 'mego-tv', 'width=1280,height=720');
  if (!tv) {
    alert('Pop-up blocked! Please allow pop-ups for this page and try again.');
    return;
  }
  // TV sends TV_READY on load; we'll get it via the channel
  updateTVStatus(false); // will flip to true when TV_READY arrives
}

/* ══════════════════════════════════════════════════════════
   SCORES
   ══════════════════════════════════════════════════════════ */
function renderScores() {
  const container = $('#hostScores');
  container.innerHTML = '<div class="scores-heading">Scores</div>';

  state.entities.forEach(entity => {
    const card = document.createElement('div');
    card.className = `score-card ${entity.colorClass}`;
    card.id = `scoreCard-${entity.id}`;
    card.innerHTML = `
      <div class="score-card-name">${entity.name}</div>
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
    void el.offsetWidth; // reflow to restart animation
    el.classList.add('anim-pop-in');
  }

  broadcast('SCORES_UPDATE', {
    entities: state.entities,
    delta:    { entityId, points: delta },
  });
}

/* ══════════════════════════════════════════════════════════
   CATEGORY TABS
   ══════════════════════════════════════════════════════════ */
function initCategoryTabs() {
  $$('.host-cat-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      $$('.host-cat-tab').forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
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
  const questions = MOVIE_EMOJI_QUESTIONS[category] || [];

  questions.forEach((q, i) => {
    const btn = document.createElement('button');
    const isUsed     = state.usedIds.has(q.id);
    const isCurrent  = state.currentQ?.id === q.id;

    btn.type = 'button';
    btn.className = ['q-btn', isUsed ? 'used' : '', isCurrent ? 'selected' : ''].filter(Boolean).join(' ');
    btn.setAttribute('aria-label', `Question ${i + 1}: ${q.emojis}`);
    btn.setAttribute('role', 'listitem');
    btn.innerHTML = `
      <span class="q-btn-emoji">${q.emojis.split(' ').slice(0, 2).join('')}</span>
      <span class="q-btn-num">${isUsed ? '<span class="q-btn-check">✓</span>' : `#${i + 1}`}</span>
    `;
    btn.addEventListener('click', () => selectQuestion(q));
    grid.appendChild(btn);
  });

  if (questions.length === 0) {
    grid.innerHTML = '<p style="color:var(--clr-text-muted);font-size:.85rem;padding:.5rem">No questions in this category.</p>';
  }
}

/* ══════════════════════════════════════════════════════════
   QUESTION SELECTION
   ══════════════════════════════════════════════════════════ */
function selectQuestion(q) {
  // Stop any running timer
  stopTimer();

  state.currentQ       = q;
  state.revealedParts  = new Set();
  state.showingSentToTv = false;

  // Update grid highlight
  $$('.q-btn').forEach(btn => btn.classList.remove('selected'));
  const buttons = $$('.q-btn');
  const questions = MOVIE_EMOJI_QUESTIONS[state.currentCat] || [];
  const idx = questions.findIndex(x => x.id === q.id);
  if (buttons[idx]) buttons[idx].classList.add('selected');

  // Show panel
  $('#hostQEmpty').classList.add('hidden');
  $('#hostQDisplay').classList.remove('hidden');

  // Populate display
  const badge = $('#hostQCatBadge');
  badge.textContent = q.difficulty.charAt(0).toUpperCase() + q.difficulty.slice(1);
  badge.className = `cat-badge ${q.difficulty}`;
  $('#hostQId').textContent = q.id;
  $('#hostQEmoji').textContent = q.emojis;

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

  // Reset Send to TV button
  const sendBtn = $('#sendToTvBtn');
  sendBtn.textContent = '📺 Show on TV';
  sendBtn.disabled = false;

  // Build reveal buttons
  renderRevealButtons(q);

  // Build award buttons (locked until something is revealed)
  renderAwardButtons(q);

  // Lock reveal until sent to TV
  lockRevealUntilSent(true);
}

/* ── Reveal buttons ── */
function renderRevealButtons(q) {
  const container = $('#hostRevealBtns');
  container.innerHTML = '';

  const parts = [
    { key: 'title', label: '🎬 Movie Title',     pts: q.points.title },
    ...(q.answer.actor ? [{ key: 'actor', label: '🎭 Lead Actor',  pts: q.points.actor }] : []),
    ...(q.answer.quote ? [{ key: 'quote', label: '💬 Quote/Song',  pts: q.points.quote }] : []),
  ];

  parts.forEach(({ key, label, pts }) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `btn btn-secondary btn-sm reveal-btn`;
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
    ...(q.answer.title ? [{ key: 'title', label: 'Title', pts: q.points.title }] : []),
    ...(q.answer.actor ? [{ key: 'actor', label: 'Actor', pts: q.points.actor }] : []),
    ...(q.answer.quote ? [{ key: 'quote', label: 'Quote', pts: q.points.quote }] : []),
  ];

  parts.forEach(({ key, label, pts }) => {
    // Only show parts that have been revealed
    const row = document.createElement('div');
    row.className = 'host-award-row';
    row.id = `awardRow-${key}`;
    row.classList.add('hidden'); // shown when part is revealed

    const partLabel = document.createElement('div');
    partLabel.className = 'host-award-label';
    partLabel.style.cssText = 'text-transform:capitalize;font-size:.75rem;color:var(--clr-text-muted);min-width:48px';
    partLabel.textContent = `${label}:`;

    const btnGroup = document.createElement('div');
    btnGroup.className = 'award-comp-btns';

    state.entities.forEach(entity => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `btn btn-sm award-comp-btn`;
      btn.style.cssText = `background:${entity.color};color:#fff;opacity:.85`;
      btn.textContent = `+${pts} ${entity.name}`;
      btn.dataset.entityId = entity.id;
      btn.dataset.part     = key;
      btn.dataset.pts      = pts;
      btn.title = `Award ${pts} points for ${label} to ${entity.name}`;
      btn.addEventListener('click', () => {
        btn.disabled = true; // one award per component per entity
        btn.style.opacity = '.4';
        updateScore(entity.id, pts);
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

  const btn = $('#sendToTvBtn');
  btn.textContent = '📺 Shown on TV ✓';
  btn.disabled = true;

  // Unlock reveal buttons
  lockRevealUntilSent(false);
}

/* ══════════════════════════════════════════════════════════
   REVEAL PARTS
   ══════════════════════════════════════════════════════════ */
function revealPart(part) {
  if (!state.currentQ || state.revealedParts.has(part)) return;
  state.revealedParts.add(part);

  // Update button appearance
  const btn = $(`.reveal-btn[data-part="${part}"]`);
  if (btn) { btn.classList.add('revealed'); btn.disabled = true; }

  // Show award row for this part
  const row = $(`#awardRow-${part}`);
  if (row) row.classList.remove('hidden');

  // Broadcast to TV
  broadcast(revealMsg(part), { text: revealText(part) });
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
    if (state.timerValue <= 0) {
      stopTimer();
      broadcast('TIMER_END', {});
    }
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
  el.textContent = val <= 0 ? '0:00' : `${m}:${s.toString().padStart(2, '0')}`;
}

/* ══════════════════════════════════════════════════════════
   NEXT QUESTION / END GAME
   ══════════════════════════════════════════════════════════ */
function nextQuestion() {
  if (state.currentQ) {
    state.usedIds.add(state.currentQ.id);
  }
  stopTimer();
  state.currentQ       = null;
  state.revealedParts  = new Set();
  state.showingSentToTv = false;

  $('#hostQEmpty').classList.remove('hidden');
  $('#hostQDisplay').classList.add('hidden');

  broadcast('NEXT_QUESTION', {});

  // Refresh grid to mark as used
  renderQuestionGrid(state.currentCat);
}

function endGame() {
  if (!confirm('End the game and show final scores?')) return;
  stopTimer();

  const sorted = [...state.entities].sort((a, b) => b.score - a.score);
  const winner = sorted[0]?.name || '—';

  broadcast('GAME_OVER', { entities: sorted, winner });

  // Show a simple summary on host panel
  const panel = $('#hostQPanel');
  panel.innerHTML = `
    <div class="host-q-empty" style="flex:1;gap:1rem">
      <span style="font-size:3rem">🏆</span>
      <strong style="font-size:1.5rem">Game Over!</strong>
      <p>Winner: <strong style="color:var(--clr-secondary)">${winner}</strong></p>
      <div style="display:flex;flex-direction:column;gap:.4rem;text-align:left;width:100%;max-width:240px">
        ${sorted.map((e, i) => `<div style="display:flex;justify-content:space-between;padding:.4rem .6rem;background:var(--clr-surface);border-radius:.5rem"><span>#${i + 1} ${e.name}</span><strong>${e.score}pts</strong></div>`).join('')}
      </div>
      <button class="btn btn-primary" onclick="location.href='host.html'">Play Again</button>
    </div>
  `;
}

/* ══════════════════════════════════════════════════════════
   WIRE UP CONTROL BUTTONS
   ══════════════════════════════════════════════════════════ */
function initControlButtons() {
  $('#openTvBtn').addEventListener('click', openTvWindow);
  $('#sendToTvBtn').addEventListener('click', sendToTV);
  $('#timerBtn').addEventListener('click', startTimer);
  $('#stopTimerBtn').addEventListener('click', stopTimer);
  $('#nextQBtn').addEventListener('click', nextQuestion);
  $('#endGameBtn').addEventListener('click', endGame);
}

/* ══════════════════════════════════════════════════════════
   BOOT
   ══════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  initSetup();
  // State room code shown in setup header (optional — shown in game header instead)
});
