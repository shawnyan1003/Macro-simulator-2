'use strict';

/**
 * Platform-independent API layer.
 * Used by both the local Node server (server.js) and the Cloudflare Worker
 * (worker/index.js) — it never touches the file system or Node-only globals.
 */

const MODEL = require('./model');
const { ROLES } = require('./countries');
const { TERMS, ALIAS } = require('./glossary');
const { interpret } = require('./policyai');

const IDS = ['A', 'B', 'C'];

/** Random token that works both in Node 18+ and in Cloudflare Workers */
function newToken() {
  const c = globalThis.crypto;
  if (c && c.getRandomValues) {
    const a = new Uint8Array(14);
    c.getRandomValues(a);
    return Array.from(a).map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

/* ============================ Policy validation ============================ */

const P = {
  transfers: [0, 45], ubi: [0, 15],
  taxIncome: [0, 70], taxCorporate: [0, 60], taxCapital: [0, 60], taxConsumption: [0, 40],
  progressivity: [0, 100], directProvision: [0, 15], subsidies: [0, 12],
  priceControls: [0, 100], antiDiscrimination: [0, 100],
  policyRate: [-2, 30], reserveRatio: [0, 30], omoStance: [-5, 5], qeSize: [0, 30],
  ssEducation: [0, 10], ssTech: [0, 10], ssInfra: [0, 10],
  privatisation: [0, 100], deregulation: [0, 100], ppp: [0, 100], outsourcing: [0, 100],
  antitrust: [0, 100], tradeLiberalisation: [0, 100],
  unionPower: [0, 100], minWage: [0, 100], unemploymentBenefit: [0, 100], jobSecurity: [0, 100],
  greenPolicy: [0, 100], fxTarget: [50, 200], fxIntervention: [0, 10], capitalControls: [0, 100]
};
const MIX = { education: [0, 20], health: [0, 20], infrastructure: [0, 20], defence: [0, 20], other: [0, 30] };
const IND = { sme: [0, 100], infant: [0, 100], exportFirm: [0, 100], marketEdu: [0, 100] };
const PAIRS = { tariffs: [0, 200], exportSubsidy: [0, 80], quotas: [0, 100], ntb: [0, 100] };
const PARTNERS = ['A', 'B', 'C', 'ROW'];
const FX_REGIMES = ['fixed', 'managed', 'floating'];

const LABEL = {
  transfers: 'Transfer payments', ubi: 'Universal basic income', taxIncome: 'Personal income tax', taxCorporate: 'Corporate income tax',
  taxCapital: 'Capital tax', taxConsumption: 'Consumption tax', progressivity: 'Tax progressivity',
  directProvision: 'Direct provision', subsidies: 'Subsidies', priceControls: 'Price controls',
  antiDiscrimination: 'Anti-discrimination law', policyRate: 'Policy rate', reserveRatio: 'Required reserve ratio',
  omoStance: 'Open market operations', qeSize: 'Quantitative easing size', ssEducation: 'Education programme',
  ssTech: 'R&D programme', ssInfra: 'Infrastructure programme', privatisation: 'Privatisation',
  deregulation: 'Deregulation', ppp: 'Public-private partnership', outsourcing: 'Outsourcing', antitrust: 'Antitrust enforcement',
  tradeLiberalisation: 'Trade liberalisation', unionPower: 'Trade union power', minWage: 'Minimum wage',
  unemploymentBenefit: 'Unemployment benefit', jobSecurity: 'Job security', greenPolicy: 'Green policy',
  fxTarget: 'Exchange rate target', fxIntervention: 'FX intervention intensity', capitalControls: 'Capital controls',
  fxRegime: 'Exchange rate regime'
};
const MIX_LABEL = { education: 'Education spending', health: 'Health spending', infrastructure: 'Infrastructure spending', defence: 'Defence spending', other: 'Other spending' };
const IND_LABEL = { sme: 'Support for SMEs', infant: 'Infant industry protection', exportFirm: 'Support for exporters', marketEdu: 'Marketised education' };
const PAIR_LABEL = { tariffs: 'Tariff', exportSubsidy: 'Export subsidy', quotas: 'Quota', ntb: 'Non-tariff barriers' };
const PARTNER_LABEL = { A: 'Country A', B: 'Country B', C: 'Country C', ROW: 'Rest of the world' };

function num(v, d) { const x = Number(v); return Number.isFinite(x) ? x : d; }
function cl(v, r) { return Math.max(r[0], Math.min(r[1], v)); }
function fmt(v) { return (Math.round(v * 100) / 100).toString(); }

/** Merge and validate a policy patch, returning a description of the changes */
function applyPolicyPatch(country, patch) {
  const p = country.policy;
  const notes = [];
  const setNum = (obj, key, val, range, label) => {
    const old = obj[key];
    const nv = cl(num(val, old), range);
    if (Math.abs(nv - old) < 1e-9) return;
    obj[key] = nv;
    notes.push(`${label}: ${fmt(old)} → ${fmt(nv)}`);
  };
  Object.keys(P).forEach((k) => {
    if (patch[k] === undefined || patch[k] === null) return;
    setNum(p, k, patch[k], P[k], LABEL[k] || k);
  });
  if (patch.fxRegime && FX_REGIMES.includes(patch.fxRegime) && patch.fxRegime !== p.fxRegime) {
    notes.push(`Exchange rate regime: ${p.fxRegime} → ${patch.fxRegime}`);
    p.fxRegime = patch.fxRegime;
  }
  if (patch.spend) {
    Object.keys(MIX).forEach((k) => {
      if (patch.spend[k] === undefined) return;
      setNum(p.spend, k, patch.spend[k], MIX[k], MIX_LABEL[k]);
    });
  }
  if (patch.industrial) {
    Object.keys(IND).forEach((k) => {
      if (patch.industrial[k] === undefined) return;
      setNum(p.industrial, k, patch.industrial[k], IND[k], IND_LABEL[k]);
    });
  }
  Object.keys(PAIRS).forEach((key) => {
    if (!patch[key]) return;
    PARTNERS.forEach((t) => {
      if (patch[key][t] === undefined) return;
      const label = `${PAIR_LABEL[key]}(${PARTNER_LABEL[t] || t})`;
      setNum(p[key], t, patch[key][t], PAIRS[key], label);
    });
  });
  if (patch.fta) {
    PARTNERS.forEach((t) => {
      if (patch.fta[t] === undefined) return;
      const nv = !!patch.fta[t];
      if (nv !== !!p.fta[t]) {
        p.fta[t] = nv;
        notes.push(`Free trade agreement(${PARTNER_LABEL[t] || t}): ${nv ? 'signed' : 'withdrawn'}`);
      }
    });
  }
  return notes;
}

/* ============================ Router factory ============================ */

/**
 * @param {{ getState:Function, setState:Function, save:Function, saveSoon:Function }} io
 *   getState()  -> current world state (object)
 *   setState(s) -> replace the current world state (used by "reset world")
 *   save()      -> persist now
 *   saveSoon()  -> persist soon (debounced locally, immediate on Workers)
 */
function createApi(io) {
  const getState = io.getState;
  const setState = io.setState;
  const save = io.save || (() => {});
  const saveSoon = io.saveSoon || save;

  function findAccount(username) {
    const state = getState();
    for (const id of IDS) {
      const acc = state.countries[id].accounts.find((a) => a.username === username);
      if (acc) return { acc, countryId: id, country: state.countries[id] };
    }
    return null;
  }

  function sessionUser(token) {
    if (!token) return null;
    const state = getState();
    const s = state.sessions[token];
    if (!s) return null;
    if (s.type === 'teacher') return { type: 'teacher', username: s.username, role: 'teacher', countryId: null };
    const found = findAccount(s.username);
    if (!found) return null;
    return {
      type: 'student', username: s.username, role: found.acc.role,
      countryId: found.countryId, country: found.country,
      isPresident: state.countries[found.countryId].president === s.username,
      acc: found.acc
    };
  }

  function publicState(u) {
    const state = getState();
    const viewer = u ? { countryId: u.countryId, type: u.type } : null;
    const countries = IDS.map((id) => MODEL.publicView(state.countries[id], viewer));
    const out = {
      ok: true,
      phase: state.phase,
      time: state.time,
      world: state.world,
      settings: state.settings,
      weights: state.settings.weights,
      countries,
      events: state.events.slice(0, 60),
      me: u ? {
        username: u.username, role: u.role, type: u.type,
        countryId: u.countryId, isPresident: !!u.isPresident
      } : null,
      templates: IDS.map((id) => ({
        id, templateName: state.countries[id].templateName,
        flag: state.countries[id].flag, mascot: state.countries[id].mascot,
        color: state.countries[id].color,
        tagline: state.countries[id].tagline,
        traits: state.countries[id].traits,
        realData: MODEL.TEMPLATES[id].realData,
        hasPresident: !!state.countries[id].president,
        members: state.countries[id].accounts.map((a) => ({ username: a.username, role: a.role })),
        countryPassword: u && u.type === 'teacher' ? state.countries[id].countryPassword : undefined
      }))
    };
    if (u && u.type === 'teacher') {
      out.allAccounts = IDS.map((id) => ({
        countryId: id,
        countryName: state.countries[id].name,
        countryPassword: state.countries[id].countryPassword,
        president: state.countries[id].president,
        accounts: state.countries[id].accounts.map((a) => ({
          username: a.username, password: a.password, role: a.role
        }))
      }));
      out.teacher = { username: state.teacher.username, password: state.teacher.password };
      out.eventLibrary = MODEL.EVENT_LIBRARY;
    }
    return out;
  }

  const routes = {
    'GET /api/glossary': () => ({
      ok: true,
      terms: TERMS,
      alias: ALIAS
    }),

    'POST /api/login': (body) => {
      const state = getState();
      const username = String(body.username || '').trim();
      const password = String(body.password || '');
      if (!username || !password) return { ok: false, error: 'Please enter a username and password' };
      if (username === state.teacher.username && password === state.teacher.password) {
        const token = newToken();
        state.sessions[token] = { username, type: 'teacher', createdAt: Date.now() };
        saveSoon();
        return { ok: true, token, type: 'teacher' };
      }
      const found = findAccount(username);
      if (!found || found.acc.password !== password) return { ok: false, error: 'Incorrect username or password' };
      const token = newToken();
      state.sessions[token] = {
        username, type: 'student', countryId: found.countryId, createdAt: Date.now()
      };
      saveSoon();
      return { ok: true, token, type: 'student', countryId: found.countryId };
    },

    /** First member: register the government chair and name the country (the country password is set by the teacher) */
    'POST /api/setup': (body) => {
      const state = getState();
      const id = String(body.countryId || '').toUpperCase();
      const c = state.countries[id];
      if (!c) return { ok: false, error: 'Country does not exist' };
      if (c.accounts.length > 0) return { ok: false, error: 'This country already has a chair — join it instead' };
      const username = String(body.username || '').trim();
      const password = String(body.password || '');
      const countryName = String(body.countryName || '').trim();
      const countryPassword = String(body.countryPassword || '');
      if (!username || !password) return { ok: false, error: 'Please complete the username and password' };
      if (countryName.length < 1 || countryName.length > 16) return { ok: false, error: 'The country name must be 1–16 characters' };
      if (!c.countryPassword) {
        return { ok: false, error: 'Your teacher has not set a login password for this country yet — please ask your teacher for it' };
      }
      if (!countryPassword) return { ok: false, error: 'Please enter the country password your teacher gave you' };
      if (countryPassword !== c.countryPassword) return { ok: false, error: 'Incorrect country password' };
      if (findAccount(username)) return { ok: false, error: 'That username is already taken' };
      c.name = countryName;
      c.customNamed = true;
      c.accounts.push({ username, password, role: 'government', createdAt: Date.now() });
      c.president = username;
      MODEL.pushLog(state, c, `🏛️ ${username} was elected the first chair and the country was named “${countryName}”`, 'policy');
      const token = newToken();
      state.sessions[token] = { username, type: 'student', countryId: id, createdAt: Date.now() };
      saveSoon();
      return { ok: true, token };
    },

    'POST /api/register': (body) => {
      const state = getState();
      const id = String(body.countryId || '').toUpperCase();
      const c = state.countries[id];
      if (!c) return { ok: false, error: 'Country does not exist' };
      if (!c.accounts.length) return { ok: false, error: 'No chair account exists for this country yet — a government member must create one first' };
      if (String(body.countryPassword || '') !== c.countryPassword) {
        return { ok: false, error: 'Incorrect country password' };
      }
      const username = String(body.username || '').trim();
      const password = String(body.password || '');
      const role = String(body.role || '');
      if (!ROLES[role]) return { ok: false, error: 'Please choose a valid role' };
      if (!username || !password) return { ok: false, error: 'Please complete the username and password' };
      if (findAccount(username)) return { ok: false, error: 'That username is already taken' };
      const count = c.accounts.filter((a) => a.role === role).length;
      if (count >= state.settings.maxPerRole) {
        return { ok: false, error: `${ROLES[role].label} already has ${count} member(s); the maximum is ${state.settings.maxPerRole}` };
      }
      c.accounts.push({ username, password, role, createdAt: Date.now() });
      MODEL.pushLog(state, c, `👤 ${username} joined the ${ROLES[role].label} team`, 'info');
      const token = newToken();
      state.sessions[token] = { username, type: 'student', countryId: id, createdAt: Date.now() };
      saveSoon();
      return { ok: true, token };
    },

    'POST /api/logout': (body) => {
      const state = getState();
      if (body && body.token) delete state.sessions[body.token];
      saveSoon();
      return { ok: true };
    },

    'GET /api/state': (body, u) => publicState(u),

    'POST /api/policy': (body, u) => {
      const state = getState();
      if (!u) return { ok: false, error: 'Please log in first' };
      if (u.type !== 'teacher' && u.role !== 'government') {
        return { ok: false, error: 'Only the government team can change policy (other roles may table motions)' };
      }
      const id = u.type === 'teacher' ? String(body.countryId || 'A').toUpperCase() : u.countryId;
      const c = state.countries[id];
      if (!c) return { ok: false, error: 'Country does not exist' };
      const notes = applyPolicyPatch(c, body.patch || {});
      if (!notes.length) return { ok: true, changed: 0 };
      MODEL.pushLog(state, c, `📝 Policy change: ${notes.join('; ')}`, 'policy');
      saveSoon();
      return { ok: true, changed: notes.length, notes };
    },

    'POST /api/propose': (body, u) => {
      const state = getState();
      if (!u || u.type === 'teacher') return { ok: false, error: 'Please log in as a student to table a motion' };
      const text = String(body.text || '').trim().slice(0, 300);
      if (!text) return { ok: false, error: 'Please enter the text of the motion' };
      const c = state.countries[u.countryId];
      const role = ROLES[u.role];
      c.proposals = c.proposals || [];
      c.proposals.unshift({
        id: ++state.seq, username: u.username, role: u.role, text,
        t: `${state.time.year}Q${state.time.quarter}`, time: Date.now()
      });
      MODEL.pushLog(state, c, `📣 ${role.icon} ${u.username} (${role.label}) tabled a motion: ${text}`, 'propose');
      saveSoon();
      return { ok: true };
    },

    'POST /api/ai/interpret': (body, u) => {
      const text = String(body.text || '');
      if (!text.trim()) return { ok: false, error: 'Please describe the policy' };
      return { ok: true, result: interpret(text, u ? u.countryId : 'A', getState()) };
    },

    /** Chair: rename the country (once only) */
    'POST /api/country/name': (body, u) => {
      const state = getState();
      if (!u || !u.isPresident) return { ok: false, error: 'Only the chair can rename the country' };
      const c = state.countries[u.countryId];
      if (c.customNamed) return { ok: false, error: 'The country name can only be changed once per game' };
      const name = String(body.name || '').trim();
      if (name.length < 1 || name.length > 16) return { ok: false, error: 'The country name must be 1–16 characters' };
      const old = c.name;
      c.name = name;
      c.customNamed = true;
      MODEL.pushLog(state, c, `🏷️ The country was renamed from “${old}” to “${name}”`, 'policy');
      saveSoon();
      return { ok: true };
    },

    'POST /api/country/password': (body, u) => {
      const state = getState();
      if (!u || !u.isPresident) return { ok: false, error: 'Only the chair can set the country password' };
      const pw = String(body.password || '');
      if (!pw) return { ok: false, error: 'The password cannot be empty' };
      state.countries[u.countryId].countryPassword = pw;
      MODEL.pushLog(state, state.countries[u.countryId], '🔑 Country password updated', 'info');
      saveSoon();
      return { ok: true };
    },

    'POST /api/teacher/advance': (body, u) => {
      const state = getState();
      if (!u || u.type !== 'teacher') return { ok: false, error: 'Only the teacher can advance a quarter' };
      const n = Math.max(1, Math.min(8, Number(body.quarters || 1)));
      for (let i = 0; i < n; i++) {
        MODEL.advanceQuarter(state);
        MODEL.pushLog(state, null,
          `⏭️ Time advanced to Q${state.time.quarter} ${state.time.year}`, 'time');
      }
      if (state.phase === 'setup') state.phase = 'playing';
      save();
      return { ok: true };
    },

    'POST /api/teacher/event': (body, u) => {
      const state = getState();
      if (!u || u.type !== 'teacher') return { ok: false, error: 'Only the teacher can publish an external shock' };
      const ev = MODEL.applyEvent(state, body.eventId, body.targetId || null);
      if (!ev) return { ok: false, error: 'Unknown event' };
      save();
      return { ok: true };
    },

    'POST /api/teacher/weights': (body, u) => {
      const state = getState();
      if (!u || u.type !== 'teacher') return { ok: false, error: 'Only the teacher can adjust the weights' };
      const w = body.weights || {};
      let sum = 0;
      Object.keys(state.settings.weights).forEach((k) => {
        if (w[k] !== undefined) state.settings.weights[k] = Math.max(0, Math.min(1, num(w[k], state.settings.weights[k])));
        sum += state.settings.weights[k];
      });
      Object.keys(state.settings.weights).forEach((k) => {
        state.settings.weights[k] = state.settings.weights[k] / (sum || 1);
      });
      MODEL.computeScores(state);
      save();
      return { ok: true };
    },

    'POST /api/teacher/teacherpw': (body, u) => {
      const state = getState();
      if (!u || u.type !== 'teacher') return { ok: false, error: 'No permission' };
      const pw = String(body.password || '');
      if (!pw) return { ok: false, error: 'The password cannot be empty' };
      state.teacher.password = pw;
      save();
      return { ok: true };
    },

    /** Teacher: set or change the login password of one country (students need it to join) */
    'POST /api/teacher/countrypw': (body, u) => {
      const state = getState();
      if (!u || u.type !== 'teacher') return { ok: false, error: 'Only the teacher can set country passwords' };
      const id = String(body.countryId || '').toUpperCase();
      const c = state.countries[id];
      if (!c) return { ok: false, error: 'Country does not exist' };
      const pw = String(body.password || '').trim();
      c.countryPassword = pw;
      MODEL.pushLog(state, c, pw
        ? `🔑 The teacher set a new login password for ${c.name}`
        : `🔑 The teacher cleared the login password of ${c.name} (nobody can join until a new one is set)`, 'info');
      save();
      return { ok: true };
    },

    'POST /api/teacher/reset': (body, u) => {
      if (!u || u.type !== 'teacher') return { ok: false, error: 'Only the teacher can reset the world' };
      const keepAccounts = !!body.keepAccounts;
      const old = getState();
      let state = MODEL.createWorld();
      state.sessions = {};
      if (keepAccounts) {
        IDS.forEach((id) => {
          state.countries[id].accounts = old.countries[id].accounts;
          state.countries[id].president = old.countries[id].president;
          state.countries[id].name = old.countries[id].name;
          state.countries[id].customNamed = old.countries[id].customNamed;
          state.countries[id].countryPassword = old.countries[id].countryPassword;
        });
      }
      state.phase = 'playing';
      setState(state);
      save();
      return { ok: true };
    },

    'POST /api/teacher/kick': (body, u) => {
      const state = getState();
      if (!u || u.type !== 'teacher') return { ok: false, error: 'No permission' };
      const c = state.countries[String(body.countryId || '').toUpperCase()];
      if (!c) return { ok: false, error: 'Country does not exist' };
      c.accounts = c.accounts.filter((a) => a.username !== body.username);
      if (c.president === body.username) c.president = null;
      Object.keys(state.sessions).forEach((t) => {
        if (state.sessions[t].username === body.username) delete state.sessions[t];
      });
      save();
      return { ok: true };
    }
  };

  /** @returns {{status:number, body:object}} */
  function handle(method, pathname, body, token) {
    const key = `${method} ${pathname}`;
    const handler = routes[key];
    if (!handler) return { status: 404, body: { ok: false, error: 'Endpoint not found' } };
    const u = sessionUser(token || (body && body.token) || '');
    try {
      return { status: 200, body: handler(body || {}, u) };
    } catch (err) {
      console.error('[endpoint error]', key, err);
      return { status: 200, body: { ok: false, error: 'Internal server error: ' + err.message } };
    }
  }

  return { handle, sessionUser, publicState };
}

module.exports = { createApi, IDS, newToken, applyPolicyPatch };
