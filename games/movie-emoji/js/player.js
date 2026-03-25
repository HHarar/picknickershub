/**
 * Movie Emoji Game — Player (Phone) Controller
 */

/* ─── STATE ─────────────────────────────────────────────────── */
let playerState = {
  name:         '',
  roomCode:     '',
  currentQ:     null,
  submitted:    false,
  score:        0,
  unsub:        null,
  timerHandle:  null,
};

/* ─── HELPERS ───────────────────────────────────────────────── */
function $(sel) { return document.querySelector(sel); }

function setView(view) {
  const views = ['join','waiting','answering','submitted','revealed','gameover'];
  const ids   = ['playerJoin','playerWaiting','playerAnswerForm','playerSubmitted','playerReveal','playerGameover'];
  ids.forEach((id, i) => document.getElementById(id)?.classList.toggle('hidden', views[i] !== view));
}

function setRoomMsg(msg, type = '') {
  const el = $('#roomStatusMsg');
  if (!el) return;
  el.textContent = msg;
  el.style.color = type === 'error'   ? 'var(--clr-danger)'
                 : type === 'success' ? 'var(--clr-success)'
                 : 'var(--clr-text-dim)';
}

function updateScoreDisplay() {
  const wrap = document.getElementById('playerScoreWrap');
  const pts  = document.getElementById('playerScoreDisplay');
  if (wrap) wrap.classList.remove('hidden');
  if (pts)  pts.textContent = playerState.score;
}

/* ─── TIMER ─────────────────────────────────────────────────── */
function startPlayerTimer(timerEnd) {
  stopPlayerTimer();
  if (!timerEnd) return;
  const el = document.getElementById('playerTimer');
  if (!el) return;
  el.classList.remove('hidden');

  function tick() {
    const remaining = Math.ceil((timerEnd - Date.now()) / 1000);
    if (remaining <= 0) {
      el.textContent = "⏰ Time's up!";
      el.className = 'player-timer urgent';
      stopPlayerTimer();
      // Disable submit if not yet submitted
      const btn = $('#ansSubmitBtn');
      if (btn && !playerState.submitted) {
        btn.disabled = true;
        btn.textContent = "⏰ Time's up!";
      }
      return;
    }
    const m = Math.floor(remaining / 60);
    const s = remaining % 60;
    el.textContent = m > 0 ? `⏱ ${m}:${s.toString().padStart(2,'0')}` : `⏱ ${s}s`;
    el.className = `player-timer${remaining <= 10 ? ' urgent' : ''}`;
    playerState.timerHandle = setTimeout(tick, 1000);
  }
  tick();
}

function stopPlayerTimer() {
  if (playerState.timerHandle) { clearTimeout(playerState.timerHandle); playerState.timerHandle = null; }
  const el = document.getElementById('playerTimer');
  if (el) { el.classList.add('hidden'); el.textContent = ''; }
}

/* ─── FETCH GAME NAMES ──────────────────────────────────────── */
async function fetchGameNames(room) {
  setRoomMsg('Loading…');
  const picker  = $('#namePickerSection');
  const joinBtn = $('#joinBtn');
  picker?.classList.add('hidden');
  joinBtn.disabled = true;

  let game;
  try {
    game = await GameDB.getState(room);
  } catch (e) {
    setRoomMsg(
      e.code === 'NO_SERVER'
        ? 'Game server not reachable. Use the URL shown on the TV screen.'
        : 'Could not reach the game server.',
      'error'
    );
    return;
  }
  if (!game) { setRoomMsg('Room not found — double-check the code on the TV.', 'error'); return; }

  const select = $('#joinNameSelect');
  select.innerHTML = '<option value="">— select your name —</option>';
  const available = game.playerNames.filter(n => !game.joined[n]);
  available.forEach(n => {
    const opt = document.createElement('option');
    opt.value = n; opt.textContent = n;
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
  select.addEventListener('change', () => { joinBtn.disabled = !select.value; });
}

/* ─── JOIN FORM ─────────────────────────────────────────────── */
function initJoinForm() {
  const roomInput = $('#joinRoom');
  roomInput.addEventListener('input', () => {
    const room = roomInput.value.toUpperCase();
    roomInput.value = room;
    $('#playerRoomCode').textContent = room || '—';
    if (room.length === 5) fetchGameNames(room);
    else { $('#namePickerSection')?.classList.add('hidden'); $('#joinBtn').disabled = true; }
  });

  $('#joinForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const room = roomInput.value.trim().toUpperCase();
    const name = $('#joinNameSelect').value;
    if (!room || !name) return;

    const btn = $('#joinBtn');
    btn.disabled = true; btn.textContent = 'Joining…';

    try {
      await GameDB.joinGame(room, name);
      playerState.name     = name;
      playerState.roomCode = room;
      $('#playerNameDisplay').textContent = name;
      $('#playerRoomCode').textContent    = room;
      connectSSE(room);
      setView('waiting');
    } catch (err) {
      if (err.status === 409) {
        setRoomMsg('That name was just taken — pick another.', 'error');
        fetchGameNames(room);
      } else {
        setRoomMsg('Could not join. Check your connection and try again.', 'error');
      }
      btn.disabled = false; btn.textContent = 'Join Game 🎮';
    }
  });
}

/* ─── SUBSCRIBE TO GAME ─────────────────────────────────────── */
function connectSSE(room) {
  if (playerState.unsub) playerState.unsub();
  playerState.unsub = GameDB.subscribePlayer(room, {
    playerName: playerState.name,

    onState: (game) => {
      if (game.status === 'question' && game.currentQuestion && !playerState.submitted) {
        startPlayerTimer(game.currentQuestion.timerEnd);
        showAnswerForm(game.currentQuestion);
      } else if (game.status === 'over') {
        showGameOver(game.scores || {});
      } else {
        setView('waiting');
      }
      // Show any already-revealed answers
      if (game.reveals && Object.keys(game.reveals).length > 0) {
        populateRevealItems(game.reveals);
      }
    },

    onQuestionStart: (question) => {
      stopPlayerTimer();
      playerState.submitted = false;
      clearReveal();
      startPlayerTimer(question.timerEnd);
      showAnswerForm(question);
    },

    onNextQuestion: () => {
      stopPlayerTimer();
      playerState.submitted = false;
      clearReveal();
      setWaiting('Get ready for the next question…', 'Watch the TV screen for the emoji!');
    },

    onGameOver: (scores) => {
      stopPlayerTimer();
      showGameOver(scores);
    },

    onReveal: (reveals) => {
      populateRevealItems(reveals);
      // Only switch to reveal view if already submitted or timer ran out
      if (playerState.submitted || ($('#ansSubmitBtn') && $('#ansSubmitBtn').disabled)) {
        setView('revealed');
      }
    },

    onResult: (result) => {
      showResult(result);
      setView('revealed');
    },
  });
}

/* ─── WAITING SCREEN ────────────────────────────────────────── */
function setWaiting(title, sub) {
  const titleEl = document.getElementById('playerWaitingTitle');
  const subEl   = document.getElementById('playerWaitingSub');
  if (titleEl) titleEl.textContent = title || 'Waiting for question…';
  if (subEl)   subEl.textContent   = sub   || 'Watch the TV screen.';
  setView('waiting');
}

/* ─── ANSWER FORM ───────────────────────────────────────────── */
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
  $('#ansSubmitBtn').disabled  = false;
  $('#ansSubmitBtn').textContent = 'Submit Answer ✓';

  setView('answering');
}

/* ─── ANSWER SUBMIT ─────────────────────────────────────────── */
function initAnswerForm() {
  $('#answerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (playerState.submitted) return;

    const answer = {
      movie: $('#ansMovie').value.trim(),
      actor: $('#ansActor').value.trim(),
      quote: $('#ansQuote').value.trim(),
    };

    $('#ansSubmitBtn').disabled  = true;
    $('#ansSubmitBtn').textContent = 'Submitting…';

    try {
      await GameDB.submitAnswer(playerState.roomCode, playerState.name, answer);
      playerState.submitted = true;
      setView('submitted');
    } catch {
      $('#ansSubmitBtn').disabled  = false;
      $('#ansSubmitBtn').textContent = 'Submit Answer ✓';
      alert('Could not submit — check your connection.');
    }
  });
}

/* ─── REVEAL ────────────────────────────────────────────────── */
function clearReveal() {
  const items = document.getElementById('playerRevealItems');
  if (items) items.innerHTML = '';
  const banner = document.getElementById('playerResultBanner');
  if (banner) { banner.innerHTML = ''; banner.classList.add('hidden'); }
}

function populateRevealItems(reveals) {
  const container = document.getElementById('playerRevealItems');
  if (!container) return;
  container.innerHTML = '';
  if (reveals.title) {
    const d = document.createElement('div');
    d.className = 'player-reveal-item'; d.textContent = `🎬 ${reveals.title}`; container.appendChild(d);
  }
  if (reveals.actor) {
    const d = document.createElement('div');
    d.className = 'player-reveal-item'; d.textContent = `🎭 ${reveals.actor}`; container.appendChild(d);
  }
  if (reveals.quote) {
    const d = document.createElement('div');
    d.className = 'player-reveal-item'; d.textContent = `💬 ${reveals.quote}`; container.appendChild(d);
  }
}

function showResult(result) {
  const banner = document.getElementById('playerResultBanner');
  if (!banner) return;
  if (result === 'correct') {
    banner.innerHTML = '<div class="player-result-correct anim-pop-in">🎉 Correct! Points scored!</div>';
    playerState.score += 0; // score comes from Firebase scores object; we just show feedback
  } else {
    banner.innerHTML = '<div class="player-result-wrong anim-pop-in">😢 Better luck next time!</div>';
  }
  banner.classList.remove('hidden');
}

/* ─── GAME OVER ─────────────────────────────────────────────── */
function showGameOver(scores) {
  const myScore = scores?.[playerState.name] ?? 0;
  const finalEl = document.getElementById('playerFinalScore');
  if (finalEl) finalEl.textContent = `${myScore} pts`;
  setView('gameover');
}

/* ─── BOOT ──────────────────────────────────────────────────── */
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
