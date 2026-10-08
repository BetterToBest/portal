// Runs the 40 odd Ed25519 cases (../ed25519-odd-cases.json) through Ed25519 libraries that do not use
// OpenSSL or BoringSSL, and prints a JSON result to standard output. Evidence only: no verifier in
// this repository uses these libraries. Run from this folder after installing them (see README.md):
//   node run.js > node-results.json
'use strict';
const fs = require('fs');
const path = require('path');
const cases = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'ed25519-odd-cases.json'), 'utf8')).cases;
const hex = h => Uint8Array.from(Buffer.from(h, 'hex'));
const enc = s => new TextEncoder().encode(s);
const version = n => JSON.parse(fs.readFileSync(path.join(process.cwd(), 'node_modules', n, 'package.json'), 'utf8')).version;

(async () => {
  const versions = {}, libs = {};
  const nacl = require('tweetnacl'); versions.tweetnacl = version('tweetnacl');
  libs['tweetnacl'] = (p, m, s) => nacl.sign.detached.verify(enc(m), s, p);
  const sodium = require('libsodium-wrappers'); await sodium.ready; versions['libsodium-wrappers'] = version('libsodium-wrappers');
  libs['libsodium-wrappers'] = (p, m, s) => sodium.crypto_sign_verify_detached(s, enc(m), p);
  const { ed25519 } = require('@noble/curves/ed25519.js'); versions['@noble/curves'] = version('@noble/curves');
  libs['@noble/curves, default'] = (p, m, s) => ed25519.verify(s, enc(m), p);
  libs['@noble/curves, zip215 off'] = (p, m, s) => ed25519.verify(s, enc(m), p, { zip215: false });
  const EdDSA = require('elliptic').eddsa; const ec = new EdDSA('ed25519'); versions.elliptic = version('elliptic');
  libs['elliptic'] = (p, m, s) => ec.verify(Array.from(enc(m)), Array.from(s), Array.from(p));
  const noble = await import('@noble/ed25519'); versions['@noble/ed25519'] = version('@noble/ed25519');
  libs['@noble/ed25519, default'] = (p, m, s) => noble.verifyAsync(s, enc(m), p);
  libs['@noble/ed25519, zip215 off'] = (p, m, s) => noble.verifyAsync(s, enc(m), p, { zip215: false });

  const results = {};
  for (const [name, f] of Object.entries(libs)) {
    results[name] = [];
    for (const c of cases) {
      let r; try { r = !!(await f(hex(c.pub), c.msg, hex(c.sig))); } catch (e) { r = false; }   // an exception counts as "refused"
      results[name].push(r);
    }
  }
  process.stdout.write(JSON.stringify({ versions, results }) + '\n');
})();
