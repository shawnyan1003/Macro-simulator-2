'use strict';

/* ============================================================
 *  IBDP Economics HL Macroeconomic Policy Simulator — front end
 * ============================================================ */

const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

const S = {
  token: localStorage.getItem('mps_token') || '',
  me: null, data: null, view: 'overview',
  sel: null, ptab: 'fiscal', dirty: false,
  terms: null, lastIndex: -1, chartKeys: ['gdp', 'inflation', 'unemployment']
};

/* ---------------- helpers ---------------- */
const nf = (v, d) => (v === undefined || v === null || !Number.isFinite(Number(v)))
  ? '—' : Number(v).toLocaleString('en-US', {
    minimumFractionDigits: (d === undefined ? 2 : d),
    maximumFractionDigits: (d === undefined ? 2 : d)
  });
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ---------------- bilingual helpers (see i18n.js) ---------------- */
const T = (s) => (window.I18N ? window.I18N.t(s) : s);
const applyI18n = (root) => { if (window.I18N) window.I18N.apply(root); };
function bindLang() {
  $$('.lang-btn').forEach((b) => {
    if (b._lang) return;
    b._lang = 1;
    b.addEventListener('click', () => { if (window.I18N) window.I18N.toggle(); });
  });
  if (window.I18N) window.I18N.updateButtons();
}
/* Re-render everything after the language changed */
function refreshI18n() {
  if (S.data) { renderHeader(); render(); }
  if ($('#login') && !$('#login').classList.contains('hidden') && pickerData.length) renderJoin();
  applyI18n(document);
  if (window.I18N) window.I18N.updateButtons();
}
window.refreshI18n = refreshI18n;

function toast(msg, ms) {
  const el = $('#toast');
  el.textContent = T(msg);
  el.classList.remove('hidden');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.add('hidden'), ms || 2200);
}
function openModal(html) {
  $('#modalBody').innerHTML = html;
  $('#modal').classList.remove('hidden');
  applyI18n($('#modalBody'));
}
function closeModal() { $('#modal').classList.add('hidden'); }

async function api(path, body) {
  const hasQ = path.indexOf('?') >= 0;
  const url = path + (hasQ ? '&' : '?') + 'token=' + encodeURIComponent(S.token || '');
  const opt = body
    ? { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(Object.assign({ token: S.token }, body)) }
    : {};
  try {
    const r = await fetch(body ? path : url, opt);
    return await r.json();
  } catch (e) {
    return { ok: false, error: 'Network error: ' + e.message };
  }
}

/* ---------------- term definitions (double-click) ---------------- */
let TERM_RE = null;
const TERM_MAP = new Map();

function buildTermIndex(terms, zh) {
  const surfaces = [];
  const push = (surface, key) => {
    const s = String(surface == null ? '' : surface).trim();
    if (!s) return;
    if (/^[\x00-\x7F]+$/.test(s)) { if (s.length < 4) return; }
    else if (s.length < 2) return;
    const k = s.toLowerCase();
    if (!TERM_MAP.has(k)) { TERM_MAP.set(k, key); surfaces.push(s); }
  };
  Object.keys(terms || {}).forEach((k) => {
    push(k, k);
    if (terms[k] && terms[k].en) push(terms[k].en, k);
  });
  Object.keys(zh || {}).forEach((z) => push(z, zh[z]));
  surfaces.sort((a, b) => b.length - a.length);
  const parts = surfaces.map((s) => {
    const e = s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return /^[\x00-\x7F]+$/.test(s) ? '\\b' + e + '\\b' : e;
  });
  TERM_RE = parts.length ? new RegExp('(' + parts.join('|') + ')', 'gi') : null;
}

const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'SELECT', 'SVG', 'OPTION']);
function enhance(root) {
  if (!root || !TERM_RE) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const p = node.parentElement;
      if (!p) return NodeFilter.FILTER_REJECT;
      if (SKIP.has(p.tagName) || p.classList.contains('term')) return NodeFilter.FILTER_REJECT;
      if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  const list = [];
  while (walker.nextNode()) list.push(walker.currentNode);
  list.forEach((node) => {
    const txt = node.nodeValue;
    TERM_RE.lastIndex = 0;
    if (!TERM_RE.test(txt)) return;
    const frag = document.createDocumentFragment();
    let last = 0;
    TERM_RE.lastIndex = 0;
    let m;
    while ((m = TERM_RE.exec(txt)) !== null) {
      if (m[0].length === 0) { TERM_RE.lastIndex++; continue; }
      if (m.index > last) frag.appendChild(document.createTextNode(txt.slice(last, m.index)));
      const span = document.createElement('span');
      span.className = 'term';
      span.textContent = m[0];
      span.dataset.k = TERM_MAP.get(m[0].toLowerCase()) || '';
      frag.appendChild(span);
      last = m.index + m[0].length;
    }
    if (last < txt.length) frag.appendChild(document.createTextNode(txt.slice(last)));
    node.parentNode.replaceChild(frag, node);
  });
}

let tipTerm = null;
document.addEventListener('dblclick', (e) => {
  const t = e.target && e.target.closest ? e.target.closest('.term') : null;
  if (!t) return;
  e.preventDefault();
  const sel = window.getSelection();
  if (sel && sel.removeAllRanges) sel.removeAllRanges();   // a double click normally selects the word
  if (tipTerm && tipTerm !== t) tipTerm.classList.remove('term-on');
  tipTerm = t;
  t.classList.add('term-on');
  showTip(t, { x: e.clientX, y: e.clientY });
});
/* close the definition: click anywhere else, press Esc, or scroll */
document.addEventListener('mousedown', (e) => {
  const tip = $('#tip');
  if (!tip || tip.classList.contains('hidden')) return;
  if (e.target && e.target.closest && e.target.closest('#tip')) return;
  hideTip();
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hideTip(); });
window.addEventListener('scroll', hideTip, true);
function showTip(el, ev) {
  const key = el.dataset.k;
  const t = S.terms && S.terms[key];
  if (!t) return;
  const tip = $('#tip');
  tip.innerHTML = '<b>' + esc(t.en || key) + '</b> <span class="cat">' + esc(t.cat || 'Term') + '</span>'
    + '<div>' + esc(t.def || '') + '</div>'
    + '<div class="tip-foot">Click anywhere to close</div>';
  tip.classList.remove('hidden');
  applyI18n(tip);
  const w = 320;
  let x = (ev ? ev.x : 0) + 14, y = (ev ? ev.y : 0) + 14;
  if (x + w > window.innerWidth) x = Math.max(8, window.innerWidth - w - 10);
  if (y + tip.offsetHeight > window.innerHeight) y = Math.max(8, window.innerHeight - tip.offsetHeight - 10);
  tip.style.left = x + 'px';
  tip.style.top = y + 'px';
}
function hideTip() {
  const tip = $('#tip');
  if (tip) tip.classList.add('hidden');
  if (tipTerm) { tipTerm.classList.remove('term-on'); tipTerm = null; }
}

/* ---------------- line chart ---------------- */
function chart(labels, series) {
  const W = 760, H = 250, pl = 46, pr = 16, pt = 14, pb = 26;
  const iw = W - pl - pr, ih = H - pt - pb, n = labels.length;
  if (!n) return '<div class="hint">No historical data yet</div>';
  let out = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none">';
  for (let g = 0; g <= 4; g++) {
    const y = pt + ih * g / 4;
    out += '<line x1="' + pl + '" y1="' + y + '" x2="' + (W - pr) + '" y2="' + y + '" stroke="#e6e6ee" stroke-width="1"/>';
  }
  let first = null;
  series.forEach((s) => {
    const vs = s.data.filter((x) => Number.isFinite(x));
    if (!vs.length) return;
    let mn = Math.min.apply(null, vs), mx = Math.max.apply(null, vs);
    if (mn === mx) { mn -= 1; mx += 1; }
    const pad = (mx - mn) * 0.1; mn -= pad; mx += pad;
    if (!first) first = [mn, mx];
    const X = (i) => pl + (n === 1 ? iw / 2 : iw * i / (n - 1));
    const Y = (v) => pt + ih - ih * (v - mn) / (mx - mn);
    const pts = s.data.map((v, i) => (Number.isFinite(v) ? X(i).toFixed(1) + ',' + Y(v).toFixed(1) : null))
      .filter(Boolean).join(' ');
    out += '<polyline points="' + pts + '" fill="none" stroke="' + s.color
      + '" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>';
    s.data.forEach((v, i) => {
      if (!Number.isFinite(v)) return;
      out += '<circle cx="' + X(i).toFixed(1) + '" cy="' + Y(v).toFixed(1)
        + '" r="3" fill="#fff" stroke="' + s.color + '" stroke-width="2"/>';
    });
  });
  if (first) {
    out += '<text x="4" y="' + (pt + 9) + '" font-size="10" fill="#5b5b70">' + nf(first[1], 1) + '</text>';
    out += '<text x="4" y="' + (pt + ih) + '" font-size="10" fill="#5b5b70">' + nf(first[0], 1) + '</text>';
  }
  const step = Math.max(1, Math.ceil(n / 8));
  labels.forEach((l, i) => {
    if (i % step === 0 || i === n - 1) {
      out += '<text x="' + (pl + iw * i / (n - 1 || 1)).toFixed(1) + '" y="' + (H - 8)
        + '" font-size="10" text-anchor="middle" fill="#5b5b70">' + esc(l) + '</text>';
    }
  });
  out += '</svg>';
  return out;
}

const SERIES = {
  gdp: { n: 'Real GDP', f: 'gdp' }, growth: { n: 'Real growth %', f: 'growth' },
  potential: { n: 'Potential output', f: 'potential' }, gap: { n: 'Output gap %', f: 'gap' },
  inflation: { n: 'Inflation %', f: 'inflation' }, unemployment: { n: 'Unemployment %', f: 'unemployment' },
  debt: { n: 'Debt/GDP %', f: 'debt' }, gini: { n: 'Gini coefficient', f: 'gini' },
  mpi: { n: 'MPI %', f: 'mpi' }, hdi: { n: 'HDI', f: 'hdi' }, hpi: { n: 'HPI', f: 'hpi' },
  ca: { n: 'Current account %', f: 'ca' }, exports: { n: 'Exports', f: 'exports' },
  imports: { n: 'Imports', f: 'imports' }, fx: { n: 'Exchange rate index', f: 'fx' },
  score: { n: 'Composite index', f: 'score' }, education: { n: 'Human capital', f: 'education' },
  technology: { n: 'Technology', f: 'technology' }, infrastructure: { n: 'Infrastructure', f: 'infrastructure' },
  competition: { n: 'Market competition', f: 'competition' }
};
const CLR = ['#3d7bf5', '#e8503a', '#12a87b'];

/* ---------------- login ---------------- */
let pickerData = [];
let picked = 'A';

async function loadPicker() {
  const r = await api('/api/state');
  if (!r || !r.ok) return;
  pickerData = r.templates || [];
  const wrap = $('#countryPicker');
  wrap.innerHTML = pickerData.map((t) => `
    <div class="cpick ${t.id === picked ? 'sel' : ''}" data-id="${t.id}">
      <div class="fl">${t.flag || '🏳️'}</div>
      <h4>${esc(t.templateName)}</h4>
      <div class="tag">${esc(t.tagline || '')}</div>
      <div class="traits">${(t.traits || []).map((x) => '<span>' + esc(x) + '</span>').join('')}</div>
      <div class="mk ${t.hasPresident ? 'taken' : 'free'}">
        ${t.hasPresident ? (t.members.length + ' joined · country password required') : '🆓 Not founded yet · first chair names it'}
        ${t.countryPassword === undefined ? '' : ' · ' + (t.countryPassword ? '🔑 ' + esc(t.countryPassword) : '⚠️ no password set')}</div>
    </div>`).join('');
  $$('.cpick', wrap).forEach((el) => el.addEventListener('click', () => {
    picked = el.dataset.id;
    $$('.cpick', wrap).forEach((x) => x.classList.toggle('sel', x.dataset.id === picked));
    renderJoin();
  }));
  renderJoin();
  applyI18n($('#login'));
  enhance($('#login'));
}

function roleLabel(k) {
  return ({ government: 'Government', labor: 'Labour', firms: 'Firms', teacher: 'Teacher' })[k] || k;
}
function roleDesc(k) {
  return ({
    government: 'Set fiscal / monetary / supply-side / trade policy',
    labor: 'Represent workers: table wage and employment motions',
    firms: 'Represent firms: table investment and business motions'
  })[k] || '';
}

function renderJoin() {
  const t = pickerData.find((x) => x.id === picked);
  if (!t) return;
  const box = $('#joinForm');
  box.classList.remove('hidden');
  if (!t.hasPresident) {
    box.innerHTML = `
      <h3>🏛️ Create the chair account of “${esc(t.templateName)}”</h3>
      <p class="hint">${T('You are the first member of this country, so you automatically become its <b>chair</b> and can <b>name the country (once per game)</b>. Your teammates join with the same <b>country password</b>, which your <b>teacher</b> sets and gives to the whole group.')}</p>
      <div class="grid g2">
        <label>Country name (1–16 characters)<input type="text" id="jCountryName" maxlength="16" value="${esc(t.templateName)}" /></label>
        <label>Country password (set by your teacher)<input type="password" id="jCountryPass" /></label>
        <label>Your username<input type="text" id="jUser" autocomplete="username" /></label>
        <label>Your password<input type="password" id="jPass" autocomplete="new-password" /></label>
      </div>
      <button class="btn primary block" id="btnSetup">Found the country &amp; enter</button>`;
    $('#btnSetup').onclick = async () => {
      const r = await api('/api/setup', {
        countryId: picked,
        countryName: $('#jCountryName').value.trim(),
        countryPassword: $('#jCountryPass').value,
        username: $('#jUser').value.trim(),
        password: $('#jPass').value
      });
      afterAuth(r);
    };
  } else {
    box.innerHTML = `
      <h3>🙋 Join “${esc(t.templateName)}”</h3>
      <p class="hint">Members: ${(t.members || []).map((m) => esc(m.username) + ' (' + roleLabel(m.role) + ')').join(', ') || '—'}</p>
      <label>Country password (ask your teacher)<input type="password" id="jCountryPass" /></label>
      <label>My role
        <div class="country-picker" style="grid-template-columns:repeat(3,1fr);margin-top:6px">
          ${[['government', '🏛️', 'Government'], ['labor', '👷', 'Labour'], ['firms', '🏭', 'Firms']].map((r, i) => `
            <div class="cpick ${i === 0 ? 'sel' : ''}" data-role="${r[0]}" style="padding:8px">
              <div class="fl">${r[1]}</div><h4 style="font-size:15px">${r[2]}</h4>
              <div class="tag" style="min-height:auto">${roleDesc(r[0])}</div>
            </div>`).join('')}
        </div>
      </label>
      <div class="grid g2">
        <label>My username<input type="text" id="jUser" autocomplete="username" /></label>
        <label>My password<input type="password" id="jPass" autocomplete="new-password" /></label>
      </div>
      <button class="btn primary block" id="btnJoin">Join this country</button>`;
    $$('.cpick[data-role]', box).forEach((el) => el.addEventListener('click', () => {
      $$('.cpick[data-role]', box).forEach((x) => x.classList.toggle('sel', x === el));
    }));
    $('#btnJoin').onclick = async () => {
      const sel = $('.cpick.sel[data-role]', box);
      const r = await api('/api/register', {
        countryId: picked,
        countryPassword: $('#jCountryPass').value,
        role: sel ? sel.dataset.role : 'government',
        username: $('#jUser').value.trim(),
        password: $('#jPass').value
      });
      afterAuth(r);
    };
  }
  applyI18n(box);
  enhance(box);
}

function afterAuth(r) {
  if (!r || !r.ok) return toast((r && r.error) || 'Something went wrong');
  S.token = r.token;
  localStorage.setItem('mps_token', r.token);
  toast('Logged in — welcome to government!');
  boot();
}

/* ---------------- start-up ---------------- */
let polling = false;
async function boot() {
  bindLogin();                     // login-screen events: bind them regardless of login state
  if (!S.terms) {
    try {
      const g = await fetch('/api/glossary');
      const gr = await g.json();
      if (gr && gr.ok) { S.terms = gr.terms; buildTermIndex(gr.terms, gr.alias); }
    } catch (e) { /* ignore */ }
  }
  if (!S.token) { showLogin(); return; }
  const r = await api('/api/state');
  if (!r.ok || !r.me) { S.token = ''; localStorage.removeItem('mps_token'); showLogin(); return; }
  $('#login').classList.add('hidden');
  $('#game').classList.remove('hidden');
  S.me = r.me;
  S.data = r;
  S.sel = (r.me.countryId || 'A');
  S.lastIndex = r.time.index;
  $('#tabTeacher').classList.toggle('hidden', r.me.type !== 'teacher');
  bindStatic();
  renderHeader();
  render();
  if (!polling) { setInterval(poll, window.MPS_POLL_MS || 5000); polling = true; }
}

function showLogin() {
  $('#game').classList.add('hidden');
  $('#login').classList.remove('hidden');
  loadPicker();
}

async function poll() {
  const r = await api('/api/state');
  if (!r.ok || !r.me) return;
  const prev = S.data ? S.data.time.index : -1;
  S.data = r;
  S.me = r.me;
  renderHeader();
  if (prev >= 0 && r.time.index > prev) toast('⏭️ New quarter: ' + r.time.year + ' Q' + r.time.quarter);
  if (!(S.view === 'policy' && S.dirty)) render();
}

function bindStatic() {
  if (bindStatic._d) return;
  bindStatic._d = 1;
  $$('.tab').forEach((b) => b.addEventListener('click', () => {
    S.view = b.dataset.v;
    $$('.tab').forEach((x) => x.classList.toggle('active', x === b));
    $$('.view').forEach((v) => v.classList.add('hidden'));
    $('#view-' + S.view).classList.remove('hidden');
    render();
  }));
  $('#btnLogout').onclick = async () => {
    await api('/api/logout', {});
    S.token = ''; localStorage.removeItem('mps_token');
    location.reload();
  };
  $('#btnGlossary').onclick = openGlossary;
  $('#modalX').onclick = closeModal;
  bindLang();
  $('#modal').addEventListener('click', (e) => { if (e.target === $('#modal')) closeModal(); });
}

/* Login-screen events: must be bound as soon as the login view is shown */
function bindLogin() {
  if (bindLogin._d) return;
  bindLogin._d = 1;
  $$('.tmini').forEach((b) => b.addEventListener('click', () => {
    $$('.tmini').forEach((x) => x.classList.toggle('active', x === b));
    $('#pane-student').classList.toggle('hidden', b.dataset.lt !== 'student');
    $('#pane-teacher').classList.toggle('hidden', b.dataset.lt !== 'teacher');
    if (b.dataset.lt === 'teacher') setTimeout(() => { const el = $('#tPass'); if (el) el.focus(); }, 30);
  }));
  const submit = async () => {
    const r = await api('/api/login', { username: $('#tUser').value.trim(), password: $('#tPass').value });
    afterAuth(r);
  };
  const btn = $('#btnTeacherLogin');
  if (btn) btn.addEventListener('click', submit);
  ['#tUser', '#tPass'].forEach((sel) => {
    const el = $(sel);
    if (el) el.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
  });
  bindLang();
}

/* ---------------- header ---------------- */
function own() {
  if (!S.data) return null;
  const id = S.me.type === 'teacher' ? (S.sel || 'A') : (S.me.countryId || 'A');
  return S.data.countries.find((c) => c.id === id) || S.data.countries[0];
}
function observed() {
  if (!S.data) return null;
  return S.data.countries.find((c) => c.id === (S.sel || 'A')) || S.data.countries[0];
}

function renderHeader() {
  const d = S.data, m = S.me;
  const c = own(), o = observed();
  if (!c) return;
  $('#hMascot').textContent = c.mascot || '🏳️';
  $('#hCountry').textContent = m.type === 'teacher'
    ? 'Teacher console · ' + (o ? o.name : '')
    : c.name + (o && o.id !== c.id ? ' · viewing ' + o.name : '');
  $('#hRole').textContent = m.type === 'teacher' ? 'Teacher' : roleLabel(m.role) + (m.isPresident ? ' · Chair' : '');
  $('#hMembers').textContent = c.members.length + (c.members.length === 1 ? ' member' : ' members');
  $('#hTime').textContent = d.time.year + ' Q' + d.time.quarter;
  $('#hPhase').textContent = d.phase === 'setup' ? 'Setup · waiting for the teacher' : 'Governing';
  const sc = o ? o.econ.score : 0;
  const h0 = (o && o.history && o.history.length) ? o.history[0].score : sc;
  const gain = sc - h0;
  $('#hScore').innerHTML = nf(sc, 1) + ' <small class="' + (gain >= 0 ? 'up' : 'down') + '">'
    + (gain >= 0 ? '▲' : '▼') + nf(Math.abs(gain), 1) + '</small>';
  applyI18n($('.topbar'));
}

/* ---------------- render entry ---------------- */
function render() {
  if (!S.data) return;
  const fn = ({
    overview: renderOverview, data: renderData, policy: renderPolicy,
    world: renderWorld, feed: renderFeed, team: renderTeam, teacher: renderTeacher
  })[S.view];
  const el = $('#view-' + S.view);
  if (fn) el.innerHTML = fn();
  bindView();
  applyI18n(el);
  enhance(el);
}
function bindView() {
  if (S.view === 'policy') bindPolicy();
  if (S.view === 'data') bindData();
  if (S.view === 'team') bindTeam();
  if (S.view === 'teacher') bindTeacher();
  bindSeries();
}

function kpi(k, v, d, cls) {
  return '<div class="kpi"><div class="k"><span>' + k + '</span></div>'
    + '<div class="v ' + (cls || '') + '">' + v + '</div><div class="d">' + (d || '') + '</div></div>';
}

/* ---------------- overview ---------------- */
function renderOverview() {
  const c = own(), d = S.data;
  if (!c) return '';
  const e = c.econ;
  const h0 = c.history[0] || {};
  const gain = e.score - (h0.score || e.score);
  const ranked = d.countries.slice().sort((a, b) => b.econ.score - a.econ.score);
  const rank = ranked.findIndex((x) => x.id === c.id) + 1;
  const inflOk = Math.abs(e.inflation - e.inflationTarget) < 1.2;

  return `
  <div class="card" style="background:linear-gradient(120deg,#fff, ${c.color}22)">
    <h3>${c.mascot} ${esc(c.name)}
      <span class="pill">${esc(c.tagline || '')}</span></h3>
    <div class="tagline">Global environment: inflation ${nf(d.world.inflation, 1)}% · world growth ${nf(d.world.growth, 1)}% · ${d.time.index} quarter(s) elapsed</div>
  </div>

  <div class="card">
    <h3>🏆 Composite Economic Health Index</h3>
    <div class="grid g4">
      ${kpi('Current index', nf(e.score, 1), 'Start ' + nf(h0.score || 0, 1) + ' · change <b class="' + (gain >= 0 ? 'up' : 'down') + '">' + (gain >= 0 ? '+' : '') + nf(gain, 1) + '</b>')}
      ${kpi('Current rank', '#' + rank, '3 countries · the winner is decided by the gain in the index')}
      ${kpi('Output gap', nf(e.gap, 2) + '%', e.gap > 0.5 ? 'Overheating' : (e.gap < -0.5 ? 'Weak demand' : 'Near potential output'))}
      ${kpi('Your role', S.me.type === 'teacher' ? 'Teacher' : roleLabel(S.me.role) + (S.me.isPresident ? ' · Chair' : ''),
        (S.me.type === 'teacher' || S.me.role === 'government') ? 'Can submit policies' : 'Can submit proposals')}
    </div>
    <hr class="sep" />
    <div class="bars">${scoreBars(e)}</div>
  </div>

  <div class="card">
    <h3>📌 Core macroeconomic indicators</h3>
    <div class="grid g4">
      ${kpi('Real GDP', nf(e.gdp, 0) + ' <small>bn</small>', 'PPP per capita ' + nf(e.gdpPerCapitaPPP, 0) + ' int$')}
      ${kpi('Real growth', nf(e.growth, 2) + '%', 'Potential growth ' + nf(e.potentialGrowth, 2) + '%')}
      ${kpi('Inflation', nf(e.inflation, 2) + '%', 'Target ' + nf(e.inflationTarget, 1) + '% · expected ' + nf(e.inflationExp, 2) + '%', inflOk ? 'up' : (Math.abs(e.inflation - e.inflationTarget) > 3 ? 'down' : ''))}
      ${kpi('Unemployment', nf(e.unemployment, 2) + '%', 'NAIRU ' + nf(e.nairu, 2) + '%', e.unemployment <= e.nairu ? 'up' : 'down')}
      ${kpi('Government debt/GDP', nf(e.govDebt, 1) + '%', 'Budget balance ' + nf(e.budgetBalance, 2) + '% of GDP')}
      ${kpi('Current account/GDP', nf(e.currentAccount, 2) + '%', 'Exports ' + nf(e.exports, 0) + ' / imports ' + nf(e.imports, 0) + ' (US$100m)')}
      ${kpi('Gini coefficient', nf(e.gini, 3), 'MPI ' + nf(e.mpi, 2) + '%')}
      ${kpi('HDI / HPI', nf(e.hdi, 3) + ' / ' + nf(e.hpi, 1), 'Life expectancy ' + nf(e.lifeExpectancy, 1) + ' years')}
    </div>
  </div>

  <div class="card">
    <h3>🧭 Policy stance and structure</h3>
    <div class="grid g2">
      <div>${stanceBar('Fiscal stance', e.fiscalImpulse)}${stanceBar('Monetary stance', e.monetaryImpulse)}${stanceBar('Net export impulse', e.nxImpulse)}</div>
      <div>
        <div class="hint">Confidence: business ${nf(e.businessConfidence, 0)} · consumer ${nf(e.consumerConfidence, 0)} · sovereign risk ${nf(e.sovereignRisk, 2)}pp</div>
        <div class="hint">Expenditure structure: C ${nf(e.compC, 1)}% · I ${nf(e.compI, 1)}% · G ${nf(e.compG, 1)}% · X ${nf(e.compX, 1)}% · M ${nf(e.compM, 1)}%</div>
        <div class="hint">Supply side: human capital ${nf(e.education, 0)} · technology ${nf(e.technology, 0)} · infrastructure ${nf(e.infrastructure, 0)} · competition ${nf(e.competition, 0)}</div>
      </div>
    </div>
  </div>

  <div class="card">
    <h3>📈 Economic trends</h3>
    ${seriesPicker()}
    <div class="chart-wrap">${chart(c.history.map((h) => h.label), S.chartKeys.map((k, i) => ({
      name: SERIES[k].n, data: c.history.map((h) => h[SERIES[k].f]), color: CLR[i % 3]
    })))}</div>
    <div class="legend">${S.chartKeys.map((k, i) => '<span><i style="background:' + CLR[i % 3] + '"></i>' + SERIES[k].n + '</span>').join('')}</div>
  </div>`;
}

function scoreBars(e) {
  const p = e.scoreParts || {};
  const W = {
    gdpPerCapita: 'Income per head', growth: 'Growth', unemployment: 'Employment', inflation: 'Price stability',
    debt: 'Debt sustainability', hdi: 'Human development', hpi: 'Happy planet', gini: 'Income distribution',
    mpi: 'Multidimensional poverty', currentAccount: 'Current account'
  };
  return Object.keys(W).map((k) => {
    const v = p[k] === undefined ? 0 : p[k];
    const cls = v > 70 ? 'g' : (v > 45 ? 'y' : 'r');
    return '<div class="bar-row"><span>' + W[k] + '</span>'
      + '<span class="bar ' + cls + '"><i style="width:' + clamp(v, 0, 100) + '%"></i></span>'
      + '<span style="text-align:right">' + nf(v, 0) + '</span></div>';
  }).join('');
}

function stanceBar(name, v) {
  const w = clamp(Math.abs(v) * 22, 2, 100);
  const pos = v >= 0;
  return '<div class="bar-row"><span>' + name + '</span>'
    + '<span class="bar ' + (pos ? 'g' : 'r') + '"><i style="width:' + w + '%"></i></span>'
    + '<span style="text-align:right;color:' + (pos ? '#12a87b' : '#e8503a') + '">'
    + (pos ? 'Expansionary ' : 'Contractionary ') + nf(Math.abs(v), 2) + '</span></div>';
}

function seriesPicker() {
  return '<div class="subtabs">' + Object.keys(SERIES).map((k) =>
    '<button class="subtab ' + (S.chartKeys.indexOf(k) >= 0 ? 'active' : '') + '" data-sk="' + k + '">'
    + SERIES[k].n + '</button>').join('') + '</div>';
}
function bindSeries() {
  $$('.subtab[data-sk]').forEach((b) => b.addEventListener('click', () => {
    const k = b.dataset.sk;
    if (!k) return;
    const i = S.chartKeys.indexOf(k);
    if (i >= 0) S.chartKeys.splice(i, 1);
    else { S.chartKeys.push(k); if (S.chartKeys.length > 3) S.chartKeys.shift(); }
    render();
  }));
}

/* ---------------- economic data ---------------- */
function renderData() {
  const c = observed(), d = S.data;
  if (!c) return '';
  const e = c.econ;
  const rows = [
    ['Population (millions)', nf(e.pop, 1)], ['GDP per capita (US$)', nf(e.gdpPerCapita, 0)],
    ['GDP per capita (PPP int$)', nf(e.gdpPerCapitaPPP, 0)],
    ['Real GDP (bn domestic currency)', nf(e.gdp, 0)], ['Potential output', nf(e.potential, 0)],
    ['Real growth %', nf(e.growth, 2)], ['Potential growth %', nf(e.potentialGrowth, 2)],
    ['Output gap %', nf(e.gap, 2)], ['Price level (base = 100)', nf(e.priceLevel, 1)],
    ['Inflation %', nf(e.inflation, 2)], ['Expected inflation %', nf(e.inflationExp, 2)],
    ['Central bank target %', nf(e.inflationTarget, 1)], ['Unemployment %', nf(e.unemployment, 2)],
    ['NAIRU %', nf(e.nairu, 2)], ['Government revenue/GDP %', nf(e.revenueGDP, 2)],
    ['Government spending/GDP %', nf(e.spendGDP, 2)], ['Transfers/GDP %', nf(e.transGDP, 2)],
    ['Debt interest/GDP %', nf(e.interestGDP, 2)], ['Budget balance/GDP %', nf(e.budgetBalance, 2)],
    ['Tariff revenue/GDP %', nf(e.tariffRevenue, 2)], ['Government debt/GDP %', nf(e.govDebt, 1)],
    ['Policy rate %', nf(e.policyRate, 2)], ['Long-term rate %', nf(e.longRate, 2)],
    ['Corporate borrowing cost %', nf(e.borrowingCost, 2)], ['Real borrowing cost %', nf(e.realBorrowing, 2)],
    ['Neutral real rate %', nf(e.neutralReal, 2)], ['Monetary conditions index', nf(e.moneyIndex, 1)],
    ['Exports (US$100m)', nf(e.exports, 0)], ['Imports (US$100m)', nf(e.imports, 0)],
    ['Net exports (US$100m)', nf(e.netExports, 0)], ['Current account/GDP %', nf(e.currentAccount, 2)],
    ['Trade openness %', nf(e.tradeOpennessRatio, 1)],
    ['Exchange rate (domestic/USD)', nf(e.fx, 2) + ' · index ' + nf(e.fxIndex, 1)],
    ['Exchange rate regime', e.fxRegime === 'fixed' ? 'Fixed' : (e.fxRegime === 'managed' ? 'Managed float' : 'Free float')],
    ['FX reserves (US$100m)', nf(e.fxReserves, 0)],
    ['Gini coefficient', nf(e.gini, 3)], ['MPI %', nf(e.mpi, 2)],
    ['HDI', nf(e.hdi, 3)], ['HPI', nf(e.hpi, 1)],
    ['Wellbeing (0–10)', nf(e.wellbeing, 2)], ['Life expectancy (years)', nf(e.lifeExpectancy, 1)],
    ['Ecological footprint', nf(e.footprint, 2)], ['Environmental quality (0–100)', nf(e.envQuality, 0)],
    ['Human capital (0–100)', nf(e.education, 0)], ['Health care (0–100)', nf(e.health, 0)],
    ['Infrastructure (0–100)', nf(e.infrastructure, 0)], ['Technology (0–100)', nf(e.technology, 0)],
    ['Market competition (0–100)', nf(e.competition, 0)], ['Regulatory burden (0–100)', nf(e.regulationBurden, 0)],
    ['Trade openness (0–100)', nf(e.tradeOpenness, 0)],
    ['Business confidence', nf(e.businessConfidence, 0)], ['Consumer confidence', nf(e.consumerConfidence, 0)],
    ['Credit health (0–100)', nf(e.creditHealth, 0)]
  ];
  const tpl = (d.templates || []).find((t) => t.id === c.id) || {};
  return `
  <div class="card">
    <h3>🔎 Observing
      ${d.countries.map((x) => '<button class="btn sm ' + (x.id === c.id ? 'primary' : 'ghost') + '" data-sel="' + x.id + '">'
        + x.mascot + ' ' + esc(x.name) + '</button>').join(' ')}
    </h3>
    <div class="hint">Other countries’ policy details (tax rates, interest rates, spending composition) are hidden — you can only see macro outcomes and trade policy.</div>
  </div>

  <div class="grid g2">
    <div class="card"><h3>📊 Indicator panel · ${esc(c.name)}</h3>
      <div style="max-height:540px;overflow:auto"><table><tbody>
      ${rows.map((r) => '<tr><td>' + r[0] + '</td><td><b>' + r[1] + '</b></td></tr>').join('')}
      </tbody></table></div>
    </div>
    <div>
      <div class="card"><h3>📉 Historical trends</h3>
        ${seriesPicker()}
        <div class="chart-wrap">${chart(c.history.map((h) => h.label), S.chartKeys.map((k, i) => ({
          name: SERIES[k].n, data: c.history.map((h) => h[SERIES[k].f]), color: CLR[i % 3]
        })))}</div>
      </div>
      <div class="card"><h3>🧾 Reference values (real-world calibration)</h3>
        <table><tbody>${Object.keys(tpl.realData || {}).map((k) =>
          '<tr><td>' + esc(k) + '</td><td><b>' + esc(tpl.realData[k]) + '</b></td></tr>').join('')}</tbody></table>
        <div class="hint">These reference values are real-world figures used to calibrate the model. The starting positions in the model have been adjusted into comparable teaching versions, so the magnitudes differ from the reference data.</div>
      </div>
    </div>
  </div>`;
}
function bindData() {
  $$('#view-data [data-sel]').forEach((b) => b.addEventListener('click', () => {
    S.sel = b.dataset.sel; renderHeader(); render();
  }));
}

/* ---------------- policy toolkit ---------------- */
const GROUPS = [
  {
    id: 'fiscal', name: '💰 Fiscal policy', items: [
      { p: 'spend.education', l: 'Education spending', u: '%GDP', min: 0, max: 20, step: 0.1 },
      { p: 'spend.health', l: 'Health care spending', u: '%GDP', min: 0, max: 20, step: 0.1 },
      { p: 'spend.infrastructure', l: 'Infrastructure spending', u: '%GDP', min: 0, max: 20, step: 0.1 },
      { p: 'spend.defence', l: 'Defence spending', u: '%GDP', min: 0, max: 20, step: 0.1 },
      { p: 'spend.other', l: 'Other spending', u: '%GDP', min: 0, max: 30, step: 0.1 },
      { p: 'transfers', l: 'Transfer payments', u: '%GDP', min: 0, max: 45, step: 0.1 },
      { p: 'ubi', l: 'Universal basic income (UBI)', u: '%GDP', min: 0, max: 15, step: 0.1 },
      { p: 'taxIncome', l: 'Personal income tax', u: '%', min: 0, max: 70, step: 0.5 },
      { p: 'taxCorporate', l: 'Corporate income tax', u: '%', min: 0, max: 60, step: 0.5 },
      { p: 'taxCapital', l: 'Capital tax', u: '%', min: 0, max: 60, step: 0.5 },
      { p: 'taxConsumption', l: 'Consumption tax / VAT', u: '%', min: 0, max: 40, step: 0.5 },
      { p: 'progressivity', l: 'Tax progressivity', u: '0–100', min: 0, max: 100, step: 1 }
    ]
  },
  {
    id: 'monetary', name: '🏦 Monetary policy', items: [
      { p: 'policyRate', l: 'Policy / base interest rate', u: '%', min: -2, max: 30, step: 0.25 },
      { p: 'reserveRatio', l: 'Required reserve ratio (RRR)', u: '%', min: 0, max: 30, step: 0.5 },
      { p: 'omoStance', l: 'Open market operations (+ = inject liquidity)', u: '', min: -5, max: 5, step: 1 },
      { p: 'qeSize', l: 'Quantitative easing size', u: '%GDP', min: 0, max: 30, step: 0.5 }
    ]
  },
  {
    id: 'supply', name: '🏗️ Interventionist supply-side', items: [
      { p: 'ssEducation', l: 'Education & training programmes', u: '%GDP', min: 0, max: 10, step: 0.1 },
      { p: 'ssTech', l: 'R&D programmes', u: '%GDP', min: 0, max: 10, step: 0.1 },
      { p: 'ssInfra', l: 'Infrastructure programmes', u: '%GDP', min: 0, max: 10, step: 0.1 },
      { p: 'industrial.sme', l: 'Support for small & medium firms', u: '0–100', min: 0, max: 100, step: 5 },
      { p: 'industrial.infant', l: 'Infant industry protection', u: '0–100', min: 0, max: 100, step: 5 },
      { p: 'industrial.exportFirm', l: 'Support for exporters', u: '0–100', min: 0, max: 100, step: 5 },
      { p: 'industrial.marketEdu', l: 'Marketised education (vouchers)', u: '0–100', min: 0, max: 100, step: 5 }
    ]
  },
  {
    id: 'market', name: '🛒 Market-oriented supply-side', items: [
      { p: 'privatisation', l: 'Privatisation', u: '0–100', min: 0, max: 100, step: 5 },
      { p: 'deregulation', l: 'Deregulation', u: '0–100', min: 0, max: 100, step: 5 },
      { p: 'ppp', l: 'Private finance (PPP)', u: '0–100', min: 0, max: 100, step: 5 },
      { p: 'outsourcing', l: 'Outsourcing', u: '0–100', min: 0, max: 100, step: 5 },
      { p: 'antitrust', l: 'Antitrust / competition policy', u: '0–100', min: 0, max: 100, step: 5 },
      { p: 'tradeLiberalisation', l: 'Trade liberalisation', u: '0–100', min: 0, max: 100, step: 5 },
      { p: 'unionPower', l: 'Trade union power', u: '0–100', min: 0, max: 100, step: 5 },
      { p: 'minWage', l: 'Minimum wage', u: '0–100', min: 0, max: 100, step: 5 },
      { p: 'unemploymentBenefit', l: 'Unemployment benefit level', u: '0–100', min: 0, max: 100, step: 5 },
      { p: 'jobSecurity', l: 'Job security legislation', u: '0–100', min: 0, max: 100, step: 5 },
      { p: 'greenPolicy', l: 'Green / environmental policy', u: '0–100', min: 0, max: 100, step: 5 }
    ]
  },
  {
    id: 'equity', name: '⚖️ Redistribution & equity', items: [
      { p: 'taxIncome', l: 'Personal income tax', u: '%', min: 0, max: 70, step: 0.5 },
      { p: 'taxCapital', l: 'Capital tax', u: '%', min: 0, max: 60, step: 0.5 },
      { p: 'progressivity', l: 'Tax progressivity', u: '0–100', min: 0, max: 100, step: 1 },
      { p: 'transfers', l: 'Transfer payments', u: '%GDP', min: 0, max: 45, step: 0.1 },
      { p: 'ubi', l: 'Universal basic income (UBI)', u: '%GDP', min: 0, max: 15, step: 0.1 },
      { p: 'directProvision', l: 'Direct provision (free public services)', u: '%GDP', min: 0, max: 15, step: 0.1 },
      { p: 'subsidies', l: 'Subsidies on necessities', u: '%GDP', min: 0, max: 12, step: 0.1 },
      { p: 'priceControls', l: 'Price control intensity', u: '0–100', min: 0, max: 100, step: 5 },
      { p: 'antiDiscrimination', l: 'Anti-discrimination legislation', u: '0–100', min: 0, max: 100, step: 5 }
    ]
  }
];
const PARTNERS = [['A', 'Country A'], ['B', 'Country B'], ['C', 'Country C'], ['ROW', 'Rest of the world']];

function getP(o, path) { return path.split('.').reduce((a, k) => (a == null ? a : a[k]), o); }
function setP(o, path, v) {
  const ks = path.split('.');
  let cur = o;
  for (let i = 0; i < ks.length - 1; i++) { cur[ks[i]] = cur[ks[i]] || {}; cur = cur[ks[i]]; }
  cur[ks[ks.length - 1]] = v;
}
function canEdit() { return S.me && (S.me.type === 'teacher' || S.me.role === 'government'); }

function renderPolicy() {
  const c = own();
  if (!c) return '';
  if (!c.policy) return '<div class="card">Loading data…</div>';
  if (!canEdit()) {
    return '<div class="card"><h3>🎛️ Policy toolkit</h3>'
      + '<p class="hint">' + T('Only members of the <b>government team</b> can adjust policy directly. As a member of the')
      + ' ' + roleLabel(S.me.role) + ' '
      + T('team you can describe what you want in plain language below; the system translates it into policy parameters for the government to consider (you can also table a motion under “My Team”).')
      + '</p>'
      + freeTextPanel() + '</div>';
  }
  const g = GROUPS.find((x) => x.id === S.ptab) || GROUPS[0];
  let html = `
  <div class="card">
    <h3>🎛️ Policy toolkit · ${esc(c.name)}
      ${S.me.type === 'teacher' ? '<select id="teacherCountry" style="width:auto;display:inline-block">'
        + S.data.countries.map((x) => '<option value="' + x.id + '"' + (x.id === c.id ? ' selected' : '') + '>' + esc(x.name) + '</option>').join('')
        + '</select>' : ''}
    </h3>
    <div class="hint">${T('When you are done, click <b>Submit this round’s policy</b>. Policies take effect when the teacher advances the next quarter, and there are <b>transmission lags</b>.')}</div>
    <div class="subtabs">
      ${GROUPS.map((x) => '<button class="subtab ' + (x.id === S.ptab ? 'active' : '') + '" data-pt="' + x.id + '">' + x.name + '</button>').join('')}
      <button class="subtab ${S.ptab === 'intl' ? 'active' : ''}" data-pt="intl">🌐 Trade & exchange rate</button>
      <button class="subtab ${S.ptab === 'free' ? 'active' : ''}" data-pt="free">✨ Free-text policy</button>
    </div>`;
  if (S.ptab === 'intl') html += intlPanel(c);
  else if (S.ptab === 'free') html += freeTextPanel();
  else html += '<div class="grid g2">' + g.items.map((it) => ctl(c.policy, it)).join('') + '</div>';
  html += `<div style="display:flex;gap:10px;align-items:center;margin-top:12px">
      <button class="btn primary" id="btnSubmitPolicy">📤 Submit this round’s policy</button>
      <button class="btn ghost" id="btnResetForm">↩︎ Discard changes</button>
      <span class="hint" id="dirtyHint" style="margin:0"></span>
    </div></div>`;
  return html;
}

function ctl(pol, it) {
  const v = getP(pol, it.p);
  const id = 'p_' + it.p.replace(/\./g, '_');
  return '<div class="pctl"><span class="lb">' + it.l + '</span>'
    + '<input type="range" id="' + id + '" data-p="' + it.p + '" min="' + it.min + '" max="' + it.max
    + '" step="' + it.step + '" value="' + v + '" />'
    + '<span class="nv"><b data-for="' + id + '">' + nf(v, it.step < 1 ? 2 : 0) + '</b> <small class="muted">' + it.u + '</small></span></div>';
}

function intlPanel(c) {
  const p = c.policy;
  return `
  <div class="grid g2">
    <div>
      <h4>💱 Exchange rate regime & capital flows</h4>
      <label>Exchange rate regime <select id="sel_fxRegime">
        ${[['fixed', 'Fixed (pegged)'], ['managed', 'Managed float'], ['floating', 'Free float']]
    .map((r) => '<option value="' + r[0] + '"' + (p.fxRegime === r[0] ? ' selected' : '') + '>' + r[1] + '</option>').join('')}
      </select></label>
      ${ctl(p, { p: 'fxTarget', l: 'Exchange rate target (↑ = depreciation)', u: 'index', min: 50, max: 200, step: 1 })}
      ${ctl(p, { p: 'fxIntervention', l: 'FX intervention intensity', u: '0–10', min: 0, max: 10, step: 1 })}
      ${ctl(p, { p: 'capitalControls', l: 'Capital controls', u: '0–100', min: 0, max: 100, step: 5 })}
      <div class="hint">Current exchange rate index ${nf(c.econ.fxIndex, 1)} | FX reserves ${nf(c.econ.fxReserves, 0)} (US$100m)</div>
    </div>
    <div>
      <h4>🧱 Trade protection instruments (by partner)</h4>
      <table><thead><tr><th>Partner</th><th>Tariff %</th><th>Export subsidy %</th><th>Quota %</th><th>Non-tariff barriers</th><th>Free trade agreement</th></tr></thead><tbody>
      ${PARTNERS.map((r) => '<tr><td>' + r[1] + '</td>'
      + '<td><input type="number" data-tp="tariffs" data-k="' + r[0] + '" min="0" max="200" step="1" value="' + (p.tariffs[r[0]] || 0) + '" /></td>'
      + '<td><input type="number" data-tp="exportSubsidy" data-k="' + r[0] + '" min="0" max="80" step="1" value="' + (p.exportSubsidy[r[0]] || 0) + '" /></td>'
      + '<td><input type="number" data-tp="quotas" data-k="' + r[0] + '" min="0" max="100" step="5" value="' + (p.quotas[r[0]] || 0) + '" /></td>'
      + '<td><input type="number" data-tp="ntb" data-k="' + r[0] + '" min="0" max="100" step="5" value="' + (p.ntb[r[0]] || 0) + '" /></td>'
      + '<td><input type="checkbox" data-tp="fta" data-k="' + r[0] + '"' + (p.fta[r[0]] ? ' checked' : '') + ' /></td></tr>').join('')}
      </tbody></table>
      <div class="hint">Rival countries can see your trade policy and may retaliate.</div>
    </div>
  </div>`;
}

function freeTextPanel() {
  return `<div>
    <h4>✨ Describe your policy in one sentence</h4>
    <p class="hint">For example: “To curb inflation, raise the policy rate by 0.5 percentage points”,
    “Impose a 20% tariff on country A while subsidising exporters”,
    “Introduce a universal basic income and cut corporation tax by 3 points”.
    The system turns your sentence into concrete parameters for you to <b>confirm</b> before submitting.</p>
    <textarea id="freeText" placeholder="Describe your programme in plain language…"></textarea>
    <div style="display:flex;gap:8px;margin-top:8px"><button class="btn blue" id="btnParse">🔮 Interpret as policy parameters</button></div>
    <div id="parseResult"></div>
  </div>`;
}

function bindPolicy() {
  const c = own();
  if (!c || !c.policy) return;
  $$('.subtab[data-pt]').forEach((b) => b.addEventListener('click', () => {
    S.ptab = b.dataset.pt; S.dirty = false; render();
  }));
  const sel = $('#teacherCountry');
  if (sel) sel.addEventListener('change', () => { S.sel = sel.value; S.dirty = false; renderHeader(); render(); });

  $$('#view-policy input[type=range]').forEach((r) => {
    r.addEventListener('input', () => {
      const lab = $('b[data-for="' + r.id + '"]');
      if (lab) lab.textContent = nf(Number(r.value), Number(r.step) < 1 ? 2 : 0);
      markDirty();
    });
  });
  $$('#view-policy input[type=number]').forEach((el) => el.addEventListener('input', markDirty));
  $$('#view-policy input[type=checkbox]').forEach((el) => el.addEventListener('change', markDirty));
  $$('#view-policy select').forEach((el) => el.addEventListener('change', markDirty));
  const bs = $('#btnSubmitPolicy');
  if (bs) bs.addEventListener('click', submitPolicy);
  const br = $('#btnResetForm');
  if (br) br.addEventListener('click', () => { S.dirty = false; render(); toast('Changes discarded'); });
  const bp = $('#btnParse');
  if (bp) bp.addEventListener('click', doParse);
}
function markDirty() {
  S.dirty = true;
  const h = $('#dirtyHint');
  if (h) h.innerHTML = '<span class="dirty">● Unsaved changes</span>';
}

function collectPatch() {
  const c = own();
  const patch = JSON.parse(JSON.stringify(c.policy || {}));
  $$('#view-policy input[type=range]').forEach((r) => { setP(patch, r.dataset.p, Number(r.value)); });
  if (S.ptab === 'intl') {
    const fx = $('#sel_fxRegime');
    if (fx) patch.fxRegime = fx.value;
    $$('#view-policy input[data-tp]').forEach((el) => {
      patch[el.dataset.tp] = patch[el.dataset.tp] || {};
      patch[el.dataset.tp][el.dataset.k] = el.type === 'checkbox' ? !!el.checked : Number(el.value);
    });
  }
  return patch;
}

async function submitPolicy() {
  const r = await api('/api/policy', { patch: collectPatch(), countryId: S.sel });
  if (!r.ok) return toast(r.error || 'Submission failed');
  S.dirty = false;
  toast(r.changed ? 'Submitted ' + r.changed + ' policy change(s)' : 'No policy change');
  const st = await api('/api/state');
  if (st.ok) { S.data = st; render(); }
}

async function doParse() {
  const box = $('#parseResult');
  const r = await api('/api/ai/interpret', { text: $('#freeText').value });
  if (!r.ok || !r.result) return toast((r && r.error) || 'Could not interpret that');
  const res = r.result;
  if (!res.matched) { box.innerHTML = '<div class="card soft"><p class="hint">' + esc(res.hint) + '</p></div>'; return; }
  box.innerHTML = '<div class="card soft"><h4>🔮 Interpretation</h4>'
    + '<table><thead><tr><th>Policy instrument</th><th>Change</th><th>Resulting value</th></tr></thead><tbody>'
    + res.notes.map((n) => '<tr><td>' + esc(n.label) + '</td><td><b>' + (n.delta > 0 ? '+' : '') + nf(n.delta, 2)
    + '</b></td><td>' + nf(n.value, 2) + '</td></tr>').join('')
    + '</tbody></table><div style="margin-top:10px"><button class="btn primary" id="btnApplyAI">✅ Confirm &amp; submit</button></div></div>';
  applyI18n(box);
  const parsed = res.patch;
  $('#btnApplyAI').addEventListener('click', async () => {
    const rp = await api('/api/policy', { patch: parsed, countryId: S.sel });
    if (!rp.ok) return toast(rp.error || 'Submission failed');
    toast('Submitted ' + rp.changed + ' policy change(s)');
    box.innerHTML = '<div class="hint">✅ Submitted — see the record under “Country Feed”.</div>';
    const st = await api('/api/state');
    if (st.ok) { S.data = st; S.dirty = false; render(); }
  });
  enhance(box);
}

/* ---------------- trade & FX ---------------- */
function renderWorld() {
  const d = S.data;
  const gainOf = (c) => c.econ.score - ((c.history[0] || {}).score || c.econ.score);
  const ranked = d.countries.slice().sort((a, b) => gainOf(b) - gainOf(a));
  const rows = [
    ['Composite index', (c) => nf(c.econ.score, 1), 0],
    ['Index gain', (c) => (gainOf(c) >= 0 ? '+' : '') + nf(gainOf(c), 2), 0],
    ['Real growth %', (c) => nf(c.econ.growth, 2), 0],
    ['Inflation %', (c) => nf(c.econ.inflation, 2), 0],
    ['Unemployment %', (c) => nf(c.econ.unemployment, 2), 0],
    ['Debt/GDP %', (c) => nf(c.econ.govDebt, 1), 0],
    ['Budget balance %', (c) => nf(c.econ.budgetBalance, 2), 0],
    ['Current account %', (c) => nf(c.econ.currentAccount, 2), 0],
    ['HDI', (c) => nf(c.econ.hdi, 3), 0],
    ['HPI', (c) => nf(c.econ.hpi, 1), 0],
    ['Gini coefficient', (c) => nf(c.econ.gini, 3), 0],
    ['MPI %', (c) => nf(c.econ.mpi, 2), 0],
    ['Policy rate %', (c) => nf(c.econ.policyRate, 2), 1]
  ];
  return `
  <div class="card"><h3>🏆 Composite Economic Health Index · ranking by gain (this decides the winner)</h3>
    <div class="rank">${ranked.map((c, i) => {
    const g = gainOf(c);
    return '<div class="rank-row"><span class="no">' + (['🥇', '🥈', '🥉'][i] || (i + 1)) + '</span>'
      + '<span class="nm">' + c.mascot + ' ' + esc(c.name) + '</span>'
      + '<span class="sc">' + nf(c.econ.score, 1) + '</span>'
      + '<span class="gain ' + (g >= 0 ? 'up' : 'down') + '">' + (g >= 0 ? '+' : '') + nf(g, 2) + '</span></div>';
  }).join('')}</div>
    <div class="hint">Victory depends on how far the index has risen since the start, not on its absolute level — countries that begin further behind can improve the most.</div>
  </div>

  <div class="card"><h3>🌍 Key indicators across the three countries</h3>
    <table><thead><tr><th>Indicator</th>${d.countries.map((c) => '<th>' + c.mascot + ' ' + esc(c.name) + '</th>').join('')}</tr></thead><tbody>
    ${rows.map((r) => '<tr><td>' + r[0] + '</td>' + d.countries.map((c) => {
    const visible = !r[2] || c.id === own().id || S.me.type === 'teacher';
    return '<td class="' + (c.id === own().id ? 'mine' : '') + '">' + (visible ? r[1](c) : 'Classified') + '</td>';
  }).join('') + '</tr>').join('')}
    </tbody></table>
    <div class="hint">Your country is highlighted in green. The policy rate is domestic policy: only your own country and the teacher can see it.</div>
  </div>

  <div class="card"><h3>🔗 Bilateral trade links (export destinations, US$100m)</h3>
    ${d.countries.map((c) => {
    const det = c.econ.exportDetail || {};
    const rs = ['A', 'B', 'C', 'ROW'].filter((k) => k !== c.id)
      .map((k) => [k, det[k] !== undefined ? det[k] : (det['>' + k] || 0)]);
    const mx = Math.max.apply(null, rs.map((r) => Math.abs(r[1] || 0)).concat([1]));
    return '<h4>' + c.mascot + ' ' + esc(c.name) + ' exports</h4><div class="flow-diagram">'
      + rs.map((r) => '<div class="flow-row"><span>'
      + (r[0] === 'ROW' ? 'Rest of the world' : ((d.countries.find((x) => x.id === r[0]) || {}).name || r[0])) + '</span>'
      + '<span class="flow-bar"><i style="width:' + (Math.abs(r[1] || 0) / mx * 100) + '%;background:' + c.color + '"></i></span>'
      + '<span style="text-align:right">' + nf(r[1], 0) + '</span></div>').join('') + '</div>';
  }).join('')}
    <div class="hint">Tariffs imposed by one country directly depress another’s exports, feeding through to that country’s aggregate demand, employment and growth.</div>
  </div>

  <div class="card"><h3>🧱 Tariff policies (public information)</h3>
    <table><thead><tr><th>Imposing country / Target</th>${PARTNERS.map((r) => '<th>' + r[1] + '</th>').join('')}</tr></thead><tbody>
    ${d.countries.map((c) => '<tr><td>' + c.mascot + ' ' + esc(c.name) + '</td>'
    + PARTNERS.map((r) => '<td>' + nf(((c.tradePolicy || {}).tariffs || {})[r[0]] || 0, 0) + '%</td>').join('') + '</tr>').join('')}
    </tbody></table>
    <div class="hint">Quotas, non-tariff barriers, export subsidies and free trade agreements also shift trade flows.</div>
  </div>

  <div class="card"><h3>📈 Composite index trend</h3>
    <div class="chart-wrap">${chart(d.countries[0].history.map((x) => x.label),
    d.countries.map((c) => ({ name: c.name, data: c.history.map((x) => x.score), color: c.color })))}</div>
    <div class="legend">${d.countries.map((c) => '<span><i style="background:' + c.color + '"></i>' + esc(c.name) + '</span>').join('')}</div>
  </div>`;
}

/* ---------------- country feed ---------------- */
function renderFeed() {
  const c = observed() || own();
  const d = S.data;
  return `
  <div class="grid g2">
    <div class="card"><h3>📜 Country feed · ${esc(c.name)}</h3>
      <div class="log">${(c.log || []).map((l) => '<div class="log-item k-' + l.kind + '"><span class="t">'
        + esc(l.t) + '</span><span>' + esc(l.text) + '</span></div>').join('') || '<div class="hint">No entries yet</div>'}</div>
    </div>
    <div>
      <div class="card"><h3>🌐 World events</h3>
        <div class="log">${(d.events || []).map((l) => '<div class="log-item k-event"><span class="t">'
          + esc(l.t) + '</span><span>' + esc(l.text) + '</span></div>').join('') || '<div class="hint">No events yet</div>'}</div>
      </div>
      <div class="card"><h3>📣 Team proposals</h3>
        ${d.countries.map((x) => '<h4>' + x.mascot + ' ' + esc(x.name) + '</h4><div class="log">'
        + ((x.proposals || []).slice(0, 8).map((p) => '<div class="log-item k-propose"><span class="t">'
          + esc(p.t || '') + '</span><span>' + (p.username ? '<b>' + esc(p.username) + '</b> (' + roleLabel(p.role) + '): ' : '')
          + esc(p.text) + '</span></div>').join('') || '<div class="hint">No proposals yet</div>') + '</div>').join('')}
      </div>
    </div>
  </div>`;
}

/* ---------------- my team ---------------- */
function renderTeam() {
  const c = own();
  if (!c) return '';
  const isPres = !!S.me.isPresident;
  return `
  <div class="grid g2">
    <div class="card"><h3>👥 Cabinet of ${esc(c.name)}</h3>
      <table><thead><tr><th>Username</th><th>Role</th><th>Status</th></tr></thead><tbody>
      ${(c.accounts || []).map((a) => '<tr><td>' + esc(a.username) + (a.username === S.me.username ? ' (you)' : '')
      + '</td><td>' + roleLabel(a.role) + '</td><td>' + (a.isPresident ? '👑 Chair' : '') + '</td></tr>').join('')}
      </tbody></table>
      <div class="hint">Country password: ${(isPres || S.me.type === 'teacher')
      ? '<b>' + esc(c.countryPassword || '') + '</b>' : '(visible to the chair only — ask your chair for it)'}</div>
      ${isPres ? `<hr class="sep" /><div class="grid g2">
          <label>Rename the country (once per game)<input type="text" id="newName" maxlength="16" value="${esc(c.name)}" ${c.customNamed ? 'disabled' : ''} /></label>
          <label>Reset the country password<input type="text" id="newPw" value="${esc(c.countryPassword || '')}" /></label>
        </div><button class="btn mint" id="btnSaveCountry">💾 Save</button>` : ''}
    </div>
    <div class="card"><h3>📣 Submit a policy proposal</h3>
      <p class="hint">Labour and firms teams can put demands to the government here; government members can also record their programme.</p>
      <textarea id="propText" placeholder="e.g. we want higher unemployment benefits and stronger support for small firms…"></textarea>
      <button class="btn primary block" id="btnPropose">Submit proposal</button>
      <hr class="sep" /><h4>Existing proposals</h4>
      <div class="log">${(c.proposals || []).map((p) => '<div class="log-item k-propose"><span class="t">'
        + esc(p.t || '') + '</span><span><b>' + esc(p.username) + '</b> (' + roleLabel(p.role) + '): ' + esc(p.text) + '</span></div>').join('')
    || '<div class="hint">No proposals yet</div>'}</div>
    </div>
  </div>`;
}

function bindTeam() {
  const bp = $('#btnPropose');
  if (bp) bp.addEventListener('click', async () => {
    const r = await api('/api/propose', { text: $('#propText').value });
    if (!r.ok) return toast(r.error || 'Submission failed');
    toast('Proposal submitted');
    const st = await api('/api/state'); if (st.ok) { S.data = st; render(); }
  });
  const bs = $('#btnSaveCountry');
  if (bs) bs.addEventListener('click', async () => {
    const nm = $('#newName'), pw = $('#newPw');
    if (nm && !nm.disabled && nm.value.trim() && nm.value.trim() !== own().name) {
      const r = await api('/api/country/name', { name: nm.value.trim() });
      if (!r.ok) return toast(r.error);
    }
    if (pw && pw.value.trim()) {
      const r2 = await api('/api/country/password', { password: pw.value.trim() });
      if (!r2.ok) return toast(r2.error);
    }
    toast('Saved');
    const st = await api('/api/state'); if (st.ok) { S.data = st; renderHeader(); render(); }
  });
}

/* ---------------- teacher panel ---------------- */
function renderTeacher() {
  const d = S.data;
  if (!d.allAccounts) return '<div class="card">No permission</div>';
  const W = {
    gdpPerCapita: 'Income per head', growth: 'Growth', unemployment: 'Employment', inflation: 'Price stability',
    debt: 'Debt sustainability', hdi: 'Human development (HDI)', hpi: 'Happy planet (HPI)', gini: 'Income distribution',
    mpi: 'Multidimensional poverty', currentAccount: 'Current account'
  };
  return `
  <div class="card"><h3>⏭️ Advance time</h3>
    <p class="hint">${T('Now:')} Q${d.time.quarter} ${d.time.year} (${T('quarter')} ${d.time.index + 1}). ${T('All countries’ policies take effect once time advances.')}</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn primary" data-adv="1">Advance 1 quarter</button>
      <button class="btn blue" data-adv="4">Advance 1 year (4 quarters)</button>
      <button class="btn ghost" id="btnReload">Refresh data</button>
    </div>
  </div>

  <div class="card"><h3>⚡ Publish an external shock</h3>
    <div class="grid g3">
      ${(d.eventLibrary || []).map((e) => '<div class="kpi"><div class="k"><span>' + esc(e.name) + '</span></div>'
      + '<div class="d" style="min-height:36px">' + esc(e.desc || '') + '</div>'
      + '<div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap">'
      + '<button class="btn sm" data-ev="' + e.id + '" data-target="">Global</button>'
      + d.countries.map((c) => '<button class="btn sm ghost" data-ev="' + e.id + '" data-target="' + c.id + '">' + c.mascot + '</button>').join('')
      + '</div></div>').join('')}
    </div>
  </div>

  <div class="card"><h3>⚖️ Composite index weights (auto-normalised)</h3>
    <div class="grid g3">
      ${Object.keys(W).map((k) => '<div class="pctl" style="grid-template-columns:1fr 120px 56px"><span class="lb">' + W[k] + '</span>'
      + '<input type="range" data-w="' + k + '" min="0" max="0.4" step="0.01" value="' + d.weights[k] + '" />'
      + '<span class="nv"><b>' + nf(d.weights[k] * 100, 0) + '%</b></span></div>').join('')}
    </div>
    <button class="btn mint" id="btnWeights">Save weights</button>
  </div>

  <div class="card"><h3>🔑 Country login passwords</h3>
    <p class="hint">Every student needs the country login password in order to join that country. Set one password per country here and give it to the group; you can change it at any time (members who have already joined stay logged in).</p>
    <div class="grid g3">
      ${d.allAccounts.map((a) => {
        const tpl = (d.templates || []).find((x) => x.id === a.countryId) || {};
        return '<div class="kpi" style="text-align:left"><div class="k"><span>'
          + esc(tpl.flag || '🏳️') + ' ' + esc(a.countryName) + '</span></div>'
          + '<div class="d" style="min-height:auto">' + a.accounts.length + ' member(s) joined</div>'
          + '<div style="display:flex;gap:6px;margin-top:6px">'
          + '<input type="text" id="cpw-' + esc(a.countryId) + '" value="' + esc(a.countryPassword || '') + '" placeholder="Login password" />'
          + '<button class="btn sm primary" data-cpw="' + esc(a.countryId) + '">Save</button></div></div>';
      }).join('')}
    </div>
  </div>

  <div class="card"><h3>🔑 All accounts and passwords</h3>
    ${d.allAccounts.map((a) => '<h4>' + esc(a.countryName) + ' · country password <b>' + esc(a.countryPassword) + '</b></h4>'
    + '<table><thead><tr><th>Username</th><th>Password</th><th>Role</th><th>Action</th></tr></thead><tbody>'
    + a.accounts.map((x) => '<tr><td>' + esc(x.username) + (x.username === a.president ? ' 👑' : '') + '</td><td><b>' + esc(x.password)
    + '</b></td><td>' + roleLabel(x.role) + '</td><td><button class="btn sm ghost" data-kick="' + esc(x.username)
    + '" data-kc="' + a.countryId + '">Remove</button></td></tr>').join('') + '</tbody></table>').join('')}
    <p class="hint">Teacher account: ${esc(d.teacher.username)} / <b>${esc(d.teacher.password)}</b>
      <input type="text" id="newTeacherPw" style="width:auto;display:inline-block" placeholder="New teacher password" />
      <button class="btn sm" id="btnTeacherPw">Save</button></p>
  </div>

  <div class="card"><h3>♻️ Reset the world</h3>
    <p class="hint">Resetting clears all economic data and returns the world to the starting position (registered accounts and country names are kept by default).</p>
    <button class="btn ghost" data-reset="1">Reset but keep accounts</button>
    <button class="btn ghost" data-reset="0">Full reset (delete all accounts)</button>
  </div>`;
}

function bindTeacher() {
  $$('#view-teacher [data-adv]').forEach((b) => b.addEventListener('click', async () => {
    const r = await api('/api/teacher/advance', { quarters: Number(b.dataset.adv) });
    if (!r.ok) return toast(r.error || 'Failed');
    toast('Time advanced');
    const st = await api('/api/state'); if (st.ok) { S.data = st; renderHeader(); render(); }
  }));
  $$('#view-teacher [data-ev]').forEach((b) => b.addEventListener('click', async () => {
    const r = await api('/api/teacher/event', { eventId: b.dataset.ev, targetId: b.dataset.target || null });
    if (!r.ok) return toast(r.error || 'Failed');
    toast('Shock published');
    const st = await api('/api/state'); if (st.ok) { S.data = st; render(); }
  }));
  $$('#view-teacher input[data-w]').forEach((r) => r.addEventListener('input', () => {
    const b = r.parentElement.querySelector('b');
    if (b) b.textContent = nf(Number(r.value) * 100, 0) + '%';
  }));
  const bw = $('#btnWeights');
  if (bw) bw.addEventListener('click', async () => {
    const w = {};
    $$('#view-teacher input[data-w]').forEach((r) => { w[r.dataset.w] = Number(r.value); });
    const r = await api('/api/teacher/weights', { weights: w });
    if (!r.ok) return toast(r.error || 'Failed');
    toast('Weights saved');
    const st = await api('/api/state'); if (st.ok) { S.data = st; render(); }
  });
  $$('#view-teacher [data-cpw]').forEach((b) => b.addEventListener('click', async () => {
    const inp = $('#cpw-' + b.dataset.cpw);
    const v = (inp ? inp.value : '').trim();
    if (!v) return toast('Please enter a country password');
    const r = await api('/api/teacher/countrypw', { countryId: b.dataset.cpw, password: v });
    if (!r.ok) return toast(r.error || 'Failed');
    toast('Country password saved');
    const st = await api('/api/state'); if (st.ok) { S.data = st; render(); }
  }));
  $$('#view-teacher [data-kick]').forEach((b) => b.addEventListener('click', async () => {
    const r = await api('/api/teacher/kick', { username: b.dataset.kick, countryId: b.dataset.kc });
    if (!r.ok) return toast(r.error || 'Failed');
    toast('Removed');
    const st = await api('/api/state'); if (st.ok) { S.data = st; render(); }
  }));
  $$('#view-teacher [data-reset]').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm(T('Reset the world? All economic data will return to the starting position.'))) return;
    const r = await api('/api/teacher/reset', { keepAccounts: b.dataset.reset === '1' });
    if (!r.ok) return toast(r.error || 'Failed');
    toast('World reset');
    const st = await api('/api/state'); if (st.ok) { S.data = st; renderHeader(); render(); }
  }));
  const bt = $('#btnTeacherPw');
  if (bt) bt.addEventListener('click', async () => {
    const v = $('#newTeacherPw').value.trim();
    if (!v) return;
    const r = await api('/api/teacher/teacherpw', { password: v });
    if (!r.ok) return toast(r.error || 'Failed');
    toast('Teacher password updated');
    const st = await api('/api/state'); if (st.ok) { S.data = st; render(); }
  });
  const br = $('#btnReload');
  if (br) br.addEventListener('click', async () => {
    const st = await api('/api/state'); if (st.ok) { S.data = st; renderHeader(); render(); }
  });
}

/* ---------------- glossary dialog ---------------- */
function openGlossary() {
  const terms = S.terms || {};
  const keys = Object.keys(terms);
  openModal('<h3>📖 Economics glossary</h3>'
    + '<input type="text" id="gsearch" placeholder="Search for a term…" />'
    + '<div id="glist">' + glossaryList(keys, terms, '') + '</div>');
  const gs = $('#gsearch');
  if (gs) gs.addEventListener('input', (e) => {
    $('#glist').innerHTML = glossaryList(keys, terms, String(e.target.value || '').trim().toLowerCase());
    applyI18n($('#glist'));
  });
}
function glossaryList(keys, terms, q) {
  const hit = keys.filter((k) => {
    if (!q) return true;
    const t = terms[k] || {};
    return k.toLowerCase().indexOf(q) >= 0
      || String(t.en || '').toLowerCase().indexOf(q) >= 0
      || String(t.def || '').toLowerCase().indexOf(q) >= 0;
  });
  if (!hit.length) return '<div class="hint">No matching terms</div>';
  return hit.slice(0, 200).map((k) => {
    const t = terms[k] || {};
    return '<div class="glossary-item"><b>' + esc(t.en || k) + '</b> <span class="pill">' + esc(t.cat || 'Term') + '</span>'
      + '<div class="d">' + esc(t.def || '') + '</div></div>';
  }).join('');
}

/* ---------------- entry point ---------------- */
boot();
