'use strict';
/* Model self-test: hands-off means stable, policy directions are correct, trade linkages work */
const M = require('../lib/model');

const fmt = (n, d) => Number(n).toFixed(d == null ? 2 : d);

function snapshot(state) {
  return ['A', 'B', 'C'].map((id) => {
    const e = state.countries[id].econ;
    return {
      id, gdp: fmt(e.gdp, 0), growth: fmt(e.growth), infl: fmt(e.inflation),
      u: fmt(e.unemployment), nairu: fmt(e.nairu), debt: fmt(e.govDebt),
      gini: fmt(e.gini), hdi: fmt(e.hdi, 3), hpi: fmt(e.hpi), mpi: fmt(e.mpi),
      ca: fmt(e.currentAccount), fx: fmt(e.fxIndex), score: fmt(e.score),
      gap: fmt(e.gap), X: fmt(e.exports, 0), M: fmt(e.imports, 0)
    };
  });
}

console.log('=== 1) Baseline stability (20 quarters with no intervention)===');
let s = M.createWorld();
console.log('t=0 ', JSON.stringify(snapshot(s)));
for (let i = 0; i < 20; i++) M.advanceQuarter(s);
console.log('t=20', JSON.stringify(snapshot(s)));

console.log('\n=== 2) Expansionary fiscal policy (country A government spending +3% of GDP)===');
let s2 = M.createWorld();
for (let i = 0; i < 4; i++) M.advanceQuarter(s2);
const before = JSON.parse(JSON.stringify(s2.countries.A.econ));
s2.countries.A.policy.spend.other += 3;
for (let i = 0; i < 6; i++) M.advanceQuarter(s2);
const a2 = s2.countries.A.econ;
console.log(`GDP ${fmt(before.gdp, 0)} → ${fmt(a2.gdp, 0)} | inflation ${fmt(before.inflation)} → ${fmt(a2.inflation)} | unemployment ${fmt(before.unemployment)} → ${fmt(a2.unemployment)} | debt ${fmt(before.govDebt)} → ${fmt(a2.govDebt)}`);

console.log('\n=== 3) Contractionary monetary policy (country B raises rates 300bp)===');
let s3 = M.createWorld();
for (let i = 0; i < 4; i++) M.advanceQuarter(s3);
const b3 = JSON.parse(JSON.stringify(s3.countries.B.econ));
s3.countries.B.policy.policyRate += 3;
for (let i = 0; i < 8; i++) M.advanceQuarter(s3);
const b3a = s3.countries.B.econ;
console.log(`inflation ${fmt(b3.inflation)} → ${fmt(b3a.inflation)} | output gap ${fmt(b3.gap)} → ${fmt(b3a.gap)} | FX index ${fmt(b3.fxIndex)} → ${fmt(b3a.fxIndex)} (fall = appreciation)`);

console.log('\n=== 4) Supply-side reform (country C: education +2, infrastructure +2, technology +2, %GDP)===');
let s4 = M.createWorld();
for (let i = 0; i < 4; i++) M.advanceQuarter(s4);
const c4 = JSON.parse(JSON.stringify(s4.countries.C.econ));
s4.countries.C.policy.ssEducation = 2;
s4.countries.C.policy.ssInfra = 2;
s4.countries.C.policy.ssTech = 2;
for (let i = 0; i < 16; i++) M.advanceQuarter(s4);
const c4a = s4.countries.C.econ;
console.log(`potential growth ${fmt(c4.potentialGrowth)} → ${fmt(c4a.potentialGrowth)} | GDP ${fmt(c4.gdp, 0)} → ${fmt(c4a.gdp, 0)} | education ${fmt(c4.education)} → ${fmt(c4a.education)} | HDI ${fmt(c4.hdi, 3)} → ${fmt(c4a.hdi, 3)}`);

console.log('\n=== 5) Trade war (A and C each impose a 40% tariff on the other)===');
let s5 = M.createWorld();
for (let i = 0; i < 4; i++) M.advanceQuarter(s5);
const a5 = JSON.parse(JSON.stringify(s5.countries.A.econ));
const c5 = JSON.parse(JSON.stringify(s5.countries.C.econ));
s5.countries.A.policy.tariffs.C = 40;
s5.countries.C.policy.tariffs.A = 40;
for (let i = 0; i < 4; i++) M.advanceQuarter(s5);
const a5b = s5.countries.A.econ, c5b = s5.countries.C.econ;
console.log(`A→C exports ${fmt(a5.exportDetail ? a5.exportDetail.C : 0, 1)} → ${fmt(a5b.exportDetail.C, 1)}`);
console.log(`C→A exports ${fmt(c5.exportDetail ? c5.exportDetail.A : 0, 1)} → ${fmt(c5b.exportDetail.A, 1)}`);
console.log(`country C GDP ${fmt(c5.gdp, 0)} → ${fmt(c5b.gdp, 0)} | output gap ${fmt(c5.gap)} → ${fmt(c5b.gap)}`);

console.log('\n=== 6) Redistribution (country A: UBI 3% of GDP, transfers +3)===');
let s6 = M.createWorld();
for (let i = 0; i < 4; i++) M.advanceQuarter(s6);
const a6 = JSON.parse(JSON.stringify(s6.countries.A.econ));
s6.countries.A.policy.ubi = 3;
s6.countries.A.policy.transfers += 3;
for (let i = 0; i < 8; i++) M.advanceQuarter(s6);
const a6b = s6.countries.A.econ;
console.log(`Gini ${fmt(a6.gini)} → ${fmt(a6b.gini)} | MPI ${fmt(a6.mpi)} → ${fmt(a6b.mpi)} | debt ${fmt(a6.govDebt)} → ${fmt(a6b.govDebt)} | inflation ${fmt(a6.inflation)} → ${fmt(a6b.inflation)}`);

console.log('\n=== 7) Composite index and ranking ===');
let s7 = M.createWorld();
for (let i = 0; i < 12; i++) M.advanceQuarter(s7);
['A', 'B', 'C'].forEach((id) => {
  const c = s7.countries[id];
  console.log(`${id} ${c.name}: index ${fmt(c.econ.score)} change ${fmt(c.econ.scoreGain)} components ${JSON.stringify(Object.fromEntries(Object.entries(c.econ.scoreParts).map(([k, v]) => [k, fmt(v, 1)])))}`);
});
console.log('\n✅ Self-test complete');
