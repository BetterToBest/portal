# Changelog

Newest first, grouped by phase. CIP is a research proposal, not a live voting system: everything here is a draft, a model or test-data software, and none of it has had an outside review. Dates are commit dates. Versions are tags in the sense of "a point worth citing"; a tag is not a claim that the work has been reviewed.

## v0.3.0 (2026-10-28): Phase 3 prototype, for review

### Phase 3: prototype (test data only)
- A proposal flow page, [prototype/try/](prototype/try/index.html), that builds a test log step by step in the browser with a simulated clock (2026-10-28).
- A log viewer, [prototype/viewer/](prototype/viewer/index.html), that checks a log in the browser (2026-10-04).
- A written spec, [prototype/SPEC.md](prototype/SPEC.md), a JSON Schema, a language-neutral answer key, edge cases and deliberately corrupted test logs.
- Two verifiers, in Node and Python, written by the same author, that must agree with the spec and with each other (G1 is only partly met: it asks for at least three, one from someone else).
- Tests: `tests/prototype.test.js`, `tests/ranked-choice.test.js`, `tests/fork.test.js` with the halt-power sweep `tests/fork-sweep.js`, and `tests/pages.test.py` (browser and accessibility checks of every page; no screen-reader testing by people has been done).
- A draft [Phase 3 plan](docs/phase-3-plan.md) and [test plan](docs/phase-3-test-plan.md) with ten gates, most not met.

### Phase 4: privacy layer (design only)
- A first draft of options and a proposed ballot record shape, [phase-4-privacy-design.md](docs/phase-4-privacy-design.md). Nothing is built and no cryptographer has reviewed it (2026-10-28).

### Phase 2: simulators
- Four single-page browser models: one person one vote versus quadratic voting, liquid delegation, ranked-choice tie-breaks, and ledger fork and halt power. Results are illustrative, not predictions (from 2026-10-03).
- Halt-power model tests and a threshold sweep; the thresholds are placeholders (2026-10-28).

### Phase 1: specs and policies (drafts)
- Threat model, voting rules, ranked-choice rules, halt-power limits, data-collection policy, key handling, identity linking, checkpoints, advisory notice, pilot design, reviewer brief, a glossary and a pilot brief, all in [docs/](docs/).
- The 1,000-signature threshold is an accepted starting point that may change.

### Phase 5: pilot design (draft)
- A first draft in [pilot-design.md](docs/pilot-design.md) and a [pilot brief](docs/pilot-brief.md). No community is named or approached.

### Project and safety
- CLAUDE.md, a pull-request guard (`tests/pr-guard.js` and its workflow), and read-only CI for tests and page checks (2026-10-28).

## Phase 0: overview (2026-10-03)
- Overview page, README and CONTRIBUTING.md. Docs are CC BY 4.0; code is Apache-2.0.
