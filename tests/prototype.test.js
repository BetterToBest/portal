// Tests for the Phase 3 prototype in prototype/ (test log, Node verifier, Python verifier).
// Checks: the test logs are reproducible; every shared test log gives the expected result in
// BOTH verifiers and the two outputs are identical, and match the language-neutral answer key; recorded results from other Ed25519 libraries are consistent; 600 random single edits to the good log are
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

// ---- 3a. the language-neutral answer key (prototype/answer-key/expected.json) ----
{
  const keyFile = path.join(root, 'answer-key', 'expected.json');
  const genK = cp.spawnSync('node', [path.join(root, 'node', 'make-answer-key.js'), '--check'], { encoding: 'utf8' });
  ok(genK.status === 0, 'committed answer key matches what make-answer-key.js produces' + (genK.status ? ' (' + genK.stdout.trim() + ')' : ''));
  const key = readJson(keyFile);
  const kcase = key.cases.map(c => ({ log: path.join(root, c.log), trusted: c.trusted ? path.join(root, c.trusted) : undefined }));
  const kPy = pythonVerify(kcase, tmp);
  ok(key.format === 'cip-answer-key/0' && key.cases.length >= table.length, 'answer key: format and size (' + key.cases.length + ' cases)');
  // every test log appears, and every saved-checkpoint case names a file that exists
  const allLogs = fs.readdirSync(path.join(root, 'testdata')).filter(f => !/\.checkpoint-\d+\.json$/.test(f)).sort();
  const inKey = Array.from(new Set(key.cases.map(c => path.basename(c.log)))).sort();
  ok(deepEq(allLogs, inKey), 'answer key: lists every one of the ' + allLogs.length + ' test logs in testdata/ and nothing else');
  // the key against the Python verifier, case by case
  const kBad = key.cases.filter((c, i) => !deepEq(c.expect, kPy[i]) || c.exit_code !== (c.expect.ok ? 0 : 1));
  ok(kBad.length === 0, 'answer key: the Python verifier gives exactly the recorded output for all ' + key.cases.length + ' cases' + (kBad.length ? ' (differs: ' + kBad.slice(0, 3).map(c => c.log).join(', ') + ')' : ''));
  // the key against the hand-written table above (an independent statement of ok and error codes)
  table.forEach(([f, t, want, codes]) => {
    const c = key.cases.find(x => path.basename(x.log) === f && (x.trusted ? path.join(root, x.trusted) : null) === (t || null));
    const all = c ? c.expect.integrity_errors.concat(c.expect.rule_errors) : [];
    ok(!!c && c.expect.ok === want && codes.every(e => all.some(x => x.code === e.code && x.index === e.index)), 'answer key: ' + f + (t ? ' with the saved checkpoint' : '') + ' agrees with the hand-written table (ok is ' + want + ')');
  });
  // the command line prints the recorded output and returns the recorded exit code, in both programs
  const cliRun = (cmd, script, c) => cp.spawnSync(cmd, [path.join(root, script)].concat(cmd === 'node' ? ['verify'] : [], [path.join(root, c.log)], c.trusted ? ['--trusted', path.join(root, c.trusted)] : []), { encoding: 'utf8' });
  const cliBad = [];
  key.cases.forEach(c => {
    [['node', 'node/cip-log.js'], ['python3', 'python/verify.py']].forEach(([cmd, script]) => {
      const r = cliRun(cmd, script, c);
      let got = null; try { got = JSON.parse(r.stdout); } catch (e) { /* stays null */ }
      if (r.status !== c.exit_code || !deepEq(got, c.expect)) cliBad.push(cmd + ' ' + c.log);
    });
  });
  ok(cliBad.length === 0, 'answer key: both command-line programs print the recorded output and exit code for all ' + key.cases.length + ' cases' + (cliBad.length ? ' (differs: ' + cliBad.slice(0, 3).join(', ') + ')' : ''));
}

// ---- 3c. recorded results from other Ed25519 libraries (prototype/vectors/other-libraries/) ----
{
  const dir = path.join(root, 'vectors', 'other-libraries');
  const rec = readJson(path.join(dir, 'results.json'));
  const nCases = readJson(path.join(root, 'vectors', 'ed25519-odd-cases.json')).cases.length;
  const libsRec = Object.keys(rec.results);
  ok(libsRec.length >= 16 && libsRec.every(k => Array.isArray(rec.results[k]) && rec.results[k].length === nCases && rec.results[k].every(v => typeof v === 'boolean')), 'other libraries: results.json has a yes or no for each of the ' + nCases + ' odd cases from each of ' + libsRec.length + ' library variants');
  ok(Object.keys(rec.versions).length >= 14 && Object.values(rec.versions).every(v => /^\d+\.\d+/.test(v)), 'other libraries: the version of every library is recorded');
  const an = cp.spawnSync('python3', ['-I', path.join(dir, 'analyze.py'), '--json'], { encoding: 'utf8' });
  let A = null; try { A = JSON.parse(an.stdout); } catch (e) { /* stays null */ }
  ok(an.status === 0 && A && A.rows.length === libsRec.length, 'other libraries: analyze.py reads the recorded results' + (an.status ? ' (' + an.stderr.trim().split('\n').pop() + ')' : ''));
  if (A) {
    const row = n => A.rows.find(r => r.library.startsWith(n));
    ok(['PyNaCl', 'libsodium-wrappers', 'PHP sodium'].every(n => row(n).refuses_what_42_accepts === 0 && row(n).differs_alone.length <= 2 && row(n).differs_alone.every(x => /order-8 component|cancel/.test(x))), 'other libraries: libsodium (PyNaCl, libsodium-wrappers and PHP sodium) differs from SPEC 4.2 on at most two cases, both with an order-8 component that it accepts and rule 5 refuses');
    const same = (a, b) => deepEq(rec.results[a], rec.results[b]);
    ok(same('PyNaCl (libsodium)', 'libsodium-wrappers') && same('PyNaCl (libsodium)', 'PHP sodium (libsodium)'), 'other libraries: libsodium gives the same ' + nCases + ' answers through Python, JavaScript and PHP (the three harnesses read the cases the same way)');
    ok(['Go', 'Java', 'PHP', 'Rust'].every(l => libsRec.some(k => k.startsWith(l))), 'other libraries: Go, Java, PHP and Rust are all in the recorded results');
    ok(['run.go', 'run.php', 'Run.java', 'rust/Cargo.toml', 'rust/Cargo.lock', 'rust/src/main.rs'].every(f => fs.existsSync(path.join(dir, f))), 'other libraries: the Go, PHP, Java and Rust harnesses are in the folder (the Rust one with its Cargo.lock, so the crate versions are fixed)');
    ok(A.rows.every(r => !r.differs_alone.some(x => /message changed|one bit of R/.test(x))), 'other libraries: every variant refuses the two tampered copies of the valid signature (a check that each harness reads the cases correctly)');
    ok(A.rows.every(r => r.refuses_what_42_accepts === 0), 'other libraries: none refuses a case that SPEC 4.2 requires to pass');
    ok(A.rows.every(r => r.agrees_after_checks === nCases), 'other libraries: with the 4.2 key rules, S below L and the prime-order-subgroup check (rule 5) in front, every variant agrees on all ' + nCases + ' cases');
    ok(A.rows.every(r => r.agrees_alone < nCases), 'other libraries: no library follows SPEC 4.2 on its own (so the check above means something)');
  }
}

// ---- 3d. points the spec was silent or unclear about (found by the cold-read test, docs/spec-cold-read.md) ----
// A reader who had only SPEC.md wrote a third verifier (Rust). It gave a different output from the two programs on these
// points, so the spec now says what to do, and each is pinned here: same output from both programs, and the exact errors.
{
  const T0 = 1790900000, id = n => L.testIdentity(n), op = id('test-operator'), al = id('test-alice'), bo = id('test-bob');
  const rc = (i, t, b) => L.makeRecord(i, t, b), reg = (i, l) => rc(i, 'register_key', { public_key: i.pub, label: l });
  const gen = rc(op, 'genesis', { threshold: 2, comment_seconds: 100 });
  const mk = (steps, cps) => { const e = L.makeEntries(steps.map(([t, r]) => ({ time: T0 + t, record: r }))); return { format: 'cip-test-log/0', entries: e, checkpoints: (cps || []).map(n => L.makeCheckpoint(op, e, n)) }; };
  const base = [[0, gen], [1, reg(al, 'test-alice')], [2, reg(bo, 'test-bob')], [3, rc(al, 'propose', { title: 'T', text: 'Body' })]];
  const good = mk(base, [4]), pidOf = log => L.entryHash(log.entries[3]), v1 = L.versionHash('T', 'Body');
  const wf = (name, v) => { const f = path.join(tmp, 'cr-' + name); fs.writeFileSync(f, typeof v === 'string' || Buffer.isBuffer(v) ? v : JSON.stringify(v)); return f; };
  const runBoth = (args) => [['node', [path.join(root, 'node', 'cip-log.js')].concat(args)], ['python3', ['-I', path.join(root, 'python', 'verify.py')].concat(args.filter((a, i) => !(i === 0 && a === 'verify')))]]
    .map(([c, a]) => { const r = cp.spawnSync(c, a, { encoding: 'utf8' }); let j = null; try { j = JSON.parse(r.stdout); } catch (e) { /* stays null */ } return { status: r.status, json: j, stderr: r.stderr, stdout: r.stdout }; });
  const sh = (L2) => L2.map(e => e.code + '@' + e.where + (e.index === undefined ? '' : ':' + e.index)).join(' ');
  const check = (name, args, status, ie, re) => {
    const [n, py] = runBoth(args);
    ok(n.status === status && py.status === status && n.json && py.json && deepEq(n.json, py.json) && sh(n.json.integrity_errors) === ie && sh(n.json.rule_errors) === re,
      'cold read: ' + name + ' gives exit ' + status + ' and "' + (ie || 'no integrity errors') + (re ? ' | ' + re : '') + '" in both programs' + (n.json ? ' (got: ' + n.status + ' ' + sh(n.json.integrity_errors) + ' | ' + sh(n.json.rule_errors) + ')' : ' (no JSON: ' + n.stderr.trim().slice(0, 80) + ')'));
  };
  // files that are not valid JSON (SPEC section 1)
  const text = JSON.stringify(good);
  check('a file that is not JSON', ['verify', wf('notjson', '{"format": "cip-test-log/0", "entries": [')], 1, 'BAD_FORMAT@log:0', '');
  check('a file that starts with a byte-order mark', ['verify', wf('bom', Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(text)]))], 1, 'BAD_FORMAT@log:0', '');
  check('a file that is not UTF-8', ['verify', wf('latin1', Buffer.concat([Buffer.from(text.slice(0, 10)), Buffer.from([0xff, 0xfe]), Buffer.from(text.slice(10))]))], 1, 'BAD_FORMAT@log:0', '');
  check('a file holding null', ['verify', wf('null', 'null')], 1, 'BAD_FORMAT@log:0', '');
  check('a bare NaN', ['verify', wf('nan', text.replace('"size":4', '"size":NaN'))], 1, 'BAD_FORMAT@log:0', '');
  check('an extra top-level key', ['verify', wf('extra', Object.assign({ extra: 1 }, good))], 1, 'BAD_FORMAT@log:0', '');
  check('the wrong format string', ['verify', wf('fmt', Object.assign({}, good, { format: 'cip-test-log/1' }))], 1, 'BAD_FORMAT@log:0', '');
  check('entries that is not a list', ['verify', wf('entobj', Object.assign({}, good, { entries: {} }))], 1, 'BAD_FORMAT@log:0', '');
  check('a trusted checkpoint that is not JSON', ['verify', wf('good', good), '--trusted', wf('trustedjunk', '[1,2')], 1, 'TRUSTED_BAD_FORMAT@trusted:0', '');
  check('a log that is not JSON, with a trusted checkpoint (the trusted one is not looked at)', ['verify', wf('notjson2', '{'), '--trusted', wf('tr-ok', good.checkpoints[0])], 1, 'BAD_FORMAT@log:0', '');
  const missing = runBoth(['verify', path.join(tmp, 'cr-does-not-exist.json')]);
  ok(missing.every(r => r.status === 2 && r.stdout === '' && /cannot read/.test(r.stderr)), 'cold read: a file that cannot be read gives exit 2, no JSON and a message on standard error, in both programs');
  // an empty log passes (section 9, question 7) and a checkpoint in it has no operator
  check('an empty log', ['verify', wf('empty', { format: 'cip-test-log/0', entries: [], checkpoints: [] })], 0, '', '');
  // who the operator is (section 5): entry 0 only has to be a genesis record with a 64-hex author
  { const e = JSON.parse(text); e.entries[0].hash = 'f'.repeat(64);
    check('a genesis with a wrong hash (the operator is still known)', ['verify', wf('g-badhash', e)], 1, 'BAD_HASH@entry:0 BAD_PREV@entry:1', ''); }
  { const bad = mk([[0, rc(op, 'genesis', { threshold: 0, comment_seconds: 100 })], [1, reg(al, 'test-alice')]], [2]);
    check('a genesis with a bad body (the operator is still known)', ['verify', wf('g-badbody', bad)], 1, '', 'BAD_BODY@entry:0'); }
  { const wrongOp = JSON.parse(text); wrongOp.checkpoints.push(L.makeCheckpoint(id('test-other'), good.entries, 4));
    check('a checkpoint signed by another operator', ['verify', wf('wrongop', wrongOp)], 1, 'CP_WRONG_OPERATOR@checkpoint:1', ''); }
  // BAD_FORMAT is the shape of the entry and record, BAD_BODY the body for the type (section 6)
  check('a record type that is not in the table', ['verify', wf('unknowntype', mk([...base, [4, rc(al, 'vote', { x: 1 })]]))], 1, '', 'BAD_BODY@entry:4');
  { const f = JSON.parse(JSON.stringify(mk([[0, gen], [1, reg(al, 'test-alice')]], [2]))); f.entries[0].record.body.threshold = 1.5;
    check('a body number that section 2 does not allow', ['verify', wf('float', f)], 1, 'BAD_FORMAT@entry:0 CP_BAD_ROOT@checkpoint:0', ''); }
  // signing: stale and repeated at once reports only STALE_VERSION (section 6, step 10)
  { const pid = pidOf(good);
    check('a signature that is both stale and a repeat', ['verify', wf('stale-dup', mk([...base, [4, rc(al, 'sign', { proposal: pid, version: v1 })], [5, rc(al, 'sign', { proposal: pid, version: 'a'.repeat(64) })]]))], 1, '', 'STALE_VERSION@entry:5');
    check('a repeated signature on the current version', ['verify', wf('dup', mk([...base, [4, rc(al, 'sign', { proposal: pid, version: v1 })], [5, rc(al, 'sign', { proposal: pid, version: v1 })]]))], 1, '', 'DUPLICATE_SIGNATURE@entry:5');
    const two = [[4, rc(al, 'sign', { proposal: pid, version: v1 })], [5, rc(bo, 'sign', { proposal: pid, version: v1 })]];
    check('a comment one second before the comment period ends', ['verify', wf('cm-before', mk([...base, ...two, [104, rc(al, 'comment', { proposal: pid, text: 'ok' })]]))], 0, '', '');
    check('a comment at the exact moment the comment period ends', ['verify', wf('cm-exact', mk([...base, ...two, [105, rc(al, 'comment', { proposal: pid, text: 'late' })]]))], 1, '', 'PROPOSAL_CLOSED@entry:6');
    check('an amendment in the comment period starts collecting again', ['verify', wf('amend', mk([...base, ...two, [6, rc(al, 'amend', { proposal: pid, title: 'T2', text: 'B2' })], [500, rc(bo, 'comment', { proposal: pid, text: 'still open' })]]))], 0, '', ''); }
  check('the operator registering its own key', ['verify', wf('opreg', mk([[0, gen], [1, reg(op, 'test-op')]]))], 1, '', 'DUPLICATE_KEY@entry:1');
  // compare (section 5.1): errors have a code and a where, and no index
  { const a = good.checkpoints[0], other = L.makeCheckpoint(id('test-other'), good.entries, 3), badSig = Object.assign({}, a, { root: '1'.repeat(64) });
    const cmp = (name, x, y, want) => { const [n, py] = runBoth(['compare', x, y]); const got = n.json ? n.json.errors.map(e => e.code + '@' + e.where + (Object.keys(e).length === 2 ? '' : '+extra')).join(' ') : 'no json';
      ok(n.json && py.json && deepEq(n.json, py.json) && got === want, 'cold read: compare ' + name + ' gives "' + want + '" in both programs, with no index (got: ' + got + ')'); };
    cmp('with a file that is not JSON', wf('c-a', a), wf('c-junk', '{'), 'CMP_BAD_FORMAT@b');
    cmp('with one malformed file and one bad signature (the well-formed one is still checked)', wf('c-bs', badSig), wf('c-junk2', '[]'), 'CMP_BAD_FORMAT@b CMP_BAD_SIG@a');
    cmp('with different operators and one bad signature (both signatures are checked)', wf('c-a2', a), wf('c-o', Object.assign({}, other, { root: '2'.repeat(64) })), 'CMP_DIFFERENT_OPERATOR@both CMP_BAD_SIG@b'); }
}

{
  const cr = path.join(root, 'cold-read');
  ok(['README.md', 'DECISIONS.md', 'outputs.json', 'rust/Cargo.toml', 'rust/Cargo.lock', 'rust/src/main.rs'].every(f => fs.existsSync(path.join(cr, f))) && fs.existsSync(path.join(root, '..', 'docs', 'spec-cold-read.md')), 'cold read: the Rust verifier, its decision log, its outputs and the write-up are in the repository');
  const ko = readJson(path.join(cr, 'outputs.json')), kk = readJson(path.join(root, 'answer-key', 'expected.json')).cases;
  const same = kk.filter(c => { const o = ko[path.basename(c.log) + (c.trusted ? '+trusted' : '')]; return o && deepEq(o, c.expect); }).length;
  ok(same === 22 && kk.length === 23, 'cold read: the recorded Rust output matches the answer key on 22 of its ' + kk.length + ' cases (the one difference, a stale and repeated signature, is listed in docs/spec-cold-read.md)');
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
  const V = new Function(core + ';return {verifyLogAsync, checkSigAsync}')();
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
    // ---- 4c. odd Ed25519 keys and signatures (SPEC section 4.2) ----
    {
      const genV = cp.spawnSync('python3', [path.join(root, 'python', 'make-ed25519-vectors.py'), '--check'], { encoding: 'utf8' });
      ok(genV.status === 0, 'committed Ed25519 odd cases match what make-ed25519-vectors.py produces (expected results come from RFC 8032 arithmetic, not from a library)' + (genV.status ? ' (' + genV.stdout.trim() + ')' : ''));
      const vec = readJson(path.join(root, 'vectors', 'ed25519-odd-cases.json')), cases = vec.cases;
      ok(cases.length >= 41 && cases.filter(c => c.expect).length >= 1 && cases.filter(c => !c.expect).length >= 30, 'odd cases: ' + cases.length + ' cases, one that must pass and many that must fail');
      const specText = fs.readFileSync(path.join(root, 'SPEC.md'), 'utf8');
      ok(vec.small_order_keys.length === 8 && vec.small_order_keys.every(h => specText.includes(h)), 'SPEC.md lists the same eight small-order keys the cases file derives by arithmetic');
      const nodeBadV = cases.filter(c => L.verifySig(c.pub, c.msg, c.sig) !== c.expect).map(c => c.name);
      ok(nodeBadV.length === 0, 'Node verifier gives the required result on all ' + cases.length + ' odd Ed25519 cases' + (nodeBadV.length ? ' (differs: ' + nodeBadV.slice(0, 3).join('; ') + ')' : ''));
      const PY3 = `
import sys, json, importlib.util
spec = importlib.util.spec_from_file_location('v', sys.argv[1]); v = importlib.util.module_from_spec(spec); spec.loader.exec_module(v)
cases = json.load(open(sys.argv[2]))['cases']
print(json.dumps([v.verify_sig(c['pub'], c['msg'], c['sig']) for c in cases]))`;
      const pr = cp.spawnSync('python3', ['-c', PY3, path.join(root, 'python', 'verify.py'), path.join(root, 'vectors', 'ed25519-odd-cases.json')], { encoding: 'utf8' });
      if (pr.status !== 0) { console.log(pr.stderr); throw new Error('python odd-case run failed'); }
      const pyRes = JSON.parse(pr.stdout);
      const pyBadV = cases.filter((c, i) => pyRes[i] !== c.expect).map(c => c.name);
      ok(pyBadV.length === 0, 'Python verifier gives the required result on all ' + cases.length + ' odd Ed25519 cases' + (pyBadV.length ? ' (differs: ' + pyBadV.slice(0, 3).join('; ') + ')' : ''));
      // Rule 5 does real work: Node's own library says yes to the cases with a small-order component whose plain equation holds, and the verifier still refuses them.
      {
        const SPKI = Buffer.from('302a300506032b6570032100', 'hex');
        const libAlone = c => crypto.verify(null, Buffer.from(c.msg, 'utf8'), crypto.createPublicKey({ key: Buffer.concat([SPKI, Buffer.from(c.pub, 'hex')]), format: 'der', type: 'spki' }), Buffer.from(c.sig, 'hex'));
        const sub = cases.filter(c => /order-8 component/.test(c.name) && !c.expect && libAlone(c));
        ok(sub.length >= 2 && sub.every(c => L.verifySig(c.pub, c.msg, c.sig) === false), 'rule 5 (prime-order subgroup): ' + sub.length + ' odd cases that Node\'s own Ed25519 accepts are refused by the verifier (' + sub.map(c => c.name.slice(0, 45)).join('; ') + ')');
      }
      const vwBad = [];
      for (const c of cases) if (await V.checkSigAsync(prims, c.pub, c.msg, c.sig) !== c.expect) vwBad.push(c.name);
      ok(vwBad.length === 0, 'viewer page logic gives the required result on all ' + cases.length + ' odd Ed25519 cases' + (vwBad.length ? ' (differs: ' + vwBad.slice(0, 3).join('; ') + ')' : ''));

      // Whole logs: a key that is not allowed, with a signature that common libraries accept, must fail the whole check the same way everywhere.
      const opId = L.testIdentity('test-operator'), bobId = L.testIdentity('test-bob');
      const ID = '01' + '00'.repeat(31), ZERO_SIG = ID + '00'.repeat(32);
      const oddLog = (rec) => {
        const entries = L.makeEntries([
          { time: 1790900000, record: L.makeRecord(opId, 'genesis', { threshold: 3, comment_seconds: 1000 }) },
          { time: 1790900010, record: rec }]);
        return { format: 'cip-test-log/0', entries, checkpoints: [L.makeCheckpoint(opId, entries, 2)] };
      };
      const regOdd = key => ({ type: 'register_key', author: key, body: { public_key: key, label: 'test-odd' }, sig: ZERO_SIG });
      const logs = [
        ['identity key', oddLog(regOdd(ID)), false],
        ['non-canonical identity key (y = p + 1)', oddLog(regOdd('ee' + 'ff'.repeat(30) + '7f')), false],
        ['identity key with the sign bit set (x = 0)', oddLog(regOdd('01' + '00'.repeat(30) + '80')), false],
        ['control: an ordinary key', oddLog(L.makeRecord(bobId, 'register_key', { public_key: bobId.pub, label: 'test-bob' })), true]
      ];
      const files = logs.map(([n, l], i) => { const f = path.join(tmp, 'odd-' + i + '.json'); fs.writeFileSync(f, JSON.stringify(l)); return { log: f }; });
      const pyLogs = pythonVerify(files, tmp);
      for (let i = 0; i < logs.length; i++) {
        const [name, log, want] = logs[i], n = L.verifyLog(JSON.parse(JSON.stringify(log))), v = await V.verifyLogAsync(JSON.parse(JSON.stringify(log)), undefined, prims);
        ok(n.ok === want && deepEq(n, pyLogs[i]) && deepEq(n, v) && (want || n.integrity_errors.some(e => e.code === 'BAD_SIG' && e.index === 1)), 'whole log, ' + name + ': ' + (want ? 'passes' : 'fails with BAD_SIG at entry 1') + ', and Node, Python and the viewer give identical output');
      }
    }
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
