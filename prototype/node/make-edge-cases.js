// Builds the edge-case inputs in prototype/edge-cases/inputs/ and prototype/edge-cases/expected.json.
// These are the inputs a first cold read of SPEC.md (an AI helper writing a Rust verifier) and a second one
// (a Go verifier) disagreed with the reference programs about, or that probe the places they flagged: a file
// that is not JSON, a byte-order mark, a damaged first entry, a signature that is both stale and repeated,
// a comment at the exact moment the comment period ends, half-broken compare pairs, and so on. See
// docs/spec-cold-read.md. The expected output is what the Node reference program prints; the tests check it
// against the Python program, and the second cold read's Go verifier gave the same output on every case.
//   node prototype/node/make-edge-cases.js            write the inputs and expected.json
//   node prototype/node/make-edge-cases.js --check    fail if the committed files differ
// Test data only: the keys come from labels that anyone can recompute.
'use strict';
const fs = require('fs'), path = require('path');
const L = require('./cip-log.js');
const proto = path.join(__dirname, '..');
const check = process.argv.includes('--check');
const outDir = path.join(proto, 'edge-cases', 'inputs');
const files = {}; // name -> content (string)
const ID = n => L.testIdentity(n);
const op = ID('test-operator'), al = ID('test-alice'), bo = ID('test-bob'), ca = ID('test-carol');
const T0 = 1790900000;
const rec = (id, type, body) => L.makeRecord(id, type, body);
const reg = (id, label) => rec(id, 'register_key', { public_key: id.pub, label });
const gen = (th = 2, cs = 100) => rec(op, 'genesis', { threshold: th, comment_seconds: cs });
const P1 = rec(al, 'propose', { title: 'T', text: 'Body' });
function build(steps, cps) { // steps [{t, r}] ; cps [size...]
  const entries = L.makeEntries(steps.map(s => ({ time: s.t, record: s.r })));
  return { format: 'cip-test-log/0', entries, checkpoints: (cps || []).map(n => L.makeCheckpoint(op, entries, n)) };
}
const W = (name, v) => { files[name] = typeof v === 'string' ? v : JSON.stringify(v); };
const base = () => [{ t: T0, r: gen() }, { t: T0 + 1, r: reg(al, 'test-alice') }, { t: T0 + 2, r: reg(bo, 'test-bob') }];
const pid = entries => L.entryHash(entries[3]);
const baseLog = () => build([...base(), { t: T0 + 3, r: P1 }], [4]);

// --- file level
W('e01-not-json.json', '{"format": "cip-test-log/0", "entries": [');
W('e02-bom.json', '﻿' + JSON.stringify(baseLog()));
{ const b = baseLog(); b.extra = 1; W('e03-extra-top-key.json', b); }
{ const b = baseLog(); b.format = 'cip-test-log/1'; W('e04-wrong-format.json', b); }
{ const b = baseLog(); b.entries = {}; W('e05-entries-object.json', b); }
W('e06-empty-entries.json', { format: 'cip-test-log/0', entries: [], checkpoints: [] });
{ const b = baseLog(); const c = JSON.stringify(b).replace('"format"', '"format":"cip-test-log/0","format"'); W('e07-dup-top-key.json', c); }
// --- numbers
{ const b = baseLog(); let s = JSON.stringify(b); s = s.replace('"threshold":2', '"threshold":2.0'); W('e08-threshold-2point0.json', s); }
{ const b = build([{ t: T0, r: gen() }, { t: T0 + 1, r: reg(al, 'test-alice') }], [2]); W('e09-threshold-1point5.json', JSON.stringify(b).replace('"threshold":2', '"threshold":1.5')); }
{ const b = baseLog(); let s = JSON.stringify(b); s = s.replace(/"time":1790900001/, '"time":1.790900001e9'); W('e10-time-exponent.json', s); }
{ const b = baseLog(); b.entries[2].index = -2; W('e11-negative-index.json', b); }
{ const b = baseLog(); b.entries[2].time = -5; W('e12-negative-time.json', b); }
{ const b = baseLog(); let s = JSON.stringify(b); s = s.replace('"time":1790900001', '"time":9007199254740993'); W('e13-time-beyond-safe.json', s); }
// --- records / types
{ const steps = [...base(), { t: T0 + 3, r: rec(al, 'vote', { x: 1 }) }]; W('e14-unknown-type.json', build(steps)); }
{ const steps = [{ t: T0, r: gen() }, { t: T0 + 1, r: rec(al, 'propose', { title: 'T', text: 'x' }) }]; W('e15-propose-unregistered-author.json', build(steps)); }
{ const steps = [{ t: T0, r: gen() }, { t: T0 + 1, r: reg(op, 'test-op-self') }]; W('e16-operator-self-register.json', build(steps)); }
{ const steps = [{ t: T0, r: rec(op, 'genesis', { threshold: 0, comment_seconds: 100 }) }, { t: T0 + 1, r: reg(al, 'test-alice') }]; W('e17-genesis-bad-body.json', build(steps, [2])); }
{ const steps = [{ t: T0, r: reg(al, 'test-alice') }, { t: T0 + 1, r: gen() }, { t: T0 + 2, r: reg(bo, 'test-bob') }]; W('e18-no-genesis-first.json', build(steps)); }
{ const b = baseLog(); b.entries[0].hash = 'f'.repeat(64); W('e19-entry0-bad-hash.json', b); }
{ const b = baseLog(); b.entries[0].record.sig = '0'.repeat(128); W('e20-entry0-bad-sig.json', b); }
// --- rules
{ const steps = [...base(), { t: T0 + 3, r: P1 }]; const e = L.makeEntries(steps.map(s => ({ time: s.t, record: s.r }))); const id = L.entryHash(e[3]);
  const v1 = L.versionHash('T', 'Body');
  const mk = (extra, cps) => build([...steps, ...extra(id, v1)], cps);
  W('e21-sign-stale-and-dup.json', mk((id, v1) => [{ t: T0 + 4, r: rec(al, 'sign', { proposal: id, version: v1 }) }, { t: T0 + 5, r: rec(al, 'sign', { proposal: id, version: 'a'.repeat(64) }) }]));
  W('e22-sign-stale-only.json', mk((id, v1) => [{ t: T0 + 4, r: rec(bo, 'sign', { proposal: id, version: 'a'.repeat(64) }) }]));
  W('e23-sign-unknown-and-unregistered.json', mk((id, v1) => [{ t: T0 + 4, r: rec(ca, 'sign', { proposal: 'b'.repeat(64), version: v1 }) }]));
  // threshold 2, comment 100: alice+bob sign at T0+4, T0+5 -> threshold time T0+5; closed at T0+105
  const two = (id, v1) => [{ t: T0 + 4, r: rec(al, 'sign', { proposal: id, version: v1 }) }, { t: T0 + 5, r: rec(bo, 'sign', { proposal: id, version: v1 }) }];
  W('e24-comment-at-exact-end.json', mk((id, v1) => [...two(id, v1), { t: T0 + 105, r: rec(al, 'comment', { proposal: id, text: 'late' }) }]));
  W('e25-comment-just-before-end.json', mk((id, v1) => [...two(id, v1), { t: T0 + 104, r: rec(al, 'comment', { proposal: id, text: 'ok' }) }]));
  const v2 = L.versionHash('T2', 'Body2');
  W('e26-amend-in-comment-state.json', mk((id, v1) => [...two(id, v1), { t: T0 + 6, r: rec(al, 'amend', { proposal: id, title: 'T2', text: 'Body2' }) }, { t: T0 + 200, r: rec(al, 'comment', { proposal: id, text: 'after amend, no new signatures' }) }]));
  W('e27-identical-amend.json', mk((id, v1) => [{ t: T0 + 4, r: rec(al, 'amend', { proposal: id, title: 'T', text: 'Body' }) }]));
  W('e28-third-signature-after-threshold.json', mk((id, v1) => [...two(id, v1), { t: T0 + 50, r: rec(op, 'sign', { proposal: id, version: v1 }) }, { t: T0 + 106, r: rec(al, 'comment', { proposal: id, text: 'closed' }) }]));
  W('e29-time-reversed-after-bad-entry.json', (() => { const b = mk((id, v1) => [{ t: T0 + 10, r: rec(al, 'comment', { proposal: id, text: 'a' }) }, { t: T0 + 5, r: rec(al, 'comment', { proposal: id, text: 'b' }) }, { t: T0 + 6, r: rec(al, 'comment', { proposal: id, text: 'c' }) }]); b.entries[5].hash = 'e'.repeat(64); return b; })());
  W('e30-duplicate-genesis.json', mk(() => [{ t: T0 + 4, r: gen() }]));
  W('e31-bad-label.json', build([{ t: T0, r: gen() }, { t: T0 + 1, r: reg(al, 'alice') }, { t: T0 + 2, r: P1 }]));
  W('e32-register-dup-and-mismatch.json', build([{ t: T0, r: gen() }, { t: T0 + 1, r: reg(al, 'test-alice') }, { t: T0 + 2, r: reg(al, 'test-alice-2') }, { t: T0 + 3, r: rec(bo, 'register_key', { public_key: ca.pub, label: 'test-x' }) }]));
}
// --- checkpoints in a log
{ const b = baseLog(); const o = ID('test-other'); b.checkpoints.push(L.makeCheckpoint(o, b.entries, 4)); W('e33-checkpoint-wrong-operator-good-sig.json', b); }
{ const b = baseLog(); b.checkpoints[0].size = 0; W('e34-checkpoint-size-zero.json', b); }
{ const b = baseLog(); b.checkpoints[0].size = 99; W('e35-checkpoint-size-too-big.json', b); }
{ const b = baseLog(); delete b.checkpoints[0].sig; W('e36-checkpoint-missing-key.json', b); }
{ const b = baseLog(); b.checkpoints[0].time = -1; W('e37-checkpoint-negative-time.json', b); }
// --- trusted
{ const b = baseLog(); W('e40-good-for-trusted.json', b); W('e40-trusted-ok.json', b.checkpoints[0]); const bad = Object.assign({}, b.checkpoints[0]); bad.root = '0'.repeat(64); W('e41-trusted-bad-sig.json', bad); W('e42-trusted-garbage.json', '[1,2'); const o = L.makeCheckpoint(ID('test-other'), b.entries, 4); W('e43-trusted-other-operator.json', o); const big = Object.assign({}, b.checkpoints[0]); big.size = 50; W('e44-trusted-too-big.json', big); }
// --- compare
{ const b = baseLog(); const a = b.checkpoints[0]; const o = L.makeCheckpoint(ID('test-other'), b.entries, 3);
  W('c01-a.json', a); W('c02-other-operator.json', o); const bs = Object.assign({}, a); bs.root = '1'.repeat(64); W('c03-bad-sig.json', bs);
  const ex = Object.assign({}, a); ex.extra = 1; W('c04-extra-key.json', ex); W('c05-garbage.json', '{'); const sm = L.makeCheckpoint(op, b.entries, 3); W('c06-smaller.json', sm);
  const bso = Object.assign({}, o); bso.root = '2'.repeat(64); W('c07-other-op-bad-sig.json', bso); const z = Object.assign({}, a); z.size = 0; W('c08-size-zero.json', z); }

// ---- the cases: [name, note, arguments (files are inputs/<name>), open question or null]
const I = f => 'edge-cases/inputs/' + f;
const CASES = [];
Object.keys(files).sort().forEach(f => {
  if (/^e4[1-4]|^e40-trusted|^c0/.test(f)) return; // checkpoints used only as the second argument below
  CASES.push({ note: f.replace(/\.json$/, '').replace(/^e\d+-/, '').replace(/-/g, ' '), args: ['verify', I(f)] });
});
[['e40-trusted-ok', 'a trusted checkpoint that matches'], ['e41-trusted-bad-sig', 'a trusted checkpoint with a bad signature'], ['e42-trusted-garbage', 'a trusted checkpoint that is not JSON'], ['e43-trusted-other-operator', 'a trusted checkpoint from another operator'], ['e44-trusted-too-big', 'a trusted checkpoint larger than the log']].forEach(([t, n]) =>
  CASES.push({ note: n, args: ['verify', I('e40-good-for-trusted.json'), '--trusted', I(t + '.json')] }));
CASES.push({ note: 'a log that is not JSON, with a trusted checkpoint (the trusted one is not looked at)', args: ['verify', I('e01-not-json.json'), '--trusted', I('e40-trusted-ok.json')] });
Object.keys(files).sort().filter(f => /^c0[2-8]/.test(f)).forEach(f => CASES.push({ note: 'compare the good checkpoint with ' + f.replace(/\.json$/, '').replace(/^c0\d-/, '').replace(/-/g, ' '), args: ['compare', I('c01-a.json'), I(f)] }));
CASES.push({ note: 'compare: other operator against the same with a bad signature', args: ['compare', I('c02-other-operator.json'), I('c07-other-op-bad-sig.json')] });
CASES.push({ note: 'compare: extra key against garbage', args: ['compare', I('c04-extra-key.json'), I('c05-garbage.json')] });
CASES.push({ note: 'compare: garbage against the good checkpoint', args: ['compare', I('c05-garbage.json'), I('c01-a.json')] });
CASES.push({ note: 'compare: bad signature against garbage (the well-formed one is still checked)', args: ['compare', I('c03-bad-sig.json'), I('c05-garbage.json')] });
CASES.push({ note: 'compare: the same checkpoint twice', args: ['compare', I('c01-a.json'), I('c01-a.json')] });
[['e40-good-for-trusted.json', []], ['e40-good-for-trusted.json', ['--index', '0']], ['e40-good-for-trusted.json', ['--index', '5']], ['e03-extra-top-key.json', []], ['e06-empty-entries.json', []], ['e21-sign-stale-and-dup.json', []]].forEach(([f, a]) =>
  CASES.push({ note: 'Save a checkpoint from ' + f.replace(/\.json$/, '') + (a.length ? ' at position ' + a[1] : ''), args: ['checkpoint', I(f)].concat(a) }));
const OPEN = { 'e07-dup-top-key.json': 'SPEC section 9, question 6 (repeated keys): the programs accept this file, a stricter verifier would not', 'e06-empty-entries.json': 'SPEC section 9, question 7 (an empty log passes)' };
CASES.forEach(c => { const f = path.basename(c.args[1]); if (OPEN[f] && c.args[0] === 'verify') c.open = OPEN[f]; });

if (!check) { fs.rmSync(path.join(proto, 'edge-cases'), { recursive: true, force: true }); fs.mkdirSync(outDir, { recursive: true }); }
let bad = 0;
Object.keys(files).sort().forEach(f => {
  const p = path.join(outDir, f);
  if (check) { if (!fs.existsSync(p) || fs.readFileSync(p, 'utf8') !== files[f]) { console.log('differs: ' + f); bad++; } }
  else fs.writeFileSync(p, files[f]);
});
// Same reading rules as the command line (SPEC section 1): a file that is not valid UTF-8 JSON reads as null.
const readJ = f => { try { return JSON.parse(new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(fs.readFileSync(f))); } catch (e) { return null; } };
const run = c => {
  const [cmd, a, b, c3, d] = c.args, P = x => path.join(proto, x);
  let code, j = null;
  if (cmd === 'verify') { j = L.verifyLog(readJ(P(a)), b === '--trusted' ? readJ(P(c3)) : undefined); code = j.ok ? 0 : 1; }
  else if (cmd === 'compare') { j = L.compareCheckpoints(readJ(P(a)), readJ(P(b))); code = j.ok ? 0 : 1; }
  else { const r = L.extractCheckpoint(readJ(P(a)), b === '--index' ? Number(c3) : undefined); if (r.error) code = 1; else { code = 0; j = r.checkpoint; } }
  const o = { note: c.note, command: c.args, exit_code: code };
  if (c.open) o.open_question = c.open;
  o.expect = j; // for Save: the checkpoint file, or null when nothing is saved
  return o;
};
const doc = { format: 'cip-edge-cases/0', about: 'Edge cases for a third verifier. Each case is a command (verify, compare or checkpoint, with files relative to prototype/), the exit code and the JSON printed (null when nothing is printed). Produced by the Node reference program; see docs/spec-cold-read.md. Cases marked open_question are not settled by the spec. Test data only.', cases: CASES.map(run) };
const text = JSON.stringify(doc, null, 1) + '\n';
const ep = path.join(proto, 'edge-cases', 'expected.json');
if (check) { if (!fs.existsSync(ep) || fs.readFileSync(ep, 'utf8') !== text) { console.log('differs: expected.json'); bad++; } console.log(bad ? 'edge cases differ from the generator' : 'edge cases match the generator (' + Object.keys(files).length + ' files, ' + CASES.length + ' cases)'); process.exit(bad ? 1 : 0); }
fs.writeFileSync(ep, text);
console.log('wrote ' + Object.keys(files).length + ' files and ' + CASES.length + ' cases');
