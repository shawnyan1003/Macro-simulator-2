'use strict';

/**
 * IBDP Economics HL Macroeconomic Policy Simulator — zero-dependency HTTP server
 * All state is stored in data/state.json, so refreshing the page never loses progress.
 * The API logic itself lives in lib/api.js (shared with the Cloudflare Worker).
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const MODEL = require('./lib/model');
const { createApi } = require('./lib/api');

const ROOT = __dirname;
const PUBLIC = path.join(ROOT, 'public');
const DATA = path.join(ROOT, 'data');
const STATE_FILE = path.join(DATA, 'state.json');
const PORT = Number(process.env.PORT || 3000);

/* ============================ State persistence ============================ */

let state = null;

function ensureDataDir() {
  if (!fs.existsSync(DATA)) fs.mkdirSync(DATA, { recursive: true });
}

function loadState() {
  ensureDataDir();
  if (fs.existsSync(STATE_FILE)) {
    try {
      state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
      if (!state.sessions) state.sessions = {};
      return;
    } catch (err) {
      console.error('[save] could not be read, starting a new game: ', err.message);
    }
  }
  state = MODEL.createWorld();
  state.sessions = {};
  saveState();
}

let saveTimer = null;
function saveState() {
  ensureDataDir();
  const tmp = STATE_FILE + '.tmp';
  try {
    fs.writeFileSync(tmp, JSON.stringify(state));
    fs.renameSync(tmp, STATE_FILE);
  } catch (err) {
    console.error('[save] could not be written: ', err.message);
  }
}
function saveSoon() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => { saveTimer = null; saveState(); }, 200);
}

const api = createApi({
  getState: () => state,
  setState: (s) => { state = s; },
  save: saveState,
  saveSoon
});

/* ============================ HTTP ============================ */

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

function sendJSON(res, code, obj) {
  const buf = Buffer.from(JSON.stringify(obj), 'utf8');
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': buf.length,
    'Cache-Control': 'no-store'
  });
  res.end(buf);
}

function readBody(req) {
  return new Promise((resolve) => {
    let raw = '';
    req.on('data', (d) => {
      raw += d;
      if (raw.length > 2e6) req.destroy();
    });
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); } catch (e) { resolve({}); }
    });
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = decodeURIComponent(url.pathname);

  if (pathname.startsWith('/api/')) {
    let body = {};
    if (req.method === 'POST') body = await readBody(req);
    url.searchParams.forEach((v, k) => {
      if (body[k] === undefined) body[k] = v;
    });
    const token = body.token || (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    const out = api.handle(req.method, pathname, body, token);
    return sendJSON(res, out.status, out.body);
  }

  // static assets
  let file = pathname === '/' ? '/index.html' : pathname;
  const full = path.join(PUBLIC, path.normalize(file).replace(/^(\.\.[/\\])+/, ''));
  if (!full.startsWith(PUBLIC) || !fs.existsSync(full) || !fs.statSync(full).isFile()) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('404 Not Found');
  }
  const ext = path.extname(full).toLowerCase();
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Cache-Control': 'no-store'   // stop the browser caching old front-end code (a refresh is enough after a change)
  });
  fs.createReadStream(full).pipe(res);
});

loadState();
server.listen(PORT, () => {
  console.log('');
  console.log('  🎓 IBDP Macroeconomic Policy Simulator is running');
  console.log(`  👉 Students: http://localhost:${PORT}`);
  console.log(`  🧑‍🏫 Teacher account: ${state.teacher.username} / ${state.teacher.password}`);
  console.log(`  💾 Save file: ${STATE_FILE}`);
  console.log('');
});
