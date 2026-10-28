// Tests for the PR guard (tests/pr-guard.js) and its workflow (.github/workflows/pr-guard.yml).
// Each case builds a small throwaway git repo in the system temp folder: a made-up base commit, then a
// pull-request commit on top, and checks what the guard says. The fixtures are invented and harmless.
// The attack fixture copies only the shape of the October 2026 attempt (an editor task that runs on
// folder open, and a file named like a font holding one harmless comment after many tabs); nothing in
// it is run. The last cases run the workflow's own shell step against a local stand-in for GitHub,
// to show that it uses the base branch's guard even when the pull request edits the guard.
// Needs Node 18 or later, git and bash. Run from the repo root: node tests/pr-guard.test.js
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');

// Keep the machine's git settings (signing, hooks, aliases) out of the throwaway repos.
process.env.GIT_CONFIG_NOSYSTEM = '1';
process.env.GIT_CONFIG_GLOBAL = os.devNull;
Object.assign(process.env, { GIT_AUTHOR_NAME: 'Test', GIT_AUTHOR_EMAIL: 'test@example.invalid', GIT_COMMITTER_NAME: 'Test', GIT_COMMITTER_EMAIL: 'test@example.invalid' });

const G = require('./pr-guard.js');
const GUARD = path.join(__dirname, 'pr-guard.js');
const WORKFLOW = path.join(__dirname, '..', '.github', 'workflows', 'pr-guard.yml');
let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.log('FAIL', m); } else console.log('ok  ', m); };

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pr-guard-test-'));
process.on('exit', () => fs.rmSync(tmp, { recursive: true, force: true }));
const git = (dir, ...args) => cp.execFileSync('git', ['-C', dir, ...args], { stdio: ['ignore', 'pipe', 'pipe'] }).toString().trim();

// Small stand-ins for real file types.
const WOFF2 = Buffer.concat([Buffer.from('wOF2'), Buffer.alloc(60, 7)]);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]), Buffer.alloc(40, 0)]);
const BASE_FILES = {
  'README.md': '# Test repo\n',
  'LICENSE': 'Made-up licence text.\n',
  '.gitignore': 'target/\n',
  'docs/voting-rules.md': '# Voting rules\n\nOne person, one vote.\n',
  'simulator/index.html': '<!doctype html>\n<title>Simulator</title>\n<p>Votes: 0</p>\n',
  'simulator/app.js': 'const votes = 0;\n',
  'prototype/rust/Cargo.toml': '[package]\nname = "demo"\n',
  'prototype/data.json': '{"a": 1}\n',
  'assets/fonts/demo.woff2': WOFF2,
  'assets/og-image.png': PNG,
  '.github/workflows/tests.yml': 'name: Tests\non: push\n',
};

function write(dir, files) {
  for (const [p, v] of Object.entries(files)) {
    const f = path.join(dir, p);
    if (v === null) { fs.rmSync(f, { force: true }); continue; }
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.rmSync(f, { force: true });
    if (v && v.symlink) fs.symlinkSync(v.symlink, f); else fs.writeFileSync(f, v);
  }
}
function commit(dir, msg) {
  git(dir, 'add', '-A');
  git(dir, '-c', 'commit.gpgsign=false', 'commit', '-q', '--allow-empty', '-m', msg);
  return git(dir, 'rev-parse', 'HEAD');
}
let n = 0;
// A fresh repo with the base commit; returns { dir, base, pr(files) -> head sha }.
function repo(baseFiles = BASE_FILES) {
  const dir = path.join(tmp, 'r' + (n++));
  fs.mkdirSync(dir);
  git(dir, 'init', '-q', '-b', 'main');
  write(dir, baseFiles);
  const base = commit(dir, 'base');
  return { dir, base, pr(files, from = base) {
    git(dir, 'checkout', '-q', '--detach', from);
    write(dir, files);
    return commit(dir, 'pr');
  } };
}
// Run the guard on one pull request and return { problems, reasons(path) }.
function run(files, author = 'someone', owner = 'BetterToBest') {
  const r = repo();
  const head = r.pr(files);
  const res = G.check({ repo: r.dir, base: r.base, head, author, owner });
  return { ...res, reasons: p => ((res.problems.find(x => x.path === p) || {}).reasons || []).join(' ') };
}
const passes = (files, m, author) => { const r = run(files, author); ok(r.problems.length === 0, m + (r.problems.length ? ' :: ' + JSON.stringify(r.problems) : '')); };
const blocks = (files, p, re, m, author) => { const r = run(files, author); ok(re.test(r.reasons(p)), m + (re.test(r.reasons(p)) ? '' : ' :: ' + JSON.stringify(r.problems))); };

// ---- The attack's shape, by file names only ----
const TASKS = JSON.stringify({ version: '2.0.0', tasks: [{ label: 'build', type: 'shell', command: 'node public/fonts/fa-solid.lkf', runOptions: { runOn: 'folderOpen' } }] }, null, 2) + '\n';
const LKF = '\t'.repeat(300) + '// harmless test fixture line\n';
{
  const r = repo();
  const head = r.pr({ '.vscode/tasks.json': TASKS, 'public/fonts/fa-solid.lkf': LKF });
  const res = G.check({ repo: r.dir, base: r.base, head, author: 'someone', owner: 'BetterToBest' });
  const why = p => ((res.problems.find(x => x.path === p) || {}).reasons || []).join(' ');
  ok(res.problems.length === 2, 'attack: both files are reported');
  ok(/\.vscode\/ holds editor settings/.test(why('.vscode/tasks.json')), 'attack: .vscode/tasks.json is refused');
  ok(/run a task automatically when the folder is opened/.test(why('.vscode/tasks.json')), 'attack: the folder-open task is named');
  ok(/file type "\.lkf" is not used/.test(why('public/fonts/fa-solid.lkf')), 'attack: the .lkf type is not on the allowlist');
  ok(/folder named like a font folder/.test(why('public/fonts/fa-solid.lkf')), 'attack: a fonts folder outside assets/fonts/ is refused');
  ok(/run of 40 or more tabs or spaces/.test(why('public/fonts/fa-solid.lkf')), 'attack: the run of tabs is found');
  const out = cp.spawnSync(process.execPath, [GUARD, '--repo', r.dir, '--author', 'someone', '--owner', 'BetterToBest', r.base, head], { encoding: 'utf8' });
  ok(out.status === 1, 'attack: the command exits with 1');
  ok(/PR guard: 2 of 2 changed files broke a rule/.test(out.stdout), 'attack: the summary is plain English');
  ok(!out.stdout.includes('harmless test fixture') && !out.stdout.includes('folderOpen'), 'attack: file contents are never printed');
}

// ---- Clean changes that must pass ----
passes({ 'docs/voting-rules.md': '# Voting rules\n\nOne person, one vote. Ties go to a recount.\n', 'docs/glossary.md': '# Glossary\n\n**Ledger:** the shared record.\n' }, 'clean: docs-only change passes', 'someone');
passes({ 'simulator/index.html': '<!doctype html>\n<title>Simulator</title>\n<p>Votes: <output id="v">0</output></p>\n<script src="app.js"></script>\n', 'simulator/liquid/index.html': '<!doctype html>\n<title>Liquid</title>\n', 'simulator/app.js': 'let votes = 0;\nconst add = () => { votes += 1; };\n' }, 'clean: simulator-only change passes', 'someone');
{
  const r = repo();
  const head = r.pr({ 'docs/glossary.md': '# Glossary\n' });
  const out = cp.spawnSync(process.execPath, [GUARD, '--repo', r.dir, r.base, head], { encoding: 'utf8' });
  ok(out.status === 0 && /1 changed file checked, no problems found/.test(out.stdout), 'clean: the command exits with 0 and says so');
}

// ---- Editor, workflow and install-hook files ----
blocks({ '.devcontainer/devcontainer.json': '{"postCreateCommand": "echo hi"}\n' }, '.devcontainer/devcontainer.json', /\.devcontainer\/ holds editor settings/, '.devcontainer/ is refused');
blocks({ '.idea/workspace.xml': '<project/>\n' }, '.idea/workspace.xml', /\.idea\/ holds editor settings/, '.idea/ is refused');
blocks({ 'docs/.VSCode/settings.json': '{}\n' }, 'docs/.VSCode/settings.json', /\.vscode\/ holds editor settings/, 'a nested .vscode/ in any letter case is refused');
blocks({ '.devcontainer.json': '{}\n' }, '.devcontainer.json', /dev-container settings file/, 'a root .devcontainer.json is refused');
blocks({ 'portal.code-workspace': '{}\n' }, 'portal.code-workspace', /editor or dev-container settings file/, 'a .code-workspace file is refused');
blocks({ '.github/workflows/new.yml': 'name: New\non: push\n' }, '.github/workflows/new.yml', /Only the repository owner \(BetterToBest\) may change it; this pull request is from someone/, '.github/ change by someone else is refused');
blocks({ '.github/workflows/tests.yml': null }, '.github/workflows/tests.yml', /Only the repository owner/, 'removing a workflow is refused for someone else');
passes({ '.github/workflows/new.yml': 'name: New\non: push\n' }, '.github/ change by the owner passes', 'BetterToBest');
passes({ '.github/workflows/new.yml': 'name: New\non: push\n' }, 'owner match ignores letter case', 'bettertobest');
{
  const r = repo(); const head = r.pr({ '.github/workflows/new.yml': 'name: New\n' });
  const res = G.check({ repo: r.dir, base: r.base, head, owner: 'BetterToBest' });
  ok(res.problems.length === 1, '.github/ change with no known author is refused');
}
blocks({ 'package.json': '{"scripts": {"postinstall": "echo hi"}}\n' }, 'package.json', /package\.json is not accepted.*postinstall/, 'package.json is refused', 'BetterToBest');
blocks({ 'simulator/package.json': '{}\n' }, 'simulator/package.json', /package\.json is not accepted/, 'a nested package.json is refused');
blocks({ 'prototype/python/setup.py': 'print("hi")\n' }, 'prototype/python/setup.py', /pip runs this file/, 'setup.py is refused');
blocks({ '.husky/pre-commit.md': 'hi\n' }, '.husky/pre-commit.md', /\.husky\/ is not accepted/, 'a git-hook folder is refused');
blocks({ 'prototype/rust/Cargo.toml': '[package]\nname = "demo"\nbuild = "gen.rs"\n' }, 'prototype/rust/Cargo.toml', /Line 3 names a build script/, 'a Cargo.toml build script is refused');
passes({ 'prototype/rust/Cargo.toml': '[package]\nname = "demo"\nversion = "0.1.0"\n' }, 'an ordinary Cargo.toml edit passes');

// ---- File types and fonts ----
blocks({ 'scripts/run.sh': 'echo hi\n' }, 'scripts/run.sh', /file type "\.sh" is not used/, 'a new file type is refused');
blocks({ 'Makefile': 'all:\n' }, 'Makefile', /file type "makefile" is not used/, 'a file with no extension is matched by its whole name');
passes({ 'docs/LICENSE': 'Made-up.\n', 'prototype/.gitignore': 'out/\n' }, 'names already in the repo (LICENSE, .gitignore) pass');
passes({ 'assets/fonts/other.woff2': WOFF2 }, 'a real font in assets/fonts/ passes');
blocks({ 'simulator/fonts/x.woff2': WOFF2 }, 'simulator/fonts/x.woff2', /named like a font \(\.woff2\), but fonts belong in assets\/fonts\//, 'a font outside assets/fonts/ is refused');
blocks({ 'assets/fonts/fake.woff2': 'console.log(1)\n' }, 'assets/fonts/fake.woff2', /its contents are not a font/, 'a text file named like a font is refused');
{
  const r = run({ 'docs/glossary.md': '# Glossary\n' });
  const real = G.check({ repo: path.join(__dirname, '..'), base: 'HEAD', head: 'HEAD' });
  ok(r.problems.length === 0 && real.files === 0, 'an empty change on this repo checks cleanly');
  const types = new Set(cp.execFileSync('git', ['-C', path.join(__dirname, '..'), 'ls-tree', '-r', '-z', '--name-only', 'HEAD']).toString().split('\0').filter(Boolean).map(G.typeKey));
  ok(['.md', '.js', '.json', '.html', '.woff2', 'license'].every(t => types.has(t)) && !types.has('.lkf') && !types.has('.sh'), "this repo's allowlist has its real types and not .lkf or .sh");
}

// ---- Size, binaries, links ----
const line = 'x'.repeat(99) + '\n';
blocks({ 'docs/big.md': line.repeat(3073) }, 'docs/big.md', /The file is 300.1 KB; the limit is 300 KB/, 'a file over 300 KB is refused');
passes({ 'docs/big.md': line.repeat(3070) }, 'a file just under 300 KB passes');
blocks({ 'docs/diagram.png': PNG }, 'docs/diagram.png', /binary file.*only accepted under assets\//, 'a binary outside assets/ is refused');
passes({ 'assets/diagram.png': PNG }, 'a binary under assets/ passes');
blocks({ 'docs/link.md': { symlink: '../README.md' } }, 'docs/link.md', /symbolic link/, 'a symbolic link is refused');

// ---- Long lines and runs of blanks ----
passes({ 'docs/long.md': 'y'.repeat(2000) + '\n' }, 'a line of exactly 2,000 characters passes');
blocks({ 'docs/long.md': 'y'.repeat(2001) + '\n' }, 'docs/long.md', /Line 1 is over 2,000 characters/, 'a line of 2,001 characters is refused');
passes({ 'prototype/edge-cases/inputs/e99-new.json': '{"a": "' + 'z'.repeat(2500) + '"}\n' }, 'a long line in a generated edge-case log passes');
blocks({ 'prototype/edge-cases/inputs/e99-new.json': '{"a": 1,' + ' '.repeat(40) + '"b": 2}\n' }, 'prototype/edge-cases/inputs/e99-new.json', /has a run/, 'a run of blanks in an edge-case log is still refused');
blocks({ 'prototype/edge-cases/e99.json': 'z'.repeat(2001) + '\n' }, 'prototype/edge-cases/e99.json', /over 2,000 characters/, 'the long-line exception covers only prototype/edge-cases/inputs/');
passes({ 'simulator/app.js': 'const votes = 0;' + ' '.repeat(39) + '// 39 spaces\n' }, 'a run of 39 spaces passes');
blocks({ 'simulator/app.js': 'const votes = 0;' + ' '.repeat(40) + 'hidden();\n' }, 'simulator/app.js', /Line 1 has a run of 40 or more/, 'a run of 40 spaces is refused');
blocks({ 'simulator/app.js': 'const votes = 0;\n' + ' \t'.repeat(20) + 'hidden();\n' }, 'simulator/app.js', /Line 2 has a run/, 'a run of mixed tabs and spaces is refused');
blocks({ 'docs/a.md': 'ok' + String.fromCharCode(0xa0).repeat(40) + 'hidden\n' }, 'docs/a.md', /has a run/, 'a run of no-break spaces is refused');
blocks({ 'docs/a.md': 'shown' + '\r' + '\t'.repeat(45) + 'hidden\n' }, 'docs/a.md', /Line 2 has a run/, 'a lone carriage return counts as a line break, as editors show it');
{
  const longBase = { ...BASE_FILES, 'prototype/data.json': '{"a": "' + 'z'.repeat(2500) + '"}\n' };
  const r = repo(longBase);
  const head = r.pr({ 'prototype/data.json': '{"a": "' + 'z'.repeat(2500) + '"}\n{"b": 2}\n' });
  ok(G.check({ repo: r.dir, base: r.base, head }).problems.length === 0, 'an edit that leaves an existing long line alone passes');
}

// ---- How changes are worked out ----
{
  const r = repo();
  const head = r.pr({ 'docs/voting-rules.md': null, '.vscode/voting-rules.md': BASE_FILES['docs/voting-rules.md'] });
  const res = G.check({ repo: r.dir, base: r.base, head });
  ok(res.problems.some(p => p.path === '.vscode/voting-rules.md'), 'a file moved into .vscode/ is refused');
}
{
  const r = repo();
  const head = r.pr({ 'docs/glossary.md': '# Glossary\n' });
  git(r.dir, 'checkout', '-q', '--detach', r.base);
  write(r.dir, { '.github/workflows/new.yml': 'name: New\n' });
  const newBase = commit(r.dir, 'owner change on main');
  ok(G.check({ repo: r.dir, base: newBase, head, author: 'someone' }).problems.length === 0, 'changes made on the base branch since the PR branched are not blamed on the PR');
}
{
  const r = repo();
  const head = r.pr({ ['.vscode/x\n::warning::y.json']: '{}\n' });
  const out = cp.spawnSync(process.execPath, [GUARD, '--repo', r.dir, r.base, head], { encoding: 'utf8' });
  ok(out.status === 1 && !out.stdout.split('\n').some(l => l.startsWith('::')) && out.stdout.includes('\\u000a::warning::'), 'a file name cannot start a new output line or a GitHub Actions command');
}
{
  const r = repo();
  const out = cp.spawnSync(process.execPath, [GUARD, '--repo', r.dir, r.base, 'f'.repeat(40)], { encoding: 'utf8' });
  ok(out.status === 2 && /could not run: The commit "f+" was not found/.test(out.stdout), 'a missing commit exits with 2 and says why');
  const use = cp.spawnSync(process.execPath, [GUARD, r.base], { encoding: 'utf8' });
  ok(use.status === 2 && /^Usage:/.test(use.stdout), 'wrong arguments exit with 2 and show usage');
}

// ---- The workflow ----
if (!fs.existsSync(WORKFLOW)) {
  console.log('skip workflow checks: .github/workflows/pr-guard.yml is not in this checkout (it is created by hand)');
} else {
  const yml = fs.readFileSync(WORKFLOW, 'utf8');
  const code = yml.split('\n').filter(l => !/^\s*#/.test(l)).join('\n');
  ok(/^on:\n  pull_request:\n/m.test(code) && !/pull_request_target/.test(code), 'workflow: runs on pull_request, never pull_request_target');
  ok(/^permissions:\n  contents: read\n\n/m.test(code) && (code.match(/permissions:/g) || []).length === 1, 'workflow: read-only permissions, set once');
  ok(!/secrets\./.test(code) && !/uses:/.test(code), 'workflow: no secrets and no third-party actions');
  ok(/git -C "\$repo" show "\$BASE_SHA:tests\/pr-guard\.js"/.test(code) && /--bare/.test(code), "workflow: runs the base branch's guard; the PR is fetched into a bare repo");
  ok(!/\$\{\{[^}]*\}\}/.test(code.split('run: |')[1]), 'workflow: no ${{ }} values inside the shell script (they come in through env)');

  // Run the workflow's own shell step against a local stand-in for GitHub.
  const script = code.split('run: |\n')[1].split('\n').map(l => l.replace(/^ {10}/, '')).join('\n');
  const origin = path.join(tmp, 'github', 'owner', 'portal');
  fs.mkdirSync(path.dirname(origin), { recursive: true });
  const step = (baseFiles, prFiles) => {
    const r = repo(baseFiles);
    const head = r.pr(prFiles);
    fs.rmSync(origin, { recursive: true, force: true });
    cp.execFileSync('git', ['clone', '-q', '--bare', r.dir, origin]);
    git(origin, 'update-ref', 'refs/pull/7/head', head);
    git(origin, 'config', 'uploadpack.allowAnySHA1InWant', 'true');
    const runner = fs.mkdtempSync(path.join(tmp, 'runner-'));
    return cp.spawnSync('bash', ['-c', script], { encoding: 'utf8', env: { ...process.env,
      BASE_SHA: r.base, HEAD_SHA: head, PR_NUMBER: '7', PR_AUTHOR: 'someone', OWNER: 'owner',
      GITHUB_SERVER_URL: 'file://' + path.join(tmp, 'github'), GITHUB_REPOSITORY: 'owner/portal', RUNNER_TEMP: runner } });
  };
  const withGuard = { ...BASE_FILES, 'tests/pr-guard.js': fs.readFileSync(GUARD) };
  let s = step(withGuard, { 'docs/glossary.md': '# Glossary\n' });
  ok(s.status === 0 && /no problems found/.test(s.stdout), 'workflow step: a clean PR passes' + (s.status ? ' :: ' + s.stdout + s.stderr : ''));
  s = step(withGuard, { 'tests/pr-guard.js': 'process.exit(0)\n', '.vscode/tasks.json': TASKS, 'public/fonts/fa-solid.lkf': LKF });
  ok(s.status === 1 && /\.vscode\/tasks\.json/.test(s.stdout), "workflow step: a PR that empties the guard is still checked by the base branch's copy" + (s.status === 1 ? '' : ' :: ' + s.stdout + s.stderr));
  s = step(BASE_FILES, { 'tests/pr-guard.js': 'process.exit(1)\n' });
  ok(s.status === 0 && /base branch has no tests\/pr-guard\.js yet/.test(s.stdout), 'workflow step: before the guard is on the base branch, it says so and does not run the PR copy');
}

console.log(fail ? `\n${fail} check(s) FAILED` : '\nAll PR guard checks passed.');
process.exitCode = fail ? 1 : 0;
