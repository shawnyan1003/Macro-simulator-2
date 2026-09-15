'use strict';

const { TEMPLATES, DEFAULT_WEIGHTS, WORLD } = require('./countries');

/* ============================ Constants and utilities ============================ */

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const ELAST = 1.3;            // price elasticity of export/import demand (relative price changes such as the exchange rate)
const TARIFF_ELAST = 0.55;    // short-run demand elasticity to tariffs (substitutability is low, far below the long-run elasticity)
const GAP_ADJ = 0.42;         // speed at which the output gap adjusts each quarter (speed of policy transmission)
const PHILLIPS_K = 0.40;      // slope of the Phillips curve: a 1% gap → ±0.4pp of inflation
const OKUN = 0.125;           // quarterly Okun’s law coefficient
const EXP_ADAPT = 0.28;       // speed of adaptation of inflation expectations

/** Laffer curve: past the peak, evasion and incentive distortions reduce the effective collection rate */
function effectiveRate(rate, peak) {
  const r = rate / 100;
  if (r <= peak) return rate;
  const excess = r - peak;
  return (peak + excess * (1 - 0.85 * (excess / (1 - peak + 0.05)))) * 100;
}

/* ============================ Initialisation ============================ */

function makeCountry(id, t) {
  const c = {
    id,
    prototype: t.prototype,
    flag: t.flag,
    mascot: t.mascot,
    color: t.color,
    templateName: t.defaultName,
    name: t.defaultName,
    tagline: t.tagline,
    traits: t.traits,
    countryPassword: '',
    customNamed: false,
    president: null,
    accounts: [],
    proposals: [],
    log: [],
    history: [],
    rr0: t.reserveRatio,
    policy: null,
    econ: null
  };

  c.policy = {
    // — fiscal (AD) —
    spend: Object.assign({}, t.govSpendingMix),   // functional spending, %GDP
    transfers: t.transfers,
    ubi: 0,
    taxIncome: t.taxIncome,
    taxCorporate: t.taxCorporate,
    taxCapital: t.taxCapital,
    taxConsumption: t.taxConsumption,
    progressivity: t.progressivity,
    directProvision: 0,                            // extra direct provision spending, %GDP
    subsidies: 0,                                  // general subsidies, %GDP
    priceControls: 0,                              // price control intensity 0–100
    antiDiscrimination: t.antiDiscrimination,
    // — monetary (AD) —
    policyRate: t.policyRate,
    reserveRatio: t.reserveRatio,
    omoStance: 0,                                  // −5 (withdraw) … +5 (inject)
    qeSize: 0,                                     // quantitative easing size, %GDP
    // — interventionist supply side —
    ssEducation: 0, ssTech: 0, ssInfra: 0,         // targeted investment, %GDP
    industrial: { sme: 0, infant: 0, exportFirm: 0, marketEdu: 0 },
    // — market-based supply side —
    privatisation: t.privatisation,
    deregulation: t.deregulation,
    ppp: 30,
    outsourcing: 40,
    antitrust: t.competition,
    tradeLiberalisation: t.tradeOpenness,
    unionPower: t.unionPower,
    minWage: t.minWage,
    unemploymentBenefit: t.unemploymentBenefit,
    jobSecurity: t.jobSecurity,
    greenPolicy: t.greenPolicy,
    // — international economics —
    tariffs: Object.assign({}, t.tariffs),
    exportSubsidy: Object.assign({}, t.exportSubsidy),
    quotas: Object.assign({}, t.quotas),
    ntb: Object.assign({}, t.ntb),
    fta: Object.assign({}, t.fta),
    fxRegime: t.fxRegime,
    fxTarget: 100,
    fxIntervention: 0,
    capitalControls: id === 'A' ? 55 : (id === 'B' ? 0 : 35)
  };

  const totalExports = (t.exportFlows.A || 0) + (t.exportFlows.B || 0)
    + (t.exportFlows.C || 0) + (t.exportFlows.ROW || 0);

  const e = {
    pop: t.pop,
    laborForce: t.pop * t.laborForceParticipation / 100,
    employment: t.pop * t.laborForceParticipation / 100 * (1 - t.unemployment / 100),
    unemployment: t.unemployment,
    nairu: t.nairu,
    gdp: t.gdp,
    gdpPrev: t.gdp,
    potential: t.gdp,
    gap: 0,
    growth: t.potentialGrowth,
    potentialGrowth: t.potentialGrowth,
    priceLevel: 100,
    inflation: t.inflation,
    inflationExp: t.inflation,
    inflationTarget: t.inflationTarget,
    policyRate: t.policyRate,
    reserveRatio: t.reserveRatio,
    creditSpread: t.creditSpread,
    longRate: t.policyRate + t.debtTermPremium,
    borrowingCost: t.policyRate + t.creditSpread,
    sovereignRisk: 0,
    moneyIndex: 100,
    govDebt: t.govDebt,
    debtRate: t.debtServicingRate,          // average interest cost of outstanding debt, %
    govDebtLevel: t.gdp * t.govDebt / 100,
    budgetBalance: 0,
    revenueGDP: 0,
    spendGDP: 0,
    transGDP: t.transfers,
    interestGDP: 0,
    tariffRevenue: 0,
    exportSubsidyCost: 0,
    consumptionGDP: t.consumptionGDP,
    investmentGDP: t.investmentGDP,
    exports: totalExports,
    imports: t.imports,
    netExports: totalExports - t.imports,
    currentAccount: (totalExports - t.imports) / t.gdp * 100 + t.caOffset,
    fx: t.fx,
    fxIndex: 100,
    prevFxIndex: 100,
    fxReserves: t.fxReserves,
    gini: t.gini,
    mpi: t.mpi,
    hdi: t.hdi,
    hpi: t.hpi,
    lifeExpectancy: t.lifeExpectancy,
    wellbeing: t.wellbeing,
    footprint: t.footprint,
    envQuality: t.envQuality,
    education: t.education,
    health: t.health,
    infrastructure: t.infrastructure,
    technology: t.technology,
    competition: t.competition,
    regulationBurden: t.regulationBurden,
    tradeOpenness: t.tradeOpenness,
    adShift: 0,
    srasShift: 0,
    nxGap: 0,
    trendReal: t.gdp,                  // baseline real GDP path (reference for tax buoyancy)
    shock: { demand: 0, supply: 0, trade: 0 },
    creditHealth: 70,
    businessConfidence: 50,
    consumerConfidence: 50
  };
  c.econ = e;

  e.base = {
    spend: Object.assign({}, t.govSpendingMix),
    spendTotal: t.govSpending,
    transfers: t.transfers,
    ubi: 0,
    taxIncome: t.taxIncome, taxCorporate: t.taxCorporate,
    taxCapital: t.taxCapital, taxConsumption: t.taxConsumption,
    otherRevenue: t.otherRevenue,
    caOffset: t.caOffset,
    gdp: t.gdp,
    gdpPerCapita: t.gdp * 1000 / t.pop,
    gdpPerCapitaPPP: t.gdpPerCapitaPPP,
    netExports: totalExports - t.imports,
    totalExports,
    tariffRevenue: 0,
    currentAccount: (totalExports - t.imports) / t.gdp * 100 + t.caOffset,
    potentialGrowth: t.potentialGrowth,
    nxRatio: (totalExports - t.imports) / t.gdp * 100,
    inflation: t.inflation,
    inflationTarget: t.inflationTarget,
    unemployment: t.unemployment,
    nairu: t.nairu,
    govDebt: t.govDebt,
    debtServicingRate: t.debtServicingRate,
    gini: t.gini, mpi: t.mpi, hdi: t.hdi, hpi: t.hpi,
    lifeExpectancy: t.lifeExpectancy,
    wellbeing: t.wellbeing,
    footprint: t.footprint,
    envQuality: t.envQuality,
    education: t.education, health: t.health, infrastructure: t.infrastructure,
    technology: t.technology, competition: t.competition,
    regulationBurden: t.regulationBurden, tradeOpenness: t.tradeOpenness,
    unionPower: t.unionPower, minWage: t.minWage,
    unemploymentBenefit: t.unemploymentBenefit, jobSecurity: t.jobSecurity,
    progressivity: t.progressivity,
    privatisation: t.privatisation, deregulation: t.deregulation,
    antiDiscrimination: t.antiDiscrimination,
    greenPolicy: t.greenPolicy,
    consumptionGDP: t.consumptionGDP, investmentGDP: t.investmentGDP,
    fiscalMultiplier: t.fiscalMultiplier,
    monSens: t.monSens,
    nxMultiplier: t.nxMultiplier,
    capitalMobility: t.capitalMobility,
    creditSpread: t.creditSpread,
    debtTermPremium: t.debtTermPremium,
    // —— baseline-neutral calibration terms (solved numerically by autoCalibrate so that a "hands-off" economy stays on a steady path)——
    adBias: 0,          // exogenous demand trend (% output gap)
    inflBias: 0,        // exogenous cost trend (percentage points)
    balanceAdj: 0,      // off-budget balance (%GDP, excluded from the demand impulse)
    incomeElasticity: t.incomeElasticity,
    exportLinkage: t.exportLinkage,
    laborGrowth: t.laborGrowth,
    pop: t.pop,
    fxRegime: t.fxRegime
  };
  // HDI calibration factor: makes the HDI computed from its components match the given starting value (avoiding a first-quarter jump)
  const iIncome0 = clamp((Math.log(Math.max(501, t.gdpPerCapitaPPP)) - Math.log(500))
    / (Math.log(85000) - Math.log(500)), 0, 1);
  const iEdu0 = clamp(t.education / 100, 0, 1);
  const iHealth0 = clamp((t.lifeExpectancy - 20) / 65, 0, 1);
  e.base.hdiScale = t.hdi / Math.max(0.05, Math.pow(iIncome0 * iEdu0 * iHealth0, 1 / 3));
  return c;
}

function createWorld() {
  const state = {
    version: 1,
    phase: 'setup',
    time: { year: 2025, quarter: 1, index: 0 },
    teacher: { username: 'teacher', password: 'econ2024' },
    settings: {
      minPerRole: 1, maxPerRole: 3,
      weights: Object.assign({}, DEFAULT_WEIGHTS)
    },
    world: {
      rowPriceIndex: 100,
      rowDemandIndex: 100,
      growth: WORLD.growth,
      inflation: WORLD.inflation,
      policyRate: WORLD.policyRate,
      shocks: []
    },
    countries: {},
    flows: {},
    events: [],
    seq: 0
  };
  ['A', 'B', 'C'].forEach((id) => { state.countries[id] = makeCountry(id, TEMPLATES[id]); });
  buildTradeMatrix(state);
  calibrate(state);
  computeScores(state);
  recordHistory(state, true);
  return state;
}

/** the "flow multiplier" implied by the trade barriers that the importer imposes on the exporter */
function barrierFactor(importer, exporter) {
  const ti = TEMPLATES[importer] || { tariffs: {}, quotas: {}, ntb: {}, fta: {} };
  const te = TEMPLATES[exporter] || { exportSubsidy: {}, fta: {} };
  const from = exporter;
  const tariffF = Math.pow(1 + (ti.tariffs[from] || 0) / 100, -TARIFF_ELAST);
  const quotaF = 1 - clamp(ti.quotas[from] || 0, 0, 90) / 100;
  const ntbF = 1 - clamp(ti.ntb[from] || 0, 0, 100) * 0.006;
  const subF = Math.pow(1 + (te.exportSubsidy[importer] || 0) / 100, ELAST * 0.55);
  const ftaF = 1 + ((ti.fta[from] ? 1 : 0) + (te.fta[importer] ? 1 : 0)) * 0.12;
  return tariffF * quotaF * ntbF * subF * ftaF;
}

/**
 * Baseline bilateral trade matrix E0[exporter][importer], including the "rest of the world ROW".
 * Observed actual flows already include current tariffs, quotas and non-tariff barriers, 
 * so they are first "unwound" into barrier-free baseline flows, avoiding double-counting of barriers and a spurious trade contraction at the baseline.
 */
function buildTradeMatrix(state) {
  const ids = ['A', 'B', 'C'];
  const Obs = { ROW: {} };
  ids.forEach((i) => {
    Obs[i] = {};
    ids.forEach((j) => { Obs[i][j] = (i === j) ? 0 : (TEMPLATES[i].exportFlows[j] || 0); });
    Obs[i].ROW = TEMPLATES[i].exportFlows.ROW || 0;
  });
  ids.forEach((i) => {
    let fromRow = TEMPLATES[i].imports;
    ids.forEach((j) => { fromRow -= Obs[j][i]; });
    Obs.ROW[i] = Math.max(1, fromRow);
  });

  const E0 = { ROW: {} };
  ids.forEach((i) => {
    E0[i] = {};
    ids.forEach((j) => { E0[i][j] = (i === j) ? 0 : Obs[i][j] / barrierFactor(j, i); });
    E0[i].ROW = Obs[i].ROW / Math.pow(1 + (TEMPLATES[i].exportSubsidy.ROW || 0) / 100, ELAST * 0.55);
    E0.ROW[i] = Obs.ROW[i] / barrierFactor(i, 'ROW');
  });
  state.trade = { E0, elastic: ELAST };

  // baseline tariff revenue; the current value is also written so that the baseline fiscal reference matches later quarters
  ids.forEach((i) => {
    let rev = 0;
    ids.forEach((j) => { rev += Obs[j][i] * (TEMPLATES[i].tariffs[j] || 0) / 100; });
    rev += Obs.ROW[i] * (TEMPLATES[i].tariffs.ROW || 0) / 100;
    const b = state.countries[i].econ.base;
    b.tariffRevenue = rev / TEMPLATES[i].gdp * 100;
    state.countries[i].econ.tariffRevenue = b.tariffRevenue;
    // baseline import sourcing structure (used to compute how trade barriers raise import prices)
    const totImp = Obs.A[i] + Obs.B[i] + Obs.C[i] + Obs.ROW[i];
    b.impShare = {};
    ['A', 'B', 'C', 'ROW'].forEach((k) => { b.impShare[k] = Obs[k][i] / Math.max(1, totImp); });
  });
}

/** Baseline calibration: neutral real rate, baseline exchange rate drift and baseline fiscal position — guaranteeing that "hands-off means stable" */
function calibrate(state) {
  ['A', 'B', 'C'].forEach((id) => {
    const c = state.countries[id];
    const e = c.econ;
    const b = computeBorrowingCost(state, c, true);
    e.borrowingCost = b;
    e.neutralReal = b - e.inflation;
    e.fxBias = 0;
    const dep = fxPressure(state, c);
    e.fxBias = -dep;                       // offsets the baseline pressure
    const f = computeFiscal(state, c, true);
    e.base.revenueGDP = f.revenue;
    e.base.spendTotal = f.spend;
    e.base.budgetBalance = f.balance;
    e.realBorrowHist = [b - e.inflation];
    e.realBorrowing = b - e.inflation;
  });
  calibrateTradeTrend(state);
}

/**
 * Export trend calibration: each country is given an exogenous "export market share trend", 
 * so that on the "hands-off + growing at potential" baseline the ratio of net exports to GDP stays constant.
 * The baseline is then stable, so any change in the trade balance that students see comes from policy or external shocks.
 */
function calibrateTradeTrend(state) {
  const ids = ['A', 'B', 'C'];
  const trend = { A: 0, B: 0, C: 0 };
  for (let outer = 0; outer < 4; outer++) {
    const gX = {};
    ids.forEach((i) => { gX[i] = state.world.growth; });
    for (let it = 0; it < 8; it++) {
      ids.forEach((i) => {
        const E0 = state.trade.E0;
        const total = E0[i].A + E0[i].B + E0[i].C + E0[i].ROW;
        let gx = 0;
        ids.forEach((j) => {
          if (i === j) return;
          const bj = state.countries[j].econ.base;
          const gImp = bj.incomeElasticity * bj.potentialGrowth
            + bj.exportLinkage * (gX[j] + trend[j]);
          gx += E0[i][j] / total * gImp;
        });
        gx += E0[i].ROW / total * state.world.growth;
        gX[i] = gx;
      });
    }
    ids.forEach((i) => {
      const b = state.countries[i].econ.base;
      const gM = b.incomeElasticity * b.potentialGrowth + b.exportLinkage * (gX[i] + trend[i]);
      // Goal: the absolute level of net exports is unchanged (zero contribution to growth), i.e. X·gX = M·gM
      const X0 = b.totalExports, M0 = TEMPLATES[i].imports;
      const gXtarget = M0 * gM / Math.max(1, X0);
      trend[i] = gXtarget - gX[i];
    });
  }
  ids.forEach((i) => {
    state.countries[i].econ.exportTrend = trend[i];
    state.countries[i].econ.exportTrendFactor = 1;
  });
  // process is not defined inside Cloudflare Workers, so guard the lookup
  const calibLog = typeof process !== 'undefined' && process.env && process.env.SIM_CALIB_LOG === '1';
  autoCalibrate(state, calibLog);
}

/* ==================== Baseline-neutral calibration (numerical solution) ====================
 * Goal: in a "shadow simulation" that changes no policy, each country should keep 
 *   ① output gap ≈ 0  ② inflation ≈ central bank target  ③ a stable debt ratio  ④ stable net exports
 * so four calibration parameters per country (adBias / inflBias / balanceAdj / exportTrend) are solved for, 
 * using damped least squares (Levenberg–Marquardt) iteration to drive those four errors towards zero.
 */

const SHADOW_H = 36;      // number of quarters in the shadow simulation
const SHADOW_WARM = 8;    // the first few quarters are a transition period and are excluded from the errors

const KNOBS = [
  { name: 'adBias', h: 0.5, lim: [-4, 4], step: 1.0,
    get: (c) => c.econ.base.adBias || 0, set: (c, v) => { c.econ.base.adBias = v; } },
  { name: 'inflBias', h: 0.5, lim: [-4, 4], step: 1.0,
    get: (c) => c.econ.base.inflBias || 0, set: (c, v) => { c.econ.base.inflBias = v; } },
  { name: 'balanceAdj', h: 1.0, lim: [-8, 8], step: 1.5,
    get: (c) => c.econ.base.balanceAdj || 0, set: (c, v) => { c.econ.base.balanceAdj = v; } },
  { name: 'exportTrend', h: 1.0, lim: [-5, 8], step: 1.5,
    get: (c) => c.econ.exportTrend || 0, set: (c, v) => { c.econ.exportTrend = v; } }
];

/** Shadow simulation: advances the world "without changing any policy" and returns each country’s baseline drift */
function runShadow(state, perturb) {
  const s = JSON.parse(JSON.stringify(state));
  if (perturb) perturb(s);
  const acc = {};
  ['A', 'B', 'C'].forEach((i) => { acc[i] = { gap: 0, infl: 0, nx: 0, n: 0 }; });
  for (let q = 0; q < SHADOW_H; q++) {
    advanceQuarter(s);
    if (q < SHADOW_WARM) continue;
    ['A', 'B', 'C'].forEach((i) => {
      const e = s.countries[i].econ, b = state.countries[i].econ.base, a = acc[i];
      a.gap += e.gap;
      a.infl += e.inflation - b.inflationTarget;
      a.nx += e.netExports / Math.max(1, e.gdp) * 100 - b.nxRatio;
      a.n += 1;
    });
  }
  const out = {};
  ['A', 'B', 'C'].forEach((i) => {
    const a = acc[i], n = Math.max(1, a.n);
    out[i] = {
      gap: a.gap / n,
      infl: a.infl / n,
      nx: a.nx / n,
      debt: s.countries[i].econ.govDebt - state.countries[i].econ.base.govDebt
    };
  });
  return out;
}

/** Flattens the output of runShadow into a 12-dimensional error vector: [gap, infl, nx, debt] × [A, B, C] */
function errVector(res) {
  const out = [];
  ['A', 'B', 'C'].forEach((i) => { out.push(res[i].gap, res[i].infl, res[i].nx, res[i].debt); });
  return out;
}

/** Solve a system of linear equations by Gaussian elimination */
function solveLinear(A, b) {
  const n = b.length;
  const M = A.map((row, i) => row.concat([b[i]]));
  for (let col = 0; col < n; col++) {
    let piv = col;
    for (let r = col + 1; r < n; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    }
    if (Math.abs(M[piv][col]) < 1e-9) continue;
    const tmp = M[col]; M[col] = M[piv]; M[piv] = tmp;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = M[r][col] / M[col][col];
      if (!f) continue;
      for (let k = col; k <= n; k++) M[r][k] -= f * M[col][k];
    }
  }
  const x = new Array(n).fill(0);
  for (let r = 0; r < n; r++) x[r] = Math.abs(M[r][r]) > 1e-9 ? M[r][n] / M[r][r] : 0;
  return x;
}

function autoCalibrate(state, verbose) {
  const ids = ['A', 'B', 'C'];
  const n = ids.length * KNOBS.length;
  let last = Infinity;
  for (let iter = 0; iter < 6; iter++) {
    const e0 = errVector(runShadow(state, null));
    const norm = Math.max.apply(null, e0.map(Math.abs));
    if (verbose) console.log(`  [calibration] round ${iter + 1}, max error ${norm.toFixed(3)}`);
    if (norm < 0.02 || norm > last * 1.0001 && iter > 2) break;
    last = norm;

    // numerical Jacobian D[target][knob]
    const D = [];
    for (let t = 0; t < n; t++) D.push(new Array(n).fill(0));
    for (let k = 0; k < n; k++) {
      const ci = ids[Math.floor(k / KNOBS.length)], knob = KNOBS[k % KNOBS.length];
      const ek = errVector(runShadow(state, (s) => {
        knob.set(s.countries[ci], knob.get(s.countries[ci]) + knob.h);
      }));
      for (let t = 0; t < n; t++) D[t][k] = (ek[t] - e0[t]) / knob.h;
    }

    // normal equations (DᵀD + λI) Δ = −Dᵀ e0
    const lam = 0.08;
    const A = [];
    const rhs = [];
    for (let k1 = 0; k1 < n; k1++) {
      const row = new Array(n).fill(0);
      let bk = 0;
      for (let k2 = 0; k2 < n; k2++) {
        let s = 0;
        for (let t = 0; t < n; t++) s += D[t][k1] * D[t][k2];
        row[k2] = s + (k1 === k2 ? lam : 0);
      }
      for (let t = 0; t < n; t++) bk += D[t][k1] * e0[t];
      rhs.push(-bk);
      A.push(row);
    }
    const d = solveLinear(A, rhs);
    for (let k = 0; k < n; k++) {
      const ci = ids[Math.floor(k / KNOBS.length)], knob = KNOBS[k % KNOBS.length];
      const dv = clamp(d[k] || 0, -knob.step, knob.step);
      knob.set(state.countries[ci], clamp(knob.get(state.countries[ci]) + dv, knob.lim[0], knob.lim[1]));
    }
  }
  if (verbose) {
    ['A', 'B', 'C'].forEach((i) => {
      const c = state.countries[i];
      console.log(`  ${i}: adBias ${c.econ.base.adBias.toFixed(2)} inflBias ${c.econ.base.inflBias.toFixed(2)}`
        + ` balanceAdj ${c.econ.base.balanceAdj.toFixed(2)} exportTrend ${c.econ.exportTrend.toFixed(2)}`);
    });
  }
}

/* ============================ Module calculations ============================ */

/** Government revenue and spending (%GDP) */
function computeFiscal(state, c, dry) {
  const e = c.econ, p = c.policy, b = e.base;
  const rIncome = effectiveRate(p.taxIncome, 0.42);
  const rCorp = effectiveRate(p.taxCorporate, 0.40);
  const rCap = effectiveRate(p.taxCapital, 0.35);
  const rCons = p.taxConsumption;

  const revTax = 0.55 * rIncome + 0.12 * rCorp + 0.08 * rCap + 0.55 * rCons;
  const prog = 1 + (p.progressivity - b.progressivity) / 400;
  // Tax buoyancy: measured against the "baseline real GDP path", capturing only cyclical/policy deviations, 
  // to avoid a spurious fiscal drag from trend growth at the baseline.
  const trend = e.trendReal || b.gdp;
  const buoyancy = clamp(1 + 0.12 * Math.log(Math.max(0.2, e.gdp / trend)), 0.75, 1.5);
  const other = b.otherRevenue * buoyancy;
  const revenue = (revTax * prog + other) * buoyancy + (e.tariffRevenue || 0);

  const spendMix = p.spend.education + p.spend.health + p.spend.infrastructure
    + p.spend.defence + p.spend.other;
  const extra = p.ssEducation + p.ssTech + p.ssInfra + p.directProvision + p.subsidies;
  const spend = spendMix + extra;
  const trans = p.transfers + p.ubi;

  // Outstanding debt is serviced at historical rates and repriced slowly (avoiding a debt–interest death spiral)
  const interest = e.govDebt * (e.debtRate || b.debtServicingRate || 3) / 100;
  const subExport = e.exportSubsidyCost || 0;
  const stabilizer = 0.30 * e.gap;      // automatic stabiliser
  // balanceAdj: baseline calibration term (off-budget balance); it affects debt and the budget balance only, not the AD impulse
  const balance = revenue - spend - trans - interest - subExport + stabilizer + (b.balanceAdj || 0);

  if (!dry) {
    e.revenueGDP = revenue;
    e.spendGDP = spend;
    e.transGDP = trans;
    e.interestGDP = interest;
    e.budgetBalance = balance;
    e.taxRates = { income: rIncome, corporate: rCorp, capital: rCap, consumption: rCons };
  }
  return { revenue, spend, trans, interest, balance };
}

/** Borrowing costs and sovereign risk */
function computeBorrowingCost(state, c, dry) {
  const e = c.econ, p = c.policy, b = e.base;
  const inflRisk = 0.30 * (e.inflation - e.inflationTarget);
  const sovRisk = Math.max(0, (e.govDebt - 90) * 0.018)
    + Math.max(0, -(e.budgetBalance) - 6) * 0.05
    + (p.fxRegime === 'fixed' && e.fxReserves / Math.max(1, e.imports) < 3 ? 1.5 : 0);
  if (!dry) e.sovereignRisk = clamp(sovRisk, 0, 8);
  const longRate = p.policyRate + b.debtTermPremium + inflRisk + clamp(sovRisk, 0, 8);
  const qeEase = p.qeSize * 0.035;
  const omoEase = p.omoStance * 0.12;
  const rr = 0.05 * (p.reserveRatio - c.rr0);
  const borrowing = 0.45 * p.policyRate + 0.55 * longRate + b.creditSpread
    - qeEase - omoEase + rr;
  if (!dry) {
    e.longRate = longRate;
    e.borrowingCost = borrowing;
    e.policyRate = p.policyRate;
    e.reserveRatio = p.reserveRatio;
  }
  return borrowing;
}

/** Exchange rate pressure (positive = depreciation pressure, in %) */
function fxPressure(state, c) {
  const e = c.econ, p = c.policy, b = e.base;
  const others = ['A', 'B', 'C'].filter((x) => x !== c.id);
  const avgOtherRate = others.reduce((s, x) => s + state.countries[x].econ.policyRate, 0) / others.length;
  const avgOtherInfl = others.reduce((s, x) => s + state.countries[x].econ.inflation, 0) / others.length;
  const iF = 0.5 * state.world.policyRate + 0.5 * avgOtherRate;
  const inflF = 0.5 * state.world.inflation + 0.5 * avgOtherInfl;
  const mobility = b.capitalMobility * (1 - p.capitalControls / 100);

  const carry = mobility * (p.policyRate - iF) * 0.35;           // higher rates → capital inflows → appreciation
  const caTerm = mobility * (e.currentAccount - b.currentAccount) * 0.30;
  const riskTerm = -(e.sovereignRisk || 0) * 0.5;
  // relative PPP: higher inflation than trading partners → the nominal rate keeps depreciating by the inflation differential while the real rate is unchanged
  const ppp = (e.inflation - state.world.inflation) / 4;
  e.iForeign = iF; e.inflForeign = inflF;
  return ppp - (carry + caTerm + riskTerm) + (e.shock.trade || 0);
}

/** International trade: bilateral flows, net exports and tariff revenue */
function computeTrade(state) {
  const ids = ['A', 'B', 'C'];
  const cs = ids.map((i) => state.countries[i]);
  const { E0 } = state.trade;
  const el = ELAST;

  // the domestic good priced in US dollars: domestic price ÷ exchange rate (domestic/USD)
  // depreciation (fx rises) → the USD price of domestic goods falls → exports rise and imports fall
  const usdPrice = {};
  cs.forEach((c) => { usdPrice[c.id] = (c.econ.priceLevel / 100) / (c.econ.fxIndex / 100); });
  const rowPrice = state.world.rowPriceIndex / 100;

  // import demand: income effect × export linkage (processing-trade economies)
  const impDemand = {};
  cs.forEach((c) => {
    const b = c.econ.base;
    const baseExports = b.totalExports;
    impDemand[c.id] = Math.pow(c.econ.gdp / b.gdp, b.incomeElasticity)
      * Math.pow(c.econ.exports / baseExports, b.exportLinkage);
  });

  const F = {};          // F['A>B'] = export flow
  const rowExp = {}, rowImp = {};

  cs.forEach((ci) => {
    const i = ci.id, pi = ci.policy;
    const tf = ci.econ.exportTrendFactor || 1;
    cs.forEach((cj) => {
      if (i === cj.id) return;
      const j = cj.id, pj = cj.policy;
      const rel = usdPrice[i] / usdPrice[j];
      const tariffF = Math.pow(1 + (pj.tariffs[i] || 0) / 100, -TARIFF_ELAST);
      const quotaF = 1 - clamp(pj.quotas[i] || 0, 0, 90) / 100;
      const ntbF = 1 - clamp(pj.ntb[i] || 0, 0, 100) * 0.006;
      const subF = Math.pow(1 + (pi.exportSubsidy[j] || 0) / 100, el * 0.55);
      const ftaF = 1 + ((pj.fta[i] ? 1 : 0) + (pi.fta[j] ? 1 : 0)) * 0.12;
      F[i + '>' + j] = E0[i][j] * Math.pow(rel, -el) * tariffF * quotaF * ntbF
        * subF * impDemand[j] * ftaF * tf;
    });
    const relRow = usdPrice[i] / rowPrice;
    rowExp[i] = E0[i].ROW * Math.pow(relRow, -el)
      * Math.pow(1 + (pi.exportSubsidy.ROW || 0) / 100, el * 0.55)
      * (state.world.rowDemandIndex / 100) * tf;
    rowImp[i] = E0.ROW[i] * Math.pow(rowPrice / usdPrice[i], -el)
      * Math.pow(1 + (pi.tariffs.ROW || 0) / 100, -TARIFF_ELAST)
      * (1 - clamp(pi.ntb.ROW || 0, 0, 100) * 0.006)
      * impDemand[i];
  });

  const tariffRev = {}, subCost = {};
  cs.forEach((ci) => {
    const i = ci.id, pi = ci.policy, ei = ci.econ;
    let X = rowExp[i], M = rowImp[i];
    tariffRev[i] = rowImp[i] * (pi.tariffs.ROW || 0) / 100;
    subCost[i] = rowExp[i] * (pi.exportSubsidy.ROW || 0) / 100;
    const detail = { ROW: rowExp[i] };
    cs.forEach((cj) => {
      if (i === cj.id) return;
      const j = cj.id;
      X += F[i + '>' + j];
      M += F[j + '>' + i];
      detail[j] = F[i + '>' + j];
      tariffRev[i] += F[j + '>' + i] * (pi.tariffs[j] || 0) / 100;
      subCost[i] += F[i + '>' + j] * (pi.exportSubsidy[j] || 0) / 100;
    });
    ei.exports = X;
    ei.imports = M;
    ei.netExports = X - M;
    ei.exportDetail = detail;
    ei.tariffRevenue = tariffRev[i] / Math.max(1, ei.gdp) * 100;
    ei.exportSubsidyCost = subCost[i] / Math.max(1, ei.gdp) * 100;
    // Net export impulse: measured by the change in "net exports as a share of GDP" (percentage points), 
    // the ratio is constant at the baseline ⇒ no spurious AD impulse
    ei.nxRatio = ei.netExports / Math.max(1, ei.gdp) * 100;
    ei.nxGap = clamp(ei.nxRatio - ei.base.nxRatio, -25, 25);

    // trade barriers raise import prices (relative to baseline), creating cost-push inflation pressure
    let bc = 0;
    ['A', 'B', 'C', 'ROW'].forEach((k) => {
      if (k === i) return;
      const sh = ei.base.impShare[k] || 0;
      const t0 = TEMPLATES[i].tariffs[k] || 0, t1 = pi.tariffs[k] || 0;
      const n0 = TEMPLATES[i].ntb[k] || 0, n1 = pi.ntb[k] || 0;
      const q1 = pi.quotas[k] || 0;
      bc += sh * ((1 + t1 / 100) / (1 + t0 / 100) - 1
        + (n1 - n0) * 0.004 + q1 * 0.004);
    });
    ei.barrierCost = bc * 100;
  });
  state.flows = F;
}

/** Structural indices converge towards policy targets (lagged transmission of supply-side policy) */
function updateStructure(c) {
  const e = c.econ, p = c.policy, b = e.base;
  const conv = (key, target, speed) => {
    e[key] = e[key] + (clamp(target, 0, 100) - e[key]) * speed;
  };
  const mixEdu = p.spend.education - b.spend.education;
  const mixHealth = p.spend.health - b.spend.health;
  const mixInfra = p.spend.infrastructure - b.spend.infrastructure;

  conv('education', b.education + 2.2 * mixEdu + 3.2 * p.ssEducation + p.industrial.marketEdu * 0.05, 0.22);
  conv('health', b.health + 2.0 * mixHealth + 2.6 * p.directProvision, 0.22);
  conv('infrastructure', b.infrastructure + 2.6 * mixInfra + 3.4 * p.ssInfra + 0.05 * (p.ppp - 30), 0.20);
  conv('technology', b.technology + 3.6 * p.ssTech + 0.06 * (p.tradeLiberalisation - b.tradeOpenness)
    + 0.04 * (p.deregulation - b.deregulation) + p.industrial.sme * 0.03, 0.18);
  conv('competition', b.competition + 0.12 * (p.privatisation - b.privatisation)
    + 0.14 * (p.deregulation - b.deregulation) + 0.10 * (p.antitrust - b.competition)
    + 0.08 * (p.tradeLiberalisation - b.tradeOpenness) + 0.05 * (p.outsourcing - 40)
    + 0.04 * (p.ppp - 30), 0.20);
  conv('regulationBurden', b.regulationBurden - 0.30 * (p.deregulation - b.deregulation)
    - 0.10 * (p.outsourcing - 40) + 0.08 * (p.antitrust - b.competition), 0.22);

  const T = TEMPLATES[c.id];
  const avg = (o) => ((o.A || 0) + (o.B || 0) + (o.C || 0)) / 3;
  const barrier = avg(p.tariffs) + avg(p.quotas) * 1.5 + avg(p.ntb) * 0.4;
  const baseBarrier = avg(T.tariffs) + avg(T.quotas) * 1.5 + avg(T.ntb) * 0.4;
  conv('tradeOpenness', b.tradeOpenness + 0.35 * (p.tradeLiberalisation - b.tradeOpenness)
    - 0.55 * (barrier - baseBarrier) + 6 * ((p.fta.A ? 1 : 0) + (p.fta.B ? 1 : 0) + (p.fta.C ? 1 : 0)), 0.25);
  conv('envQuality', b.envQuality + 0.35 * (p.greenPolicy - b.greenPolicy)
    - 0.36 * Math.max(0, e.growth - 3), 0.18);
}

/** potential output */
function updatePotential(c) {
  const e = c.econ, b = e.base;
  const laborGrowth = b.laborGrowth + 0.002 * (e.education - b.education);
  const capitalTerm = 0.30 * (e.investmentGDP - b.investmentGDP);
  const g = b.potentialGrowth
    + 0.08 * (e.education - b.education)
    + 0.10 * (e.infrastructure - b.infrastructure)
    + 0.12 * (e.technology - b.technology)
    + 0.06 * (e.competition - b.competition)
    - 0.05 * (e.regulationBurden - b.regulationBurden)
    + 0.03 * (e.health - b.health)
    + 0.04 * (e.tradeOpenness - b.tradeOpenness)
    + 0.5 * capitalTerm
    + laborGrowth * 0.6;
  e.potentialGrowth = clamp(g, -3, 12);
  e.potential *= (1 + e.potentialGrowth / 400);
  e.laborForce *= (1 + laborGrowth / 400);
  e.pop *= (1 + (laborGrowth + 0.2) / 400);
}

/* ============================ Advancing a quarter ============================ */

function advanceQuarter(state) {
  const ids = ['A', 'B', 'C'];
  const cs = ids.map((i) => state.countries[i]);

  // world environment
  let wg = 0, wi = 0, wr = 0;
  (state.world.shocks || []).forEach((s) => { wg += s.worldGrowth; wi += s.worldInflation; wr += s.worldRate; });
  state.world.shocks = (state.world.shocks || []).filter((s) => --s.quarters > 0);
  state.world.growth += (WORLD.growth + wg - state.world.growth) * 0.5;
  state.world.inflation += (WORLD.inflation + wi - state.world.inflation) * 0.5;
  state.world.policyRate += (WORLD.policyRate + wr - state.world.policyRate) * 0.5;
  state.world.rowPriceIndex *= (1 + state.world.inflation / 400);
  state.world.rowDemandIndex *= (1 + state.world.growth / 400);

  // 1) structure, potential output and export trends
  cs.forEach((c) => {
    updateStructure(c);
    updatePotential(c);
    c.econ.exportTrendFactor = (c.econ.exportTrendFactor || 1)
      * (1 + (c.econ.exportTrend || 0) / 400);
    c.econ.trendReal = (c.econ.trendReal || c.econ.base.gdp)
      * (1 + c.econ.base.potentialGrowth / 400);
  });

  // 2) monetary conditions
  cs.forEach((c) => {
    const e = c.econ;
    const cost = computeBorrowingCost(state, c, false);
    e.realBorrowHist = e.realBorrowHist || [];
    e.realBorrowHist.push(cost - e.inflationExp);
    if (e.realBorrowHist.length > 3) e.realBorrowHist.shift();
    e.realBorrowing = e.realBorrowHist.reduce((a, b) => a + b, 0) / e.realBorrowHist.length;
    e.moneyIndex *= (1 + (c.policy.omoStance * 0.6 + c.policy.qeSize * 0.4
      - (c.policy.reserveRatio - c.rr0) * 0.3) / 100);
  });

  // 3) fiscal
  cs.forEach((c) => computeFiscal(state, c, false));

  // 4) trade
  computeTrade(state);

  // 5) aggregate demand → output gap → GDP
  cs.forEach((c) => {
    const e = c.econ, p = c.policy, b = e.base;
    const dSpend = e.spendGDP - b.spendTotal;
    const dTax = (e.revenueGDP - b.revenueGDP) - (e.tariffRevenue - b.tariffRevenue);
    const dTrans = (p.transfers + p.ubi) - b.transfers;
    const m = b.fiscalMultiplier;
    const fiscalImpulse = m * dSpend - m * 0.62 * dTax + m * 0.55 * dTrans;
    const monImpulse = -b.monSens * (e.realBorrowing - e.neutralReal);
    const nxImpulse = b.nxMultiplier * e.nxGap;
    const confImpulse = 0.02 * (e.businessConfidence - 50) + 0.015 * (e.consumerConfidence - 50);

    e.fiscalImpulse = clamp(fiscalImpulse, -12, 12);
    e.monetaryImpulse = clamp(monImpulse, -12, 12);
    e.nxImpulse = clamp(nxImpulse, -12, 12);
    const target = e.fiscalImpulse + e.monetaryImpulse + e.nxImpulse + confImpulse
      + e.shock.demand + (b.adBias || 0);
    e.gapTarget = clamp(target, -16, 14);
    e.gap = clamp(e.gap + (e.gapTarget - e.gap) * GAP_ADJ, -16, 14);
    e.adShift = e.gapTarget;

    e.gdp = e.potential * (1 + e.gap / 100);
    e.growth = (e.gdp / e.gdpPrev - 1) * 400;
    e.gdpPrev = e.gdp;

    // expenditure accounting (%GDP, normalised to 100)
    const C = b.consumptionGDP
      - 0.30 * (p.taxIncome - b.taxIncome)
      + 0.35 * dTrans
      - 0.22 * (e.realBorrowing - e.neutralReal)
      + 0.22 * e.gap
      - 0.20 * (e.unemployment - b.unemployment)
      - 0.06 * (p.taxConsumption - b.taxConsumption);
    const I = b.investmentGDP
      - 0.55 * (e.realBorrowing - e.neutralReal)
      + 0.40 * e.gap
      - 0.25 * (p.taxCorporate - b.taxCorporate)
      + 0.03 * (e.businessConfidence - 50);
    const G = e.spendGDP;
    const X = e.exports / e.gdp * 100;
    const M = e.imports / e.gdp * 100;
    const sum = Math.max(20, C + I + G + (X - M));
    const k = 100 / sum;
    e.consumptionGDP = C * k;
    e.investmentGDP = I * k;
    e.compC = C * k; e.compI = I * k; e.compG = G * k;
    e.compX = X * k; e.compM = M * k;
  });

  // 6) exchange rate
  cs.forEach((c) => {
    const e = c.econ, p = c.policy;
    const dep = fxPressure(state, c) + e.fxBias;
    e.depreciation = 0;
    if (p.fxRegime === 'fixed') {
      const need = Math.abs(dep + (e.fxIndex - p.fxTarget)) / 100 * e.imports * 0.25;
      if (e.fxReserves > need) {
        e.fxReserves -= need;
        e.fxIndex = p.fxTarget;
        e.depreciation = (e.fxIndex / e.prevFxIndex - 1) * 100;
      } else {
        e.fxIndex *= (1 + Math.abs(dep * 1.5) / 100);
        e.depreciation = (e.fxIndex / e.prevFxIndex - 1) * 100;
        e.shock.supply += 1.5;
        pushLog(state, c, '⚠️ FX reserves exhausted: the currency was forced to depreciate and a currency crisis broke out!', 'crisis');
      }
    } else if (p.fxRegime === 'managed') {
      const damp = clamp(0.45 - p.fxIntervention * 0.06, 0.05, 0.9);
      e.fxIndex *= (1 + dep * damp / 100);
      e.depreciation = (e.fxIndex / e.prevFxIndex - 1) * 100;
      e.fxReserves = Math.max(0, e.fxReserves - dep * e.imports * 0.06);
    } else {
      e.fxIndex *= (1 + dep * 0.75 / 100);
      e.depreciation = (e.fxIndex / e.prevFxIndex - 1) * 100;
      e.fxReserves = Math.max(0, e.fxReserves - dep * e.imports * 0.02);
    }
    e.prevFxIndex = e.fxIndex;
    e.fx = TEMPLATES[c.id].fx * e.fxIndex / 100;
  });

  // 7) inflation and the price level
  cs.forEach((c) => {
    const e = c.econ;
    // import price pass-through share: scaled by import dependence (baseline removed to avoid self-generating inflation at the baseline)
    const ptShare = clamp(e.imports / e.gdp, 0, 1) * 0.45;
    const barrierPass = clamp(e.imports / e.gdp, 0, 1) * 0.5;
    const importPriceInfl = (e.depreciation || 0) * 4 * ptShare * 0.65
      + (state.world.inflation - WORLD.inflation) * ptShare * 0.5
      + (e.barrierCost || 0) * barrierPass;
    e.importPriceInfl = importPriceInfl;
    const prodBonus = 0.05 * (e.technology - e.base.technology)
      + 0.04 * (e.competition - e.base.competition)
      + 0.02 * (e.infrastructure - e.base.infrastructure);
    const core = e.inflationExp + PHILLIPS_K * e.gap + importPriceInfl + e.shock.supply
      - prodBonus + (e.base.inflBias || 0);
    e.inflation = clamp(e.inflation + (core - e.inflation) * 0.6, -8, 60);
    // inflation expectations: adaptive expectations plus anchoring on the central bank target (credibility falls as the gap widens)
    const cred = clamp(1 - Math.abs(e.inflation - e.inflationTarget) / 12, 0.25, 1);
    e.inflationExp = e.inflationExp + (e.inflation - e.inflationExp) * EXP_ADAPT
      + (e.inflationTarget - e.inflationExp) * 0.05 * cred;
    e.priceLevel *= (1 + e.inflation / 400);
    // SRAS shift (for the AD/AS diagram)
    const dTech = e.technology - (e._pTech != null ? e._pTech : e.base.technology);
    const dInfra = e.infrastructure - (e._pInfra != null ? e._pInfra : e.base.infrastructure);
    const dEdu = e.education - (e._pEdu != null ? e._pEdu : e.base.education);
    const dComp = e.competition - (e._pComp != null ? e._pComp : e.base.competition);
    const dReg = e.regulationBurden - (e._pReg != null ? e._pReg : e.base.regulationBurden);
    e._pTech = e.technology; e._pInfra = e.infrastructure;
    e._pEdu = e.education; e._pComp = e.competition; e._pReg = e.regulationBurden;
    e.srasShift += 0.30 * dTech + 0.22 * dInfra + 0.18 * dEdu + 0.28 * dComp
      - 0.25 * dReg - 0.30 * importPriceInfl - e.shock.supply * 0.5;
  });

  // 8) labour market
  cs.forEach((c) => {
    const e = c.econ, p = c.policy, b = e.base;
    const oldNairu = e.nairu;
    e.nairu = clamp(b.nairu
      + 0.015 * (p.unionPower - b.unionPower)
      + 0.018 * (p.unemploymentBenefit - b.unemploymentBenefit)
      + 0.012 * (p.jobSecurity - b.jobSecurity)
      + 0.015 * (p.minWage - b.minWage)
      - 0.008 * (e.education - b.education)
      - 0.005 * (e.technology - b.technology), 0.8, 22);
    if (e.unemployment - e.nairu > 2) e.nairu += 0.03;
    let u = e.unemployment - OKUN * (e.growth - e.potentialGrowth);
    u += 0.25 * (e.nairu - oldNairu);
    e.unemployment = clamp(u, 0.4, 30);
    e.employment = e.laborForce * (1 - e.unemployment / 100);
  });

  // 9) government debt
  cs.forEach((c) => {
    const e = c.econ;
    const nominalGrowth = e.growth + e.inflation;
    // the budget balance is annual, so a quarter takes a quarter of it, plus the (r − g) stock effect
    e.govDebt = clamp(e.govDebt - e.budgetBalance / 4
      + e.govDebt * (e.debtRate - nominalGrowth) / 400, 0, 400);
    // the rate on outstanding debt reprices slowly towards market rates (long maturity structure)
    e.debtRate = e.debtRate + (0.5 * e.policyRate + 0.5 * e.longRate - e.debtRate) * 0.04;
    e.govDebtLevel = e.gdp * e.priceLevel / 100 * e.govDebt / 100;
  });

  // 10) distribution, welfare and sustainability
  cs.forEach((c) => {
    const e = c.econ, p = c.policy, b = e.base;
    const giniTarget = b.gini
      - 0.35 * (p.transfers - b.transfers)
      - 0.50 * p.ubi
      - 0.045 * (p.minWage - b.minWage)
      - 0.030 * (p.unionPower - b.unionPower)
      - 0.040 * (p.progressivity - b.progressivity)
      - 0.030 * (p.antiDiscrimination - b.antiDiscrimination)
      - 0.025 * p.directProvision
      - 0.080 * (p.taxIncome - b.taxIncome)
      - 0.090 * (p.taxCapital - b.taxCapital)
      - 0.015 * (p.taxCorporate - b.taxCorporate)
      + 0.030 * (p.privatisation - b.privatisation)
      + 0.025 * (p.deregulation - b.deregulation)
      + 0.020 * (e.technology - b.technology)
      + 0.025 * (e.tradeOpenness - b.tradeOpenness)
      + 0.50 * (e.unemployment - e.nairu)
      + 0.06 * (e.inflation - e.inflationTarget)
      - 0.05 * (e.education - b.education);
    e.gini = clamp(e.gini + (clamp(giniTarget, 15, 70) - e.gini) * 0.35, 15, 70);

    const pgdp = e.gdp * 1000 / e.pop;
    e.gdpPerCapita = pgdp;
    const pppFactor = 1 + (b.gdpPerCapitaPPP / b.gdpPerCapita - 1)
      * Math.pow(b.gdpPerCapita / Math.max(1, pgdp), 0.6);
    e.gdpPerCapitaPPP = pgdp * pppFactor;

    const mpiTarget = b.mpi
      - 0.22 * (e.growth - b.potentialGrowth)
      - 0.9 * (p.transfers - b.transfers)
      - 1.3 * p.ubi
      - 0.8 * p.directProvision
      - 0.05 * (e.education - b.education)
      - 0.03 * (e.health - b.health)
      + 0.15 * (e.gini - b.gini)
      + 0.25 * (e.unemployment - e.nairu);
    e.mpi = clamp(e.mpi + (clamp(mpiTarget, 0, 60) - e.mpi) * 0.30, 0, 60);

    e.lifeExpectancy = clamp(b.lifeExpectancy
      + 2.2 * Math.log(Math.max(0.3, pgdp / b.gdpPerCapita))
      + 0.02 * (e.health - b.health)
      - 0.015 * (e.mpi - b.mpi)
      - 0.02 * Math.max(0, 60 - e.envQuality), 45, 92);

    const wb = clamp(b.wellbeing
      + 0.42 * Math.log2(Math.max(0.3, pgdp / b.gdpPerCapita))
      - 0.020 * (e.gini - b.gini)
      - 0.13 * (e.unemployment - e.nairu)
      - 0.035 * (e.inflation - e.inflationTarget)
      + 0.010 * (e.envQuality - b.envQuality)
      + 0.06 * (e.lifeExpectancy - b.lifeExpectancy), 1, 10);
    e.wellbeing = wb;
    e.footprint = Math.max(0.5, b.footprint * (1 + 0.35 * (pgdp / b.gdpPerCapita - 1))
      * (1 - p.greenPolicy / 100 * 0.30));
    const raw = wb * e.lifeExpectancy / e.footprint;
    const raw0 = b.wellbeing * b.lifeExpectancy / b.footprint;
    e.hpi = clamp(b.hpi * (raw / raw0), 0, 100);

    const iIncome = clamp((Math.log(Math.max(501, e.gdpPerCapitaPPP)) - Math.log(500))
      / (Math.log(85000) - Math.log(500)), 0, 1);
    const iEdu = clamp(e.education / 100, 0, 1);
    const iHealth = clamp((e.lifeExpectancy - 20) / 65, 0, 1);
    e.hdi = clamp((b.hdiScale || 1) * Math.pow(iIncome * iEdu * iHealth, 1 / 3), 0.2, 0.99);
    e.hdiParts = { income: iIncome, education: iEdu, health: iHealth };

    e.currentAccount = e.netExports / Math.max(1, e.gdp) * 100 + b.caOffset;
    e.tradeOpennessRatio = (e.exports + e.imports) / e.gdp * 100;

    e.businessConfidence = clamp(50 + 0.8 * e.growth - 1.2 * (e.inflation - e.inflationTarget)
      - 0.6 * (p.taxCorporate - b.taxCorporate) + 0.5 * e.gap, 5, 95);
    e.consumerConfidence = clamp(50 + 0.6 * e.growth - 1.5 * (e.inflation - e.inflationTarget)
      - 1.5 * (e.unemployment - e.nairu), 5, 95);
    e.creditHealth = clamp(70 - 0.6 * (e.realBorrowing - e.neutralReal)
      - 1.2 * Math.max(0, -e.growth), 10, 100);

    const s = e.shock;
    s.demand *= 0.5; s.supply *= 0.5; s.trade *= 0.5;
    if (Math.abs(s.demand) < 0.02) s.demand = 0;
    if (Math.abs(s.supply) < 0.02) s.supply = 0;
    if (Math.abs(s.trade) < 0.02) s.trade = 0;
  });

  // 11) advancing time
  state.time.index += 1;
  state.time.quarter += 1;
  if (state.time.quarter > 4) { state.time.quarter = 1; state.time.year += 1; }
  computeScores(state);
  recordHistory(state, false);
  return state;
}

/* ============================ Composite economic health index ============================ */

function subScore(c, w) {
  const e = c.econ;
  const pgdp = e.gdpPerCapita || (e.gdp * 1000 / e.pop);
  const recent = c.history.slice(-4).map((h) => h.growth);
  const avgGrowth = recent.length ? recent.reduce((a, x) => a + x, 0) / recent.length : e.growth;

  const s = {};
  s.gdpPerCapita = clamp((Math.log(Math.max(2000, pgdp)) - Math.log(2000)) / (Math.log(70000) - Math.log(2000)) * 100, 0, 100);
  s.growth = clamp((avgGrowth + 1) / 8 * 100, 0, 100);
  s.unemployment = clamp(100 - 10 * Math.abs(e.unemployment - e.nairu) - 4 * Math.max(0, e.unemployment - 4), 0, 100);
  s.inflation = clamp(100 - 18 * Math.abs(e.inflation - e.inflationTarget)
    - 6 * Math.max(0, e.inflation - 6) - 5 * Math.max(0, -e.inflation), 0, 100);
  s.debt = clamp(100 - Math.max(0, e.govDebt - 40) * 0.7 - Math.max(0, 25 - e.govDebt), 0, 100);
  s.hdi = clamp((e.hdi - 0.55) / 0.40 * 100, 0, 100);
  s.hpi = clamp(e.hpi / 70 * 100, 0, 100);
  s.gini = clamp(100 - (e.gini - 25) * 2.2, 0, 100);
  s.mpi = clamp(100 - e.mpi * 8, 0, 100);
  s.currentAccount = clamp(100 - 8 * Math.abs(e.currentAccount), 0, 100);

  let total = 0;
  Object.keys(w).forEach((k) => { total += (s[k] || 0) * (w[k] || 0); });
  return { parts: s, score: total };
}

function computeScores(state) {
  const w = state.settings.weights;
  ['A', 'B', 'C'].forEach((id) => {
    const c = state.countries[id];
    const r = subScore(c, w);
    c.econ.score = r.score;
    c.econ.scoreParts = r.parts;
    if (c.econ.baseScore == null) c.econ.baseScore = r.score;
    c.econ.scoreGain = r.score - c.econ.baseScore;
  });
}

function recordHistory(state) {
  ['A', 'B', 'C'].forEach((id) => {
    const c = state.countries[id], e = c.econ;
    c.history.push({
      t: state.time.index,
      label: `${state.time.year}Q${state.time.quarter}`,
      gdp: e.gdp, growth: e.growth, potential: e.potential, gap: e.gap,
      inflation: e.inflation, unemployment: e.unemployment, nairu: e.nairu,
      debt: e.govDebt, gini: e.gini, hdi: e.hdi, hpi: e.hpi, mpi: e.mpi,
      ca: e.currentAccount, fx: e.fxIndex, exports: e.exports, imports: e.imports,
      score: e.score || 0, education: e.education, technology: e.technology,
      infrastructure: e.infrastructure, competition: e.competition
    });
    if (c.history.length > 80) c.history.shift();
  });
}

/* ============================ Logging and shocks ============================ */

function pushLog(state, c, text, kind) {
  const entry = {
    id: ++state.seq,
    t: `${state.time.year}Q${state.time.quarter}`,
    time: Date.now(),
    country: c ? c.id : 'WORLD',
    text, kind: kind || 'info'
  };
  if (c) { c.log.unshift(entry); if (c.log.length > 200) c.log.pop(); }
  state.events.unshift(entry);
  if (state.events.length > 400) state.events.pop();
  return entry;
}

const EVENT_LIBRARY = [
  { id: 'global_recession', name: '🌍 Global recession', desc: 'World demand drops by 3 percentage points for 4 quarters; every country’s exports come under pressure.', quarters: 4, worldGrowth: -3, worldInflation: -1, worldRate: -2 },
  { id: 'commodity_shock', name: '🛢️ Energy and commodity price spike', desc: 'Import prices rise, SRAS shifts left in every country and cost-push inflation appears.', supply: 2.2 },
  { id: 'tech_boom', name: '💡 General-purpose technology breakthrough', desc: 'A new technology diffuses: every country’s technology level rises by 4 and productivity improves.', tech: 4 },
  { id: 'pandemic', name: '🦠 Global public health crisis', desc: 'Demand and supply are hit at the same time for 2 quarters.', quarters: 2, demand: -3.5, supply: 1.8, worldGrowth: -2 },
  { id: 'capital_flight', name: '💸 Emerging-market capital flight', desc: 'Capital flows out: depreciation pressure rises by 6% and sovereign risk increases.', trade: 6 },
  { id: 'supply_chain', name: '🚢 Supply chain disruption', desc: 'Intermediate inputs are scarce, costs rise and net exports suffer.', supply: 1.5, demand: -1.2 },
  { id: 'credit_crunch', name: '🏦 Banking crisis', desc: 'Credit contracts and real borrowing costs rise by 2 percentage points.', credit: 2 }
];

function applyEvent(state, eventId, targetId) {
  const ev = EVENT_LIBRARY.find((x) => x.id === eventId);
  if (!ev) return null;
  if (ev.worldGrowth || ev.worldInflation || ev.worldRate) {
    state.world.shocks = state.world.shocks || [];
    state.world.shocks.push({
      worldGrowth: ev.worldGrowth || 0, worldInflation: ev.worldInflation || 0,
      worldRate: ev.worldRate || 0, quarters: ev.quarters || 4
    });
  }
  const targets = targetId ? [state.countries[targetId]] : ['A', 'B', 'C'].map((i) => state.countries[i]);
  targets.forEach((c) => {
    const e = c.econ;
    if (ev.supply) e.shock.supply += ev.supply;
    if (ev.demand) e.shock.demand += ev.demand;
    if (ev.trade) e.shock.trade += ev.trade;
    if (ev.tech) e.technology += ev.tech;
    if (ev.credit) e.creditSpread = (e.creditSpread || 0) + ev.credit;
    pushLog(state, c, `📢 External shock: ${ev.name} — ${ev.desc}`, 'event');
  });
  return ev;
}

/* ============================ Front-end view ============================ */

function publicView(c, viewer) {
  const e = c.econ;
  const isOwn = viewer && viewer.countryId === c.id;
  const isTeacher = viewer && viewer.type === 'teacher';
  const v = {
    id: c.id, name: c.name, flag: c.flag, mascot: c.mascot, color: c.color,
    templateName: c.templateName, tagline: c.tagline, traits: c.traits,
    president: c.president,
    members: c.accounts.map((a) => ({ username: a.username, role: a.role })),
    econ: {
      pop: e.pop, gdp: e.gdp, gdpPerCapita: e.gdpPerCapita, gdpPerCapitaPPP: e.gdpPerCapitaPPP,
      growth: e.growth, potential: e.potential, potentialGrowth: e.potentialGrowth,
      gap: e.gap, inflation: e.inflation, inflationTarget: e.inflationTarget,
      inflationExp: e.inflationExp, unemployment: e.unemployment, nairu: e.nairu,
      priceLevel: e.priceLevel, exports: e.exports, imports: e.imports,
      netExports: e.netExports, currentAccount: e.currentAccount,
      tradeOpennessRatio: e.tradeOpennessRatio, exportDetail: e.exportDetail,
      govDebt: e.govDebt, budgetBalance: e.budgetBalance,
      revenueGDP: e.revenueGDP, spendGDP: e.spendGDP, transGDP: e.transGDP,
      interestGDP: e.interestGDP, tariffRevenue: e.tariffRevenue,
      policyRate: e.policyRate, longRate: e.longRate, borrowingCost: e.borrowingCost,
      realBorrowing: e.realBorrowing, neutralReal: e.neutralReal,
      sovereignRisk: e.sovereignRisk, iForeign: e.iForeign,
      reserveRatio: e.reserveRatio, moneyIndex: e.moneyIndex,
      taxRates: e.taxRates,
      fx: e.fx, fxIndex: e.fxIndex, fxRegime: c.policy.fxRegime,
      fxReserves: e.fxReserves, fxTarget: c.policy.fxTarget,
      gini: e.gini, mpi: e.mpi, hdi: e.hdi, hpi: e.hpi, hdiParts: e.hdiParts,
      lifeExpectancy: e.lifeExpectancy, wellbeing: e.wellbeing,
      footprint: e.footprint, envQuality: e.envQuality,
      education: e.education, health: e.health, infrastructure: e.infrastructure,
      technology: e.technology, competition: e.competition,
      regulationBurden: e.regulationBurden, tradeOpenness: e.tradeOpenness,
      consumptionGDP: e.consumptionGDP, investmentGDP: e.investmentGDP,
      compC: e.compC, compI: e.compI, compG: e.compG, compX: e.compX, compM: e.compM,
      adShift: e.adShift, srasShift: e.srasShift,
      score: e.score, scoreGain: e.scoreGain, scoreParts: e.scoreParts,
      businessConfidence: e.businessConfidence, consumerConfidence: e.consumerConfidence,
      creditHealth: e.creditHealth,
      nxGap: e.nxGap, fiscalImpulse: e.fiscalImpulse,
      monetaryImpulse: e.monetaryImpulse, nxImpulse: e.nxImpulse
    },
    tradePolicy: {
      tariffs: c.policy.tariffs, exportSubsidy: c.policy.exportSubsidy,
      quotas: c.policy.quotas, ntb: c.policy.ntb, fta: c.policy.fta
    },
    history: c.history
  };
  if (isOwn || isTeacher) {
    v.policy = c.policy;
    v.log = c.log.slice(0, 80);
    v.countryPassword = c.countryPassword;
    v.proposals = c.proposals || [];
  } else {
    v.log = c.log.filter((x) => ['trade', 'crisis', 'event'].includes(x.kind)).slice(0, 25);
    v.proposals = (c.proposals || []).map((p) => ({ role: p.role, t: p.t }));
  }
  v.accounts = c.accounts.map((a) => ({
    username: a.username, role: a.role, isPresident: a.username === c.president,
    password: isTeacher ? a.password : undefined
  }));
  return v;
}

module.exports = {
  createWorld, advanceQuarter, computeScores, publicView, pushLog,
  clamp, effectiveRate, subScore, applyEvent, EVENT_LIBRARY, TEMPLATES
};
