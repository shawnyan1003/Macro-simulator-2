'use strict';

/**
 * Base data for the three fictional countries.
 * The starting values are calibrated on recent real-world data for three archetypal economies
 * (a large manufacturing exporter, a consumption-led advanced economy and an export-oriented
 * developing economy), simplified and rescaled where teaching requires it so that they interact
 * sensibly inside one model. The real economies behind them are deliberately not named.
 * All monetary amounts are in billions of US dollars (bn USD, constant prices); population is in millions.
 */

const WORLD = {
  inflation: 3.2,        // world (the "rest of the world" trade partner) average inflation %
  growth: 3.0,           // growth rate of world demand, % per year
  policyRate: 4.0,       // world average policy rate %
  tradeGrowth: 3.0       // growth rate of global trade volume, % per year
};

const TEMPLATES = {
  A: {
    id: 'A',
    prototype: 'Manufacturing-led emerging economy',
    flag: '🐉',
    mascot: 'Dragon',
    color: '#E8503A',
    defaultName: 'Cathay Federation',
    tagline: 'Manufacturing powerhouse · high saving and investment · capital controls · managed float',
    traits: [
      'Huge export and manufacturing capacity — a dominant supplier in global manufacturing — but weak household consumption',
      'A very high saving rate, with investment around 40% of GDP: growth has long been investment-driven',
      'Capital flows are controlled (low capital mobility) and the central bank manages a floating exchange rate',
      'The population has started to shrink, so labour supply is contracting and long-run growth faces a turning point',
      'Local government debt and the property correction create debt pressure and limit fiscal space'
    ],
    pop: 1410,
    gdp: 17794,                 // real GDP
    gdpPerCapitaPPP: 24500,     // PPP GDP per capita (used for the HDI)
    laborForceParticipation: 68,
    laborGrowth: -0.2,          // growth rate of the labour force, % per year
    potentialGrowth: 4.6,       // baseline potential growth rate %

    inflation: 2.5,                 // baseline inflation (aligned with the central bank target so the baseline is stable)
    inflationTarget: 2.5,
    unemployment: 5.1,
    nairu: 5.0,
    // Reference real-world values (2024), for teaching display only
    realData: { gdp: 'US$17.79tn', growth: '5.0%', inflation: '0.2%', unemployment: '5.1%', debt: '83% of GDP', gini: '37.1', hdi: '0.788', fx: '7.10 per US$', 'policy rate': '3.45% (1-year benchmark)' },

    // Fiscal
    govSpending: 24.0,          // government consumption + public investment, % of GDP
    debtServicingRate: 3.2,     // average interest cost on the outstanding debt %
    govSpendingMix: { education: 4.0, health: 3.2, infrastructure: 5.0, defence: 1.8, other: 10.0 },
    transfers: 9.0,
    ubi: 0,
    otherRevenue: 18.2,         // revenue outside the four main taxes (social security, land sales, excises, …), % of GDP
    taxIncome: 6.0,             // effective average personal income tax rate %
    taxCorporate: 25.0,         // statutory corporate income tax rate %
    taxCapital: 10.0,           // tax rate on capital gains / interest income %
    taxConsumption: 8.5,        // effective VAT / sales tax rate %
    govDebt: 83.0,              // government debt, % of GDP
    debtTermPremium: 0.8,

    // Monetary
    policyRate: 3.45,
    reserveRatio: 10.5,
    creditSpread: 1.8,
    monSens: 0.30,              // sensitivity of output to the real interest rate
    capitalMobility: 0.45,      // 0–1; the higher, the freer capital flows
    fx: 7.10,                   // domestic currency per US dollar
    fxRegime: 'managed',
    fxReserves: 3240,           // bn USD

    // Structural indices (0–100)
    education: 68,
    health: 74,
    infrastructure: 82,
    technology: 70,
    competition: 48,
    regulationBurden: 62,
    tradeOpenness: 34,
    unionPower: 30,
    minWage: 40,
    unemploymentBenefit: 30,
    jobSecurity: 55,
    progressivity: 45,
    antiDiscrimination: 50,
    directProvision: 45,
    privatisation: 45,
    deregulation: 40,
    greenPolicy: 45,
    envQuality: 45,

    consumptionGDP: 39,
    investmentGDP: 40,
    incomeElasticity: 1.05,
    exportLinkage: 0.30,
    fiscalMultiplier: 1.25,
    nxMultiplier: 0.90,
    caOffset: -3.2,

    // Trade matrix (exporter → importer), bn USD
    exportFlows: { B: 460, C: 120, ROW: 2800 },
    // Total imports (bn USD), used to derive the baseline "rest of the world ROW → home" flow
    imports: 2560,
    // Living standards
    lifeExpectancy: 78.2,
    gini: 37.1,
    mpi: 1.2,
    hdi: 0.788,
    hpi: 47.3,
    wellbeing: 5.8,
    footprint: 3.6,
    tariffs: { B: 8.0, C: 5.0, ROW: 4.5 },      // tariffs imposed on partners (weighted average %)
    exportSubsidy: { B: 0, C: 0, ROW: 0 },
    quotas: { B: 0, C: 0, ROW: 0 },
    ntb: { B: 5, C: 5, ROW: 5 },
    fta: { B: 0, C: 0, ROW: 0 }
  },

  B: {
    id: 'B',
    prototype: 'Consumption-led advanced economy',
    flag: '🦅',
    mascot: 'Eagle',
    color: '#2E5FDC',
    defaultName: 'Northstar Union',
    tagline: 'Consumption-led · deep capital markets · floating exchange rate · reserve-currency status',
    traits: [
      'Household consumption is about 68% of GDP: domestic demand is the main engine of growth',
      'Deep capital markets and highly free capital flows — its interest rates pull in capital from all over the world',
      'Its currency is widely held as an international reserve currency, so it can run a current account deficit for a long time',
      'Leading in technology and innovation, but with high income inequality and falling social mobility',
      'Government debt above 120% of GDP, with interest payments squeezing fiscal space'
    ],
    pop: 335,
    gdp: 27360,
    gdpPerCapitaPPP: 82700,
    laborForceParticipation: 63,
    laborGrowth: 0.5,
    potentialGrowth: 2.0,

    inflation: 2.8,
    inflationTarget: 2.8,
    unemployment: 3.7,
    nairu: 4.2,
    realData: { gdp: 'US$27.36tn', growth: '2.8%', inflation: '2.9%', unemployment: '4.0%', debt: '122% of GDP', gini: '41.3', hdi: '0.927', fx: '1.00 per US$', 'policy rate': '4.50%' },

    govSpending: 22.0,
    debtServicingRate: 3.3,
    govSpendingMix: { education: 5.0, health: 6.5, infrastructure: 1.8, defence: 3.5, other: 5.2 },
    transfers: 12.5,
    ubi: 0,
    otherRevenue: 20.0,
    taxIncome: 12.0,
    taxCorporate: 21.0,
    taxCapital: 20.0,
    taxConsumption: 4.5,
    govDebt: 122.0,
    debtTermPremium: 0.9,

    policyRate: 5.375,
    reserveRatio: 0.0,
    creditSpread: 1.2,
    monSens: 0.55,
    capitalMobility: 1.0,
    fx: 1.0,
    fxRegime: 'floating',
    fxReserves: 245,

    education: 90,
    health: 78,
    infrastructure: 68,
    technology: 92,
    competition: 72,
    regulationBurden: 48,
    tradeOpenness: 30,
    unionPower: 28,
    minWage: 45,
    unemploymentBenefit: 45,
    jobSecurity: 25,
    progressivity: 55,
    antiDiscrimination: 70,
    directProvision: 35,
    privatisation: 70,
    deregulation: 60,
    greenPolicy: 40,
    envQuality: 58,

    consumptionGDP: 68,
    investmentGDP: 21,
    incomeElasticity: 1.30,
    exportLinkage: 0.05,
    fiscalMultiplier: 0.95,
    nxMultiplier: 0.80,
    caOffset: 0.9,

    exportFlows: { A: 148, C: 12, ROW: 1860 },
    imports: 3170,

    lifeExpectancy: 78.4,
    gini: 41.3,
    mpi: 2.0,
    hdi: 0.927,
    hpi: 20.7,
    wellbeing: 7.0,
    footprint: 8.0,
    tariffs: { A: 12.0, C: 5.0, ROW: 3.0 },
    exportSubsidy: { A: 0, C: 0, ROW: 0 },
    quotas: { A: 0, C: 0, ROW: 0 },
    ntb: { A: 8, C: 5, ROW: 5 },
    fta: { A: 0, C: 0, ROW: 0 }
  },

  C: {
    id: 'C',
    prototype: 'Export-oriented developing economy',
    flag: '🐃',
    mascot: 'Buffalo',
    color: '#12A87B',
    defaultName: 'Mekong Republic',
    tagline: 'Export-oriented · young workforce · highly trade-dependent · FDI-driven',
    traits: [
      'Extremely trade-dependent (exports plus imports around 160% of GDP), so acutely sensitive to global demand and tariffs',
      'Dominated by FDI assembly: it imports intermediates and re-exports, so exports and imports move together',
      'A young, low-cost workforce still enjoying a demographic dividend, though skills need improving',
      'Weak infrastructure and technology: plenty of long-run growth potential, but held back by productivity',
      'Low government debt (about 37% of GDP) leaves relatively generous fiscal space'
    ],
    pop: 100,
    gdp: 430,
    gdpPerCapitaPPP: 13400,
    laborForceParticipation: 75,
    laborGrowth: 0.8,
    potentialGrowth: 6.2,

    inflation: 3.5,
    inflationTarget: 3.5,
    unemployment: 2.3,
    nairu: 2.6,
    realData: { gdp: 'US$476bn', growth: '7.1%', inflation: '3.6%', unemployment: '2.2%', debt: '37% of GDP', gini: '36.1', hdi: '0.726', fx: '25,000 per US$', 'policy rate': '4.50%' },

    govSpending: 15.0,
    debtServicingRate: 4.2,
    govSpendingMix: { education: 3.5, health: 2.0, infrastructure: 4.0, defence: 1.0, other: 4.5 },
    transfers: 5.5,
    ubi: 0,
    otherRevenue: 8.0,
    taxIncome: 3.0,
    taxCorporate: 20.0,
    taxCapital: 5.0,
    taxConsumption: 9.0,
    govDebt: 37.0,
    debtTermPremium: 1.0,

    policyRate: 4.5,
    reserveRatio: 3.0,
    creditSpread: 2.5,
    monSens: 0.35,
    capitalMobility: 0.60,
    fx: 24000,
    fxRegime: 'managed',
    fxReserves: 100,

    education: 63,
    health: 66,
    infrastructure: 55,
    technology: 45,
    competition: 42,
    regulationBurden: 68,
    tradeOpenness: 78,
    unionPower: 25,
    minWage: 45,
    unemploymentBenefit: 18,
    jobSecurity: 60,
    progressivity: 35,
    antiDiscrimination: 40,
    directProvision: 40,
    privatisation: 35,
    deregulation: 35,
    greenPolicy: 35,
    envQuality: 55,

    consumptionGDP: 62,
    investmentGDP: 31,
    incomeElasticity: 0.60,
    exportLinkage: 0.55,
    fiscalMultiplier: 1.15,
    nxMultiplier: 1.00,
    caOffset: -2.5,

    exportFlows: { A: 50, B: 105, ROW: 200 },
    imports: 327,

    lifeExpectancy: 73.6,
    gini: 36.1,
    mpi: 5.5,
    hdi: 0.726,
    hpi: 53.5,
    wellbeing: 5.3,
    footprint: 2.3,
    tariffs: { A: 6.0, B: 4.0, ROW: 5.0 },
    exportSubsidy: { A: 0, B: 0, ROW: 0 },
    quotas: { A: 0, B: 0, ROW: 0 },
    ntb: { A: 8, B: 5, ROW: 8 },
    fta: { A: 0, B: 0, ROW: 0 }
  }
};

/* Role definitions */
const ROLES = {
  government: { label: 'Government', icon: '🏛️', desc: 'Sets fiscal, monetary, exchange rate and industrial policy and decides the country’s strategic direction. Elects the chair (President) and names the country.' },
  labor: { label: 'Labour', icon: '👷', desc: 'Represents trade unions and workers. Cares about wages, jobs, unemployment benefits, job security and fairness; can table and oppose motions.' },
  firms: { label: 'Firms', icon: '🏭', desc: 'Represents producers and investors. Cares about taxes, interest rates, regulatory burden, trading conditions and returns on investment; can table and oppose motions.' }
};

/* Weights of the composite economic health index (the teacher can adjust them) */
const DEFAULT_WEIGHTS = {
  gdpPerCapita: 0.14,   // level of real GDP per capita
  growth: 0.06,         // average growth over the last 4 quarters
  unemployment: 0.10,   // unemployment rate (relative to the NAIRU)
  inflation: 0.10,      // inflation rate (relative to the target)
  debt: 0.08,           // government debt as a share of GDP
  hdi: 0.14,            // Human Development Index
  hpi: 0.12,            // Happy Planet Index
  gini: 0.10,           // Gini coefficient (inverted)
  mpi: 0.10,            // Multidimensional Poverty Index (inverted)
  currentAccount: 0.06  // size of the current account imbalance (inverted)
};

module.exports = { TEMPLATES, ROLES, DEFAULT_WEIGHTS, WORLD };
