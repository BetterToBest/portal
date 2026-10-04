// Builds the example files for prototype/schema/ from the good test log and fixed test identities,
// so the output is identical on every run.
//   node prototype/node/make-schema-examples.js            write the files
//   node prototype/node/make-schema-examples.js --check    fail if the committed files differ
//
// "valid" means the SHAPE is right (keys, types, lengths). Examples made by editing a signed record
// carry the old signature, which is fine here: the schema does not check signatures.
// Each invalid example is listed with the error the schema checker must report (JSON path and keyword).
'use strict';
const fs = require('fs');
const path = require('path');
const L = require('./cip-log.js');

const dir = path.join(__dirname, '..', 'schema', 'examples');
const good = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'testdata', 'good.json'), 'utf8'));
const E = good.entries;
const clone = o => JSON.parse(JSON.stringify(o));
const edit = (o, f) => { const x = clone(o); f(x); return x; };
const SAFE_PLUS_1 = '9007199254740992'; // 2^53, one past the safe range
const pretty = v => JSON.stringify(v, null, 1) + '\n';

const files = {};      // relative path -> text
const expected = {};   // invalid file name -> { path, keyword }
const valid = (name, v) => { files['valid/' + name + '.json'] = typeof v === 'string' ? v : pretty(v); };
const invalid = (name, v, p, keyword) => { files['invalid/' + name + '.json'] = typeof v === 'string' ? v : pretty(v); expected[name + '.json'] = { path: p, keyword }; };

const rec = type => clone(E.find(e => e.record.type === type).record);
const alice = L.testIdentity('test-alice');

// ----- valid -----
['genesis', 'register_key', 'propose', 'amend', 'sign', 'comment'].forEach(t => valid('record-' + t.replace('_', '-'), rec(t)));
valid('entry-genesis', clone(E[0]));
valid('entry-sign', clone(E.find(e => e.record.type === 'sign')));
valid('checkpoint-size-10', clone(good.checkpoints[0]));
valid('log-minimal', { format: 'cip-test-log/0', entries: [clone(E[0])], checkpoints: [] });
valid('log-empty', { format: 'cip-test-log/0', entries: [], checkpoints: [] });
// Lengths count characters (code points), not UTF-16 units: 120 astral characters is exactly the limit.
valid('record-propose-120-astral-chars', L.makeRecord(alice, 'propose', { title: '\u{1F3DB}'.repeat(120), text: 'x' }));
valid('record-propose-text-20000', L.makeRecord(alice, 'propose', { title: 'Longest text', text: 'x'.repeat(20000) }));
valid('record-comment-control-chars', L.makeRecord(alice, 'comment', { proposal: '1'.repeat(64), text: 'line one\nline two\t\u0001 end' }));
// A whole number written as 3.0 is the integer 3 (SPEC section 2); JSON.stringify cannot write it, so edit the text.
valid('record-genesis-integer-written-3.0', pretty(rec('genesis')).replace(/"threshold": (\d+)/, '"threshold": $1.0'));

// ----- invalid: records -----
const R = rec('genesis'), P = rec('propose'), S = rec('sign'), C = rec('comment'), K = rec('register_key'), A = rec('amend');
invalid('record-unknown-type', edit(R, r => { r.type = 'vote'; }), '/type', 'enum');
invalid('record-extra-key', edit(R, r => { r.extra = 1; }), '/extra', 'additionalProperties');
invalid('record-missing-sig', edit(R, r => { delete r.sig; }), '', 'required');
invalid('record-sig-127-hex', edit(R, r => { r.sig = r.sig.slice(1); }), '/sig', 'pattern');
invalid('record-author-uppercase', edit(R, r => { r.author = r.author.toUpperCase(); }), '/author', 'pattern');
invalid('record-author-trailing-newline', edit(R, r => { r.author += '\n'; }), '/author', 'pattern');
invalid('record-body-is-array', edit(R, r => { r.body = [r.body]; }), '/body', 'type');
invalid('record-body-wrong-shape', edit(P, r => { r.body = clone(S.body); }), '/body', 'required');
invalid('record-genesis-threshold-zero', edit(R, r => { r.body.threshold = 0; }), '/body/threshold', 'minimum');
invalid('record-genesis-threshold-fraction', edit(R, r => { r.body.threshold = 1.5; }), '/body/threshold', 'type');
invalid('record-genesis-threshold-true', edit(R, r => { r.body.threshold = true; }), '/body/threshold', 'type');
invalid('record-genesis-threshold-string', edit(R, r => { r.body.threshold = '3'; }), '/body/threshold', 'type');
invalid('record-genesis-threshold-null', edit(R, r => { r.body.threshold = null; }), '/body/threshold', 'type');
invalid('record-genesis-threshold-too-large', pretty(R).replace(/"threshold": \d+/, '"threshold": ' + SAFE_PLUS_1), '/body/threshold', 'maximum');
invalid('record-genesis-comment-seconds-negative', edit(R, r => { r.body.comment_seconds = -1; }), '/body/comment_seconds', 'minimum');
invalid('record-register-key-label-empty', edit(K, r => { r.body.label = ''; }), '/body/label', 'minLength');
invalid('record-register-key-label-41-chars', edit(K, r => { r.body.label = 'test-' + 'x'.repeat(36); }), '/body/label', 'maxLength');
invalid('record-propose-title-empty', edit(P, r => { r.body.title = ''; }), '/body/title', 'minLength');
invalid('record-propose-title-121-astral-chars', edit(P, r => { r.body.title = '\u{1F3DB}'.repeat(121); }), '/body/title', 'maxLength');
invalid('record-propose-text-20001', edit(P, r => { r.body.text = 'x'.repeat(20001); }), '/body/text', 'maxLength');
invalid('record-propose-text-lone-surrogate', edit(P, r => { r.body.text = '\ud800'; }), '/body/text', 'pattern');
invalid('record-amend-proposal-short', edit(A, r => { r.body.proposal = r.body.proposal.slice(1); }), '/body/proposal', 'pattern');
invalid('record-sign-version-uppercase', edit(S, r => { r.body.version = r.body.version.toUpperCase(); }), '/body/version', 'pattern');
invalid('record-comment-text-2001', edit(C, r => { r.body.text = 'x'.repeat(2001); }), '/body/text', 'maxLength');

// ----- invalid: entries -----
const EN = clone(E[0]);
invalid('entry-time-negative', edit(EN, e => { e.time = -1; }), '/time', 'minimum');
invalid('entry-time-too-large', pretty(EN).replace(/"time": \d+/, '"time": ' + SAFE_PLUS_1), '/time', 'maximum');
invalid('entry-index-string', edit(EN, e => { e.index = '0'; }), '/index', 'type');
invalid('entry-extra-key', edit(EN, e => { e.note = 'hello'; }), '/note', 'additionalProperties');
invalid('entry-missing-hash', edit(EN, e => { delete e.hash; }), '', 'required');
invalid('entry-prev-short', edit(EN, e => { e.prev = e.prev.slice(1); }), '/prev', 'pattern');
invalid('entry-record-bad-sig', edit(EN, e => { e.record.sig = e.record.sig.slice(1); }), '/record/sig', 'pattern');

// ----- invalid: checkpoints -----
const CP = clone(good.checkpoints[0]);
invalid('checkpoint-size-fraction', edit(CP, c => { c.size = 10.5; }), '/size', 'type');
invalid('checkpoint-time-string', edit(CP, c => { c.time = '1790900000'; }), '/time', 'type');
invalid('checkpoint-missing-sig', edit(CP, c => { delete c.sig; }), '', 'required');
invalid('checkpoint-extra-key', edit(CP, c => { c.extra = 1; }), '/extra', 'additionalProperties');
invalid('checkpoint-root-short', edit(CP, c => { c.root = c.root.slice(1); }), '/root', 'pattern');

// ----- invalid: whole logs -----
const LOG = { format: 'cip-test-log/0', entries: [clone(E[0])], checkpoints: [clone(good.checkpoints[0])] };
invalid('log-format-wrong', edit(LOG, l => { l.format = 'cip-test-log/1'; }), '/format', 'const');
invalid('log-extra-key', edit(LOG, l => { l.notes = []; }), '/notes', 'additionalProperties');
invalid('log-missing-checkpoints', edit(LOG, l => { delete l.checkpoints; }), '', 'required');
invalid('log-entries-not-array', edit(LOG, l => { l.entries = {}; }), '/entries', 'type');
invalid('log-entry-bad-hash', edit(LOG, l => { l.entries[0].hash = 'abc'; }), '/entries/0/hash', 'pattern');
invalid('log-checkpoint-bad-size', edit(LOG, l => { l.checkpoints[0].size = 1.5; }), '/checkpoints/0/size', 'type');

files['expected-errors.json'] = pretty(expected);

if (require.main === module) {
  if (process.argv.includes('--check')) {
    let bad = 0;
    for (const [f, text] of Object.entries(files)) {
      const p = path.join(dir, f);
      if (!fs.existsSync(p) || fs.readFileSync(p, 'utf8') !== text) { bad++; console.log('DIFFERS', f); }
    }
    for (const sub of ['valid', 'invalid']) {
      const d = path.join(dir, sub);
      if (fs.existsSync(d)) for (const f of fs.readdirSync(d)) if (!files[sub + '/' + f]) { bad++; console.log('NOT GENERATED', sub + '/' + f); }
    }
    process.exit(bad ? 1 : 0);
  }
  for (const [f, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, f)), { recursive: true });
    fs.writeFileSync(path.join(dir, f), text);
  }
  console.log('wrote ' + Object.keys(files).length + ' files to ' + dir);
}
module.exports = { files, expected };
