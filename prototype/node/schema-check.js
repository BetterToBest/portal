// CIP Phase 3 prototype: a small checker for prototype/schema/cip-test-log.schema.json.
// A research prototype on TEST DATA. No network access, no storage: it reads the files you give
// it and prints a result. Built-in Node modules only.
//
//   node prototype/node/schema-check.js <file.json> [--def log|entry|record|checkpoint] [--schema <schema.json>]
//
// Checks that the file has the right SHAPE: the keys, the types, the lengths. It does not check
// hashes, signatures, the chain or the rules; for that use cip-log.js (or verify.py) verify.
// Prints {ok, errors:[{path, keyword, message}]} as JSON. Exit 0 if the shape is right, 1 if not,
// 2 for a usage error.
//
// This implements ONLY the parts of JSON Schema the schema file uses ($ref to #/$defs/..., type,
// properties, required, additionalProperties false, items, enum, const, pattern, minLength,
// maxLength, minimum, maximum, allOf, if/then). It refuses any other keyword instead of ignoring it.
// For anything else, or to check this checker, use a full validator (the tests do, when one is installed).
'use strict';
const fs = require('fs');
const path = require('path');

const DEFAULT_SCHEMA = path.join(__dirname, '..', 'schema', 'cip-test-log.schema.json');
const KNOWN = new Set(['$schema', '$comment', '$defs', 'title', '$ref', 'type', 'properties', 'required', 'additionalProperties', 'items',
  'enum', 'const', 'pattern', 'minLength', 'maxLength', 'minimum', 'maximum', 'allOf', 'if', 'then']);

const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const typeOf = v => v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v; // 'object', 'string', 'number', 'boolean'
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k); // plain `in` would also find inherited names such as toString
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b); // enough for the string constants used here

function makeValidator(root) {
  const resolve = ref => {
    if (!ref.startsWith('#/')) throw new Error('only local references are supported: ' + ref);
    return ref.slice(2).split('/').reduce((n, k) => { if (n === undefined) throw new Error('bad reference ' + ref); return n[k]; }, root);
  };
  const patterns = new Map();
  const re = p => { if (!patterns.has(p)) patterns.set(p, new RegExp(p, 'u')); return patterns.get(p); };

  function check(schema, v, at, errs) {
    for (const k of Object.keys(schema)) if (!KNOWN.has(k)) throw new Error('unsupported schema keyword: ' + k);
    const err = (keyword, message) => errs.push({ path: at, keyword, message });
    if (schema.$ref) check(resolve(schema.$ref), v, at, errs);
    if (schema.type !== undefined) {
      const t = typeOf(v);
      const good = schema.type === 'integer' ? t === 'number' && Number.isInteger(v) : t === schema.type;
      if (!good) { err('type', 'expected ' + schema.type + ', found ' + (t === 'number' ? 'a number that is not a whole number' : t)); return; }
    }
    if (schema.const !== undefined && !same(v, schema.const)) err('const', 'must be ' + JSON.stringify(schema.const));
    if (schema.enum && !schema.enum.some(x => same(x, v))) err('enum', 'must be one of ' + schema.enum.map(x => JSON.stringify(x)).join(', '));
    if (typeof v === 'string') {
      const n = [...v].length; // length in code points, as JSON Schema counts it
      if (schema.minLength !== undefined && n < schema.minLength) err('minLength', 'shorter than ' + schema.minLength + ' characters');
      if (schema.maxLength !== undefined && n > schema.maxLength) err('maxLength', 'longer than ' + schema.maxLength + ' characters');
      if (schema.pattern !== undefined && !re(schema.pattern).test(v)) err('pattern', 'does not match the required form');
    }
    if (typeof v === 'number') {
      if (schema.minimum !== undefined && v < schema.minimum) err('minimum', 'below ' + schema.minimum);
      if (schema.maximum !== undefined && v > schema.maximum) err('maximum', 'above ' + schema.maximum);
    }
    if (Array.isArray(v) && schema.items) v.forEach((x, i) => check(schema.items, x, at + '/' + i, errs));
    if (isObj(v)) {
      for (const r of schema.required || []) if (!own(v, r)) err('required', 'missing "' + r + '"');
      const props = schema.properties || {};
      for (const k of Object.keys(v)) {
        if (own(props, k)) check(props[k], v[k], at + '/' + k.replace(/~/g, '~0').replace(/\//g, '~1'), errs);
        else if (schema.additionalProperties === false) errs.push({ path: at + '/' + k.replace(/~/g, '~0').replace(/\//g, '~1'), keyword: 'additionalProperties', message: 'this key is not allowed' });
      }
    }
    for (const sub of schema.allOf || []) check(sub, v, at, errs);
    if (schema.if) {
      const probe = [];
      check(schema.if, v, at, probe);
      if (probe.length === 0 && schema.then) check(schema.then, v, at, errs);
    }
  }
  return (def, v) => {
    const errs = [];
    check(def ? { $ref: '#/$defs/' + def } : root, v, '', errs);
    return errs;
  };
}

function validate(schema, def, value) {
  const errors = makeValidator(schema)(def, value);
  return { ok: errors.length === 0, errors };
}

if (require.main === module) {
  const a = process.argv.slice(2);
  const usage = () => { console.error('usage: node schema-check.js <file.json> [--def log|entry|record|checkpoint] [--schema <schema.json>]'); process.exit(2); };
  if (!a[0] || a[0].startsWith('--')) usage();
  const opt = n => { const i = a.indexOf(n); return i > 0 ? a[i + 1] : undefined; };
  if ((a.includes('--def') && !opt('--def')) || (a.includes('--schema') && !opt('--schema'))) usage();
  const def = opt('--def');
  if (def !== undefined && !['log', 'entry', 'record', 'checkpoint'].includes(def)) usage();
  let schema, value;
  try { schema = JSON.parse(fs.readFileSync(opt('--schema') || DEFAULT_SCHEMA, 'utf8')); } catch (e) { console.error('cannot read the schema: ' + e.message); process.exit(2); }
  try { value = JSON.parse(fs.readFileSync(a[0], 'utf8')); } catch (e) { console.error('cannot read ' + a[0] + ' as JSON: ' + e.message); process.exit(2); }
  let result;
  try { result = validate(schema, def, value); } catch (e) { console.error(e.message); process.exit(2); }
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.ok ? 0 : 1);
}
module.exports = { validate, makeValidator, DEFAULT_SCHEMA };
