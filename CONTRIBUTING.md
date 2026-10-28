# Contributing to the Citizens Internet Portal

CIP is a proposed open-source platform for transparent democratic participation. The research is done; this repository is where it becomes software people can try. Read the [paper](https://bettertobest.github.io/research-hub/citizens-internet-portal.html) first, or start with the [overview page](https://bettertobest.github.io/portal/).

You do not need to be a developer. Every contribution below matters.

## Ways to help

- **Developers:** prototype the components in the roadmap below.
- **Security and cryptography reviewers:** challenge the architecture and threat model. See the [review brief](docs/review-brief.md).
- **Designers and accessibility experts:** make participation easy for everyone.
- **Legal and policy thinkers:** map the statutory questions raised by the Judicial Guard.
- **Writers and organizers:** improve docs, explain the project, find pilot communities.

## Build roadmap (prototype phases)

| Phase | Goal | Status |
|---|---|---|
| 0 | Overview page and contributor guide | Done |
| 1 | Specs: threat model, data model, voting rules in `/docs` | In progress: drafts in `/docs`, including a [glossary](docs/glossary.md) and a [pilot brief](docs/pilot-brief.md); none has had an outside review |
| 2 | Simulator: browser demo of direct, liquid and quadratic voting | Four models live in `/simulator` (voting, liquid delegation, ranked-choice, ledger fork); more welcome |
| 3 | Prototype: proposals, signatures, comment periods, tamper-evident log | Started: [plan](docs/phase-3-plan.md); a test log, two verifiers, a log viewer and a [proposal flow page](prototype/try/index.html), all on test data only, in [prototype/](prototype/); a draft [test plan](docs/phase-3-test-plan.md) lists ten gates, most not met |
| 4 | Privacy layer: verifiable ballots without revealing votes | Design drafted, nothing built: [options and a proposed ballot shape](docs/phase-4-privacy-design.md), not reviewed by a cryptographer |
| 5 | Pilot design: a small advisory vote with a real community | Started: first draft in [docs/pilot-design.md](docs/pilot-design.md); no community approached |

Phases 1 and 2 are the best places to start.

## How to start

1. Say hello in [Discussions](https://github.com/BetterToBest/portal/discussions).
2. Pick an open issue (starter ideas are in `docs/good-first-issues.md`), or propose one.
3. Fork, make a small change, open a pull request. Short pull requests get reviewed fastest.

## Checking the pages

Every page is checked in a browser by [tests/pages.test.py](tests/pages.test.py), in light and dark: no requests off the local server, no serious or critical accessibility findings from axe-core, every control reachable by Tab with visible focus and no Tab traps, no console errors after clicking the buttons, and no broken relative links. How to run it is at the top of the file. It is an automated check only; testing by people who use a screen reader is still needed.

## Pull request safety

Every pull request is checked automatically by the PR guard ([tests/pr-guard.js](tests/pr-guard.js)). It reads the changed files as data and never runs them. It fails, with a plain-English reason, when a pull request:

- adds or changes anything in `.vscode/`, `.devcontainer/` or `.idea/` (editor settings can run commands as soon as a folder is opened), or in `.github/` unless it comes from the repository owner;
- adds a `package.json` or another file that runs code on install or build (`setup.py`, `build.rs`, git hooks and similar);
- adds a file type the repository does not already use, or a font outside `assets/fonts/`;
- adds a file over 300 KB, a binary file outside `assets/`, a symbolic link, or a line over 2,000 characters (the generated test logs in `prototype/edge-cases/inputs/` are exempt from this one) or with a run of 40 or more tabs or spaces (a trick that pushes code past the edge of the screen).

If a rule blocks a change that is genuinely needed, say so in the pull request and a maintainer will look. Run the check yourself with `node tests/pr-guard.js main HEAD` and its tests with `node tests/pr-guard.test.js`.

For reviewers: read the list of changed files before anything else. Do not open a pull request's branch in an editor, install it or run it until you have read every file it changes; if you must open it, use the editor's restricted mode (in VS Code, do not trust the folder). GitHub reads a workflow from the pull request itself, so a pull request that edits `.github/workflows/` can change its own checks: read those by eye before approving their workflow runs.

## Ground rules

- Be kind and assume good faith.
- Claims need sources. Label proposals as proposals.
- Nothing may collect or monetize user behavior data. This is a core design principle.
- Contributions are licensed **CC BY 4.0** for docs and research, and the [Apache License 2.0](LICENSE) for code.
