// CIP Phase 3 prototype: reference implementation of the test log (see prototype/SPEC.md).
// A research prototype on TEST DATA. Not a voting system. No network access, no analytics:
// it reads the files you give it and prints a result (it writes a file only when you pass
// --out to the checkpoint command). Built-in Node modules only.
//
//   node prototype/node/cip-log.js verify <log.json> [--trusted <checkpoint.json>]
//   node prototype/node/cip-log.js checkpoint <log.json> [--index N] [--out <file>]
//   node prototype/node/cip-log.js compare <checkpoint-a.json> <checkpoint-b.json>
//
// verify: exit code 0 when the log passes every check, 1 otherwise; the result is printed as JSON.
// checkpoint: checks the log's integrity, then prints (or saves) one of its checkpoints as a
//   standalone file, the last one unless --index says otherwise. Exit 1 if the log fails.
// compare: checks two checkpoints against each other (SPEC section 5.1). Exit 0 unless it reports errors.
'use strict';
const crypto = require('crypto');
const fs = require('fs');

const HEX64 = /^[0-9a-f]{64}$/;
const HEX128 = /^[0-9a-f]{128}$/;
const isHex64 = v => typeof v === 'string' && HEX64.test(v); // strict: a regex test alone would accept an array holding one hex string
const isHex128 = v => typeof v === 'string' && HEX128.test(v);
const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

// ---------- canonical JSON (the subset of RFC 8785 we need: strings, integers, arrays, objects) ----------
function canon(v) {
  if (typeof v === 'string') {
    if (LONE_SURROGATE.test(v)) throw new Error('lone surrogate');
    return JSON.stringify(v);
  }
  if (typeof v === 'number') {
    if (!Number.isSafeInteger(v)) throw new Error('not a safe integer');
    return String(v);
  }
  if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
  if (v && typeof v === 'object') {
    return '{' + Object.keys(v).sort().map(k => canon(k) + ':' + canon(v[k])).join(',') + '}';
  }
  throw new Error('type not allowed');
}
const canonOk = v => { try { canon(v); return true; } catch (e) { return false; } };

const sha256 = b => crypto.createHash('sha256').update(b).digest();
const sha256hex = s => sha256(Buffer.from(s, 'utf8')).toString('hex');

// ---------- Ed25519 helpers ----------
const SPKI = Buffer.from('302a300506032b6570032100', 'hex');
const PKCS8 = Buffer.from('302e020100300506032b657004220420', 'hex');
// SPEC section 4.2, rules 2 and 3: a public key must be a canonical encoding and not a point of small order (rule 5, below, adds the prime-order subgroup).
// Common libraries accept both kinds of key, so this check is ours, made before the library is asked.
const P25519 = (1n << 255n) - 19n;
const SMALL_ORDER = new Set([
  '01' + '00'.repeat(31), 'ec' + 'ff'.repeat(30) + '7f', '00'.repeat(32), '00'.repeat(31) + '80',
  'c7176a703d4dd84fba3c0b760d10670f2a2053fa2c39ccc64ec7fd7792ac037a', 'c7176a703d4dd84fba3c0b760d10670f2a2053fa2c39ccc64ec7fd7792ac03fa',
  '26e8958fc2b227b045c3f489f2ef98f0d5dfac05d3c63339b13802886d53fc05', '26e8958fc2b227b045c3f489f2ef98f0d5dfac05d3c63339b13802886d53fc85']);
function keyAllowed(pubHex) {
  const b = Buffer.from(pubHex, 'hex'), sign = b[31] >> 7;
  b[31] &= 0x7f;
  let y = 0n;
  for (let i = 31; i >= 0; i--) y = (y << 8n) | BigInt(b[i]);
  if (y >= P25519) return false;                          // not the canonical form of y
  if (sign && (y === 1n || y === P25519 - 1n)) return false; // x is 0 here, so a set sign bit is not allowed
  return !SMALL_ORDER.has(pubHex);
}
// SPEC section 4.2, rule 5: the public key and R must lie in the prime-order subgroup, that is, [L] times the
// point is the identity. Libraries differ on points that carry a small-order component (some check the equation
// with the cofactor, some without), so this check is ours, made after the library says yes. The point arithmetic
// is the textbook Edwards form on BigInt; results are cached because a log repeats the same few keys.
const L25519 = (1n << 252n) + 27742317777372353535851937790883648493n;
const mod25519 = x => ((x % P25519) + P25519) % P25519;
function powMod(b, e, m) { let r = 1n; b %= m; while (e > 0n) { if (e & 1n) r = r * b % m; b = b * b % m; e >>= 1n; } return r; }
const D25519 = mod25519(-121665n) * powMod(121666n, P25519 - 2n, P25519) % P25519;
const SQRT_M1 = powMod(2n, (P25519 - 1n) / 4n, P25519);
function decodePoint(hex) {                                  // null unless the 32 bytes are a canonical encoding of a curve point
  const b = Buffer.from(hex, 'hex'), sign = BigInt(b[31] >> 7);
  b[31] &= 0x7f;
  let y = 0n;
  for (let i = 31; i >= 0; i--) y = (y << 8n) | BigInt(b[i]);
  if (y >= P25519) return null;
  const y2 = y * y % P25519;
  const x2 = mod25519(y2 - 1n) * powMod((D25519 * y2 + 1n) % P25519, P25519 - 2n, P25519) % P25519;
  if (x2 === 0n) return sign ? null : [0n, y, 1n, 0n];
  let x = powMod(x2, (P25519 + 3n) / 8n, P25519);
  if (x * x % P25519 !== x2) x = x * SQRT_M1 % P25519;
  if (x * x % P25519 !== x2) return null;
  if ((x & 1n) !== sign) x = P25519 - x;
  return [x, y, 1n, x * y % P25519];
}
function edAdd(p, q) {                                       // extended coordinates, works for doubling too
  const a = mod25519((p[1] - p[0]) * (q[1] - q[0])), b = mod25519((p[1] + p[0]) * (q[1] + q[0]));
  const c = mod25519(2n * p[3] * q[3] % P25519 * D25519), d = mod25519(2n * p[2] * q[2]);
  const e = b - a, f = d - c, g = d + c, h = b + a;
  return [mod25519(e * f), mod25519(g * h), mod25519(f * g), mod25519(e * h)];
}
const subgroupMemo = new Map();
function inPrimeSubgroup(hex) {
  if (subgroupMemo.has(hex)) return subgroupMemo.get(hex);
  const pt = decodePoint(hex);
  let ok = false;
  if (pt) {
    let r = [0n, 1n, 1n, 0n], base = pt;
    for (let s = L25519; s > 0n; s >>= 1n) { if (s & 1n) r = edAdd(r, base); base = edAdd(base, base); }
    ok = r[0] === 0n && mod25519(r[1] - r[2]) === 0n;
  }
  if (subgroupMemo.size > 4096) subgroupMemo.clear();
  subgroupMemo.set(hex, ok);
  return ok;
}
function verifySig(pubHex, msg, sigHex) {
  try {
    if (!isHex64(pubHex) || !isHex128(sigHex) || !keyAllowed(pubHex)) return false;
    const key = crypto.createPublicKey({ key: Buffer.concat([SPKI, Buffer.from(pubHex, 'hex')]), format: 'der', type: 'spki' });
    return crypto.verify(null, Buffer.from(msg, 'utf8'), key, Buffer.from(sigHex, 'hex')) && inPrimeSubgroup(pubHex) && inPrimeSubgroup(sigHex.slice(0, 64));
  } catch (e) { return false; }
}
// TEST identities only: the key comes from the label, so anyone can recompute it. Never use for real.
function testIdentity(label) {
  const seed = sha256(Buffer.from('cip-test-identity:' + label, 'utf8'));
  const priv = crypto.createPrivateKey({ key: Buffer.concat([PKCS8, seed]), format: 'der', type: 'pkcs8' });
  const pub = crypto.createPublicKey(priv).export({ format: 'der', type: 'spki' }).subarray(SPKI.length).toString('hex');
  return { label, pub, sign: msg => crypto.sign(null, Buffer.from(msg, 'utf8'), priv).toString('hex') };
}

// ---------- records, entries, checkpoints ----------
const recordPayload = r => canon({ type: r.type, author: r.author, body: r.body });
function makeRecord(id, type, body) {
  const r = { type, author: id.pub, body };
  r.sig = id.sign(recordPayload(r));
  return r;
}
const entryPayload = e => canon({ index: e.index, prev: e.prev, record: e.record, time: e.time });
const entryHash = e => sha256hex(entryPayload(e));
const versionHash = (title, text) => sha256hex(canon({ title, text }));

function makeEntries(steps) { // steps: [{time, record}] -> chained entries
  const out = [];
  steps.forEach((s, i) => {
    const e = { index: i, prev: i ? out[i - 1].hash : '0'.repeat(64), time: s.time, record: s.record };
    e.hash = entryHash(e);
    out.push(e);
  });
  return out;
}

function merkleRoot(hashes) { // RFC 6962 style; leaves are the entry hashes
  const leaf = h => sha256(Buffer.concat([Buffer.from([0]), Buffer.from(h, 'hex')]));
  const go = (a, lo, hi) => {
    const n = hi - lo;
    if (n === 1) return leaf(a[lo]);
    let k = 1; while (k * 2 < n) k *= 2;
    return sha256(Buffer.concat([Buffer.from([1]), go(a, lo, lo + k), go(a, lo + k, hi)]));
  };
  return go(hashes, 0, hashes.length).toString('hex');
}
const checkpointPayload = c => canon({ operator: c.operator, root: c.root, size: c.size, time: c.time });
function makeCheckpoint(operatorId, entries, size) {
  const c = { operator: operatorId.pub, root: merkleRoot(entries.slice(0, size).map(entryHash)), size, time: entries[size - 1].time };
  c.sig = operatorId.sign(checkpointPayload(c));
  return c;
}

// ---------- verification ----------
const isInt = v => typeof v === 'number' && Number.isSafeInteger(v);
const isStr = (v, lo, hi) => typeof v === 'string' && [...v].length >= lo && [...v].length <= hi;
const keysAre = (o, ks) => o && typeof o === 'object' && !Array.isArray(o) && Object.keys(o).sort().join() === ks.slice().sort().join();

function entryFormatOk(e) {
  return keysAre(e, ['index', 'prev', 'time', 'record', 'hash']) && isInt(e.index) && isHex64(e.prev) &&
    isInt(e.time) && e.time >= 0 && isHex64(e.hash) &&
    keysAre(e.record, ['type', 'author', 'body', 'sig']) && typeof e.record.type === 'string' &&
    isHex64(e.record.author) && isHex128(e.record.sig) &&
    e.record.body && typeof e.record.body === 'object' && !Array.isArray(e.record.body) && canonOk(e.record.body);
}
function bodyOk(type, b) {
  switch (type) {
    case 'genesis': return keysAre(b, ['threshold', 'comment_seconds']) && isInt(b.threshold) && b.threshold >= 1 && isInt(b.comment_seconds) && b.comment_seconds >= 0;
    case 'register_key': return keysAre(b, ['public_key', 'label']) && isHex64(b.public_key) && isStr(b.label, 1, 40);
    case 'propose': return keysAre(b, ['title', 'text']) && isStr(b.title, 1, 120) && isStr(b.text, 1, 20000);
    case 'amend': return keysAre(b, ['proposal', 'title', 'text']) && isHex64(b.proposal) && isStr(b.title, 1, 120) && isStr(b.text, 1, 20000);
    case 'sign': return keysAre(b, ['proposal', 'version']) && isHex64(b.proposal) && isHex64(b.version);
    case 'comment': return keysAre(b, ['proposal', 'text']) && isHex64(b.proposal) && isStr(b.text, 1, 2000);
    default: return false;
  }
}
const stateOf = (p, settings, now) => {
  if (p.sigs.size < settings.threshold) return 'collecting';
  return now < p.thresholdTime + settings.comment_seconds ? 'comment' : 'closed';
};

function cpChecks(prefix, c, operator, entries, hashes, out, where, index) {
  const err = code => out.push({ code: prefix + code, where, index });
  if (!keysAre(c, ['operator', 'root', 'size', 'time', 'sig']) || !isHex64(c.operator) || !isHex64(c.root) || !isInt(c.size) || !isInt(c.time) || !isHex128(c.sig)) return err('BAD_FORMAT');
  if (c.operator !== operator) err('WRONG_OPERATOR');
  if (!verifySig(c.operator, checkpointPayload(c), c.sig)) err('BAD_SIG');
  if (prefix === 'CP_') {
    if (c.size < 1 || c.size > entries.length) return err('BAD_SIZE');
    if (merkleRoot(hashes.slice(0, c.size)) !== c.root) err('BAD_ROOT');
  } else { // trusted checkpoint
    if (c.size < 1 || c.size > entries.length) return err('TRUNCATED');
    if (merkleRoot(hashes.slice(0, c.size)) !== c.root) err('MISMATCH');
  }
}

// Compares two saved checkpoints with no log at all (SPEC section 5.1). Two checkpoints that carry the
// same operator signature, the same size and different roots are proof the operator signed two
// histories. Checkpoints of different sizes cannot be compared without the log.
const cpShapeOk = c => keysAre(c, ['operator', 'root', 'size', 'time', 'sig']) && isHex64(c.operator) && isHex64(c.root) && isInt(c.size) && isInt(c.time) && isHex128(c.sig);
function compareCheckpoints(a, b) {
  const res = { ok: false, errors: [], relation: null, operator: null };
  const err = (code, where) => res.errors.push({ code, where });
  const cs = [['a', a], ['b', b]], usable = [];
  cs.forEach(([w, c]) => { if (!cpShapeOk(c)) err('CMP_BAD_FORMAT', w); else usable.push([w, c]); });
  if (usable.length === 2 && a.operator !== b.operator) err('CMP_DIFFERENT_OPERATOR', 'both');
  usable.forEach(([w, c]) => { if (!verifySig(c.operator, checkpointPayload(c), c.sig)) err('CMP_BAD_SIG', w); });
  if (res.errors.length === 0) {
    res.operator = a.operator;
    if (a.size !== b.size) res.relation = 'different-size';
    else if (a.root === b.root) res.relation = 'identical';
    else { res.relation = 'conflict'; err('CMP_CONFLICT', 'both'); }
  }
  res.ok = res.errors.length === 0;
  return res;
}

// True when a whole log has the right SHAPE (SPEC sections 1 to 5): keys, types, lengths. The reference
// that prototype/schema/cip-test-log.schema.json is tested against. It says nothing about hashes,
// signatures, the chain or the rules of section 6.
const shapeOk = log => keysAre(log, ['format', 'entries', 'checkpoints']) && log.format === 'cip-test-log/0' &&
  Array.isArray(log.entries) && Array.isArray(log.checkpoints) &&
  log.entries.every(e => entryFormatOk(e) && bodyOk(e.record.type, e.record.body)) && log.checkpoints.every(cpShapeOk);

function verifyLog(log, trusted) {
  const res = { ok: false, integrity_errors: [], rule_errors: [], summary: null };
  if (!keysAre(log, ['format', 'entries', 'checkpoints']) || log.format !== 'cip-test-log/0' || !Array.isArray(log.entries) || !Array.isArray(log.checkpoints)) {
    res.integrity_errors.push({ code: 'BAD_FORMAT', where: 'log', index: 0 });
    return res;
  }
  const E = log.entries, IE = res.integrity_errors, RE = res.rule_errors;
  const bad = new Set(); // entries with an integrity error: skipped by the rules pass
  const hashes = [];
  E.forEach((e, i) => {
    const flag = code => { IE.push({ code, where: 'entry', index: i }); bad.add(i); };
    const fmt = entryFormatOk(e);
    if (!fmt) { flag('BAD_FORMAT'); hashes.push('0'.repeat(64)); }
    else {
      if (e.index !== i) flag('BAD_INDEX');
      if (e.prev !== (i ? (E[i - 1] && E[i - 1].hash) : '0'.repeat(64))) flag('BAD_PREV');
      const h = entryHash(e); hashes.push(h);
      if (h !== e.hash) flag('BAD_HASH');
      if (!verifySig(e.record.author, recordPayload(e.record), e.record.sig)) flag('BAD_SIG');
    }
  });
  const g = E[0] && E[0].record && E[0].record.type === 'genesis' && isHex64(E[0].record.author || '') ? E[0].record.author : null;
  log.checkpoints.forEach((c, j) => cpChecks('CP_', c, g, E, hashes, IE, 'checkpoint', j));
  if (trusted !== undefined) cpChecks('TRUSTED_', trusted, g, E, hashes, IE, 'trusted', 0);

  // rules pass
  const keys = new Set(), proposals = new Map(), order = [];
  let settings = null, lastTime = 0, comments = 0, registered = 0;
  E.forEach((e, i) => {
    if (bad.has(i)) return;
    const err = code => RE.push({ code, where: 'entry', index: i });
    const r = e.record;
    if (i > 0 && E[i - 1] && isInt(E[i - 1].time) && e.time < E[i - 1].time) err('TIME_REVERSED');
    lastTime = e.time;
    if (i === 0) { if (r.type !== 'genesis') { err('NO_GENESIS'); } }
    else if (r.type === 'genesis') return err('DUPLICATE_GENESIS');
    if (!bodyOk(r.type, r.body)) return err('BAD_BODY');
    const b = r.body;
    if (r.type === 'genesis') { if (i === 0) { settings = { threshold: b.threshold, comment_seconds: b.comment_seconds }; keys.add(r.author); } return; }
    if (!settings) return;
    if (r.type === 'register_key') {
      if (b.public_key !== r.author) return err('SELF_REGISTER_MISMATCH');
      if (keys.has(b.public_key)) return err('DUPLICATE_KEY');
      if (!b.label.startsWith('test-')) return err('BAD_LABEL');
      keys.add(b.public_key); registered++;
      return;
    }
    if (!keys.has(r.author)) return err('UNREGISTERED_AUTHOR');
    if (r.type === 'propose') {
      const id = hashes[i];
      proposals.set(id, { author: r.author, title: b.title, versions: [versionHash(b.title, b.text)], sigs: new Set(), thresholdTime: null });
      order.push(id);
      return;
    }
    const p = proposals.get(b.proposal);
    if (!p) return err('UNKNOWN_PROPOSAL');
    if (stateOf(p, settings, e.time) === 'closed') return err('PROPOSAL_CLOSED');
    if (r.type === 'amend') {
      if (r.author !== p.author) return err('NOT_PROPOSER');
      p.versions.push(versionHash(b.title, b.text)); p.title = b.title; p.sigs = new Set(); p.thresholdTime = null;
    } else if (r.type === 'sign') {
      if (b.version !== p.versions[p.versions.length - 1]) return err('STALE_VERSION');
      if (p.sigs.has(r.author)) return err('DUPLICATE_SIGNATURE');
      p.sigs.add(r.author);
      if (p.sigs.size === settings.threshold) p.thresholdTime = e.time;
    } else if (r.type === 'comment') comments++;
  });
  if (settings) {
    res.summary = {
      entries: E.length, registered, comments,
      proposals: order.map(id => {
        const p = proposals.get(id);
        return { id, title: p.title, versions: p.versions.length, version: p.versions[p.versions.length - 1], signatures: p.sigs.size, state: stateOf(p, settings, lastTime) };
      })
    };
  }
  res.ok = IE.length === 0 && RE.length === 0;
  return res;
}

// Picks one checkpoint out of a log that has no integrity errors, ready to save as its own file.
function extractCheckpoint(log, index) {
  const r = verifyLog(log);
  if (r.integrity_errors.length) return { error: 'the log has integrity errors, so no checkpoint was taken from it', details: r.integrity_errors };
  const cps = log.checkpoints;
  if (!cps.length) return { error: 'the log holds no checkpoints' };
  const i = index === undefined ? cps.length - 1 : index;
  if (!Number.isInteger(i) || i < 0 || i >= cps.length) return { error: 'there is no checkpoint at position ' + index + ' (the log holds ' + cps.length + ', numbered from 0)' };
  return { checkpoint: cps[i], index: i, ruleErrors: r.rule_errors.length };
}
const formatCheckpoint = c => JSON.stringify(c, null, 1) + '\n'; // same layout as the files in testdata/

if (require.main === module) {
  const a = process.argv.slice(2);
  const usage = () => { console.error('usage:\n  node cip-log.js verify <log.json> [--trusted <checkpoint.json>]\n  node cip-log.js checkpoint <log.json> [--index N] [--out <file>]\n  node cip-log.js compare <checkpoint-a.json> <checkpoint-b.json>'); process.exit(2); };
  const read = f => JSON.parse(fs.readFileSync(f, 'utf8'));
  const opt = n => { const i = a.indexOf(n); return i > 0 ? a[i + 1] : undefined; };
  if (a[0] === 'verify' && a[1]) {
    const ti = a.indexOf('--trusted');
    const result = verifyLog(read(a[1]), ti > 0 ? read(a[ti + 1]) : undefined);
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.ok ? 0 : 1);
  } else if (a[0] === 'checkpoint' && a[1]) {
    const ix = opt('--index'), out = opt('--out');
    if (a.includes('--index') && !/^\d+$/.test(ix || '')) usage();
    if (a.includes('--out') && !out) usage();
    const r = extractCheckpoint(read(a[1]), ix === undefined ? undefined : Number(ix));
    if (r.error) { console.error('not saved: ' + r.error); if (r.details) console.error(JSON.stringify(r.details)); process.exit(1); }
    if (r.ruleErrors) console.error('note: the log breaks ' + r.ruleErrors + ' rule(s); run verify to see them. The checkpoint itself is intact.');
    if (out) { fs.writeFileSync(out, formatCheckpoint(r.checkpoint)); console.error('saved checkpoint ' + r.index + ' (size ' + r.checkpoint.size + ') to ' + out); }
    else process.stdout.write(formatCheckpoint(r.checkpoint));
    process.exit(0);
  } else if (a[0] === 'compare' && a[1] && a[2]) {
    const result = compareCheckpoints(read(a[1]), read(a[2]));
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.ok ? 0 : 1);
  } else usage();
}
module.exports = { verifySig, canon, sha256hex, testIdentity, makeRecord, makeEntries, makeCheckpoint, entryHash, versionHash, merkleRoot, verifyLog, compareCheckpoints, extractCheckpoint, formatCheckpoint, shapeOk };
