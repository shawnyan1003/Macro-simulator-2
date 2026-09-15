'use strict';

/**
 * Free-text policy interpreter (rule engine)
 * Turns a policy described by students in plain English into a policy patch the model can execute.
 *
 * Important: the patch returned contains "absolute target values" (the same convention as /api/policy).
 *            Interpretation starts from the country's current policy and adds increments to it;
 *            the notes also report each change so it can be confirmed.
 * Note: this module is an offline rule engine; it can be swapped for AI judgement when an LLM API
 *       is available. The front end always shows the result for the student to confirm before
 *       submitting, and the teacher can correct it manually.
 */

const UP = /(increas|rais|hike|boost|expand|strengthen|broaden|step up|scal(e|ing) up|introduc|establish|set up|creat|implement|adopt|stimulat|encourag|support|subsidis|subsidiz|promot|incentiv|tighten|more |higher)/i;
const DOWN = /(reduc|cut|lower|decreas|slash|trim|scrap|abolish|remov|eliminat|relax|lift|ease|weaken|deregulat|freez|phase out|fewer|less )/i;

const r2 = (v) => Math.round(v * 100) / 100;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const numOf = (v) => (typeof v === 'number' && isFinite(v) ? v : 0);

/** Pull a number out of a short clause: prefer figures followed by % or "percentage points" */
function numOfText(text, dflt) {
  const m = String(text).match(/(\d+(?:\.\d+)?)\s*(?:%|percent|percentage point|points|pp\b)/i);
  if (m) return Number(m[1]);
  const m2 = String(text).match(/(\d+(?:\.\d+)?)/);
  if (m2 && Number(m2[1]) <= 300) return Number(m2[1]);
  return dflt;
}

function dirOf(text, dflt) {
  if (UP.test(text)) return 1;
  if (DOWN.test(text)) return -1;
  return dflt;
}

const PARTNER_WORDS = [
  { re: /(country\s*a|nation\s*a|\ba\b\s*country|china|cathay|dragon)/i, id: 'A' },
  { re: /(country\s*b|nation\s*b|\bb\b\s*country|united states|usa|america|northstar|eagle)/i, id: 'B' },
  { re: /(country\s*c|nation\s*c|\bc\b\s*country|viet\s?nam|mekong|buffalo)/i, id: 'C' }
];

function partners(clause, dflt) {
  const hit = PARTNER_WORDS.filter((x) => x.re.test(clause)).map((x) => x.id);
  return hit.length ? hit : dflt;
}

/** Main entry point: returns {patch, notes, matched, hint} */
function interpret(text, countryId, state) {
  const t = String(text || '');
  const curCountry = state && state.countries && state.countries[countryId];
  const work = curCountry ? JSON.parse(JSON.stringify(curCountry.policy)) : {};
  const patch = {};
  const notes = [];

  const addTop = (key, delta, min, max, label) => {
    const before = numOfText(work[key], 0) || numOf(work[key]);
    const after = clamp(before + delta, min, max);
    work[key] = after;
    patch[key] = r2(after);
    notes.push({ label, delta: r2(after - before), value: r2(after) });
  };
  const addSub = (group, key, delta, min, max, label) => {
    work[group] = work[group] || {};
    patch[group] = patch[group] || {};
    const before = numOf(work[group][key]);
    const after = clamp(before + delta, min, max);
    work[group][key] = after;
    patch[group][key] = r2(after);
    notes.push({ label, delta: r2(after - before), value: r2(after) });
  };

  /* ---------------- rule table (matched clause by clause) ---------------- */
  const RULES = [
    /* International trade */
    {
      re: /tariff|import dut|anti-dumping|trade barrier/i,
      run: (c) => {
        // "abolish tariffs", "zero tariffs" are treated as setting them to zero
        const zero = /(abolish|remov|eliminat|scrap|zero tariff|no tariff|drop to\s*0|reduce to\s*0|cut to\s*0|free of tariff)/i.test(c);
        const n = zero ? -1e6 : numOfText(c, 10) * dirOf(c, 1);
        partners(c, ['A', 'B', 'C', 'ROW']).forEach((p) => addSub('tariffs', p, n, 0, 200, `Tariff on ${p}`));
      }
    },
    {
      re: /export subsidy|subsidis(e|ing) export|export rebate|export tax rebate/i,
      run: (c) => { const n = numOfText(c, 5); partners(c, ['ROW']).forEach((p) => addSub('exportSubsidy', p, n, 0, 80, `Export subsidy for ${p}`)); }
    },
    {
      re: /quota/i,
      run: (c) => { const n = numOfText(c, 20) * dirOf(c, 1); partners(c, ['A', 'B', 'C']).forEach((p) => addSub('quotas', p, n, 0, 100, `Quota on ${p}`)); }
    },
    {
      re: /non-tariff barrier|administrative barrier|import licen|technical barrier|red tape|ntb/i,
      run: (c) => { const n = numOfText(c, 20) * dirOf(c, 1); partners(c, ['A', 'B', 'C', 'ROW']).forEach((p) => addSub('ntb', p, n, 0, 100, `Non-tariff barriers on ${p}`)); }
    },
    {
      re: /free trade agreement|free trade deal|\bfta\b|regional trade agreement|trade agreement|trade deal/i,
      run: (c) => {
        work.fta = work.fta || {};
        patch.fta = patch.fta || {};
        // if this clause names no country, fall back to countries mentioned anywhere in the text
        partners(c, allPartners.length ? allPartners : ['A', 'B', 'C']).forEach((p) => {
          work.fta[p] = true;
          patch.fta[p] = true;
          notes.push({ label: `Sign a free trade agreement with ${p}`, delta: 1, value: 1 });
        });
      }
    },
    { re: /trade liberalis|liberalis(e|ing) trade|open(ing)?( up)? trade|lower trade barrier|join the global/i, run: (c) => addTop('tradeLiberalisation', 10 * dirOf(c, 1), 0, 100, 'Trade liberalisation') },

    /* Exchange rates and capital flows */
    { re: /(fixed exchange rate|peg(ged)?( the)?( currency| exchange rate)?|currency board)/i, run: () => { patch.fxRegime = 'fixed'; notes.push({ label: 'Exchange rate regime → fixed', delta: 0, value: 1 }); } },
    { re: /(free(ly)? float|floating exchange rate|free float|let the (currency|exchange rate) float)/i, run: () => { patch.fxRegime = 'floating'; notes.push({ label: 'Exchange rate regime → free float', delta: 0, value: 1 }); } },
    {
      re: /(managed float|managed exchange rate|stabilis(e|ing) the exchange rate|stabiliz|interven(e|ing|tion) in|dirty float)/i,
      run: () => { patch.fxRegime = 'managed'; addTop('fxIntervention', 3, 0, 10, 'FX intervention intensity'); }
    },
    { re: /(devalu|depreciat|weaken the (currency|exchange rate)|lower the exchange rate)/i, run: (c) => addTop('fxTarget', numOfText(c, 10), 50, 200, 'Exchange rate target (up = depreciation)') },
    { re: /(revalu|appreciat|strengthen the (currency|exchange rate)|raise the exchange rate)/i, run: (c) => addTop('fxTarget', -numOfText(c, 10), 50, 200, 'Exchange rate target (down = appreciation)') },
    { re: /(capital control|control(s)? on capital|restrict capital|capital restriction)/i, run: (c) => addTop('capitalControls', 15 * dirOf(c, 1), 0, 100, 'Capital controls') },

    /* Monetary policy */
    {
      re: /(interest rate|rate hike|rate cut|hike rate|cut rate|policy rate|monetary policy|borrowing cost)/i,
      run: (c) => {
        if (/(cut|lower|reduc|ease|loosen)/i.test(c)) addTop('policyRate', -numOfText(c, 0.5), -2, 30, 'Policy rate');
        else if (/(rais|hike|increas|tighten)/i.test(c)) addTop('policyRate', numOfText(c, 0.5), -2, 30, 'Policy rate');
        else addTop('policyRate', numOfText(c, 0.5) * dirOf(c, 1), -2, 30, 'Policy rate');
      }
    },
    {
      re: /(reserve (requirement|ratio)|\brrr\b|cash reserve)/i,
      run: (c) => {
        if (/(cut|lower|reduc)/i.test(c)) addTop('reserveRatio', -numOfText(c, 1), 0, 30, 'Required reserve ratio');
        else if (/(rais|hike|increas)/i.test(c)) addTop('reserveRatio', numOfText(c, 1), 0, 30, 'Required reserve ratio');
        else addTop('reserveRatio', numOfText(c, 1) * dirOf(c, 1), 0, 30, 'Required reserve ratio');
      }
    },
    { re: /(quantitative easing|\bqe\b|buy(ing)? (government )?bonds|asset purchase)/i, run: (c) => addTop('qeSize', numOfText(c, 3), 0, 30, 'Quantitative easing size') },
    { re: /(open market operation|\bomo\b|reverse repo|inject liquidity|add liquidity)/i, run: (c) => addTop('omoStance', numOfText(c, 2), -5, 5, 'Open market operations') },
    { re: /(withdraw liquidity|drain liquidity|mop up liquidity|tighten liquidity)/i, run: (c) => addTop('omoStance', -numOfText(c, 2), -5, 5, 'Open market operations') },

    /* Government spending and supply-side programmes */
    { re: /(education|training|human capital|school|vocational|skill)/i, run: (c) => addTop('ssEducation', numOfText(c, 1) * dirOf(c, 1), 0, 10, 'Education & training spending') },
    { re: /(r\s?&\s?d|research and development|innovation|technology|digital|artificial intelligence|\bai\b|tech(nological)? progress)/i, run: (c) => addTop('ssTech', numOfText(c, 1) * dirOf(c, 1), 0, 10, 'R&D spending') },
    { re: /(infrastructure|transport|power grid|5g|public investment|road|rail|broadband)/i, run: (c) => addTop('ssInfra', numOfText(c, 1) * dirOf(c, 1), 0, 10, 'Infrastructure spending') },
    { re: /(government spending|public spending|public expend|fiscal stimulus|stimulate the economy|boost demand|expand demand)/i, run: (c) => addSub('spend', 'other', numOfText(c, 1) * dirOf(c, 1), 0, 30, 'Other government spending') },
    { re: /(transfer payment|welfare|social security|social assist|poverty relief|benefit payment|dole)/i, run: (c) => addTop('transfers', numOfText(c, 1) * dirOf(c, 1), 0, 45, 'Transfer payments') },
    { re: /(universal basic income|unconditional basic income|\bubi\b|basic income)/i, run: (c) => addTop('ubi', numOfText(c, 1) * dirOf(c, 1), 0, 15, 'Universal basic income') },
    { re: /(direct provision|free public service|free health ?care|free education|public housing|free school)/i, run: (c) => addTop('directProvision', numOfText(c, 1) * dirOf(c, 1), 0, 15, 'Direct provision') },
    { re: /(subsid(y|ies|ise|ize))/i, run: (c) => addTop('subsidies', numOfText(c, 0.5) * dirOf(c, 1), 0, 12, 'Subsidies on necessities') },

    /* Taxation */
    { re: /(personal income tax|income tax|personal tax)/i, run: (c) => addTop('taxIncome', numOfText(c, 2) * dirOf(c, 1), 0, 70, 'Personal income tax') },
    { re: /(corporate income tax|corporate tax|corporation tax|company tax|profit tax)/i, run: (c) => addTop('taxCorporate', numOfText(c, 2) * dirOf(c, 1), 0, 60, 'Corporate income tax') },
    { re: /(capital gains tax|capital tax|tax on capital|interest tax)/i, run: (c) => addTop('taxCapital', numOfText(c, 2) * dirOf(c, 1), 0, 60, 'Capital tax') },
    { re: /(consumption tax|value added tax|\bvat\b|sales tax|goods and services tax|\bgst\b)/i, run: (c) => addTop('taxConsumption', numOfText(c, 2) * dirOf(c, 1), 0, 40, 'Consumption tax') },
    {
      re: /(tax cut|cut tax|reduce tax|lower tax|tax reduction|tax relief|tax break|cut taxes)/i,
      run: (c) => {
        const n = numOfText(c, 2);
        addTop('taxIncome', -n, 0, 70, 'Personal income tax');
        addTop('taxCorporate', -Math.max(n, 1) * 1.5, 0, 60, 'Corporate income tax');
      }
    },
    {
      re: /(raise tax|increase tax|higher tax|tax hike|tax increase)/i,
      run: (c) => { const n = numOfText(c, 2); addTop('taxIncome', n, 0, 70, 'Personal income tax'); addTop('taxConsumption', Math.max(1, n / 2), 0, 40, 'Consumption tax'); }
    },
    { re: /(more progressive|progressive tax|tax the rich)/i, run: (c) => addTop('progressivity', 10 * dirOf(c, 1), 0, 100, 'Tax progressivity') },

    /* Market-oriented supply-side policies */
    { re: /(privatis|privatiz|sell (off )?state(-| )owned|sell (off )?(the )?state firms)/i, run: (c) => addTop('privatisation', 10 * dirOf(c, 1), 0, 100, 'Privatisation') },
    { re: /(deregulat|remove regulation|simplify approval|cut regulation|reduce regulation|ease market entry|loosen regulation)/i, run: (c) => addTop('deregulation', 10 * dirOf(c, 1), 0, 100, 'Deregulation') },
    { re: /(antitrust|anti-monopoly|anti monopoly|promote competition|break up monopol|competition policy)/i, run: (c) => addTop('antitrust', 10 * dirOf(c, 1), 0, 100, 'Antitrust enforcement') },
    { re: /(outsourc)/i, run: (c) => addTop('outsourcing', 10 * dirOf(c, 1), 0, 100, 'Outsourcing') },
    { re: /(public(-| )private partnership|\bppp\b|private finance|private capital participation)/i, run: (c) => addTop('ppp', 10 * dirOf(c, 1), 0, 100, 'Public-private partnership') },

    /* Labour market */
    { re: /(trade union|union|collective bargaining|labour right|labor right)/i, run: (c) => addTop('unionPower', 10 * dirOf(c, 1), 0, 100, 'Trade union power') },
    { re: /(minimum wage|wage floor)/i, run: (c) => addTop('minWage', 10 * dirOf(c, 1), 0, 100, 'Minimum wage') },
    { re: /(unemployment benefit|unemployment allowance|jobseeker|job seeker|unemployment support)/i, run: (c) => addTop('unemploymentBenefit', 10 * dirOf(c, 1), 0, 100, 'Unemployment benefit') },
    { re: /(job security|employment protection|dismissal protection|lifetime employment)/i, run: (c) => addTop('jobSecurity', 10 * dirOf(c, 1), 0, 100, 'Job security legislation') },

    /* Industrial policy */
    { re: /(small and medium|\bsmes?\b|small business|small firm|small enterprise)/i, run: (c) => addSub('industrial', 'sme', 20 * dirOf(c, 1), 0, 100, 'Support for small & medium firms') },
    { re: /(infant industry|import substitution|protect (the )?(new|emerging|young) industr)/i, run: (c) => addSub('industrial', 'infant', 20 * dirOf(c, 1), 0, 100, 'Infant industry protection') },
    { re: /(export(ing|ed)? firms?|export(-| )oriented|support export|help exporter)/i, run: (c) => addSub('industrial', 'exportFirm', 20 * dirOf(c, 1), 0, 100, 'Support for exporters') },
    { re: /(school voucher|education voucher|market(-| )based education|marketis|marketiz)/i, run: (c) => addSub('industrial', 'marketEdu', 20 * dirOf(c, 1), 0, 100, 'Marketised education') },

    /* Equity and sustainability */
    { re: /(anti-discrimination|equal rights|gender equality|equal opportunity|affirmative action)/i, run: (c) => addTop('antiDiscrimination', 15 * dirOf(c, 1), 0, 100, 'Anti-discrimination law') },
    { re: /(price control|price ceiling|price floor|cap price|freeze price|rent control)/i, run: (c) => addTop('priceControls', 20 * dirOf(c, 1), 0, 100, 'Price controls') },
    { re: /(green|environment|low(-| )carbon|carbon tax|renewable|sustainab|clean energy|emission)/i, run: (c) => addTop('greenPolicy', 15 * dirOf(c, 1), 0, 100, 'Green policy') }
  ];

  // Split into clauses on punctuation and match clause by clause,
  // so that e.g. "raise the rate by 0.5" is not misread by the tariff rule
  const allPartners = partners(t, []);
  const clauses = t.split(/[.;,\n!?]+/).map((s) => s.trim()).filter(Boolean);
  clauses.forEach((c) => RULES.forEach((r) => { if (r.re.test(c)) r.run(c); }));

  return {
    patch,
    notes,
    matched: notes.length,
    hint: notes.length
      ? 'Interpreted as the policy changes below (relative to current policy). Confirm them before submitting.'
      : 'No keywords recognised — try a more specific phrasing (e.g. "cut corporation tax by 3 percentage points", "impose a 20% tariff on country A"), or use the policy panel directly.'
  };
}

module.exports = { interpret };
