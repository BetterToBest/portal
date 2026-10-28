// PR guard: checks the files a pull request changes, without running, installing or opening any of them.
// It fails, with a plain-English reason for each file, when a change:
//   - adds, edits or removes anything under .vscode/, .devcontainer/ or .idea/ (editor settings that can
//     run commands when a folder is opened), or under .github/ unless the PR author is the repo owner;
//   - adds or edits a package.json or another file that makes an install or build step run code;
//   - adds a file whose type (extension) is not already used in the repo, or a font outside assets/fonts/;
//   - adds a file over 300 KB, a binary file outside assets/, a symbolic link or a submodule;
//   - adds a line over 2,000 characters, or a line with a run of 40 or more tabs or spaces
//     (the trick used to push code past the right-hand edge of the screen).
// The pull request's files are read from git as data. Their contents are never printed.
//
// Run from anywhere: node tests/pr-guard.js [--repo DIR] [--author LOGIN] [--owner LOGIN] BASE HEAD
//   BASE    the base branch commit (what the repo already contains)
//   HEAD    the pull request's head commit
//   --repo  the git repository holding both commits (default: the current folder); a bare repo works
// Exit code: 0 no problems, 1 the change breaks a rule, 2 the check could not run.
// Needs Node 18 or later and git; nothing to install. .github/workflows/pr-guard.yml runs the copy of
// this file from the base branch, so a pull request cannot weaken the check by editing it.
// Tests: node tests/pr-guard.test.js
'use strict';
const cp = require('child_process');
const posix = require('path').posix;

const MAX_BYTES = 300 * 1024;
const MAX_LINE = 2000;
const MAX_BLANK_RUN = 40;          // a run of this many tabs or spaces in a row fails
const READ_CAP = 8 * 1024 * 1024;  // files bigger than this already fail on size; do not read them
const EDITOR_DIRS = ['.vscode', '.devcontainer', '.idea'];
const FONT_EXTS = ['.woff', '.woff2', '.ttf', '.otf', '.eot', '.ttc'];
// Files that make an install, build or editor step run code. Matched on the file name, any folder.
const RUNS_CODE = {
  'package.json': 'npm and other package managers run the scripts in this file (for example "postinstall") when someone installs',
  '.npmrc': 'it changes how npm installs packages and which scripts it runs',
  '.yarnrc': 'it changes how yarn installs packages',
  '.yarnrc.yml': 'it changes how yarn installs packages and can load plugins',
  '.pnpmfile.cjs': 'pnpm runs this file during install',
  'setup.py': 'pip runs this file when the package is installed',
  'setup.cfg': 'it configures a Python install step',
  'pyproject.toml': 'pip runs the build step it names when the package is installed',
  'build.rs': 'cargo runs this file on every build',
  '.envrc': 'direnv runs this file automatically when someone enters the folder',
  '.pre-commit-config.yaml': 'it installs git hooks that run on every commit',
  'lefthook.yml': 'it installs git hooks that run on every commit',
  '.gitmodules': 'it pulls in another repository as a submodule',
};
const RUNS_CODE_DIRS = {
  '.husky': 'it holds git hooks that run on every commit',
  '.githooks': 'it holds git hooks that run on every commit',
  '.cargo': 'it can change what cargo runs during a build',
};

function git(repo, args) {
  return cp.execFileSync('git', ['-C', repo, ...args], { maxBuffer: 1 << 30, stdio: ['ignore', 'pipe', 'pipe'] });
}

// The type key of a path: its lower-case extension, or the whole name when it has none (LICENSE, .gitignore).
function typeKey(p) {
  const name = posix.basename(p).toLowerCase();
  return posix.extname(name) || name;
}

// Show a path safely: control and direction-changing characters become visible escapes, so a file
// name cannot start a new output line (or a GitHub Actions command) or reorder what the reader sees.
function show(p) {
  return p.replace(/[\x00-\x1f\x7f\u2028\u2029\u200e\u200f\u202a-\u202e\u2066-\u2069]/g,
    c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
}

function isBinary(buf) {
  if (buf.subarray(0, 8000).includes(0)) return true;
  try { new TextDecoder('utf-8', { fatal: true }).decode(buf); return false; } catch { return true; }
}

function looksLikeFont(ext, buf) {
  const tag = buf.subarray(0, 4).toString('latin1');
  if (ext === '.woff') return tag === 'wOFF';
  if (ext === '.woff2') return tag === 'wOF2';
  if (ext === '.ttc') return tag === 'ttcf';
  if (ext === '.eot') return buf.length > 35 && buf[34] === 0x4c && buf[35] === 0x50;
  return tag === '\x00\x01\x00\x00' || tag === 'true' || tag === 'OTTO';   // .ttf, .otf
}

const splitLines = s => s.split(/\r\n|\r|\n|\u2028|\u2029/);
const blankRun = /[\t \u00a0\u1680\u2000-\u200b\u202f\u205f\u3000\ufeff]+/g;

// Lines of the new text that were not in the old text (counting repeats), with their line numbers.
function newLines(oldText, newText) {
  const left = new Map();
  for (const l of splitLines(oldText)) left.set(l, (left.get(l) || 0) + 1);
  const out = [];
  splitLines(newText).forEach((l, i) => {
    const n = left.get(l) || 0;
    if (n) left.set(l, n - 1); else out.push({ n: i + 1, text: l });
  });
  return out;
}

function listLines(nums) {
  const shown = nums.slice(0, 5).join(', ');
  return nums.length > 5 ? `${shown} and ${nums.length - 5} more` : shown;
}

const kb = n => (Math.ceil(n / 102.4) / 10).toLocaleString('en-US') + ' KB';

// Returns { files, problems: [{ path, reasons: [...] }] }. Throws if the commits cannot be read.
function check({ repo = '.', base, head, author = '', owner = '' }) {
  for (const c of [base, head]) {
    try { git(repo, ['rev-parse', '--verify', '--quiet', c + '^{commit}']); }
    catch { throw new Error(`The commit "${show(c)}" was not found in the repository at "${show(repo)}". Fetch it first.`); }
  }
  let from;
  try { from = git(repo, ['merge-base', base, head]).toString().trim(); }
  catch { throw new Error('The base and head commits share no history, so the change cannot be worked out.'); }

  const allowed = new Set(git(repo, ['ls-tree', '-r', '-z', '--name-only', base])
    .toString('utf8').split('\0').filter(Boolean).map(typeKey));

  // Raw diff records: ":oldmode newmode oldsha newsha status\0path\0". No rename detection, so a
  // rename shows as a removal plus an addition and the new name gets every check an addition does.
  const raw = git(repo, ['diff', '--raw', '-z', '--no-renames', '--no-abbrev', '--no-ext-diff', '--no-textconv', from, head])
    .toString('utf8').split('\0');
  const changes = [];
  for (let i = 0; i + 1 < raw.length; i += 2) {
    if (!raw[i].startsWith(':')) break;
    const [oldMode, newMode, oldSha, newSha, status] = raw[i].slice(1).split(' ');
    changes.push({ oldMode, newMode, oldSha, newSha, status: status[0], path: raw[i + 1] });
  }

  const isOwner = author !== '' && owner !== '' && author.toLowerCase() === owner.toLowerCase();
  const problems = [];
  for (const ch of changes) {
    const reasons = [];
    const p = ch.path;
    const parts = p.toLowerCase().split('/');
    const name = parts[parts.length - 1];
    const ext = posix.extname(name);
    const added = ch.status === 'A';
    const removed = ch.status === 'D';
    const readBlob = () => git(repo, ['cat-file', 'blob', ch.newSha]);

    // Places that run code or change how the repo runs. Removals count too.
    const editorDir = EDITOR_DIRS.find(d => parts.includes(d));
    if (editorDir) {
      reasons.push(`${editorDir}/ holds editor settings, and an editor can run commands from them as soon as the folder is opened. Pull requests may not add, change or remove files here.`);
      if (!removed && name === 'tasks.json' && /folderOpen/i.test(readBlob().toString('utf8')))
        reasons.push('This file asks the editor to run a task automatically when the folder is opened.');
    } else if (name === '.devcontainer.json' || name.endsWith('.code-workspace')) {
      reasons.push('This is an editor or dev-container settings file, which can run commands when the folder is opened. Pull requests may not add, change or remove it.');
    }
    if (parts[0] === '.github' && !isOwner)
      reasons.push(`.github/ holds the workflows that run on this repository and its settings. Only the repository owner${owner ? ` (${show(owner)})` : ''} may change it; this pull request is from ${author ? show(author) : 'an unknown author'}.`);
    if (!removed) {
      if (RUNS_CODE[name]) reasons.push(`${posix.basename(p)} is not accepted from pull requests: ${RUNS_CODE[name]}.`);
      const hookDir = parts.slice(0, -1).find(d => RUNS_CODE_DIRS[d]);
      if (hookDir) reasons.push(`${hookDir}/ is not accepted from pull requests: ${RUNS_CODE_DIRS[hookDir]}.`);
    }

    if (added && !allowed.has(typeKey(p)))
      reasons.push(`The file type "${show(typeKey(p))}" is not used anywhere in this repository yet. New files may only use types already here: ${[...allowed].sort().join(' ')}`);
    if (added && FONT_EXTS.includes(ext) && !p.startsWith('assets/fonts/'))
      reasons.push(`This is named like a font (${ext}), but fonts belong in assets/fonts/.`);
    else if (added && parts.slice(0, -1).some(d => d === 'fonts' || d === 'font') && !p.startsWith('assets/fonts/'))
      reasons.push('This is in a folder named like a font folder, but fonts belong in assets/fonts/.');

    if (!removed) {
      if (ch.newMode === '120000') reasons.push('This is a symbolic link. Links can point outside the repository, so they are not accepted.');
      else if (ch.newMode === '160000') reasons.push('This is a submodule (a link to another repository). Submodules are not accepted from pull requests.');
      else {
        const size = Number(git(repo, ['cat-file', '-s', ch.newSha]).toString());
        if (size > MAX_BYTES) reasons.push(`The file is ${kb(size)}; the limit is ${kb(MAX_BYTES)}.`);
        if (size <= READ_CAP) {
          const buf = readBlob();
          const binary = isBinary(buf);
          if (binary && !p.startsWith('assets/'))
            reasons.push('This is a binary file (not readable text). Binary files are only accepted under assets/.');
          if (FONT_EXTS.includes(ext) && !looksLikeFont(ext, buf))
            reasons.push(`This is named like a font (${ext}), but its contents are not a font.`);
          if (!binary) {
            const before = ch.status === 'A' || /^(120000|160000)$/.test(ch.oldMode) ? '' : git(repo, ['cat-file', 'blob', ch.oldSha]).toString('utf8');
            const long = [], hidden = [], cargoBuild = [];
            for (const l of newLines(before, buf.toString('utf8'))) {
              if (name === 'cargo.toml' && /^\s*build\s*=/.test(l.text)) cargoBuild.push(l.n);
              if ([...l.text].length > MAX_LINE) long.push(l.n);
              const runs = l.text.match(blankRun) || [];
              if (runs.some(r => r.length >= MAX_BLANK_RUN)) hidden.push(l.n);
            }
            if (cargoBuild.length) reasons.push(`Line ${listLines(cargoBuild)} names a build script, which cargo runs on every build. Build scripts are not accepted from pull requests.`);
            if (long.length) reasons.push(`Line ${listLines(long)} ${long.length > 1 ? 'are' : 'is'} over ${MAX_LINE.toLocaleString('en-US')} characters long. Very long lines can hide code past the edge of the screen.`);
            if (hidden.length) reasons.push(`Line ${listLines(hidden)} ${hidden.length > 1 ? 'have' : 'has'} a run of ${MAX_BLANK_RUN} or more tabs or spaces in a row. This pushes whatever follows past the right-hand edge of the screen, where a reviewer does not see it.`);
          }
        }
      }
    }
    if (reasons.length) problems.push({ path: p, reasons });
  }
  return { files: changes.length, problems };
}

function main(argv) {
  const opts = {}, pos = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--repo' || a === '--author' || a === '--owner') opts[a.slice(2)] = argv[++i];
    else pos.push(a);
  }
  if (pos.length !== 2 || Object.values(opts).some(v => v === undefined)) {
    console.log('Usage: node tests/pr-guard.js [--repo DIR] [--author LOGIN] [--owner LOGIN] BASE HEAD');
    return 2;
  }
  let result;
  try { result = check({ ...opts, base: pos[0], head: pos[1] }); }
  catch (e) {
    console.log('PR guard could not run: ' + (e.stderr && e.stderr.length ? show(e.stderr.toString().trim()) : e.message));
    return 2;
  }
  const { files, problems } = result;
  if (!problems.length) {
    console.log(`PR guard: ${files} changed file${files === 1 ? '' : 's'} checked, no problems found.`);
    return 0;
  }
  console.log(`PR guard: ${problems.length} of ${files} changed file${files === 1 ? '' : 's'} broke a rule.\n`);
  for (const { path: p, reasons } of problems) {
    console.log(`  ${show(p)}`);
    for (const r of reasons) console.log(`    - ${r}`);
    console.log('');
  }
  console.log('These rules keep pull requests from running code on the machines of people who review or');
  console.log('check them out. See "Pull request safety" in CONTRIBUTING.md. If a rule is wrong for your');
  console.log('change, say so in the pull request and a maintainer will look at it.');
  return 1;
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));
module.exports = { check, main, typeKey, newLines };
