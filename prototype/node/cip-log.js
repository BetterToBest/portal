// CIP Phase 3 prototype: reference implementation of the test log (see prototype/SPEC.md).
// A research prototype on TEST DATA. Not a voting system. No network access, no storage,
// no analytics: it reads a file you give it and prints a result. Built-in Node modules only.
//
//   node prototype/node/cip-log.js verify <log.json> [--trusted <checkpoint.json>]
//
// Exit code 0 when the log passes every check, 1 otherwise. The result is printed as JSON.
'use strict';
const crypto = require('crypto');
const fs = require('fs');

const HEX64 = /^[0-9a-f]{64}$/;
const HEX128 = /^[0-9a-f]{128}$/;
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
function verifySig(pubHex, msg, sigHex) {
  try {
    if (!HEX64.test(pubHex) || !HEX128.test(sigHex)) return false;
    const key = crypto.createPublicKey({ key: Buffer.concat([SPKI, Buffer.from(pubHex, 'hex')]), format: 'der', type: 'spki' });
    return crypto.verify(null, Buffer.from(msg, 'utf8'), key, Buffer.from(sigHex, 'hex'));
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
  return keysAre(e, ['index', 'prev', 'time', 'record', 'hash']) && isInt(e.index) && HEX64.test(e.prev) &&
    isInt(e.time) && e.time >= 0 && HEX64.test(e.hash) &&
    keysAre(e.record, ['type', 'author', 'body', 'sig']) && typeof e.record.type === 'string' &&
    HEX64.test(e.record.author) && HEX128.test(e.record.sig) &&
    e.record.body && typeof e.record.body === 'object' && !Array.isArray(e.record.body) && canonOk(e.record.body);
}
function bodyOk(type, b) {
  switch (type) {
    case 'genesis': return keysAre(b, ['threshold', 'comment_seconds']) && isInt(b.threshold) && b.threshold >= 1 && isInt(b.comment_seconds) && b.comment_seconds >= 0;
    case 'register_key': return keysAre(b, ['public_key', 'label']) && HEX64.test(b.public_key) && isStr(b.label, 1, 40);
    case 'propose': return keysAre(b, ['title', 'text']) && isStr(b.title, 1, 120) && isStr(b.text, 1, 20000);
    case 'amend': return keysAre(b, ['proposal', 'title', 'text']) && HEX64.test(b.proposal) && isStr(b.title, 1, 120) && isStr(b.text, 1, 20000);
    case 'sign': return keysAre(b, ['proposal', 'version']) && HEX64.test(b.proposal) && HEX64.test(b.version);
    case 'comment': return keysAre(b, ['proposal', 'text']) && HEX64.test(b.proposal) && isStr(b.text, 1, 2000);
    default: return false;
  }
}
const stateOf = (p, settings, now) => {
  if (p.sigs.size < settings.threshold) return 'collecting';
  return now < p.thresholdTime + settings.comment_seconds ? 'comment' : 'closed';
};

function cpChecks(prefix, c, operator, entries, hashes, out, where, index) {
  const err = code => out.push({ code: prefix + code, where, index });
  if (!keysAre(c, ['operator', 'root', 'size', 'time', 'sig']) || !HEX64.test(c.operator) || !HEX64.test(c.root) || !isInt(c.size) || !isInt(c.time) || !HEX128.test(c.sig)) return err('BAD_FORMAT');
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
  const g = E[0] && E[0].record && E[0].record.type === 'genesis' && HEX64.test(E[0].record.author || '') ? E[0].record.author : null;
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

if (require.main === module) {
  const a = process.argv.slice(2);
  if (a[0] !== 'verify' || !a[1]) { console.error('usage: node cip-log.js verify <log.json> [--trusted <checkpoint.json>]'); process.exit(2); }
  const read = f => JSON.parse(fs.readFileSync(f, 'utf8'));
  const ti = a.indexOf('--trusted');
  const result = verifyLog(read(a[1]), ti > 0 ? read(a[ti + 1]) : undefined);
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
}
module.exports = { canon, sha256hex, testIdentity, makeRecord, makeEntries, makeCheckpoint, entryHash, versionHash, merkleRoot, verifyLog };
