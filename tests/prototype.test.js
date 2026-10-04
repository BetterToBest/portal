// Tests for the Phase 3 prototype in prototype/ (test log, Node verifier, Python verifier).
// Checks: the test logs are reproducible; every shared test log gives the expected result in
// BOTH verifiers and the two outputs are identical; 600 random single edits to the good log are
// all rejected by both with the same result; so are 750 logs with whitespace around one hex value
// (the Python verifier once accepted a trailing newline);
// the JSON Schema (prototype/schema/) accepts every valid example and rejects every invalid one for the stated
// reason, and agrees with the verifiers' own format checks on every test log and every edited log; the canonical form and Merkle tree match
// independent reference values; saving and comparing checkpoints (SPEC 5.1) behave the same in
// both verifiers, in code and on the command line; and a coarse scan finds no network code in prototype/.
// Needs Node 18 or later and Python 3 with the `cryptography` package (pip install cryptography).
// Run from the repo root: node tests/prototype.test.js
'use strict';
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const crypto = require('crypto');
const L = require('../prototype/node/cip-log.js');

const root = path.join(__dirname, '..', 'prototype');
const td = f => path.join(root, 'testdata', f);
let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.log('FAIL', m); } else console.log('ok  ', m); };
const readJson = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const deepEq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ---- Python side: verify many files in one process ----
const PY = `
import sys, json, importlib.util
spec = importlib.util.spec_from_file_location('v', sys.argv[1]); v = importlib.util.module_from_spec(spec); spec.loader.exec_module(v)
jobs = json.load(open(sys.argv[2])); out = []
for j in jobs:
    log = v.normalize(json.load(open(j['log'])))
    if j.get('trusted'):
        out.append(v.verify_log(log, v.normalize(json.load(open(j['trusted']))), True))
    else:
        out.append(v.verify_log(log))
print(json.dumps(out))`;
function pythonVerify(jobs, tmp) {
  const jf = path.join(tmp, 'jobs.json'); fs.writeFileSync(jf, JSON.stringify(jobs));
  const r = cp.spawnSync('python3', ['-c', PY, path.join(root, 'python', 'verify.py'), jf], { encoding: 'utf8', maxBuffer: 1 << 28 });
  if (r.status !== 0) { console.log(r.stderr); throw new Error('python verifier failed to run'); }
  return JSON.parse(r.stdout);
}
const PY2 = `
import sys, json, importlib.util
spec = importlib.util.spec_from_file_location('v', sys.argv[1]); v = importlib.util.module_from_spec(spec); spec.loader.exec_module(v)
jobs = json.load(open(sys.argv[2])); out = []
for j in jobs:
    if j['op'] == 'compare':
        out.append(v.compare_checkpoints(v.normalize(json.load(open(j['a']))), v.normalize(json.load(open(j['b'])))))
    else:
        out.append(v.extract_checkpoint(v.normalize(json.load(open(j['log']))), j.get('index')))
print(json.dumps(out))`;
function pythonCheckpoints(jobs, tmp) {
  const jf = path.join(tmp, 'cpjobs.json'); fs.writeFileSync(jf, JSON.stringify(jobs));
  const r = cp.spawnSync('python3', ['-c', PY2, path.join(root, 'python', 'verify.py'), jf], { encoding: 'utf8', maxBuffer: 1 << 28 });
  if (r.status !== 0) { console.log(r.stderr); throw new Error('python checkpoint helper failed to run'); }
  return JSON.parse(r.stdout);
}
// Node's extractCheckpoint says ruleErrors and Python's says rule_errors; put both in one shape.
const shapeEx = r => r.error ? { error: r.error, details: r.details || null } : { checkpoint: r.checkpoint, index: r.index, rules: r.ruleErrors !== undefined ? r.ruleErrors : r.rule_errors };
const nodeVerify = j => L.verifyLog(readJson(j.log), j.trusted ? readJson(j.trusted) : undefined);

// ---- 1. reproducible test data ----
const gen = cp.spawnSync('node', [path.join(root, 'node', 'make-test-logs.js'), '--check'], { encoding: 'utf8' });
ok(gen.status === 0, 'committed test logs match what make-test-logs.js produces' + (gen.status ? ' (' + gen.stdout.trim() + ')' : ''));

// ---- 2. reference values for the building blocks ----
ok(L.canon({ b: 1, a: [2, 'x'], c: { z: 'é', y: '\n"\\' } }) === '{"a":[2,"x"],"b":1,"c":{"y":"\\n\\"\\\\","z":"é"}}', 'canonical form sorts keys and escapes minimally');
ok(['{"a":1.5}', '{"a":true}', '{"a":null}'].every(t => { try { L.canon(JSON.parse(t)); return false; } catch (e) { return true; } }), 'canonical form refuses floats, booleans and null');
const naiveRoot = hs => { // independent recursive Merkle tree written the textbook way
  const h = (p, ...bs) => crypto.createHash('sha256').update(Buffer.concat([Buffer.from([p]), ...bs])).digest();
  const mth = a => { if (a.length === 1) return h(0, Buffer.from(a[0], 'hex')); let k = 1; while (k < a.length) k <<= 1; k >>= 1; return h(1, mth(a.slice(0, k)), mth(a.slice(k))); };
  return mth(hs).toString('hex');
};
let merkleOk = true;
for (let n = 1; n <= 40; n++) { const hs = Array.from({ length: n }, (_, i) => crypto.createHash('sha256').update('leaf' + i).digest('hex')); if (L.merkleRoot(hs) !== naiveRoot(hs)) merkleOk = false; }
ok(merkleOk, 'Merkle root agrees with a textbook implementation for 1 to 40 leaves');
const idA = L.testIdentity('test-alice');
ok(idA.pub === L.testIdentity('test-alice').pub && idA.pub !== L.testIdentity('test-bob').pub, 'test identities are reproducible from their labels');

// ---- 3. every shared test log, in both verifiers ----
const T21 = td('good.checkpoint-21.json');
const E = (code, index) => ({ code, index });
const table = [
  ['good.json', T21, true, []],
  ['rule-ok-new-signer.json', null, true, []],
  ['unicode.json', null, true, []],
  ['tamper-text.json', null, false, [E('BAD_HASH', 5), E('BAD_SIG', 5), E('CP_BAD_ROOT', 0)]],
  ['delete-entry.json', null, false, [E('BAD_INDEX', 9), E('BAD_PREV', 9)]],
  ['reorder.json', null, false, [E('BAD_PREV', 6)]],
  ['forged-sig.json', null, false, [E('BAD_SIG', 7)]],
  ['tamper-time.json', null, false, [E('BAD_HASH', 9)]],
  ['bad-format.json', null, false, [E('BAD_FORMAT', 3)]],
  ['bad-checkpoint.json', null, false, [E('CP_BAD_SIG', 1), E('CP_BAD_ROOT', 1)]],
  ['rewritten-history.json', T21, false, [E('TRUSTED_MISMATCH', 0)]],
  ['truncated.json', T21, false, [E('TRUSTED_TRUNCATED', 0)]],
  ['rule-late-sign.json', null, false, [E('PROPOSAL_CLOSED', 22)]],
  ['rule-unregistered.json', null, false, [E('UNREGISTERED_AUTHOR', 22)]],
  ['rule-duplicate-sig.json', null, false, [E('DUPLICATE_SIGNATURE', 23)]],
  ['rule-stale-version.json', null, false, [E('STALE_VERSION', 22)]],
  ['rule-not-proposer.json', null, false, [E('NOT_PROPOSER', 22)]],
  ['rule-bad-label.json', null, false, [E('BAD_LABEL', 2)]],
  ['rule-time-reversed.json', null, false, [E('TIME_REVERSED', 22)]],
  ['rule-unknown-proposal.json', null, false, [E('UNKNOWN_PROPOSAL', 22)]],
];
const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'cip-'));
const jobs = table.map(([f, t]) => ({ log: td(f), trusted: t }));
const nodeRes = jobs.map(nodeVerify), pyRes = pythonVerify(jobs, tmp);
table.forEach(([f, , want, codes], i) => {
  const r = nodeRes[i], all = r.integrity_errors.concat(r.rule_errors);
  ok(r.ok === want, f + ': ok is ' + want);
  codes.forEach(c => ok(all.some(e => e.code === c.code && e.index === c.index), f + ': reports ' + c.code + ' at ' + c.index));
  ok(deepEq(r, pyRes[i]), f + ': Node and Python give identical output');
});
const states = r => r.summary.proposals.map(p => p.state).join();
ok(states(nodeRes[0]) === 'closed,collecting,comment', 'good.json: one proposal closed, one collecting, one in its comment period');
ok(nodeRes[0].summary.proposals[0].versions === 2 && nodeRes[0].summary.proposals[0].signatures === 3, 'good.json: the amended proposal has 2 versions and 3 signatures on the current one');
// A rewrite that is clean on its own is exposed only by the saved checkpoint:
['rewritten-history.json', 'truncated.json'].forEach(f => {
  const r = nodeVerify({ log: td(f) });
  ok(r.ok === true, f + ': passes every check when no trusted checkpoint is given (the chain alone cannot see it)');
});
ok(states(nodeVerify({ log: td('rewritten-history.json') })) === 'closed,collecting,collecting', 'rewritten-history.json: the dropped signature leaves the third proposal below its threshold');

// Numbers written differently in the file (3.0, 1.7909e9) are the same integers to both verifiers:
{
  const txt = fs.readFileSync(td('good.json'), 'utf8').replace('"threshold": 3', '"threshold": 3.0').replace('"time": 1790900000', '"time": 1.7909e9');
  ok(txt !== fs.readFileSync(td('good.json'), 'utf8'), 'number-format test file differs from the original text');
  const f = path.join(tmp, 'numbers.json'); fs.writeFileSync(f, txt);
  const a = nodeVerify({ log: f }), b = pythonVerify([{ log: f }], tmp)[0];
  ok(a.ok === true && deepEq(a, b), 'whole numbers written as 3.0 or 1.7909e9 verify the same in both verifiers');
}

// ---- 3b. saving and comparing checkpoints (SPEC 5.1) ----
{
  const goodLog = readJson(td('good.json')), g21 = readJson(T21), split = readJson(td('split-view.checkpoint-21.json'));
  const mut = (c, f) => { const x = JSON.parse(JSON.stringify(c)); f(x); return x; };
  const wf = (name, v) => { const f = path.join(tmp, name); fs.writeFileSync(f, JSON.stringify(v)); return f; };
  const otherOp = L.makeCheckpoint(L.testIdentity('test-alice'), L.makeEntries([{ time: 1790900000, record: goodLog.entries[0].record }]), 1);
  const cmpCases = [ // [name, a, b, ok, relation, error codes in order]
    ['same checkpoint twice', T21, T21, true, 'identical', []],
    ['two sizes of the same log', T21, wf('size12.json', goodLog.checkpoints[1]), true, 'different-size', []],
    ['split view: same size, different history', T21, td('split-view.checkpoint-21.json'), false, 'conflict', ['CMP_CONFLICT']],
    ['split view, arguments swapped', td('split-view.checkpoint-21.json'), T21, false, 'conflict', ['CMP_CONFLICT']],
    ['changed root without re-signing', T21, wf('badsig.json', mut(g21, c => { c.root = '0'.repeat(64); })), false, null, ['CMP_BAD_SIG']],
    ['a different operator', T21, wf('otherop.json', otherOp), false, null, ['CMP_DIFFERENT_OPERATOR']],
    ['second file missing a key', T21, wf('nokey.json', mut(g21, c => { delete c.sig; })), false, null, ['CMP_BAD_FORMAT']],
    ['both files malformed', wf('m1.json', { a: 1 }), wf('m2.json', []), false, null, ['CMP_BAD_FORMAT', 'CMP_BAD_FORMAT']],
    ['size written as text', T21, wf('strsize.json', mut(g21, c => { c.size = '21'; })), false, null, ['CMP_BAD_FORMAT']],
    ['a log file instead of a checkpoint', T21, td('good.json'), false, null, ['CMP_BAD_FORMAT']],
  ];
  const cj = cmpCases.map(([, a, b]) => ({ op: 'compare', a, b }));
  const cn = cj.map(j => L.compareCheckpoints(readJson(j.a), readJson(j.b))), cpy = pythonCheckpoints(cj, tmp);
  cmpCases.forEach(([name, , , want, rel, codes], i) => {
    ok(cn[i].ok === want && cn[i].relation === rel && deepEq(cn[i].errors.map(e => e.code), codes), 'compare: ' + name + ' gives ok=' + want + ', relation ' + rel + (codes.length ? ', ' + codes.join(' + ') : ''));
    ok(deepEq(cn[i], cpy[i]), 'compare: ' + name + ': Node and Python give identical output');
  });
  ok(cn[2].errors[0].where === 'both' && cn[1].operator === cn[0].operator, 'compare: a conflict is reported for both files, and the operator is named when the checkpoints can be compared');
  ok(cn[7].errors[0].where === 'a' && cn[7].errors[1].where === 'b' && cn[4].errors[0].where === 'b', 'compare: format and signature errors say which file (a or b) they are about');

  // Saving: take a checkpoint out of a log.
  const logs = ['good.json', 'rule-late-sign.json', 'rule-ok-new-signer.json', 'unicode.json', 'rewritten-history.json', 'truncated.json',
    'tamper-text.json', 'delete-entry.json', 'reorder.json', 'forged-sig.json', 'tamper-time.json', 'bad-format.json', 'bad-checkpoint.json'];
  const ej = [];
  logs.forEach(f => { ej.push({ op: 'extract', log: td(f) }); });
  ej.push({ op: 'extract', log: td('good.json'), index: 0 }, { op: 'extract', log: td('good.json'), index: 1 }, { op: 'extract', log: td('good.json'), index: 3 },
    { op: 'extract', log: wf('nocp.json', mut(goodLog, l => { l.checkpoints = []; })) });
  const en = ej.map(j => L.extractCheckpoint(readJson(j.log), j.index)), ep = pythonCheckpoints(ej, tmp);
  logs.forEach((f, i) => {
    const integrity = L.verifyLog(readJson(td(f))).integrity_errors.length > 0;
    ok(!!en[i].error === integrity, 'save: ' + f + (integrity ? ' has integrity errors, so no checkpoint is taken' : ' is intact, so a checkpoint is taken'));
  });
  ej.forEach((j, i) => ok(deepEq(shapeEx(en[i]), shapeEx(ep[i])), 'save: Node and Python agree on ' + path.basename(j.log) + (j.index !== undefined ? ' index ' + j.index : '')));
  ok(deepEq(en[0].checkpoint, goodLog.checkpoints[2]) && en[0].index === 2, 'save: with no index the last checkpoint is taken (good.json: position 2, size ' + goodLog.checkpoints[2].size + ')');
  ok(en[1].ruleErrors > 0 && en[1].checkpoint, 'save: a log that breaks a rule but is intact still gives its checkpoint, with a note');
  ok(en[ej.length - 4].checkpoint.size === 10 && en[ej.length - 3].checkpoint.size === 12 && /no checkpoint at position 3/.test(en[ej.length - 2].error || '') && /no checkpoints/.test(en[ej.length - 1].error || ''),
    'save: --index picks a position; an out-of-range index and a log with no checkpoints are refused with a plain message');
  // A saved checkpoint does its job: it clears the log it came from and exposes a rewrite.
  const saved = en[ej.length - 3].checkpoint;
  ok(L.verifyLog(goodLog, saved).ok === true, 'save: a checkpoint saved from good.json passes as the trusted checkpoint for good.json');
  ok(L.verifyLog(readJson(td('rewritten-history.json')), L.extractCheckpoint(goodLog, 2).checkpoint).integrity_errors.some(e => e.code === 'TRUSTED_TRUNCATED'), 'save: the last checkpoint of good.json (size 22) shows a shortened rewrite as TRUSTED_TRUNCATED');

  // Command line: both programs, same bytes, same exit codes, and nothing is written when a log is refused.
  const run = (cmd, args) => cp.spawnSync(cmd, args, { encoding: 'utf8' });
  const nodeCli = a => run('node', [path.join(root, 'node', 'cip-log.js')].concat(a));
  const pyCli = a => run('python3', [path.join(root, 'python', 'verify.py')].concat(a));
  const fN = path.join(tmp, 'saved-node.json'), fP = path.join(tmp, 'saved-py.json');
  const rN = nodeCli(['checkpoint', td('good.json'), '--index', '1', '--out', fN]), rP = pyCli(['checkpoint', td('good.json'), '--index', '1', '--out', fP]);
  ok(rN.status === 0 && rP.status === 0 && fs.readFileSync(fN, 'utf8') === fs.readFileSync(fP, 'utf8'), 'command line: both programs save the same bytes with --out');
  ok(fs.readFileSync(fN, 'utf8') === JSON.stringify(goodLog.checkpoints[1], null, 1) + '\n', 'command line: the saved file has the same layout as the checkpoint files in testdata/');
  ok(nodeCli(['checkpoint', td('good.json')]).stdout === pyCli(['checkpoint', td('good.json')]).stdout, 'command line: without --out both print the checkpoint, and it is identical');
  const refN = path.join(tmp, 'refused-node.json'), refP = path.join(tmp, 'refused-py.json');
  const bN = nodeCli(['checkpoint', td('tamper-text.json'), '--out', refN]), bP = pyCli(['checkpoint', td('tamper-text.json'), '--out', refP]);
  ok(bN.status === 1 && bP.status === 1 && !fs.existsSync(refN) && !fs.existsSync(refP) && /not saved/.test(bN.stderr) && /not saved/.test(bP.stderr), 'command line: a log with integrity errors is refused with exit 1 and no file is written');
  ok(nodeCli(['checkpoint', td('good.json'), '--index', 'x']).status === 2 && pyCli(['checkpoint', td('good.json'), '--index', 'x']).status === 2 &&
     nodeCli(['checkpoint', td('good.json'), '--index', '-1']).status === 2 && pyCli(['checkpoint', td('good.json'), '--index', '-1']).status === 2 &&
     nodeCli(['checkpoint', td('good.json'), '--out']).status === 2 && pyCli(['checkpoint', td('good.json'), '--out']).status === 2, 'command line: a bad --index or a missing --out file name is a usage error (exit 2) in both');
  const cN = nodeCli(['compare', T21, td('split-view.checkpoint-21.json')]), cP = pyCli(['compare', T21, td('split-view.checkpoint-21.json')]);
  ok(cN.status === 1 && cP.status === 1 && cN.stdout === cP.stdout, 'command line: compare exits 1 on a conflict and both print the same result');
  ok(nodeCli(['compare', T21, T21]).status === 0 && pyCli(['compare', T21, T21]).status === 0 && nodeCli(['compare', T21]).status === 2 && pyCli(['compare', T21]).status === 2, 'command line: compare exits 0 when the checkpoints agree and 2 when a file name is missing');
  ok(nodeCli(['verify', td('good.json'), '--trusted', fN]).status === 0 && pyCli([td('good.json'), '--trusted', fP]).status === 0, 'command line: a saved checkpoint file works as --trusted, and the old Python command form still works');
}

// ---- 4. random single edits: all rejected, both verifiers agree ----
function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const good = readJson(td('good.json')), rnd = rng(7), goodText = JSON.stringify(good);
const paths = []; // every string, integer and key position in the log
(function walk(v, p) {
  if (v && typeof v === 'object') for (const k of Object.keys(v)) { paths.push(p.concat(k)); walk(v[k], p.concat(k)); }
})(good, []);
const get = (o, p) => p.reduce((a, k) => a[k], o);
const pick = a => a[Math.floor(rnd() * a.length)];
const mutations = [];
while (mutations.length < 600) {
  const m = JSON.parse(goodText), kind = Math.floor(rnd() * 10), p = pick(paths), par = get(m, p.slice(0, -1)), k = p[p.length - 1];
  const v = par[k];
  if (kind === 0 && typeof v === 'string' && v.length) { const i = Math.floor(rnd() * v.length); par[k] = v.slice(0, i) + (v[i] === 'x' ? 'y' : 'x') + v.slice(i + 1); }
  else if (kind === 1 && typeof v === 'number') par[k] = v + (rnd() < 0.5 ? 1 : -1);
  else if (kind === 2 && !Array.isArray(par)) delete par[k];
  else if (kind === 3 && !Array.isArray(par)) par['extra'] = 1;
  else if (kind === 4) { const i = 1 + Math.floor(rnd() * (m.entries.length - 2)); [m.entries[i], m.entries[i + 1]] = [m.entries[i + 1], m.entries[i]]; }
  else if (kind === 5) m.entries.splice(Math.floor(rnd() * m.entries.length), 1);
  else if (kind === 6) { const i = Math.floor(rnd() * m.entries.length); m.entries.splice(i, 0, JSON.parse(JSON.stringify(m.entries[i]))); }
  else if (kind === 7 && typeof v === 'string') par[k] = v.toUpperCase() === v ? v.toLowerCase() : v.toUpperCase();
  else if (kind === 8) par[k] = [v];                                       // right value, wrong type: wrapped in an array
  else if (kind === 9) par[k] = pick([null, true, 0, 'x', {}, [], 1.5, -1]); // a value of a different type
  else continue;
  if (JSON.stringify(m) === goodText) continue;
  mutations.push(m);
}
// Hex values with extra characters around them must be rejected, never cleaned up. A trailing newline once
// slipped past the Python verifier (regex '$' allows it, and bytes.fromhex skips whitespace), so every hex
// string in the good log gets whitespace added before or after it, one at a time.
const hexEdits = [];
(function walkHex(v, p) {
  if (v && typeof v === 'object') for (const k of Object.keys(v)) {
    const x = v[k];
    if (typeof x === 'string' && /^[0-9a-f]{64}$|^[0-9a-f]{128}$/.test(x)) {
      for (const [pre, post] of [['', '\n'], ['', '\r\n'], ['', ' '], ['', '\t'], ['\n', ''], [' ', '']]) {
        const m = JSON.parse(goodText), par = get(m, p); par[k] = pre + x + post; hexEdits.push(m);
      }
    } else walkHex(x, p.concat(k));
  }
})(good, []);
const mjobs = mutations.map((m, i) => { const f = path.join(tmp, 'm' + i + '.json'); fs.writeFileSync(f, JSON.stringify(m)); return { log: f }; });
const mNode = mjobs.map(nodeVerify), mPy = pythonVerify(mjobs, tmp);
ok(mNode.every(r => r.ok === false), '600 random single edits to the good log are all rejected by the Node verifier (' + mNode.filter(r => r.ok).length + ' accepted)');
ok(mPy.every(r => r.ok === false), '600 random single edits to the good log are all rejected by the Python verifier (' + mPy.filter(r => r.ok).length + ' accepted)');
const disagree = mNode.map((r, i) => deepEq(r, mPy[i]) ? -1 : i).filter(i => i >= 0);
ok(disagree.length === 0, 'Node and Python give identical output on all 600 edited logs' + (disagree.length ? ' (first difference: m' + disagree[0] + ')' : ''));
{
  const hj = hexEdits.map((m, i) => { const f = path.join(tmp, 'h' + i + '.json'); fs.writeFileSync(f, JSON.stringify(m)); return { log: f }; });
  const hN = hj.map(nodeVerify), hP = pythonVerify(hj, tmp);
  ok(hexEdits.length > 500, hexEdits.length + ' logs made by adding whitespace around one hex value at a time');
  ok(hN.every(r => r.ok === false), 'Node rejects every log with whitespace around a hex value (' + hN.filter(r => r.ok).length + ' accepted)');
  ok(hP.every(r => r.ok === false), 'Python rejects every log with whitespace around a hex value (' + hP.filter(r => r.ok).length + ' accepted)');
  const hd = hN.map((r, i) => deepEq(r, hP[i]) ? -1 : i).filter(i => i >= 0);
  ok(hd.length === 0, 'Node and Python give identical output on all of them' + (hd.length ? ' (first difference: h' + hd[0] + ')' : ''));
}
{ // saving a checkpoint from each of the 600 edited logs: refused exactly when integrity errors exist, and both programs agree
  const ej2 = mjobs.map(j => ({ op: 'extract', log: j.log })), pe = pythonCheckpoints(ej2, tmp);
  const ne = mjobs.map(j => L.extractCheckpoint(readJson(j.log)));
  const wrong = ne.map((r, i) => !!r.error === (mNode[i].integrity_errors.length > 0) ? -1 : i).filter(i => i >= 0);
  const split = ne.map((r, i) => deepEq(shapeEx(r), shapeEx(pe[i])) ? -1 : i).filter(i => i >= 0);
  ok(wrong.length === 0, 'saving a checkpoint from each of the 600 edited logs is refused exactly when the log has integrity errors' + (wrong.length ? ' (first mismatch: m' + wrong[0] + ')' : ''));
  ok(split.length === 0, 'Node and Python agree on saving a checkpoint from all 600 edited logs' + (split.length ? ' (first difference: m' + split[0] + ')' : ''));
}

// ---- 4a. the JSON Schema: shape only (prototype/schema/) ----
{
  const S = require('../prototype/node/schema-check.js');
  const schemaFile = path.join(root, 'schema', 'cip-test-log.schema.json');
  const schema = readJson(schemaFile);
  const exDir = path.join(root, 'schema', 'examples');
  const defOf = f => f.split('-')[0]; // record-..., entry-..., checkpoint-..., log-...
  const sg = cp.spawnSync('node', [path.join(root, 'node', 'make-schema-examples.js'), '--check'], { encoding: 'utf8' });
  ok(sg.status === 0, 'committed schema examples match what make-schema-examples.js produces' + (sg.status ? ' (' + sg.stdout.trim() + ')' : ''));
  const validFiles = fs.readdirSync(path.join(exDir, 'valid')).sort(), invalidFiles = fs.readdirSync(path.join(exDir, 'invalid')).sort();
  const expectedErr = readJson(path.join(exDir, 'expected-errors.json'));
  ok(validFiles.length >= 10 && invalidFiles.length >= 30 && invalidFiles.every(f => expectedErr[f]) && Object.keys(expectedErr).length === invalidFiles.length, 'schema examples: ' + validFiles.length + ' valid, ' + invalidFiles.length + ' invalid, every invalid one has an expected error');
  const badValid = validFiles.filter(f => !S.validate(schema, defOf(f), readJson(path.join(exDir, 'valid', f))).ok);
  ok(badValid.length === 0, 'the schema accepts every valid example' + (badValid.length ? ' (rejected: ' + badValid.join(', ') + ')' : ''));
  const badInvalid = invalidFiles.filter(f => { const r = S.validate(schema, defOf(f), readJson(path.join(exDir, 'invalid', f))); return r.ok || !r.errors.some(e => e.path === expectedErr[f].path && e.keyword === expectedErr[f].keyword); });
  ok(badInvalid.length === 0, 'the schema rejects every invalid example, for the stated reason (path and keyword)' + (badInvalid.length ? ' (wrong: ' + badInvalid.join(', ') + ')' : ''));
  // Shape agrees with the verifier's own format checks, on every test log and every edited log.
  const logFiles = fs.readdirSync(path.join(root, 'testdata')).filter(f => !/\.checkpoint-\d+\.json$/.test(f)).map(f => td(f));
  const sets = { 'test logs': logFiles.map(readJson), 'random single edits': mutations, 'hex values with whitespace': hexEdits };
  for (const [name, logs] of Object.entries(sets)) {
    const diff = logs.map((l, i) => S.validate(schema, 'log', l).ok === L.shapeOk(l) ? -1 : i).filter(i => i >= 0);
    ok(diff.length === 0, 'schema and the verifier\'s format checks agree on all ' + logs.length + ' ' + name + (diff.length ? ' (first difference: #' + diff[0] + ')' : ''));
    const shapeBad = logs.filter(l => !S.validate(schema, 'log', l).ok);
    ok(shapeBad.every(l => L.verifyLog(l).ok === false), name + ': every log the schema rejects is also rejected by the verifier (' + shapeBad.length + ' of ' + logs.length + ' fail the schema)');
  }
  ok(sets['test logs'].filter(l => !S.validate(schema, 'log', l).ok).length === 1 && !S.validate(schema, 'log', readJson(td('bad-format.json'))).ok, 'of the test logs only bad-format.json fails the schema (the other broken ones have the right shape and fail on hashes, signatures or rules)');
  ok(['good.checkpoint-21.json', 'split-view.checkpoint-21.json'].every(f => S.validate(schema, 'checkpoint', readJson(td(f))).ok), 'the saved checkpoint files in testdata/ pass the checkpoint shape');
  // The checker refuses what it does not implement, and has clean exit codes.
  const sc = a => cp.spawnSync('node', [path.join(root, 'node', 'schema-check.js')].concat(a), { encoding: 'utf8' });
  const odd = path.join(tmp, 'odd.schema.json'); fs.writeFileSync(odd, JSON.stringify({ type: 'object', format: 'email' }));
  ok(sc([td('good.json')]).status === 0 && sc([td('bad-format.json')]).status === 1 && sc([td('good.checkpoint-21.json'), '--def', 'checkpoint']).status === 0 &&
     sc([td('good.json'), '--def', 'record']).status === 1, 'schema-check command: exit 0 when the shape is right, 1 when not');
  ok(sc([]).status === 2 && sc([td('good.json'), '--def', 'nonsense']).status === 2 && sc([td('good.json'), '--def']).status === 2 && sc([path.join(tmp, 'missing.json')]).status === 2 &&
     sc([td('good.json'), '--schema', odd]).status === 2 && /unsupported schema keyword: format/.test(sc([td('good.json'), '--schema', odd]).stderr), 'schema-check command: usage errors, an unreadable file and an unsupported schema keyword all exit 2 with a plain message');
  ok(S.validate(schema, 'record', JSON.parse('{"__proto__":1,"toString":2,"constructor":3}')).ok === false, 'names such as toString and constructor are treated as ordinary unknown keys, not as schema entries');
  // A full, independent JSON Schema validator, when one is installed (pip install jsonschema): same answers on everything above.
  const PY3 = `
import sys, json
try:
    import jsonschema
except ImportError:
    sys.exit(3)
schema = json.load(open(sys.argv[1])); jobs = json.load(open(sys.argv[2])); cache = {}; out = []
for j in jobs:
    d = j['def']
    if d not in cache:
        s = {'$schema': schema['$schema'], '$ref': '#/$defs/' + d, '$defs': schema['$defs']}
        cache[d] = jsonschema.Draft202012Validator(s)
    out.append(cache[d].is_valid(j['value']))
print(json.dumps(out))`;
  const jjobs = [];
  validFiles.forEach(f => jjobs.push({ def: defOf(f), value: readJson(path.join(exDir, 'valid', f)), want: true, label: 'valid/' + f }));
  invalidFiles.forEach(f => jjobs.push({ def: defOf(f), value: readJson(path.join(exDir, 'invalid', f)), want: false, label: 'invalid/' + f }));
  Object.entries(sets).forEach(([name, logs]) => logs.forEach((l, i) => jjobs.push({ def: 'log', value: l, want: S.validate(schema, 'log', l).ok, label: name + ' #' + i })));
  const jf = path.join(tmp, 'jsjobs.json'); fs.writeFileSync(jf, JSON.stringify(jjobs.map(j => ({ def: j.def, value: j.value }))));
  const jr = cp.spawnSync('python3', ['-c', PY3, schemaFile, jf], { encoding: 'utf8', maxBuffer: 1 << 28 });
  if (jr.status === 3) console.log('skip  independent check with Python jsonschema (not installed: pip install jsonschema)');
  else {
    if (jr.status !== 0) { console.log(jr.stderr); throw new Error('python jsonschema helper failed to run'); }
    const got = JSON.parse(jr.stdout), wrong = jjobs.filter((j, i) => got[i] !== j.want).map(j => j.label);
    ok(wrong.length === 0, 'Python jsonschema (a full validator) gives the same answer as expected on all ' + jjobs.length + ' documents' + (wrong.length ? ' (differs: ' + wrong.slice(0, 3).join(', ') + ')' : ''));
  }
}

// ---- 4b. the viewer page: its checking logic must agree with the Node verifier ----
{
  const html = fs.readFileSync(path.join(root, 'viewer', 'index.html'), 'utf8');
  const core = html.split('/*CORE-START*/')[1].split('/*CORE-END*/')[0];
  const V = new Function(core + ';return {verifyLogAsync}')();
  const SPKI = Buffer.from('302a300506032b6570032100', 'hex');
  const prims = {
    sha256: async b => new Uint8Array(crypto.createHash('sha256').update(b).digest()),
    verify: async (pub, msg, sig) => crypto.verify(null, Buffer.from(msg), crypto.createPublicKey({ key: Buffer.concat([SPKI, Buffer.from(pub, 'hex')]), format: 'der', type: 'spki' }), Buffer.from(sig, 'hex'))
  };
  const same = async (log, trusted) => deepEq(await V.verifyLogAsync(JSON.parse(JSON.stringify(log)), trusted, prims), L.verifyLog(JSON.parse(JSON.stringify(log)), trusted));
  (async () => {
    let bad = [];
    for (const [f, t] of table) { const log = readJson(td(f)); if (!await same(log, t ? readJson(t) : undefined)) bad.push(f); }
    ok(bad.length === 0, 'viewer page logic gives identical output to the Node verifier on all ' + table.length + ' shared test logs' + (bad.length ? ' (differs: ' + bad.join(', ') + ')' : ''));
    bad = [];
    for (let i = 0; i < mutations.length; i++) if (!await same(mutations[i], undefined)) bad.push('m' + i);
    ok(bad.length === 0, 'viewer page logic gives identical output on all ' + mutations.length + ' edited logs' + (bad.length ? ' (first difference: ' + bad[0] + ')' : ''));
    bad = [];
    for (let i = 0; i < hexEdits.length; i++) if (!await same(hexEdits[i], undefined)) bad.push('h' + i);
    ok(bad.length === 0, 'viewer page logic gives identical output on all ' + hexEdits.length + ' logs with whitespace around a hex value' + (bad.length ? ' (first difference: ' + bad[0] + ')' : ''));
    const b = cp.spawnSync('node', [path.join(root, 'node', 'build-viewer.js'), '--check'], { encoding: 'utf8' });
    ok(b.status === 0, 'example logs inside the viewer page match prototype/testdata' + (b.status ? ' (' + b.stdout.trim() + ')' : ''));
    finish();
  })();
}

function finish() {
// ---- 5. coarse tripwire for the no-behavior-data rule ----
const bannedJs = /\b(fetch|XMLHttpRequest|WebSocket|sendBeacon)\b|require\(\s*['"](node:)?(http|https|http2|net|tls|dgram|dns|child_process)['"]\s*\)/;
const bannedPy = /^\s*(import|from)\s+(urllib|http|socket|requests|ssl|ftplib|smtplib|subprocess)\b/m;
const urlRe = /https?:\/\//;
const codeFiles = [];
(function scan(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) { if (f !== 'testdata') scan(p); } else if (/\.(js|py|html)$/.test(f)) codeFiles.push(p); } })(root);
const offenders = codeFiles.filter(f => { const s = fs.readFileSync(f, 'utf8'); const noLinks = f.endsWith('.html') ? s.replace(/href="[^"]*"/g, '') : s; return (f.endsWith('.py') ? bannedPy.test(s) : bannedJs.test(s)) || urlRe.test(noLinks); });
ok(codeFiles.length >= 4 && offenders.length === 0, 'no network calls, outside addresses or tracking code in prototype/ (' + codeFiles.length + ' code files scanned)' + (offenders.length ? ': ' + offenders.join(', ') : ''));

fs.rmSync(tmp, { recursive: true, force: true });
console.log(fail ? '\n' + fail + ' check(s) failed' : '\nall checks passed');
process.exit(fail ? 1 : 0);
}
