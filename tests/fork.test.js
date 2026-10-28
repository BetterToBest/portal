// Tests for the ledger fork and halt-power model inside simulator/fork/index.html.
// It pulls the model out of the page without changing it (tests/fork-sweep.js does the extraction),
// checks the four presets, then checks properties the draft rules imply: an operator fork always needs
// a majority of all nodes, a hold needs its signers and regions, a stall never passes the 14-day cap,
// the page's hold counter agrees with an exhaustive search, and the review-panel odds are a true
// probability. Last, it checks the sweep against the rules and against the table in docs/halt-power.md.
// Illustrative model, not a prediction; every threshold is a placeholder.
// Needs only Node 18 or later; nothing to install. Run from the repo root: node tests/fork.test.js
'use strict';
const fs = require('fs');
const path = require('path');
const S = require('./fork-sweep.js');

const PAGE = process.argv[2] || path.join(__dirname, '..', 'simulator', 'fork', 'index.html');
const M = S.loadModel(PAGE);
let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.log('FAIL', m); } else console.log('ok  ', m); };

// Presets: the buttons on the page and the values behind them.
const html = fs.readFileSync(PAGE, 'utf8');
const buttons = [...html.matchAll(/data-preset="(\w+)"/g)].map(m => m[1]);
ok(buttons.join() === 'op1,op2,gd1,gd2' && Object.keys(M.PRE).join() === buttons.join(), 'four preset buttons, each with values');
ok(JSON.stringify(M.PRE) === JSON.stringify({ op1: ['op', 50, 51, 'even'], op2: ['op', 50, 55, 'region'], gd1: ['gd', 50, 2, 'even', 1000], gd2: ['gd', 50, 10, 'region', 1000] }), 'preset values as labelled');

// Operator presets, as runOp works them out: 50 regions, 1,000 nodes.
const opRun = (R, share, k, seed = 1) => {
  const N = R * M.NPR, C = Math.round(share * N / 100);
  return M.opEval(M.opOrder(k, R, M.rng(seed)), C, R);
};
let e = opRun(50, 51, 'even');
ok(e.N === 1000 && e.C === 510 && e.o && e.rw === 10 && e.rn === 26 && e.tw === 2 && e.tn === 3 && !e.ok, 'op1: 51% spread evenly has a majority of nodes but fails the region and type tests');
e = opRun(50, 55, 'region');
ok(e.C === 550 && e.rw === 27 && e.tw === 4 && e.ok, 'op2: 55% in a few regions passes all three tests');
const mins = ['even', 'region', 'type'].map(k => M.opMin(M.opOrder(k, 50, M.rng(1)), 50));
ok(mins.join() === '526,511,626', 'operator presets: smallest passing group 526 even, 511 by region, 626 by type');

// Guardian presets, as runGd works them out: 1,000 guardians in 50 regions, review panel of 7.
const gdRun = (G, R, share, k, P = S.PANEL, seed = 1) => {
  const size = S.regionSizes(G, R), C = S.colluders(share, G), c = M.gPlace(k, size, C, M.rng(seed));
  return { size, C, c, r: M.gEval(c, size, G, P) };
};
let g = gdRun(1000, 50, 2, 'even');
ok(g.C === 20 && g.r.sF === 15 && g.r.hS === 4 && g.r.stS === 288 && g.r.hF === 1 && g.r.stF === 24, 'gd1: 20 guardians spread evenly: 4 scoped holds (12 days) or 1 full pause (24 hours)');
ok(g.r.cS > 0 && g.r.cS < 1e-5 && g.r.cF > 0 && g.r.cF < g.r.cS, 'gd1: chance of holding the review panel is under 1 in 100,000');
g = gdRun(1000, 50, 10, 'region');
ok(g.C === 100 && g.r.hS === 5 && g.r.stS === 336 && g.r.hF === 6 && g.r.stF === 144, 'gd2: 100 guardians in 5 regions reach the 14-day cap with scoped holds, 6 days with full pauses');
ok(g.r.cF === 0 && g.r.cS > 0, 'gd2: a full pause signed from all 5 colluding regions leaves no colluder in the panel pool');

// Operators: properties of the three consensus tests.
let opBad = [];
for (let R = 10; R <= 50; R += 10) {
  const N = R * M.NPR, rn = Math.floor(R / 2) + 1, tn = Math.floor(M.T / 2) + 1;
  const orders = ['even', 'region', 'type'].map(k => [k, M.opOrder(k, R, M.rng(1))]);
  for (let s = 1; s <= 5; s++) orders.push(['random' + s, M.opOrder('random', R, M.rng(s))]);
  for (const [k, o] of orders) {
    const cells = {};
    o.forEach(([r, t]) => { cells[r + ',' + t] = (cells[r + ',' + t] || 0) + 1; });
    if (o.length !== N || Object.keys(cells).length !== R * M.T || Object.values(cells).some(x => x !== M.CELL)) opBad.push(`${k} R=${R}: not every node placed once`);
    let first = -1, mono = true;
    for (let C = 0; C <= N; C++) {
      const p = M.opEval(o, C, R).ok;
      if (p && first < 0) first = C;
      if (!p && first >= 0) mono = false;
    }
    const m = M.opMin(o, R);
    if (!mono) opBad.push(`${k} R=${R}: passing is not monotone in group size`);
    if (m !== first) opBad.push(`${k} R=${R}: opMin ${m} but smallest passing group ${first}`);
    if (!(m * 2 > N)) opBad.push(`${k} R=${R}: passes without a majority of nodes`);
    if (m < rn * (M.NPR / 2 + 1) || m < tn * (R * M.CELL / 2 + 1)) opBad.push(`${k} R=${R}: passes below the region or type lower bound`);
  }
}
ok(opBad.length === 0, 'operators, 5 region counts x 8 placements: every node placed once, passing is monotone, opMin is the smallest passing group, and it is always more than half of all nodes and above the region and type lower bounds' + (opBad.length ? ': ' + opBad.slice(0, 3).join('; ') : ''));
ok(JSON.stringify(M.opOrder('random', 30, M.rng(7))) === JSON.stringify(M.opOrder('random', 30, M.rng(7))), 'operators: random placement repeats with the same seed');

// Guardians: the page's hold counter maxH against an exhaustive search on small cases.
// Can the colluders c form h disjoint signer groups, each of s guardians from at least rr regions?
function canForm(c, s, rr, h) {
  if (h === 0) return true;
  const R = c.length, d = new Array(R).fill(0);
  const pick = (i, left) => {
    if (i === R) return left === 0 && d.filter(x => x > 0).length >= rr && canForm(c.map((x, j) => x - d[j]), s, rr, h - 1);
    for (let x = 0; x <= Math.min(c[i], left); x++) { d[i] = x; if (pick(i + 1, left - x)) return true; }
    d[i] = 0; return false;
  };
  return pick(0, s);
}
let hBad = 0, hCases = 0;
const small = M.rng(99);
for (let it = 0; it < 600; it++) {
  const R = 2 + Math.floor(small() * 4), c = Array.from({ length: R }, () => Math.floor(small() * 5));
  const rr = 1 + Math.floor(small() * Math.min(3, R)), s = rr + Math.floor(small() * 3), need = 1 + Math.floor(small() * 4);
  let best = 0;
  for (let h = 1; h <= need; h++) if (canForm(c, s, rr, h)) best = h; else break;
  hCases++; if (M.maxH(c, s, rr, need) !== best) hBad++;
}
ok(hBad === 0, `guardians: maxH agrees with an exhaustive search of signer groups in ${hCases} small cases`);

// Guardians: placement, sign-off rules and the cap, on random corps and placements.
let gBad = [];
const big = M.rng(2026);
for (let it = 0; it < 1500; it++) {
  const G = 500 + Math.floor(big() * 1601), R = [10, 20, 30, 40, 50][Math.floor(big() * 5)];
  const size = S.regionSizes(G, R), sF = Math.max(15, Math.ceil(G * 0.01)), P = [5, 7, 9, 11, 13, 15][Math.floor(big() * 6)];
  const C = Math.floor(big() * (big() < 0.7 ? 60 : G + 1)), k = ['even', 'region', 'random'][Math.floor(big() * 3)];
  const c = M.gPlace(k, size, C, M.rng(it + 1)), r = M.gEval(c, size, G, P), regs = c.filter(x => x > 0).length;
  if (M.sum(size) !== G || M.sum(c) !== C || c.some((x, i) => x < 0 || x > size[i])) gBad.push(`placement ${k} G=${G} C=${C}`);
  if (r.sF !== sF) gBad.push(`full-pause signers ${r.sF} for G=${G}`);
  if ((r.hS > 0) !== (C >= 5 && regs >= 3)) gBad.push(`scoped hold rule G=${G} C=${C} regions=${regs}`);
  if ((r.hF > 0) !== (C >= sF && regs >= 5)) gBad.push(`full pause rule G=${G} C=${C} regions=${regs}`);
  if (r.stS > 336 || r.stF > 336 || r.hS > 5 || r.hF > 14) gBad.push(`stall past the 14-day cap G=${G} C=${C}`);
  if (r.hS * 5 > C || r.hF * sF > C) gBad.push(`holds share signers G=${G} C=${C}`);
  for (const x of [r.cS, r.cF]) if (x !== null && !(x >= 0 && x <= 1)) gBad.push(`panel chance ${x} G=${G} C=${C}`);
  if ((r.hS === 0) !== (r.cS === null) && G - 3 * Math.ceil(G / R) >= P) gBad.push(`panel chance without a hold G=${G} C=${C}`);
}
ok(gBad.length === 0, 'guardians, 1,500 random corps and placements: colluders placed within their regions, a scoped hold needs 5 signers in 3+ regions, a full pause needs max(15, 1%) in 5+ regions, no stall passes 14 days, no signer is reused, panel chances are probabilities' + (gBad.length ? ': ' + gBad.slice(0, 3).join('; ') : ''));
ok([500, 1000, 2000].map(G => S.full(G)[0]).join() === '15,15,20', 'full pause needs 15, 15 and 20 signers for 500, 1,000 and 2,000 guardians');

// The panel odds: tail() is the hypergeometric upper tail. Compare with exact counts on small pools.
const choose = (n, k) => { if (k < 0 || k > n) return 0n; let r = 1n; for (let i = 0n; i < BigInt(k); i++) r = r * (BigInt(n) - i) / (i + 1n); return r; };
let tBad = 0;
for (const [pool, K, P] of [[20, 7, 5], [30, 15, 7], [12, 0, 5], [12, 12, 5], [40, 9, 9], [15, 14, 7]]) {
  for (let need = 0; need <= P; need++) {
    let num = 0n; for (let x = need; x <= P; x++) num += choose(K, x) * choose(pool - K, P - x);
    const exact = Number(num) / Number(choose(pool, P));
    if (Math.abs(M.tail(pool, K, P, need) - exact) > 1e-9) tBad++;
  }
}
ok(tBad === 0, 'review panel: tail() matches exact hypergeometric odds on small pools');

// capture(): the panel pool leaves out the signer regions.
// Two colluders in each of regions 0-2 and none elsewhere: signing takes all of them, so the pool has none.
let size = S.regionSizes(100, 10), c = [2, 2, 2, 0, 0, 0, 0, 0, 0, 0];
ok(M.capture(c, size, 100, 7, 5, 3) === 0, 'review panel: colluders who all sit in the signer regions cannot reach the panel');
c = [2, 2, 1, 10, 0, 0, 0, 0, 0, 0];
ok(Math.abs(M.capture(c, size, 100, 7, 5, 3) - M.tail(70, 10, 7, 4)) < 1e-12, 'review panel: signers come from the regions with the fewest colluders, the rest stay in the pool');
ok(M.capture([4, 0, 0, 0], S.regionSizes(40, 4), 40, 7, 5, 3) === null, 'review panel: no chance is given when the colluders cannot sign');

// The sweep: rule-implied values, sensible odds, and the table in docs/halt-power.md.
const rows = S.sweep(M);
const sw = [];
for (const r of rows) {
  const per = r.G / r.R, at = k => r[k] && r[k][0];
  if (at('falseScoped') !== 5) sw.push(`${r.G}: false scoped hold ${at('falseScoped')}`);
  if (at('falsePause') !== r.sF) sw.push(`${r.G}: false full pause ${at('falsePause')}`);
  if (at('stallScoped') !== 25) sw.push(`${r.G}: scoped stall ${at('stallScoped')}`);
  if (at('stallPause') !== 14 * r.sF) sw.push(`${r.G}: full-pause stall ${at('stallPause')}`);
  if (at('refuseScoped') !== r.G - 2 * per) sw.push(`${r.G}: refusal against a scoped hold ${at('refuseScoped')}`);
  if (at('refusePause') !== r.G - 4 * per) sw.push(`${r.G}: refusal against a full pause ${at('refusePause')}`);
  if (!(at('keepScoped1') < at('keepScoped50') && at('liftScoped1') < at('liftScoped50'))) sw.push(`${r.G}: 1 in 100 odds need more colluders than even odds`);
  if (!(at('liftScoped50') < at('refuseScoped') && at('liftPause50') < at('refusePause'))) sw.push(`${r.G}: review route not cheaper than refusal`);
  for (const k of ['keepScoped50', 'liftScoped50', 'liftPause50']) if (Math.abs(at(k) / r.G - 0.5) > 0.06) sw.push(`${r.G}: ${k} at ${at(k)}, far from half the corps`);
}
ok(sw.length === 0, 'sweep for 500, 1,000 and 2,000 guardians: 5 for a false scoped hold, max(15, 1%) for a false full pause, 5 and 14 sets of fresh signers for a 14-day stall, all but 2 or 4 regions to block by refusal, and about half the corps for even odds in review' + (sw.length ? ': ' + sw.slice(0, 3).join('; ') : ''));
const doc = S.docTables();
ok(doc === S.tables(rows, M), 'docs/halt-power.md shows the current sweep output (run node tests/fork-sweep.js to see it)');

process.exit(fail ? 1 : 0);
