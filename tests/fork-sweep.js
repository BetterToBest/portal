// Halt-power sweep for the draft thresholds in docs/halt-power.md, using the model inside
// simulator/fork/index.html. It pulls the model's functions out of the page by the comment markers
// already in it (/*Operators*/, /*Guardians*/ and the function names after them) and does not change
// the page. For guardian corps sizes 500, 1,000 and 2,000 it prints the smallest colluding group that
// can force a false scoped hold, force a false full pause, or block a real halt.
// Illustrative model output, not a prediction; every threshold is a placeholder.
// Needs only Node 18 or later. Run from the repo root:
//   node tests/fork-sweep.js            prints the tables
//   node tests/fork-sweep.js --check    fails if the tables in docs/halt-power.md differ from the output
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PAGE = path.join(ROOT, 'simulator', 'fork', 'index.html');
const DOC = path.join(ROOT, 'docs', 'halt-power.md');
const SIZES = [500, 1000, 2000];
const REGIONS = 50;  // the page's default number of regions
const PANEL = 7;     // the page's default review panel size (a placeholder of the page)

// Load the model from the page. Each piece runs from a marker up to the next DOM-bound function,
// so the controls and the result rendering are left out.
function loadModel(file = PAGE) {
  const src = fs.readFileSync(file, 'utf8');
  const js = src.split('<script>')[1].split('</script>')[0];
  const cut = (a, b) => {
    const i = js.indexOf(a), j = js.indexOf(b, i);
    if (i < 0 || j < 0) throw new Error(`fork model: marker "${i < 0 ? a : b}" not found in ${file}`);
    return js.slice(i, j);
  };
  const pre = js.match(/var PRE=\{[^;]*\};/);
  if (!pre) throw new Error(`fork model: presets (var PRE) not found in ${file}`);
  const code = cut('function rng(', '/*Controls*/') + cut('/*Operators*/', 'function runOp(') +
    cut('/*Guardians*/', 'function runGd(') + pre[0];
  return new Function('"use strict";' + code +
    ';return {rng,shuffle,sum,lc,tail,NPR,T,CELL,opOrder,opEval,opMin,gPlace,maxH,capture,gEval,PRE}')();
}

// Guardians per region and colluder count, as runGd in the page works them out.
function regionSizes(G, R) {
  const base = Math.floor(G / R), rem = G % R;
  return Array.from({ length: R }, (_, i) => base + (i < rem ? 1 : 0));
}
const colluders = (share, G) => Math.round(share * G / 100);

// Signers each level needs in the draft: [signers, regions].
const scoped = () => [5, 3];
const full = G => [Math.max(15, Math.ceil(G * 0.01)), 5];

// Can the guardians in counts c sign one hold of this level on their own? (The page's maxH.)
const canSign = (M, c, [s, rr]) => M.maxH(c, s, rr, 1) > 0;

// Chance the colluders hold a majority of the review panel for a real hold, so they could lift it.
// The panel is drawn from regions other than the honest signers'. The colluders' best case: the honest
// signers come from the regions with the fewest colluders, and from as few regions as the level allows.
// Returns 1 when the honest guardians cannot sign the hold at all (blocked by refusal).
function liftChance(M, c, size, G, P, level) {
  const honest = size.map((s, i) => s - c[i]);
  if (!canSign(M, honest, level)) return 1;
  const [s, rr] = level;
  const ord = size.map((_, i) => i).sort((a, b) => c[a] - c[b] || honest[b] - honest[a]);
  const ch = ord.slice(0, rr);
  let have = 0; ch.forEach(i => { have += honest[i]; });
  for (let n = rr; have < s && n < ord.length; n++) { ch.push(ord[n]); have += honest[ord[n]]; }
  let ex = 0, ec = 0; ch.forEach(i => { ex += size[i]; ec += c[i]; });
  if (G - ex < P) return 0;
  return M.tail(G - ex, M.sum(c) - ec, P, (P + 1) / 2);
}

// Smallest colluding group for which test(c) holds, under either fixed placement the page offers
// (even or concentrated in few regions). Returns [count, placement] or null.
function smallest(M, G, R, test) {
  const size = regionSizes(G, R);
  let best = null;
  for (const k of ['even', 'region']) {
    for (let C = 0; C <= G; C++) {
      if (test(M.gPlace(k, size, C, M.rng(1)), size)) {
        if (!best || C < best[0]) best = [C, k];
        break;
      }
    }
  }
  return best;
}

// The measures, in table order: [key, label, test(c, size, G, P)]. Each test says whether a colluding
// group placed as c gets that result. Holds for a stall use fresh signers each time, as the draft asks.
const CAP = 336;  // the draft's 14-day cap, in hours
function measures(M) {
  const honest = (c, size) => size.map((s, i) => s - c[i]);
  const stall = (c, [s, rr], hours) => M.maxH(c, s, rr, Math.ceil(CAP / hours)) >= Math.ceil(CAP / hours);
  // A false hold survives review when colluders hold the panel; the page's capture() gives that chance.
  const keep = (c, size, G, P, L, p) => canSign(M, c, L) && M.capture(c, size, G, P, L[0], L[1]) >= p;
  return [
    ['falseScoped', 'Force a false scoped hold (72 hours)', (c, size, G) => canSign(M, c, scoped())],
    ['falsePause', 'Force a false full pause (24 hours)', (c, size, G) => canSign(M, c, full(G))],
    ['stallScoped', 'Stall to the 14-day cap with scoped holds', (c, size, G) => stall(c, scoped(), 72)],
    ['stallPause', 'Stall to the 14-day cap with full pauses', (c, size, G) => stall(c, full(G), 24)],
    ['keepScoped1', 'Keep a false scoped hold past review, 1 in 100 chance', (c, size, G, P) => keep(c, size, G, P, scoped(), 0.01)],
    ['keepScoped50', 'Keep a false scoped hold past review, even odds', (c, size, G, P) => keep(c, size, G, P, scoped(), 0.5)],
    ['liftScoped1', 'Block a real scoped hold by lifting it in review, 1 in 100 chance', (c, size, G, P) => liftChance(M, c, size, G, P, scoped()) >= 0.01],
    ['liftScoped50', 'Block a real scoped hold by lifting it in review, even odds', (c, size, G, P) => liftChance(M, c, size, G, P, scoped()) >= 0.5],
    ['liftPause50', 'Block a real full pause by lifting it in review, even odds', (c, size, G, P) => liftChance(M, c, size, G, P, full(G)) >= 0.5],
    ['refuseScoped', 'Block a real scoped hold by refusing to sign', (c, size, G) => !canSign(M, honest(c, size), scoped())],
    ['refusePause', 'Block a real full pause by refusing to sign', (c, size, G) => !canSign(M, honest(c, size), full(G))],
  ];
}

function sweep(M, { sizes = SIZES, R = REGIONS, P = PANEL } = {}) {
  return sizes.map(G => {
    const row = { G, R, P, sF: full(G)[0] };
    for (const [key, , test] of measures(M)) row[key] = smallest(M, G, R, (c, size) => test(c, size, G, P));
    return row;
  });
}

const n = x => x.toLocaleString('en-US');
const cell = (r, G) => r ? `${n(r[0])} (${(r[0] * 100 / G).toFixed(1)}%)` : 'not possible';

// One Markdown table: a row per measure, a column per corps size.
function tables(rows, M) {
  const out = ['| Smallest colluding group that can | ' + rows.map(r => `${n(r.G)} guardians`).join(' | ') + ' |',
    '|---|' + rows.map(() => '---|').join('')];
  for (const [key, label] of measures(M)) out.push(`| ${label} | ` + rows.map(r => cell(r[key], r.G)).join(' | ') + ' |');
  return out.join('\n');
}

const START = '<!-- fork-sweep:start -->', END = '<!-- fork-sweep:end -->';
function docTables(file = DOC) {
  const d = fs.readFileSync(file, 'utf8'), i = d.indexOf(START), j = d.indexOf(END);
  return i < 0 || j < i ? null : d.slice(i + START.length, j).trim();
}

module.exports = { loadModel, regionSizes, colluders, scoped, full, canSign, liftChance, smallest, measures, sweep, tables, docTables, SIZES, REGIONS, PANEL };

if (require.main === module) {
  const M = loadModel(), t = tables(sweep(M), M);
  if (process.argv.includes('--check')) {
    const d = docTables();
    if (d === t) { console.log('ok   docs/halt-power.md matches the sweep'); process.exit(0); }
    console.log('FAIL docs/halt-power.md does not match the sweep. Paste this between the fork-sweep markers:\n');
    console.log(t);
    process.exit(1);
  }
  console.log(`Halt-power sweep: ${REGIONS} regions, review panel of ${PANEL}, colluders' best placement (even or concentrated).`);
  console.log('Illustrative model output, not a prediction; every threshold is a placeholder.\n');
  console.log(t);
}
