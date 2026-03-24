/**
 * Picknickers Hub — Main JavaScript
 * Handles: nav, game cards, leaderboard, stats counter, filter tabs, notify form
 */

/* ============================================================
   1. DATA — Game catalogue
   Add new games here as you build them. Set `url` to the game
   path once it exists, and flip `comingSoon` to false.
   ============================================================ */
const GAMES = [
  {
    id: 'movie-emoji',
    title: 'Movie Emoji',
    description: 'Decode movie titles hidden in emoji clues. Host controls the action — guess the film, lead actor, and famous quote!',
    emoji: '🎬',
    bgColor: '#1a0d25',
    category: 'trivia',
    players: '2–16',
    comingSoon: false,
    url: 'games/movie-emoji/host.html',
  },
  {
    id: 'wordle-clone',
    title: 'Word Guess',
    description: 'Guess the hidden 5-letter word in 6 tries. Classic Wordle-style.',
    emoji: '🔤',
    bgColor: '#1a2a1a',
    category: 'word',
    players: '1–∞',
    comingSoon: true,
    url: null,
  },
  {
    id: 'trivia-blitz',
    title: 'Trivia Blitz',
    description: 'Race your friends through rapid-fire trivia questions. 30 seconds per question!',
    emoji: '🧠',
    bgColor: '#1a1a2a',
    category: 'trivia',
    players: '2–8',
    comingSoon: true,
    url: null,
  },
  {
    id: 'snap-cards',
    title: 'Snap!',
    description: 'Online multiplayer card game — be the first to slap the matching pair.',
    emoji: '🃏',
    bgColor: '#2a1a2a',
    category: 'card',
    players: '2–4',
    comingSoon: true,
    url: null,
  },
  {
    id: 'chess-casual',
    title: 'Casual Chess',
    description: 'Classic chess with a casual timer — no pressure, just fun.',
    emoji: '♟️',
    bgColor: '#2a2a1a',
    category: 'board',
    players: '2',
    comingSoon: true,
    url: null,
  },
  {
    id: 'drawing-guess',
    title: 'Draw & Guess',
    description: 'One player draws, everyone guesses. A Pictionary-style laugh riot.',
    emoji: '🎨',
    bgColor: '#1a2a2a',
    category: 'word',
    players: '3–10',
    comingSoon: true,
    url: null,
  },
  {
    id: 'bingo',
    title: 'Bingo Night',
    description: 'Full multiplayer bingo with a shared board and live number calls.',
    emoji: '🎱',
    bgColor: '#2a1a1a',
    category: 'board',
    players: '2–20',
    comingSoon: true,
    url: null,
  },
];

/* ============================================================
   2. DATA — Leaderboard sample data
   Replace this with a real backend / localStorage later.
   ============================================================ */
const LEADERBOARD = [
  { rank: 1,  name: 'PickMaster99',  emoji: '🦁', wins: 42, points: 1850 },
  { rank: 2,  name: 'GamerGreta',    emoji: '🦊', wins: 38, points: 1620 },
  { rank: 3,  name: 'NightOwlNick',  emoji: '🦉', wins: 31, points: 1440 },
  { rank: 4,  name: 'CardSharkCleo', emoji: '🐬', wins: 27, points: 1210 },
  { rank: 5,  name: 'TriviaTiger',   emoji: '🐯', wins: 24, points: 1100 },
];

/* ============================================================
   3. UTILITIES
   ============================================================ */
/**
 * Safely query a DOM element. Returns null (not throws) if missing.
 * @param {string} sel
 * @param {Document|Element} root
 */
function $(sel, root = document) {
  return root.querySelector(sel);
}

/**
 * Animate a number counting up from 0 to target.
 * @param {HTMLElement} el
 * @param {number} target
 * @param {number} duration  ms
 */
function animateCount(el, target, duration = 1200) {
  if (!el) return;
  const start = performance.now();
  const step = (now) => {
    const progress = Math.min((now - start) / duration, 1);
    // Ease out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(eased * target).toLocaleString();
    if (progress < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/* ============================================================
   4. NAVBAR — mobile toggle
   ============================================================ */
function initNav() {
  const toggle = $('#navToggle');
  const links  = $('#navLinks');
  if (!toggle || !links) return;

  toggle.addEventListener('click', () => {
    const isOpen = links.classList.toggle('open');
    toggle.classList.toggle('open', isOpen);
    toggle.setAttribute('aria-expanded', String(isOpen));
  });

  // Close menu when a nav link is clicked
  links.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', () => {
      links.classList.remove('open');
      toggle.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    });
  });
}

/* ============================================================
   5. HERO STATS — animate on scroll into view
   ============================================================ */
function initStats() {
  const statsSection = $('.hero-stats');
  if (!statsSection) return;

  // Total games (non-coming-soon)
  const activeGames = GAMES.filter(g => !g.comingSoon).length;
  const totalGames  = GAMES.length;

  const targets = {
    statGames:    totalGames,    // all listed games
    statPlayers:  27,            // placeholder — replace with real data
    statSessions: 142,           // placeholder — replace with real data
  };

  let animated = false;
  const observer = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting && !animated) {
      animated = true;
      Object.entries(targets).forEach(([id, val]) => {
        animateCount(document.getElementById(id), val);
      });
      observer.disconnect();
    }
  }, { threshold: 0.5 });

  observer.observe(statsSection);
}

/* ============================================================
   6. GAME CARDS — render + filter
   ============================================================ */
function getCategoryBadgeClass(category) {
  const map = { card: 'badge-card', board: 'badge-board', word: 'badge-word', trivia: 'badge-trivia' };
  return map[category] || 'badge-coming';
}

function createGameCard(game) {
  const tag    = game.url ? 'a' : 'div';
  const card   = document.createElement(tag);

  card.className = `game-card${game.comingSoon ? ' coming-soon' : ''}`;
  card.setAttribute('data-category', game.category);
  card.setAttribute('aria-label', `${game.title}${game.comingSoon ? ' — Coming soon' : ''}`);

  if (game.url) {
    card.href = game.url;
  }

  card.innerHTML = `
    <div class="game-card-thumb" style="background-color: ${game.bgColor};" aria-hidden="true">
      ${game.emoji}
    </div>
    <div class="game-card-body">
      <h3 class="game-card-title">${game.title}${game.comingSoon ? ' <small style="font-size:.7em;opacity:.6">Soon</small>' : ''}</h3>
      <p class="game-card-desc">${game.description}</p>
      <div class="game-card-meta">
        <span class="game-badge ${getCategoryBadgeClass(game.category)}">${game.category}</span>
        <span class="game-players" aria-label="${game.players} players">👥 ${game.players}</span>
      </div>
    </div>
  `;

  return card;
}

function renderGames(filter = 'all') {
  const grid = $('#gamesGrid');
  if (!grid) return;

  const filtered = filter === 'all' ? GAMES : GAMES.filter(g => g.category === filter);

  grid.innerHTML = '';

  if (filtered.length === 0) {
    grid.innerHTML = `<div class="games-empty" role="status">No games in this category yet — check back soon!</div>`;
    return;
  }

  const fragment = document.createDocumentFragment();
  filtered.forEach(game => fragment.appendChild(createGameCard(game)));
  grid.appendChild(fragment);
}

function initGameCards() {
  renderGames();

  // Filter tabs
  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.filter-tab').forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      renderGames(tab.dataset.filter);
    });
  });
}

/* ============================================================
   7. LEADERBOARD PREVIEW — render
   ============================================================ */
function getRankClass(rank) {
  if (rank === 1) return 'gold';
  if (rank === 2) return 'silver';
  if (rank === 3) return 'bronze';
  return '';
}

function getRankDisplay(rank) {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return `#${rank}`;
}

function renderLeaderboard(containerId, data, limit) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const rows = limit ? data.slice(0, limit) : data;

  // Header row
  const header = document.createElement('div');
  header.className = 'lb-row lb-header';
  header.setAttribute('role', 'row');
  header.innerHTML = `
    <span role="columnheader">Rank</span>
    <span role="columnheader">Player</span>
    <span role="columnheader">Wins</span>
    <span role="columnheader">Points</span>
  `;
  container.appendChild(header);

  rows.forEach(player => {
    const row = document.createElement('div');
    row.className = 'lb-row';
    row.setAttribute('role', 'row');
    row.innerHTML = `
      <span class="lb-rank ${getRankClass(player.rank)}" aria-label="Rank ${player.rank}">${getRankDisplay(player.rank)}</span>
      <div class="lb-player">
        <div class="lb-avatar" aria-hidden="true">${player.emoji}</div>
        <span class="lb-name">${player.name}</span>
      </div>
      <span class="lb-wins" aria-label="${player.wins} wins">${player.wins}</span>
      <span class="lb-points" aria-label="${player.points} points">${player.points.toLocaleString()}</span>
    `;
    container.appendChild(row);
  });
}

/* ============================================================
   8. NOTIFY FORM — simple client-side feedback
   (wire up to Formspree / Netlify Forms / EmailJS for real mail)
   ============================================================ */
function initNotifyForm() {
  const form = $('#notifyForm');
  const msg  = $('#notifyMsg');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = form.email.value.trim();

    // Basic validation
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      if (msg) {
        msg.style.color = 'var(--clr-danger)';
        msg.textContent = 'Please enter a valid email address.';
      }
      return;
    }

    // === INTEGRATE HERE ===
    // Option A: Formspree — change form action to https://formspree.io/f/YOUR_ID
    // Option B: Netlify Forms — add netlify attribute to <form>
    // Option C: EmailJS — call emailjs.sendForm(...)
    // For now, simulate success:

    if (msg) {
      msg.style.color = 'var(--clr-success)';
      msg.textContent = `You're on the list! We'll ping ${email} when new games drop. 🎉`;
    }
    form.reset();
  });
}

/* ============================================================
   9. SCROLL ANIMATIONS — fade in sections on scroll
   ============================================================ */
function initScrollAnimations() {
  const hero = $('.hero-content');
  if (hero) {
    hero.querySelectorAll('.hero-badge, .hero-title, .hero-subtitle, .hero-actions, .hero-stats').forEach(el => {
      el.classList.add('animate-in');
    });
  }

  // Observe section cards for a subtle entrance
  const targets = document.querySelectorAll('.game-card, .step-card, .cta-card');
  if (!('IntersectionObserver' in window)) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

  targets.forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    el.style.transition = 'opacity 0.4s ease, transform 0.4s cubic-bezier(.16,1,.3,1)';
    observer.observe(el);
  });
}

/* ============================================================
   10. FOOTER YEAR
   ============================================================ */
function setFooterYear() {
  const el = document.getElementById('footerYear');
  if (el) el.textContent = new Date().getFullYear();
}

/* ============================================================
   11. PAGE DETECTION — run page-specific code
   ============================================================ */
function isPage(name) {
  return window.location.pathname.includes(name);
}

/* ============================================================
   12. INIT — run everything
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  initNav();
  setFooterYear();
  initNotifyForm();

  if (!isPage('leaderboard') && !isPage('about') && !isPage('privacy')) {
    // Home page
    initStats();
    initGameCards();
    renderLeaderboard('leaderboardPreview', LEADERBOARD, 5);
    // Delay scroll animations so initial layout is settled
    setTimeout(initScrollAnimations, 100);
  }

  if (isPage('leaderboard')) {
    renderLeaderboard('leaderboardFull', LEADERBOARD);
  }
});

/* Export GAMES and LEADERBOARD so sub-pages can import if needed */
// (Not using ES modules to keep GitHub Pages zero-config. Sub-pages load this file directly.)
