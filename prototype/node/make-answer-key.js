// Builds prototype/answer-key/expected.json: for every shared test log, the exact result a
// verifier must print (SPEC section 7), in one language-neutral file. A reviewer writing a third
// verifier can compare against this file without running any program from this repository.
//   node prototype/node/make-answer-key.js            write the file
//   node prototype/node/make-answer-key.js --check    fail if the committed file differs
// The file is produced by the Node reference verifier. The test suite also checks it against the
// Python verifier, the browser viewer and a hand-written table of expected error codes, so it is
// not just one program agreeing with itself. Test data only.
'use strict';
const fs = require('fs');
const path = require('path');
const L = require('./cip-log.js');

const proto = path.join(__dirname, '..');
const out = path.join(proto, 'answer-key', 'expected.json');
const CP = 'testdata/good.checkpoint-21.json';

// [log file, trusted checkpoint or null, what the case shows]
const CASES = [
  ['good.json', CP, 'a valid log, checked against a saved checkpoint'],
  ['good.json', null, 'the same valid log with no saved checkpoint'],
  ['rule-ok-new-signer.json', null, 'valid: a new signer is registered, then signs'],
  ['unicode.json', null, 'valid: non-ASCII text, which must canonicalize identically in every language'],
  ['tamper-text.json', null, 'a proposal text edited after signing'],
  ['delete-entry.json', null, 'an entry removed'],
  ['reorder.json', null, 'two entries swapped'],
  ['forged-sig.json', null, 'a signature that does not match its author'],
  ['tamper-time.json', null, 'a time edited after hashing'],
  ['bad-format.json', null, 'a malformed entry'],
  ['bad-checkpoint.json', null, 'a checkpoint with a wrong signature and root'],
  ['rewritten-history.json', CP, 'a clean-looking rewrite, caught only by the saved checkpoint'],
  ['rewritten-history.json', null, 'the same rewrite with no saved checkpoint: passes, which is the limit of the chain alone'],
  ['truncated.json', CP, 'a log cut short, caught only by the saved checkpoint'],
  ['truncated.json', null, 'the same cut log with no saved checkpoint: passes'],
  ['rule-late-sign.json', null, 'a signature after the comment period closed'],
  ['rule-unregistered.json', null, 'a record from a key that was never registered'],
  ['rule-duplicate-sig.json', null, 'the same person signing twice'],
  ['rule-stale-version.json', null, 'a signature on an old version of a proposal'],
  ['rule-not-proposer.json', null, 'an amendment by someone other than the proposer'],
  ['rule-bad-label.json', null, 'a key registered with a label that breaks the rules'],
  ['rule-time-reversed.json', null, 'an entry dated before the one before it'],
  ['rule-unknown-proposal.json', null, 'a signature on a proposal that does not exist'],
];

function build() {
  const readJson = f => JSON.parse(fs.readFileSync(path.join(proto, f), 'utf8'));
  return {
    format: 'cip-answer-key/0',
    about: 'The result every verifier must print for each shared test log (SPEC section 7). Paths are relative to the prototype/ folder. Compare as JSON values: key order does not matter. exit_code is what the command line returns (0 when ok, 1 otherwise). Test data only.',
    cases: CASES.map(([log, trusted, note]) => {
      const result = L.verifyLog(readJson('testdata/' + log), trusted ? readJson(trusted) : undefined);
      return {
        log: 'testdata/' + log,
        trusted: trusted,
        note: note,
        exit_code: result.ok ? 0 : 1,
        expect: result,
      };
    }),
  };
}

function main(argv) {
  const text = JSON.stringify(build(), null, 1) + '\n';
  if (argv.includes('--check')) {
    const have = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : null;
    if (have !== text) { console.log('OUT OF DATE: ' + path.normalize(out)); return 1; }
    console.log('ok: ' + path.normalize(out));
    return 0;
  }
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, text);
  console.log('wrote ' + path.normalize(out));
  return 0;
}

process.exit(main(process.argv.slice(2)));
