// Tests for the Phase 3 prototype in prototype/ (test log, Node verifier, Python verifier).
// Checks: the test logs are reproducible; every shared test log gives the expected result in
// BOTH verifiers and the two outputs are identical; 600 random single edits to the good log are
// all rejected by both with the same result; the canonical form and Merkle tree match
// independent reference values; and a coarse scan finds no network code in prototype/.
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
const mjobs = mutations.map((m, i) => { const f = path.join(tmp, 'm' + i + '.json'); fs.writeFileSync(f, JSON.stringify(m)); return { log: f }; });
const mNode = mjobs.map(nodeVerify), mPy = pythonVerify(mjobs, tmp);
ok(mNode.every(r => r.ok === false), '600 random single edits to the good log are all rejected by the Node verifier (' + mNode.filter(r => r.ok).length + ' accepted)');
ok(mPy.every(r => r.ok === false), '600 random single edits to the good log are all rejected by the Python verifier (' + mPy.filter(r => r.ok).length + ' accepted)');
const disagree = mNode.map((r, i) => deepEq(r, mPy[i]) ? -1 : i).filter(i => i >= 0);
ok(disagree.length === 0, 'Node and Python give identical output on all 600 edited logs' + (disagree.length ? ' (first difference: m' + disagree[0] + ')' : ''));

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
