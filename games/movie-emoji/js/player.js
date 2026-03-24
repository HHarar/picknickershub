/**
 * Movie Emoji Game — Player (Phone) Controller
 *
 * Listens on BroadcastChannel for game events from host.js
 * and lets players submit answers.
 *
 * Note: BroadcastChannel works across tabs in the same browser.
 * For true cross-device play (phones), integrate Firebase Realtime
 * Database — see the README for setup instructions.
 */

const channel = new BroadcastChannel('movie-emoji-game');

let playerState = {
  name:       '',
  roomCode:   '',
  currentQ:   null,   // { difficulty, emojis }
  submitted:  false,
};

/* ─── HELPERS ──────────────────────────────────────────────── */
function $(sel) { return document.querySelector(sel); }

function show(id)  { $(id).classList.remove('hidden'); }
function hide(id)  { $(id).classList.add('hidden'); }

function setView(view) {
  // view: 'join' | 'waiting' | 'answering' | 'submitted'
  hide('#playerJoin');
  hide('#playerWaiting');
  hide('#playerAnswerForm');
  hide('#playerSubmitted');
  if (view === 'join')      show('#playerJoin');
  if (view === 'waiting')   show('#playerWaiting');
  if (view === 'answering') show('#playerAnswerForm');
  if (view === 'submitted') show('#playerSubmitted');
}

/* Pre-fill room code from URL query string */
function prefillFromUrl() {
  const params = new URLSearchParams(location.search);
  const room = params.get('room') || params.get('session') || '';
  if (room) {
    $('#joinRoom').value = room.toUpperCase();
    $('#playerRoomCode').textContent = room.toUpperCase();
  }
  const name = params.get('name') || '';
  if (name) $('#joinName').value = name;
}

/* ─── JOIN FORM ────────────────────────────────────────────── */
function initJoinForm() {
  const form = $('#joinForm');
  if (!form) return;

  // Auto-uppercase room code as typed
  $('#joinRoom').addEventListener('input', (e) => {
    e.target.value = e.target.value.toUpperCase();
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('#joinName').value.trim();
    const room = $('#joinRoom').value.trim().toUpperCase();
    if (!name) { alert('Please enter your name.'); return; }

    playerState.name     = name;
    playerState.roomCode = room;

    $('#playerNameDisplay').textContent  = name;
    $('#playerRoomCode').textContent     = room || '—';

    // Tell host we joined (they see this in console or optionally display it)
    channel.postMessage({ type: 'PLAYER_JOINED', payload: { name, roomCode: room }, ts: Date.now() });

    setView('waiting');
  });
}

/* ─── ANSWER FORM ──────────────────────────────────────────── */
function showAnswerForm(q) {
  playerState.currentQ  = q;
  playerState.submitted = false;

  // Update emoji + category display
  $('#playerQEmoji').textContent = q.emojis || '🎬';

  const badge = $('#playerQCatBadge');
  badge.textContent = (q.difficulty || 'easy').charAt(0).toUpperCase() + (q.difficulty || '').slice(1);
  badge.className = `cat-badge ${q.difficulty || 'easy'}`;

  // Show appropriate fields based on difficulty
  const isEasy   = q.difficulty === 'easy';
  const isMedium = q.difficulty === 'medium';
  const isHard   = q.difficulty === 'hard';

  $('#ansActorField').classList.toggle('hidden', isEasy);
  $('#ansQuoteField').classList.toggle('hidden', isEasy || isMedium);

  // Update instruction text
  const instMap = {
    easy:   'Guess the movie name!',
    medium: 'Guess the movie name + lead actor / actress.',
    hard:   'Guess the movie, lead actor / actress, and famous quote or song.',
  };
  $('#playerQInst').textContent = instMap[q.difficulty] || '';

  // Reset fields
  $('#ansMovie').value = '';
  $('#ansActor').value = '';
  $('#ansQuote').value = '';
  $('#ansSubmitBtn').disabled = false;

  setView('answering');
}

function initAnswerForm() {
  const form = $('#answerForm');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (playerState.submitted) return;

    const answer = {
      name:     playerState.name,
      roomCode: playerState.roomCode,
      movie:    $('#ansMovie').value.trim(),
      actor:    $('#ansActor').value.trim(),
      quote:    $('#ansQuote').value.trim(),
    };

    // Broadcast to host (works same-browser; Firebase would send cross-device)
    channel.postMessage({
      type:    'PLAYER_ANSWER',
      payload: answer,
      ts:      Date.now(),
    });

    playerState.submitted = true;
    $('#ansSubmitBtn').disabled = true;
    setView('submitted');
  });
}

/* ─── CHANNEL MESSAGES FROM HOST ──────────────────────────── */
channel.onmessage = (e) => {
  const { type, payload } = e.data;

  if (type === 'QUESTION_START') {
    showAnswerForm(payload);
  }

  if (type === 'NEXT_QUESTION' || type === 'REVEAL_TITLE') {
    // After reveal, go back to waiting for next question
    if (playerState.submitted || type === 'NEXT_QUESTION') {
      setView('waiting');
      playerState.submitted = false;
    }
  }

  if (type === 'GAME_OVER') {
    setView('waiting');
    $('#playerWaiting').innerHTML = `
      <div style="font-size:3rem">🏆</div>
      <h2 style="font-size:1.25rem;font-weight:700">Game Over!</h2>
      <p><strong>${payload.winner || '—'}</strong> wins!</p>
      <a href="host.html" class="btn btn-primary" style="margin-top:1rem">Play Again</a>
    `;
  }
};

/* ─── BOOT ─────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  prefillFromUrl();
  initJoinForm();
  initAnswerForm();
});
