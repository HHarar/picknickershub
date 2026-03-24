/**
 * Movie Emoji Game — TV Display Controller
 *
 * Receives BroadcastChannel messages from host.js and updates the TV display.
 * All state is driven by messages; this file has no game logic.
 */

/* ─── CHANNEL ─────────────────────────────────────────────── */
const channel = new BroadcastChannel('movie-emoji-game');

/* ─── LOCAL STATE ─────────────────────────────────────────── */
let tvState = {
  entities:    [],
  roomCode:    '—',
  timerHandle: null,
  timerTotal:  60,
};

/* ─── HELPERS ──────────────────────────────────────────────── */
function $(sel, root = document) { return root.querySelector(sel); }

function setView(view) {
  // view: 'lobby' | 'question' | 'gameover'
  $('#tvLobby').classList.toggle('hidden',    view !== 'lobby');
  $('#tvQuestion').classList.toggle('hidden', view !== 'question');
  $('#tvGameover').classList.toggle('hidden', view !== 'gameover');
}

/* ─── TIMER RING ───────────────────────────────────────────── */
function buildTimerRing() {
  return `
    <div class="timer-ring" id="tvTimerRing" role="timer" aria-live="off">
      <svg viewBox="0 0 100 100" width="72" height="72">
        <circle class="timer-ring-track" cx="50" cy="50" r="45"/>
        <circle class="timer-ring-fill"  cx="50" cy="50" r="45" id="tvTimerFill"/>
      </svg>
      <div class="timer-ring-text" id="tvTimerText">—</div>
    </div>
  `;
}

function updateTimerRing(remaining, total) {
  const fill = $('#tvTimerFill');
  const text = $('#tvTimerText');
  const ring = $('#tvTimerRing');
  if (!fill || !text) return;

  const pct    = remaining / total;
  const offset = 283 * (1 - pct); // circumference of r=45 circle
  fill.style.strokeDashoffset = offset;

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  text.textContent = mins > 0 ? `${mins}:${secs.toString().padStart(2,'0')}` : String(remaining);

  const urgent = remaining <= 10;
  fill.classList.toggle('urgent', urgent);
  text.classList.toggle('urgent', urgent);
  if (ring) ring.setAttribute('aria-label', `${remaining} seconds remaining`);
}

function startTvTimer(seconds) {
  stopTvTimer();
  tvState.timerTotal = seconds;
  let remaining = seconds;

  const wrap = $('#tvTimerWrap');
  wrap.innerHTML = buildTimerRing();
  wrap.style.display = 'flex';
  updateTimerRing(remaining, seconds);

  tvState.timerHandle = setInterval(() => {
    remaining = Math.max(0, remaining - 1);
    updateTimerRing(remaining, seconds);
    if (remaining <= 0) stopTvTimer();
  }, 1000);
}

function stopTvTimer() {
  if (tvState.timerHandle) { clearInterval(tvState.timerHandle); tvState.timerHandle = null; }
  const wrap = $('#tvTimerWrap');
  if (wrap) { wrap.style.display = 'none'; wrap.innerHTML = ''; }
}

/* ─── SCOREBOARD ───────────────────────────────────────────── */
function renderScoreboard(entities, delta = null) {
  const board = $('#tvScoreboard');
  if (!board) return;

  board.innerHTML = entities.map((e, i) => {
    const hasDelta = delta && delta.entityId === e.id && delta.points > 0;
    const colorClass = ['team-a','team-b','team-c','team-d'][i] || 'team-a';
    return `
      <div class="tv-score-item">
        <div class="tv-score-name">${e.name}</div>
        <div class="tv-score-pts ${colorClass}">${e.score}
          ${hasDelta ? `<span class="tv-score-delta">+${delta.points}</span>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

/* ─── QR CODE ──────────────────────────────────────────────── */
function renderQrCode(url) {
  const container = $('#tvQrCode');
  if (!container || typeof QRCode === 'undefined') return;
  container.innerHTML = '';
  try {
    new QRCode(container, {
      text:   url,
      width:  80,
      height: 80,
      colorDark:  '#e8eaf6',
      colorLight: '#12162a',
      correctLevel: QRCode.CorrectLevel.M,
    });
  } catch (_) { /* QRCode unavailable offline */ }
}

/* ─── ANSWER REVEAL ITEMS ──────────────────────────────────── */
function appendAnswerItem(key, icon, label, text) {
  const container = $('#tvAnswerReveal');
  if (!container) return;

  // Remove existing item of same key if resent
  const existing = container.querySelector(`[data-key="${key}"]`);
  if (existing) existing.remove();

  const item = document.createElement('div');
  item.className = `tv-answer-item ${key}-reveal anim-slide-up`;
  item.dataset.key = key;
  item.innerHTML = `
    <div class="tv-answer-icon" aria-hidden="true">${icon}</div>
    <div class="tv-answer-body">
      <div class="tv-answer-label">${label}</div>
      <div class="tv-answer-text">${text}</div>
    </div>
  `;
  container.appendChild(item);
}

/* ─── MESSAGE HANDLERS ─────────────────────────────────────── */
const handlers = {

  GAME_INIT({ entities, roomCode, playerUrl }) {
    tvState.entities = entities;
    tvState.roomCode = roomCode;

    $('#tvRoomCode').textContent  = roomCode;
    $('#tvLobbyRoom').classList.remove('hidden');
    $('#tvLobbyStatus').textContent = 'Scan the QR code or visit the URL on your phone to join!';

    // Use network playerUrl from host (works on phones), fall back to same-origin
    const qrUrl = playerUrl
      ? `${playerUrl}?room=${roomCode}`
      : `${location.origin}${location.pathname.replace('tv.html','player.html')}?room=${roomCode}`;
    renderQrCode(qrUrl);

    // Show URL text below QR for manual entry
    const urlEl = document.getElementById('tvPlayerUrl');
    if (urlEl) {
      urlEl.textContent = qrUrl.replace(/^https?:\/\//, '');
    }

    // Reset player list
    const list = $('#tvPlayerList');
    if (list) { list.innerHTML = ''; list.classList.add('hidden'); }

    renderScoreboard(entities);
    setView('lobby');
  },

  PLAYER_JOINED({ name, joined }) {
    const list = $('#tvPlayerList');
    if (!list) return;
    list.classList.remove('hidden');
    list.innerHTML = Object.keys(joined).map(n =>
      `<span class="tv-player-chip">${n} ✓</span>`
    ).join('');
    // Update status
    const all = tvState.entities.length;
    const cnt = Object.keys(joined).length;
    $('#tvLobbyStatus').textContent = cnt >= all
      ? '✅ Everyone is in — ready to play!'
      : `${cnt} / ${all} joined…`;
  },

  PLAYER_SUBMITTED({ name }) {
    const strip = $('#tvSubsStrip');
    if (!strip) return;
    if (strip.querySelector(`[data-name="${name}"]`)) return;
    const b = document.createElement('span');
    b.className   = 'tv-sub-bubble anim-pop-in';
    b.dataset.name = name;
    b.title       = name;
    b.textContent = '✓';
    strip.appendChild(b);
  },

  QUESTION_START({ difficulty, emojis, index, total }) {
    stopTvTimer();

    // Reset submission strip and answer reveal
    const strip = $('#tvSubsStrip');
    if (strip) strip.innerHTML = '';
    const reveal = $('#tvAnswerReveal');
    if (reveal) reveal.innerHTML = '';

    // Update header
    const badge = $('#tvCatBadge');
    badge.textContent = (difficulty || 'easy').charAt(0).toUpperCase() + (difficulty || 'easy').slice(1);
    badge.className   = `tv-header-cat cat-badge ${difficulty || 'easy'}`;
    badge.style.display = '';

    const prog = $('#tvQProgress');
    if (prog && index !== undefined) {
      prog.textContent  = `Q ${index} / ${total}`;
      prog.style.display = '';
    }

    // Show emoji with pop animation
    const emojiEl = $('#tvEmoji');
    emojiEl.textContent = emojis;
    emojiEl.closest('.tv-emoji-wrap').classList.remove('anim-pop-in');
    void emojiEl.closest('.tv-emoji-wrap').offsetWidth;
    emojiEl.closest('.tv-emoji-wrap').classList.add('anim-pop-in');

    setView('question');
  },

  REVEAL_TITLE({ text }) {
    appendAnswerItem('title', '🎬', 'Movie', text);
  },

  REVEAL_ACTOR({ text }) {
    appendAnswerItem('actor', '🎭', 'Lead Actor / Actress', text);
  },

  REVEAL_QUOTE({ text }) {
    appendAnswerItem('quote', '💬', 'Famous Quote / Song', text);
  },

  SCORES_UPDATE({ entities, delta }) {
    tvState.entities = entities;
    renderScoreboard(entities, delta);
  },

  TIMER_START({ seconds }) {
    startTvTimer(seconds);
  },

  TIMER_STOP() {
    stopTvTimer();
  },

  TIMER_END() {
    stopTvTimer();
    // Flash a subtle "time's up" message
    const flash = document.createElement('div');
    flash.textContent = "⏰ Time's up!";
    flash.style.cssText = `
      position:fixed; top:50%; left:50%; transform:translate(-50%,-50%);
      background:var(--clr-danger); color:#fff; font-size:2.5rem; font-weight:900;
      padding:1rem 2.5rem; border-radius:1rem; z-index:1000;
      animation:popIn 300ms var(--ease-out) both;
    `;
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 2000);
  },

  NEXT_QUESTION() {
    stopTvTimer();
    const strip = $('#tvSubsStrip');
    if (strip) strip.innerHTML = '';
    const reveal = $('#tvAnswerReveal');
    if (reveal) reveal.innerHTML = '';
    $('#tvCatBadge').style.display = '';
    setView('lobby');
    $('#tvLobbyStatus').textContent = 'Next question coming up…';
  },

  GAME_OVER({ entities, winner }) {
    stopTvTimer();
    $('#tvWinner').textContent = `🏆 ${winner} Wins!`;

    const scoresEl = $('#tvGameoverScores');
    if (scoresEl) {
      scoresEl.innerHTML = entities.map((e, i) => `
        <div style="display:flex;justify-content:space-between;align-items:center;
          padding:.6rem 1.25rem;background:var(--clr-surface);border-radius:.75rem;">
          <span style="font-weight:700;font-size:1.1rem">${['🥇','🥈','🥉','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣'][i] || (i+1+'.')} ${e.name}</span>
          <strong style="font-size:1.25rem;color:var(--clr-secondary)">${e.score} pts</strong>
        </div>
      `).join('');
    }
    setView('gameover');
  },
};

/* ─── LISTEN ───────────────────────────────────────────────── */
channel.onmessage = (e) => {
  const { type, payload } = e.data;
  const handler = handlers[type];
  if (handler) {
    try { handler(payload || {}); }
    catch (err) { console.error(`[TV] Error handling "${type}":`, err); }
  }
};

/* ─── ANNOUNCE READY ───────────────────────────────────────── */
// Tell host.js the TV is ready to receive messages.
// Small delay lets the host's channel listener spin up first.
setTimeout(() => {
  channel.postMessage({ type: 'TV_READY', payload: {}, ts: Date.now() });
}, 300);

/* ─── FULLSCREEN ON CLICK ──────────────────────────────────── */
document.addEventListener('click', () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  }
});
