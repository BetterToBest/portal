// Copies the example logs from prototype/testdata/ into the viewer page, between the
// EXAMPLES-START and EXAMPLES-END markers, so the page works offline as a single file.
//   node prototype/node/build-viewer.js            update the page
//   node prototype/node/build-viewer.js --check    fail if the page is out of date
'use strict';
const fs = require('fs');
const path = require('path');

const td = f => JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'testdata', f), 'utf8'));
const page = path.join(__dirname, '..', 'viewer', 'index.html');

const data = {
  logs: {
    good: td('good.json'),
    tamper: td('tamper-text.json'),
    late: td('rule-late-sign.json'),
    rewrite: td('rewritten-history.json'),
    cp21: td('good.checkpoint-21.json')
  },
  examples: {
    good: { log: 'good', trusted: 'cp21' },
    tamper: { log: 'tamper' },
    late: { log: 'late' },
    'rewrite-alone': { log: 'rewrite' },
    'rewrite-saved': { log: 'rewrite', trusted: 'cp21' }
  }
};
// "<" is written as < so nothing inside the data can end the script block early.
const block = '<!--EXAMPLES-START-->\n<script type="application/json" id="examples">' +
  JSON.stringify(data).replace(/</g, '\\u003c') + '</script>\n<!--EXAMPLES-END-->';

const src = fs.readFileSync(page, 'utf8');
const a = src.indexOf('<!--EXAMPLES-START-->'), b = src.indexOf('<!--EXAMPLES-END-->');
if (a < 0 || b < 0) { console.error('markers not found'); process.exit(2); }
const out = src.slice(0, a) + block + src.slice(b + '<!--EXAMPLES-END-->'.length);

if (process.argv.includes('--check')) {
  if (out !== src) { console.log('DIFFERS: run node prototype/node/build-viewer.js'); process.exit(1); }
  process.exit(0);
}
fs.writeFileSync(page, out);
console.log('viewer examples updated (' + out.length + ' bytes)');
