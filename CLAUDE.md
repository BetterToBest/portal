# CLAUDE.md

Citizens Internet Portal (CIP): a research proposal for transparent democratic participation, not a live voting system. Every rule and number is a proposal from the [paper](https://bettertobest.github.io/research-hub/citizens-internet-portal.html). Label proposals as proposals and give sources for claims.

## Layout

- `index.html`, `assets/`: the overview page.
- `docs/`: draft specs, plans and policies (threat model, voting rules, phase-3 plan, data-collection policy). Markdown only.
- `simulator/`: four single-page browser models (`ranked`, `liquid`, `fork`, and the voting model at `index.html`). Results are illustrative.
- `prototype/`: Phase 3 test log with two verifiers (`node/`, `python/`), `SPEC.md`, JSON Schema, test data, viewer page. Test data only.
- `tests/`: `prototype.test.js` and `ranked-choice.test.js`.
- `.github/workflows/`: CI, issue tooling and `apply-update.yml`.

## Commands

```bash
node tests/prototype.test.js                                  # needs Python 3 + `pip install cryptography jsonschema` (about 70 s)
node tests/ranked-choice.test.js simulator/ranked/index.html
node prototype/node/cip-log.js verify prototype/testdata/good.json
node prototype/node/make-answer-key.js --check                # generated files have --check modes; run it before regenerating
node prototype/node/build-viewer.js --check
```

Node 18 or later. The generators (`make-*.js`) rewrite files when run without `--check`; commit their output only when you meant to change it.

## Rules

- Nothing may collect or monetize user behavior data. No network calls, outside addresses, third-party scripts, fonts or images, or tracking code in the prototype, viewer or simulators. A test fails the build if they appear.
- `prototype/SPEC.md` is the source of truth. Both verifiers must agree with it and with each other; change the spec first, then both programs, the answer key and the tests.
- Keep dependencies few. The Node code uses built-in modules only.
- Docs are CC BY 4.0, code is Apache-2.0. Keep wording plain and honest about what is not built or reviewed.
- Do not commit build output such as `__pycache__`.
