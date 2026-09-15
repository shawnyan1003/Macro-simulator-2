/**
 * Cloudflare Worker entry point.
 *
 * - /api/*  -> shared API logic in lib/api.js, state kept in a D1 database
 * - everything else -> static assets from ./public (served by Wrangler's assets binding)
 */

import model from '../lib/model.js';
import apiModule from '../lib/api.js';

const { createApi } = apiModule;
const { createWorld } = model;

const KEY = 'main';

/* Create the save table on first use, so a fresh D1 database works
   even if the migration SQL was never executed manually. */
let schemaPromise = null;
function ensureSchema(env) {
  if (!schemaPromise) {
    schemaPromise = env.DB.prepare(
      'CREATE TABLE IF NOT EXISTS world (' +
      'id TEXT PRIMARY KEY, data TEXT NOT NULL, rev INTEGER NOT NULL DEFAULT 0, updated_at INTEGER)'
    ).run().catch((err) => {
      console.error('[d1 create table failed]', err);
      schemaPromise = null;         // allow a retry on the next request
    });
  }
  return schemaPromise;
}

async function loadWorld(env) {
  const row = await env.DB.prepare('SELECT data, rev FROM world WHERE id = ?').bind(KEY).first();
  if (row) return { state: JSON.parse(row.data), rev: row.rev || 0 };
  const fresh = createWorld();
  fresh.sessions = {};
  await env.DB.prepare(
    'INSERT OR IGNORE INTO world (id, data, rev, updated_at) VALUES (?, ?, 0, ?)'
  ).bind(KEY, JSON.stringify(fresh), Date.now()).run();
  const again = await env.DB.prepare('SELECT data, rev FROM world WHERE id = ?').bind(KEY).first();
  return { state: JSON.parse(again.data), rev: again.rev || 0 };
}

async function saveWorld(env, state, rev) {
  const data = JSON.stringify(state);
  const res = await env.DB.prepare(
    'UPDATE world SET data = ?, rev = rev + 1, updated_at = ? WHERE id = ? AND rev = ?'
  ).bind(data, Date.now(), KEY, rev).run();
  if ((res && res.meta && res.meta.changes) || 0) return;   // our update landed
  // someone saved first (two students acting at the same moment):
  // overwrite so the newest world always wins
  await env.DB.prepare(
    'UPDATE world SET data = ?, rev = rev + 1, updated_at = ? WHERE id = ?'
  ).bind(data, Date.now(), KEY).run();
}

/** Run one API request; retries if another visitor saved the world at the same moment */
async function handleApi(request, env, ctx) {
  const url = new URL(request.url);
  let body = {};
  if (request.method === 'POST') {
    try {
      const raw = await request.text();
      if (raw) body = JSON.parse(raw);
    } catch (e) {
      body = {};
    }
  }
  url.searchParams.forEach((v, k) => {
    if (body[k] === undefined) body[k] = v;
  });
  const token = body.token || (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');

  await ensureSchema(env);
  const { state, rev } = await loadWorld(env);
  let dirty = false;
  let current = state;
  const api = createApi({
    getState: () => current,
    setState: (s) => { current = s; },
    save: () => { dirty = true; },
    saveSoon: () => { dirty = true; }
  });
  const out = api.handle(request.method, url.pathname, body, token);

  if (dirty) {
    // write behind the response so students never wait for the database
    ctx.waitUntil(saveWorld(env, current, rev).catch((err) => {
      console.error('[d1 write failed]', err);
    }));
  }
  return json(out.body, out.status);
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) return handleApi(request, env, ctx);
    if (env.ASSETS) return env.ASSETS.fetch(request);
    return new Response('Not found', { status: 404 });
  }
};
