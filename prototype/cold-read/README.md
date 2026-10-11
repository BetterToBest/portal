# Cold-read verifier (evidence, not a reference)

Two extra verifiers, each written by an AI helper from [`../SPEC.md`](../SPEC.md) alone (the first in Rust, the second in Go after the spec was clarified), plus each helper's log of every place the spec was unclear. **Not gate G1:** same model family, same project, no outside human. It is here so a reviewer can see what a reader with only the spec did. The result, and what changed in the spec because of it, is in [docs/spec-cold-read.md](../../docs/spec-cold-read.md).

| File | What it is |
|---|---|
| `DECISIONS.md` | The first helper's (Rust) log, D1 to D51, unedited. It was written against the spec **before** the clarifications in section 1, 5, 5.1, 6, 7 and 9, so some entries describe text that has since changed. |
| `DECISIONS-2.md` | The second helper's (Go) log, E1 to E60, unedited. It was written against the **clarified** spec, so it describes the spec as it stands, apart from the sentence that mentions the first cold read, which was removed from its copy. |
| `outputs.json` | What the Rust program printed for the test logs and checkpoints (verify, verify with a saved checkpoint, compare). |
| `go/` | The second program, standard library only: `go build -o cip-verify .`, then `verify`, `compare`, `checkpoint` (Save) and `sigcheck`. It matched the answer key, the 41 odd cases and all 62 edge cases ([`../edge-cases/`](../edge-cases/)). Same caveats as the Rust one. |
| `rust/` | The first program: `cargo build --release`, then `cip-verify verify <log>`, `cip-verify compare <a> <b>` or `cip-verify sigcheck <key> <message> <signature>`. It does not use any library's Ed25519 verify. It has not been reviewed, makes no network connections, and the project's tests do not run it. |

Nothing here is used by the other programs or the tests, except that a test checks these files are present.
