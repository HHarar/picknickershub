/**
 * Movie Emoji Game — Player (Phone) Controller
 *
 * Transport: HTTP POST to server API + Server-Sent Events (SSE) for push.
 * Works cross-device on the same local network.
 */

/* ─── STATE ───────────────────────────────────────────────── */
let playerState = {
  name:      '',
  roomCode:  '',
  currentQ:  null,
  submitted: false,
  sse:       null,
};

/* ─── HELPERS ──────────────────────────────────────────────── */
function $(sel) { return document.querySelector(sel); }

function setView(view) {
  $('#playerJoin').classList.toggle('hidden',         view !== 'join');
  $('#playerWaiting').classList.toggle('hidden',      view !== 'waiting');
  $('#playerAnswerForm').classList.toggle('hidden',   view !== 'answering');
  $('#playerSubmitted').classList.toggle('hidden',    view !== 'submitted');
}

function setRoomMsg(msg, type = '') {
  const el = $('#roomStatusMsg');
  if (!el) return;
  el.textContent = msg;
  el.style.color = type === 'error'   ? 'var(--clr-danger)'
                 : type === 'success' ? 'var(--clr-success)'
                 : 'var(--clr-text-dim)';
}

/* ─── FETCH GAME NAMES ─────────────────────────────────────── */
async function fetchGameNames(room) {
  setRoomMsg('Loading…');
  const picker = $('#namePickerSection');
  const joinBtn = $('#joinBtn');
  picker?.classList.add('hidden');
  joinBtn.disabled = true;

  try {
    const res = await fetch(`/api/game/state?room=${encodeURIComponent(room)}`);
    if (!res.ok) {
      // Check if the response is JSON (local server) or HTML (static host / no server)
      const isJson = res.headers.get('content-type')?.includes('application/json');
      if (isJson) {
        setRoomMsg('Room not found — double-check the code shown on the TV.', 'error');
      } else {
        setRoomMsg(
          'Game server not reachable. Make sure you are on the same Wi-Fi as the host ' +
          'and use the URL shown on the TV screen — not the Netlify site.',
          'error'
        );
      }
      return;
    }
    const game = await res.json();

    const select = $('#joinNameSelect');
    select.innerHTML = '<option value="">— select your name —</option>';

    const available = game.playerNames.filter(n => !game.joined[n]);
    available.forEach(n => {
      const opt = document.createElement('option');
      opt.value = n;
      opt.textContent = n;
      select.appendChild(opt);
    });

    if (available.length === 0) {
      setRoomMsg('All spots are taken!', 'error');
      const msg = $('#namePickerMsg');
      if (msg) msg.textContent = 'Ask the host to restart the game.';
    } else {
      setRoomMsg('');
      const msg = $('#namePickerMsg');
      if (msg) msg.textContent = `${available.length} spot${available.length > 1 ? 's' : ''} available`;
    }

    picker?.classList.remove('hidden');

    // Enable join button when a name is selected
    select.addEventListener('change', () => {
      joinBtn.disabled = !select.value;
    });

  } catch (e) {
    setRoomMsg('Could not reach the game server.', 'error');
  }
}

/* ─── JOIN FORM ────────────────────────────────────────────── */
function initJoinForm() {
  const roomInput = $('#joinRoom');

  roomInput.addEventListener('input', () => {
    const room = roomInput.value.toUpperCase();
    roomInput.value = room;
    $('#playerRoomCode').textContent = room || '—';
    if (room.length === 5) {
      fetchGameNames(room);
    } else {
      $('#namePickerSection')?.classList.add('hidden');
      $('#joinBtn').disabled = true;
    }
  });

  $('#joinForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const room = roomInput.value.trim().toUpperCase();
    const name = $('#joinNameSelect').value;
    if (!room || !name) return;

    const btn = $('#joinBtn');
    btn.disabled = true;
    btn.textContent = 'Joining…';

    try {
      const res = await fetch('/api/game/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room, name }),
      });

      if (res.status === 409) {
        setRoomMsg('That name was just taken — pick another.', 'error');
        fetchGameNames(room);
        btn.disabled = false;
        btn.textContent = 'Join Game 🎮';
        return;
      }
      if (!res.ok) {
        setRoomMsg('Could not join. Try again.', 'error');
        btn.disabled = false;
        btn.textContent = 'Join Game 🎮';
        return;
      }

      playerState.name     = name;
      playerState.roomCode = room;
      $('#playerNameDisplay').textContent = name;
      $('#playerRoomCode').textContent    = room;

      connectSSE(room);
      setView('waiting');

    } catch {
      setRoomMsg('Network error. Make sure you are on the same Wi-Fi.', 'error');
      btn.disabled = false;
      btn.textContent = 'Join Game 🎮';
    }
  });
}

/* ─── SSE CONNECTION ───────────────────────────────────────── */
function connectSSE(room) {
  if (playerState.sse) playerState.sse.close();
  const sse = new EventSource(`/api/events?room=${encodeURIComponent(room)}`);
  playerState.sse = sse;

  sse.addEventListener('question_start', (e) => {
    const { question } = JSON.parse(e.data);
    if (question) showAnswerForm(question);
  });

  sse.addEventListener('next_question', () => {
    playerState.submitted = false;
    setView('waiting');
  });

  sse.addEventListener('game_over', (e) => {
    const { scores } = JSON.parse(e.data);
    const myScore = scores?.[playerState.name] ?? '—';
    $('#playerWaiting').innerHTML = `
      <div style="font-size:3rem">🏆</div>
      <h2 style="font-size:1.25rem;font-weight:700;margin-bottom:.5rem">Game Over!</h2>
      <p>Your score: <strong style="color:var(--clr-secondary)">${myScore} pts</strong></p>
      <a href="host.html" class="btn btn-primary" style="margin-top:1.25rem">Play Again</a>
    `;
    setView('waiting');
  });

  // If game already has an active question when we connect
  sse.addEventListener('state', (e) => {
    const game = JSON.parse(e.data);
    if (game.status === 'question' && game.currentQuestion && !playerState.submitted) {
      showAnswerForm(game.currentQuestion);
    }
  });

  sse.onerror = () => {
    console.warn('[Player] SSE lost — will auto-reconnect');
  };
}

/* ─── ANSWER FORM ──────────────────────────────────────────── */
function showAnswerForm(q) {
  playerState.currentQ  = q;
  playerState.submitted = false;

  $('#playerQEmoji').textContent = q.emojis || '🎬';

  const badge = $('#playerQCatBadge');
  badge.textContent = (q.difficulty || 'easy').charAt(0).toUpperCase() + (q.difficulty || '').slice(1);
  badge.className   = `cat-badge ${q.difficulty || 'easy'}`;

  const isEasy   = q.difficulty === 'easy';
  const isMedium = q.difficulty === 'medium';
  $('#ansActorField').classList.toggle('hidden', isEasy);
  $('#ansQuoteField').classList.toggle('hidden', isEasy || isMedium);

  const instMap = {
    easy:   'Guess the movie name!',
    medium: 'Guess the movie name + lead actor / actress.',
    hard:   'Guess the movie, lead actor / actress, and famous quote or song.',
  };
  $('#playerQInst').textContent = instMap[q.difficulty] || '';

  $('#ansMovie').value = '';
  $('#ansActor').value = '';
  $('#ansQuote').value = '';
  $('#ansSubmitBtn').disabled = false;
  $('#ansSubmitBtn').textContent = 'Submit Answer ✓';

  setView('answering');
}

function initAnswerForm() {
  $('#answerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (playerState.submitted) return;

    const answer = {
      movie: $('#ansMovie').value.trim(),
      actor: $('#ansActor').value.trim(),
      quote: $('#ansQuote').value.trim(),
    };

    $('#ansSubmitBtn').disabled = true;
    $('#ansSubmitBtn').textContent = 'Submitting…';

    try {
      await fetch('/api/game/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room:   playerState.roomCode,
          name:   playerState.name,
          answer,
        }),
      });
      playerState.submitted = true;
      setView('submitted');
    } catch {
      $('#ansSubmitBtn').disabled = false;
      $('#ansSubmitBtn').textContent = 'Submit Answer ✓';
      alert('Could not submit — check your connection.');
    }
  });
}

/* ─── BOOT ─────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(location.search);
  const room   = (params.get('room') || '').toUpperCase();

  if (room) {
    $('#joinRoom').value = room;
    $('#playerRoomCode').textContent = room;
    fetchGameNames(room);
  }

  initJoinForm();
  initAnswerForm();
  setView('join');
});
