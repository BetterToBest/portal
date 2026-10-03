// Builds the shared test logs in prototype/testdata/ from nothing but fixed test identities
// and fixed times, so the output is identical on every run (Ed25519 signatures are deterministic).
//   node prototype/node/make-test-logs.js            write the files
//   node prototype/node/make-test-logs.js --check    fail if the committed files differ
'use strict';
const fs = require('fs');
const path = require('path');
const L = require('./cip-log.js');

const dir = path.join(__dirname, '..', 'testdata');
const T0 = 1790900000, COMMENT = 1000, THRESHOLD = 3;
const id = {}; ['test-operator', 'test-alice', 'test-bob', 'test-carol', 'test-dave', 'test-erin'].forEach(l => { id[l.slice(5)] = L.testIdentity(l); });
const op = id.operator;
const rec = (who, type, body) => L.makeRecord(id[who], type, body);
const reg = who => rec(who, 'register_key', { public_key: id[who].pub, label: 'test-' + who });
const step = (time, record) => ({ time, record });
const pid = (steps, n) => L.entryHash({ index: n, prev: n ? L.makeEntries(steps.slice(0, n))[n - 1].hash : '0'.repeat(64), time: steps[n].time, record: steps[n].record });

const P1 = { title: 'Open the budget meetings', text: 'All budget meetings are open to the public and the minutes are posted within 7 days.' };
const P1b = { title: 'Open the budget meetings', text: 'All budget meetings are open to the public and the minutes are posted within 5 days.' };

function goodSteps() {
  const s = [];
  const add = (t, r) => s.push(step(t, r));
  add(T0, rec('operator', 'genesis', { threshold: THRESHOLD, comment_seconds: COMMENT }));
  ['alice', 'bob', 'carol', 'dave'].forEach((w, i) => add(T0 + 10 + i, reg(w)));              // 1-4
  add(T0 + 100, rec('alice', 'propose', P1));                                                  // 5
  const p1 = pid(s, 5), v1 = L.versionHash(P1.title, P1.text), v2 = L.versionHash(P1b.title, P1b.text);
  ['alice', 'bob', 'carol'].forEach((w, i) => add(T0 + 110 + i, rec(w, 'sign', { proposal: p1, version: v1 }))); // 6-8: threshold at T0+112
  add(T0 + 200, rec('dave', 'comment', { proposal: p1, text: 'Seven days is too slow for urgent items.' })); // 9
  add(T0 + 300, rec('alice', 'amend', { proposal: p1, title: P1b.title, text: P1b.text }));    // 10: signatures reset
  ['alice', 'bob', 'carol'].forEach((w, i) => add(T0 + 310 + i, rec(w, 'sign', { proposal: p1, version: v2 }))); // 11-13: threshold at T0+312
  add(T0 + 400, rec('dave', 'comment', { proposal: p1, text: 'Five days works for me.' }));      // 14
  add(T0 + 500, rec('bob', 'propose', { title: 'Publish the road repair list', text: 'The city posts its road repair list every quarter.' })); // 15
  add(T0 + 510, rec('carol', 'sign', { proposal: pid(s, 15), version: L.versionHash('Publish the road repair list', 'The city posts its road repair list every quarter.') })); // 16
  add(T0 + 1400, rec('carol', 'propose', { title: 'Free bus passes for students', text: 'Students ride the city bus for free during the school year.' })); // 17
  const p3 = pid(s, 17), v3 = L.versionHash('Free bus passes for students', 'Students ride the city bus for free during the school year.');
  ['carol', 'dave', 'alice'].forEach((w, i) => add(T0 + 1410 + i, rec(w, 'sign', { proposal: p3, version: v3 }))); // 18-20: threshold T0+1412
  add(T0 + 1500, reg('erin'));                                                                  // 21: later registration; "now" = T0+1500
  return s; // p1 closed (T0+1312), p2 collecting, p3 in comment (until T0+2412)
}
const cps = (steps, sizes) => { const e = L.makeEntries(steps); return sizes.map(n => L.makeCheckpoint(op, e, n)); };
const logOf = (steps, sizes) => ({ format: 'cip-test-log/0', entries: L.makeEntries(steps), checkpoints: cps(steps, sizes) });
const rechain = (entries, sizes) => { // rebuild index, prev, hash and checkpoints after editing records or order
  const steps = entries.map(e => ({ time: e.time, record: e.record }));
  return logOf(steps, sizes);
};

const out = {};
const good = goodSteps();
out['good.json'] = logOf(good, [10, 12, good.length]);
out['good.checkpoint-21.json'] = cps(good, [21])[0]; // what a watcher saved before the last entry was added

// ----- integrity failures: edits made without the operator's help (no re-chaining) -----
const clone = o => JSON.parse(JSON.stringify(o));
let m = clone(out['good.json']); m.entries[5].record.body.text = m.entries[5].record.body.text.replace('7 days', '70 days'); out['tamper-text.json'] = m;
m = clone(out['good.json']); m.entries.splice(9, 1); out['delete-entry.json'] = m;
m = clone(out['good.json']); [m.entries[6], m.entries[7]] = [m.entries[7], m.entries[6]]; out['reorder.json'] = m;
m = clone(out['good.json']); m.entries[7].record.sig = m.entries[6].record.sig; out['forged-sig.json'] = m;
m = clone(out['good.json']); m.entries[9].time = T0 + 250; out['tamper-time.json'] = m;
m = clone(out['good.json']); m.entries[3].record.body.threshold = 1.5; out['bad-format.json'] = m;
m = clone(out['good.json']); m.checkpoints[1].root = '0'.repeat(64); out['bad-checkpoint.json'] = m;

// ----- the operator rewrites history: re-chained and re-signed, so only a trusted older checkpoint exposes it -----
let g = good.slice(); g.splice(20, 1); out['rewritten-history.json'] = logOf(g, [10, g.length]); // drops alice's signature on the third proposal (entry 20): it falls below the threshold
out['truncated.json'] = logOf(good.slice(0, 18), [10, 18]);                                      // cuts the log back to 18 entries

// ----- rule violations: every record is signed and chained correctly -----
const variant = (edit, label) => { const s = good.slice(); edit(s); out[label] = logOf(s, [s.length]); };
const p1id = pid(good, 5), v1 = L.versionHash(P1.title, P1.text), v2 = L.versionHash(P1b.title, P1b.text);
variant(s => s.push(step(T0 + 1600, rec('bob', 'propose', { title: '\u{1F3DB} Open budgets, caf\u00e9 \u65e5\u672c\u8a9e', text: 'Quote \" backslash \\ tab\t newline\n control \u0001 del \u007f line-sep \u2028 astral \u{1F3DB} accents \u00e9\u00fc' }))), 'unicode.json'); // strings the two verifiers must canonicalize identically
variant(s => s.push(step(T0 + 1600, rec('bob', 'sign', { proposal: p1id, version: v2 }))), 'rule-late-sign.json');                 // after p1 closed (and a duplicate)
variant(s => s.push(step(T0 + 1600, rec('erin', 'sign', { proposal: pid(good, 15), version: L.versionHash('Publish the road repair list', 'The city posts its road repair list every quarter.') }))), 'rule-ok-new-signer.json'); // erin signs p2: valid
variant(s => s.push(step(T0 + 1600, L.makeRecord(L.testIdentity('test-mallory'), 'comment', { proposal: pid(good, 15), text: 'Hello' }))), 'rule-unregistered.json');
variant(s => s.push(step(T0 + 1600, rec('dave', 'sign', { proposal: pid(good, 15), version: L.versionHash('Publish the road repair list', 'The city posts its road repair list every quarter.') })), step(T0 + 1601, rec('dave', 'sign', { proposal: pid(good, 15), version: L.versionHash('Publish the road repair list', 'The city posts its road repair list every quarter.') }))), 'rule-duplicate-sig.json');
variant(s => s.push(step(T0 + 1600, rec('carol', 'sign', { proposal: pid(good, 15), version: v1 }))), 'rule-stale-version.json');
variant(s => s.push(step(T0 + 1600, rec('carol', 'amend', { proposal: pid(good, 15), title: 'Hijacked', text: 'Changed by someone else.' }))), 'rule-not-proposer.json');
variant(s => { s.splice(2, 1, step(T0 + 11, rec('bob', 'register_key', { public_key: id.bob.pub, label: 'bob' }))); }, 'rule-bad-label.json');
variant(s => s.push(step(T0 + 1400, rec('dave', 'comment', { proposal: pid(good, 15), text: 'Back in time' }))), 'rule-time-reversed.json');
variant(s => s.push(step(T0 + 1600, rec('dave', 'comment', { proposal: '1'.repeat(64), text: 'On nothing' }))), 'rule-unknown-proposal.json');

if (process.argv.includes('--check')) {
  let bad = 0;
  for (const [f, v] of Object.entries(out)) {
    const want = JSON.stringify(v, null, 1) + '\n';
    const have = fs.existsSync(path.join(dir, f)) ? fs.readFileSync(path.join(dir, f), 'utf8') : null;
    if (want !== have) { bad++; console.log('DIFFERS', f); }
  }
  process.exit(bad ? 1 : 0);
}
fs.mkdirSync(dir, { recursive: true });
for (const [f, v] of Object.entries(out)) fs.writeFileSync(path.join(dir, f), JSON.stringify(v, null, 1) + '\n');
console.log('wrote', Object.keys(out).length, 'files to', dir);
