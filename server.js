/**
 * Picknickers Hub — Dev Server
 * Serves static files + provides a game state API with SSE push
 * so players on phones can communicate with the host in real time.
 */
const http = require('http');
const fs   = require('fs');
const path = require('path');
const os   = require('os');

const PORT = 3000;
const ROOT = __dirname;

/* ── Network IP ───────────────────────────────────────────── */
function getNetworkIp() {
  const nets = os.networkInterfaces();
  const candidates = [];
  for (const [name, addrs] of Object.entries(nets)) {
    // Skip virtual/loopback adapters
    if (/loopback|virtualbox|vmware|vethernet|wsl|docker|hyper-v|vbox/i.test(name)) continue;
    for (const iface of addrs) {
      if (iface.family !== 'IPv4' || iface.internal) continue;
      // Skip virtual subnet ranges (VirtualBox=56.x, VMware=128.x/0.x, Docker=172.17-31)
      if (/^192\.168\.56\./.test(iface.address)) continue;
      if (/^172\.(1[7-9]|2\d|3[01])\./.test(iface.address)) continue;
      // Prefer Wi-Fi adapters
      const priority = /wi.?fi|wlan|wireless/i.test(name) ? 0 : 1;
      candidates.push({ priority, address: iface.address });
    }
  }
  candidates.sort((a, b) => a.priority - b.priority);
  return candidates[0]?.address || 'localhost';
}
const NETWORK_IP = getNetworkIp();

/* ── In-memory game store ─────────────────────────────────── */
const games   = {};   // roomCode → gameState
const clients = {};   // roomCode → Set<res>  (SSE connections)

function getGame(room) { return games[room?.toUpperCase()] || null; }

function push(room, event, data) {
  const set = clients[room?.toUpperCase()];
  if (!set || !set.size) return;
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const r of set) { try { r.write(msg); } catch (_) {} }
}

/* ── Helpers ──────────────────────────────────────────────── */
const MIME = {
  '.html': 'text/html', '.css': 'text/css',
  '.js': 'application/javascript', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.woff': 'font/woff',
};

function readBody(req) {
  return new Promise(ok => {
    let s = '';
    req.on('data', c => s += c);
    req.on('end', () => { try { ok(JSON.parse(s || '{}')); } catch { ok({}); } });
  });
}

function send(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(data));
}

/* ── Server ───────────────────────────────────────────────── */
http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  const p = u.pathname;

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  /* ── API ──────────────────────────────────────────────── */
  if (p.startsWith('/api/')) {

    /* GET /api/config */
    if (p === '/api/config' && req.method === 'GET') {
      send(res, 200, {
        networkIp: NETWORK_IP,
        playerUrl: `http://${NETWORK_IP}:${PORT}/games/movie-emoji/player.html`,
      });
      return;
    }

    /* GET /api/events?room=XXXXX  — SSE stream */
    if (p === '/api/events' && req.method === 'GET') {
      const room = (u.searchParams.get('room') || '').toUpperCase();
      if (!room) { send(res, 400, { error: 'room required' }); return; }

      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
      });
      res.write(':\n\n'); // establish connection

      if (!clients[room]) clients[room] = new Set();
      clients[room].add(res);

      // Immediately send current game state so late-joiners sync up
      const game = getGame(room);
      if (game) res.write(`event: state\ndata: ${JSON.stringify(game)}\n\n`);

      const hb = setInterval(() => { try { res.write(':\n\n'); } catch { clearInterval(hb); } }, 20000);
      req.on('close', () => { clearInterval(hb); clients[room]?.delete(res); });
      return;
    }

    /* GET /api/game/state?room=XXXXX */
    if (p === '/api/game/state' && req.method === 'GET') {
      const room = (u.searchParams.get('room') || '').toUpperCase();
      const game = getGame(room);
      if (!game) { send(res, 404, { error: 'Game not found' }); return; }
      send(res, 200, game);
      return;
    }

    const b = await readBody(req);

    /* POST /api/game/create */
    if (p === '/api/game/create' && req.method === 'POST') {
      const room = (b.roomCode || '').toUpperCase();
      if (!room) { send(res, 400, { error: 'roomCode required' }); return; }
      const scores = {};
      (b.playerNames || []).forEach(n => { scores[n] = 0; });
      games[room] = {
        roomCode: room,
        mode: b.mode || 'individual',
        status: 'lobby',
        playerNames: b.playerNames || [],
        joined: {},           // name → true
        currentQuestion: null,
        timerEnd: null,
        submissions: {},      // name → { answer, submittedAt }
        scores,
      };
      clients[room] = clients[room] || new Set();
      send(res, 200, { ok: true });
      return;
    }

    /* POST /api/game/join */
    if (p === '/api/game/join' && req.method === 'POST') {
      const room = (b.room || '').toUpperCase();
      const game = getGame(room);
      if (!game) { send(res, 404, { error: 'Game not found' }); return; }
      const name = b.name || '';
      if (!game.playerNames.includes(name)) { send(res, 400, { error: 'Name not on roster' }); return; }
      // Individual mode: first-come-first-served. Teams mode: allow multiple.
      if (game.mode === 'individual' && game.joined[name]) {
        send(res, 409, { error: 'Name already taken' });
        return;
      }
      game.joined[name] = true;
      push(room, 'player_joined', { name, joined: game.joined });
      send(res, 200, { ok: true });
      return;
    }

    /* POST /api/game/question  — host shows question to players */
    if (p === '/api/game/question' && req.method === 'POST') {
      const room = (b.room || '').toUpperCase();
      const game = getGame(room);
      if (!game) { send(res, 404, { error: 'Game not found' }); return; }
      game.status = 'question';
      game.currentQuestion = b.question;
      game.timerEnd = b.timerEnd || null;
      game.submissions = {};
      push(room, 'question_start', { question: b.question, timerEnd: b.timerEnd });
      send(res, 200, { ok: true });
      return;
    }

    /* POST /api/game/submit  — player submits answer */
    if (p === '/api/game/submit' && req.method === 'POST') {
      const room = (b.room || '').toUpperCase();
      const game = getGame(room);
      if (!game) { send(res, 404, { error: 'Game not found' }); return; }
      game.submissions[b.name] = { answer: b.answer, submittedAt: Date.now() };
      push(room, 'player_submitted', {
        name: b.name,
        totalJoined: Object.keys(game.joined).length,
        totalSubmitted: Object.keys(game.submissions).length,
      });
      send(res, 200, { ok: true });
      return;
    }

    /* POST /api/game/next  — move to next question */
    if (p === '/api/game/next' && req.method === 'POST') {
      const room = (b.room || '').toUpperCase();
      const game = getGame(room);
      if (!game) { send(res, 404, { error: 'Game not found' }); return; }
      game.currentQuestion = null;
      game.submissions = {};
      game.timerEnd = null;
      game.status = 'playing';
      push(room, 'next_question', {});
      send(res, 200, { ok: true });
      return;
    }

    /* POST /api/game/over  — end game */
    if (p === '/api/game/over' && req.method === 'POST') {
      const room = (b.room || '').toUpperCase();
      const game = getGame(room);
      if (!game) { send(res, 404, { error: 'Game not found' }); return; }
      game.status = 'over';
      push(room, 'game_over', { scores: game.scores });
      send(res, 200, { ok: true });
      return;
    }

    send(res, 404, { error: 'Not found' });
    return;
  }

  /* ── Static files ─────────────────────────────────────── */
  const fp   = p === '/' ? '/index.html' : p;
  const full = path.join(ROOT, fp);
  const ext  = path.extname(full).toLowerCase();

  fs.readFile(full, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/html' });
      res.end('<h1>404 Not Found</h1>');
      return;
    }
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  });

}).listen(PORT, '0.0.0.0', () => {
  console.log(`\n🎬 Picknickers Hub running!\n`);
  console.log(`  Local:   http://localhost:${PORT}`);
  console.log(`  Network: http://${NETWORK_IP}:${PORT}\n`);
  console.log(`  Host panel: http://localhost:${PORT}/games/movie-emoji/host.html`);
  console.log(`  TV view:    http://localhost:${PORT}/games/movie-emoji/tv.html`);
  console.log(`  Player:     http://${NETWORK_IP}:${PORT}/games/movie-emoji/player.html`);
  console.log(`\nPress Ctrl+C to stop.\n`);
});
