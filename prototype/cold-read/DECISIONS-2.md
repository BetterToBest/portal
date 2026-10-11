# DECISIONS.md - cold-read log for SPEC.md (CIP test log format and verification rules, draft v0.1)

Per entry: (a) where/what, (b) readings, (c) chosen and why, (d) confidence, (e) would two careful implementers differ.
Tags: [read] logged while reading, [code] while coding, [run] after running.

## Reading phase

### E1 [read] Section 1: duplicate object keys ("not defined: see section 9, question 6")
(a) Section 1 says two same-name keys in one object are "not defined"; 9.6 says the two reference programs quietly keep the last one and accept the file, and that a stricter verifier would disagree with them.
(b) keep last and accept; reject as BAD_FORMAT; first wins.
(c) Keep last, accept. It is the only behaviour the spec states for the programs it is the contract for. Applied everywhere (log, entries, records, bodies, checkpoints, trusted and compare files).
(d) medium.
(e) Yes, very likely. A normative spec that says "not defined" and then ships a test file for it is a gap.

### E2 [read] Section 2: "whole number inside the safe range ... read as that integer however it was written"
(a) 1.0 and 1e3 are integers. What about -0, 1E+3, 10e-1, 0.0e5, 1000000000000000000000e-10?
(b) accept only certain lexical forms; or evaluate the exact mathematical value.
(c) Exact decimal value, no floating point. Whole and |v| <= 2^53-1 gives an integer; -0 gives 0. Anything else (fractions, larger, 1e400) is "not allowed". Exponent of any length handled without computing 10^exp.
(d) medium-high.
(e) Possibly; a float64-based implementation would treat 9007199254740993 or 1.0000000000000000001 differently.

### E3 [read] Sections 1, 2, 6: where does a disallowed value (float, bool, null, lone surrogate) get reported
(a) Section 6.1 says an entry that "contains something not allowed by section 2" is BAD_FORMAT. Section 1 says anything else wrong with the file is a file-level BAD_FORMAT that stops everything.
(b) float inside entries[3] gives file-level BAD_FORMAT (where log, index 0, stop); or entry-level BAD_FORMAT at entry 3 and carry on.
(c) Attribute to the containing unit: entry-level for entries, CP_BAD_FORMAT for a log checkpoint, TRUSTED_ or CMP_BAD_FORMAT for those files. File-level only for: invalid JSON/UTF-8/BOM, not an object, key set not exactly {format, entries, checkpoints}, format not the string, entries or checkpoints not arrays.
(d) medium-high.
(e) Some chance of differing; section 1's list could be read to cover values anywhere in the file.

### E4 [read] Section 2: what is escaped in canonical strings
(a) "\u00xx in lowercase hex for other control characters". Is U+007F, U+2028 or "/" escaped? "Control characters" is not defined as a range.
(c) RFC 8785 behaviour: only U+0000..U+001F, quote and backslash escaped (with the short forms listed); all else raw UTF-8. Keys sorted by UTF-16 code units (own comparison after UTF-16 conversion).
(d) high.
(e) Low risk, but the spec could say "U+0000 to U+001F".

### E5 [read] Section 3: negative `index`: BAD_FORMAT or BAD_INDEX
(a) Section 3 puts "time >= 0" only on time; section 6.1 BAD_FORMAT lists "time >= 0" and not index.
(c) Negative index is BAD_INDEX (it is an integer, just not the position).
(d) high.
(e) Possible if an implementer assumes index is a non-negative integer.

### E6 [read] Section 5: checkpoint `time` and `size` constraints at format level
(a) Section 5 says only "size and time are integers". CP_BAD_SIZE exists for size below 1, so size must pass format when below 1. For time nothing says >= 0 (entries say it explicitly).
(c) Any integer is well formed for both. Negative checkpoint time is accepted everywhere.
(d) medium for time, high for size.
(e) Yes for time: copying the entry rule would add time >= 0.

### E7 [read] Section 5.1 Compare: size < 1
(a) With no log there is nothing to compare size against and no CMP error for it.
(c) Size 0 or negative is well formed in compare.
(d) medium-high.
(e) Maybe.

### E8 [read] Section 5: operator definition and "nothing else about entry 0 matters"
(a) Operator = author of entry 0 when its record has type genesis and author is 64 hex. Must entry 0 pass entry-level BAD_FORMAT?
(c) Only look at entry 0 being an object whose record is an object with type == "genesis" and author of 64 lowercase hex. Other shape errors in entry 0 do not remove the operator. "64 hex" uses the section 2 definition (lowercase).
(d) medium-high.
(e) Slightly: "64 hex characters" could be read case-insensitively.

### E9 [read] Section 5 vs 6: two notions of operator
(a) Section 5 (structural, for checkpoints) and section 6 step 2 ("genesis ... makes its author the operator", only when the genesis is usable).
(c) Keep both: checkpoint-operator (structural) and rule-operator (set only by a usable genesis at entry 0). They cannot disagree visibly because nothing is checked before a usable genesis (step 4), except in checkpoint checks.
(d) high.
(e) Low.

### E10 [read] Section 6.1: "recomputed hash is treated as 64 zeros" and BAD_PREV of the next entry
(a) Section 3 says prev must equal the STORED hash of the previous entry. If the previous entry is not an object, or its hash is missing or not a string, there is no stored hash.
(c) Compare as strings; a non-string/missing stored hash never equals, so BAD_PREV. Merkle leaf for a BAD_FORMAT entry is SHA-256(0x00 || 32 zero bytes).
(d) medium-high for the Merkle part, medium for the missing-hash part.
(e) Yes on the missing/odd stored hash.

### E11 [read] Section 6 integrity list: stop at first or report all of BAD_INDEX, BAD_PREV, BAD_HASH, BAD_SIG
(a) "It does not stop at the first error"; only BAD_FORMAT says the rest are skipped.
(c) Report all that fail, in that order.
(d) high.
(e) Low.

### E12 [read] Section 6 trusted checkpoint: order of checks
(a) Comma list "TRUSTED_BAD_FORMAT (stops), WRONG_OPERATOR, BAD_SIG, TRUNCATED (stops), MISMATCH"; the log checkpoints have an explicitly numbered order.
(c) Same order as listed, mirrors the CP list.
(d) medium-high.
(e) Low-medium.

### E13 [read] Section 6 trusted: log with no operator or no entries
(a) "or the log has none" is written only for CP_WRONG_OPERATOR.
(c) Same for TRUSTED_WRONG_OPERATOR; empty log gives TRUSTED_TRUNCATED too.
(d) medium-high.
(e) Low.

### E14 [read] Sections 6 and 7: trusted file unreadable while the log is file-level BAD_FORMAT
(a) Section 6: verification stops "before the trusted checkpoint is looked at". Section 7: unreadable file means exit 2.
(b
) read both files up front (missing trusted file gives exit 2); or read the trusted file lazily.
(c) Lazy: "not looked at" means never opened. A missing log is always exit 2.
(d) low-medium.
(e) Yes, plausible.

### E15 [read] Section 6 rule 1 TIME_REVERSED: "has a time that is an integer"
(a) Previous entry may be a non-object, have no time, time 1.5, "5", -3 (an integer, but BAD_FORMAT), 2^60 (whole but outside the safe range), or 1e3.
(b) integer = any whole JSON number; or integer in the section 2 sense (safe range, any sign).
(c) Section 2 sense: safe range, any sign; 1e3 counts as 1000. 2^60 is not "an integer" here.
(d) medium.
(e) Yes.

### E16 [read] Section 6 rule 2: what follows NO_GENESIS
(a) NO_GENESIS is not said to end the entry; the parenthesis says checks go on except where a step ends the entry.
(c) Entry 0 of unknown type gets NO_GENESIS then BAD_BODY; step 4 then stops further checks.
(d) medium-high.
(e) Yes possible (some would end the entry at NO_GENESIS).

### E17 [read] Section 6 rule 2: a genesis at index > 0 when entry 0 was not a genesis
(a) "A genesis anywhere else is DUPLICATE_GENESIS": position-based or "after a genesis was seen"?
(c) Position-based: any genesis at index != 0 is DUPLICATE_GENESIS and never sets the settings.
(d) medium.
(e) Yes plausible.

### E18 [read] Section 6 rule 2: entry 0 genesis with a bad body, or with an integrity error
(c) Neither sets settings; later entries only get steps 1 to 3 (TIME_REVERSED, NO_GENESIS/DUPLICATE_GENESIS, BAD_BODY). Matches section 7 "summary null when no usable genesis".
(d) high.
(e) Low.

### E19 [read] Section 6 steps 2 and 3: DUPLICATE_GENESIS comes before BAD_BODY
(c) A
 second genesis with an invalid body gets only DUPLICATE_GENESIS (step 2 ends the entry).
(d) high.
(e) Low.

### E20 [read] Section 6 step 5 register_key: "Each ends the entry"
(a) Three checks (SELF_REGISTER_MISMATCH, DUPLICATE_KEY, BAD_L
ABEL), "each ends the entry". A mismatch and a bad label together: one error or two?
(c) One: the first applicable in listed order.
(d) medium-high.
(e) Yes possible.

### E21 [read] Section 6 steps 6 to 10: order of errors for amend, sign, comment
(c) UNREGISTERED_AUTHOR, UNKNOWN_PROPOSAL, PROPOSAL_CLOSED, then NOT_PROPOSER (amend) or STALE_VERSION, DUPLICATE_SIGNATURE (sign); each ends the entry. A closed proposal never shows NOT_PROPOSER.
(d) high.
(e) Low.

### E22 [read] Section 6 step 10 and States: "threshold time"
(a) "When the count reaches the threshold, this entry's time becomes the threshold time." Amend clears signatures, so the time must be forgotten; later signatures must not move it.
(c) Threshold time is set by the sign entry whose increment makes count equal threshold, and cleared by amend.
(d) high.
(e) Low-medium (">=" implemented carelessly would move it).

### E23 [read] Section 6 States: an entry whose time is earlier than the threshold time
(a) TIME_REVERSED is only a rule error, so an entry can have t below the threshold time while signatures >= threshold. Spec says collecting is by count, comment starts "from the threshold time", closed starts at T + comment_seconds. The case t < T is silent.
(c) State: collecting if count < threshold; else closed iff t >= T + comment_seconds; else comment. So t < T gives comment.
(d) medium.
(e) Yes (spec silent).

### E24 [read] Section 6 States: comment_seconds = 0
(c) Interval [T, T+0) is empty: closed from the very entry reaching the threshold onward (later entries with t >= T).
(d) high.
(e) Low-medium.

### E25 [read] Section 6 step 9: amend with identical title and text
(a) "adds a version and clears all signatures": always, or only if the version hash changes?
(c) Always: versions + 1, same hash possible, signatures cleared.
(d) medium.
(e) Yes plausible.

### E26 [read] Section 6 step 9 and States: amend in comment state
(c) Signatures cleared, count 0 < threshold, so the proposal returns to collecting and the threshold time is forgotten. Consistent with "amendments in the same states" and with 9.1.
(d) medium-high.
(e) Low.

### E27 [read] Section 7 "States ... judged at the time of the last entry that passed the integrity checks"
(c) Highest-index entry with no integrity error (it may have rule errors); use its stored time, not the maximum time.
(d) medium-high.
(e) Possible.

### E28 [read] Section 4.1/4.2 referenced files are not in the folder
(a) schema/, vectors/ed25519-odd-cases.json (41 cases), vectors/other-libraries/, python/make-ed25519-vectors.py, docs/phase-3-plan.md are not available. Section 4.2 says a verifier that differs on any of the 41 cases has not followed the section, but a reader of SPEC.md alone cannot run them.
(c) Not available. I use RFC 8032 test vectors from memory plus hand-built edge cases. Cold-read finding: the conformance suite is not self-contained.
(d) n/a.
(e) n/a.

### E29 [read] Section 4.2 rule 4: "R must be the canonical encoding of a point"
(a) Rule 2 spells out canonical for the key; rule 4 does not for R.
(c) Same canonical test as rule 2 (y < p, and if y is 1 or p-1 the sign bit is 0), then decode as a point (square root must exist).
(d) high.
(e) Low-medium.

### E30 [read] Section 4.2: is R of small order (e.g. the identity) refused
(a) Rule 3 names "the key" only. Rule 5 refuses any R with [L]R not the identity, which removes every small-order R except the identity itself.
(c) R = identity is not refused by rule 3; it passes if the equation holds.
(d) medium-high.
(e) Low-medium.

### E31 [read] Section 4.2 typos and gaps
(a) Rule 1: "the signature is 128 (sections 3 to 5)" is missing "lowercase hex characters". The intro lists the places a signature occurs but not the compare files. Rule 2 states the sign-bit rule only for y = 1 and y = 2^255-20, which are exactly the x = 0 cases; clear.
(c) read as intended.
(d) high.
(e) no.

### E32 [read] Section 5.1 Compare: output when the relation is conflict
(a) conflict is reported as CMP_CONFLICT (an error), ok is "true only when there are no errors", yet relation and operator are non-null.
(c) ok false, errors [CMP_CONFLICT where both], relation "conflict", operator = the shared operator.
(d) medium-high.
(e) Possible.

### E33 [read] Section 5.1 Compare: operator value and error order
(c) operator is non-null only when no format, operator or signature error. Errors in order: CMP_BAD_FORMAT (a, b), CMP_DIFFERENT_OPERATOR, CMP_BAD_SIG (a, b), CMP_CONFLICT.
(d) medium-high.
(e) Low.

### E34 [read] Section 5.1 Compare: different-size
(c) No errors, so ok true and exit 0, relation "different-size". Time is ignored for identical.
(d) medium-high.
(e) Possible.

### E35 [read] Section 5.1 Save
(a) "log with no integrity errors": does that include errors of other checkpoints (CP_*)? Output layout not specified.
(c) Run the full verification without a trusted checkpoint; save only if integrity_errors is empty. Print compact JSON, keys in section 5 order. A negative or too large --index "does not exist" (exit 1); a non-numeric one is a bad command line (exit 2).
(d) medium-high.
(e) Yes plausible.

### E36 [read] Section 7 exit codes for compare, checkpoint and sigcheck
(a) Section 7 covers verify only; unreadable compare inputs are not specified.
(c) Unreadable file or bad command line: message on stderr, exit 2, for all commands.
(d) medium.
(e) Yes.

### E37 [read] Section 4 and 6.1: a body with extra or missing keys, wrong value types
(c) Extra or missing keys, or a wrong type (string where integer expected), is BAD_BODY. Booleans, null, fractions anywhere is BAD_FORMAT (section 2) and takes precedence. A threshold 2.0 reads as 2.
(d) medium-high.
(e) Possible.

### E38 [read] Section 4 genesis limits
(c) No upper bound beyond the safe range.
(d) high.
(e) Low.

### E39 [read] Section 6.1: unknown or odd `type` string
(c) Any string not in the table (also empty) is BAD_BODY. Non-string type is BAD_FORMAT.
(d) high.
(e) Low.

### E40 [read] Section 6.2 BAD_PREV is positional
(c) Compared with the stored hash of the previous entry in list order, not with the entry whose index field is i-1.
(d) high.
(e) Low.

## Coding and running phase (continued from E40)

### E41 [code] Command line: sigcheck exit code and argument handling
(a) The task text for sigcheck says only "prints exactly true or false". SPEC.md defines no command line at all (section 5.1 says "both verifiers provide them" without names; section 7 gives exit codes for verify only).
(b) exit 0 for true and 1 for false (like verify/compare); or exit 0 whenever the command ran.
(c) Exit 0 for both, 2 only for a bad command line. The answer is the output, not a failure. Shape errors in key or signature (upper case hex, wrong length) print false (rule 1). Message bytes are taken exactly as given on the command line.
(d) low-medium.
(e) Yes, likely. The spec leaves the whole CLI, flag names, output layout of Save and exit codes of Compare/Save/sigcheck to the implementer.

### E42 [code] Section 4.2 rule 5 for an R that is the identity, and rule order
(a) Rule 5 "[L]R must be the identity". With R = identity (y=1, sign 0) rule 2 passes, rule 3 applies to the key only, rule 4's equation can hold, and rule 5 passes.
(c) Accepted if the equation holds (as E30). Order of the five rules does not matter for a boolean result, so I check shape, canonical key, small-order list, S<L, R decode, equation, then the two subgroup checks (cached per 32-byte string).
(d) medium-high.
(e) Low-medium.

### E43 [code] Section 4.2 rule 2/3: small-order list includes non-canonical-looking entries?
(a) All eight listed encodings turned out canonical when decoded (I checked: each decodes and 8P is the identity). So rule 3 can never catch something rule 2 already refused; only rule 5 vs rule 3 overlap is mentioned by the spec (identity passes rule 5).
(c) Nothing to decide. A hard spot that turned out clear.
(d) high.
(e) no.

### E44 [code] Section 6 step 5: label "starts with test-"
(a) "BAD_LABEL if the label does not start with test-". Case-sensitive? Does "test-" alone pass (label 1 to 40 chars, so yes)? Is a label like "Test-x" or with a leading space bad?
(c) Plain case-sensitive code-unit prefix test "test-"; "test-" alone passes. Label length is already checked by BAD_BODY (code points, 1 to 40).
(d) high.
(e) Low.

### E45 [code] Section 6 step 5 before step 6: an unregistered author may register_key (for itself)
(a) Step 5 (register_key) is evaluated before step 6 (UNREGISTERED_AUTHOR), so anyone, registered or not, can register their own key; the registration rule is only about label, duplicate, self.
(c) Implemented literally. This is clearly the intent (it is how keys get registered at all) but the spec never says that register_key is exempt from UNREGISTERED_AUTHOR in words.
(d) high.
(e) Low.

### E46 [code] Section 6 step 6: does the genesis itself go through UNREGISTERED_AUTHOR
(a) "Every other type" than register_key includes genesis and propose etc. The genesis author becomes operator and "counts as registered", so it never fails; but a genesis at entry 0 with a bad body never sets settings.
(c) Genesis at entry 0 with good body: sets operator, registered; no further check. Genesis elsewhere: DUPLICATE_GENESIS, done.
(d) high.
(e) Low.

### E47 [code] Section 6 step 8: amend/sign/comment closed-test uses this entry's own time even when that time is lower than the threshold time
(a) Same hole as E23 shows up in the code path: stateAt(p, t) with t < T gives "comment" so a late-stamped (time-reversed) entry is accepted as being inside the comment period, and with comment_seconds = 0 and t < T it is also "comment" (interval [T,T) is empty, but t < T is not "closed").
(c) closed iff count >= threshold and t >= T + comment_seconds. Consequence: with comment_seconds 0 a time-reversed entry before T is not closed. Silent in the spec.
(d) medium.
(e) Yes.

### E48 [code] Section 6 "amend ... clears all signatures" and the sign STALE_VERSION test after an identical amend
(a) After an amend that changes nothing the version hash is the same as before. A `sign` entry carrying that same hash is then "the current version" and counts, even though the signer may have signed "the earlier" version. Signatures are cleared so the signer may sign again (not DUPLICATE_SIGNATURE).
(c) Literal: versions are compared by hash only. (Related to E25.)
(d) medium.
(e) Yes plausible (an implementation that tracks versions by number would call it stale).

### E49 [code] Section 5, log checkpoint signature is checked against which key
(a) Section 5: "sig is by operator". If the checkpoint's operator is not the log's operator, is CP_BAD_SIG tested against the checkpoint's own operator field (so a validly self-signed foreign checkpoint gives only CP_WRONG_OPERATOR), as section 5.1 says for compare?
(c) Yes, against the checkpoint's own operator field. Input e33 (wrong operator, good signature) then gives exactly CP_WRONG_OPERATOR. Section 9 q7 says an empty log gives a checkpoint "CP_WRONG_OPERATOR and CP_BAD_SIZE": consistent only if the signature is checked against the checkpoint's own operator (it would also be CP_BAD_SIG otherwise).
(d) medium-high.
(e) Low-medium. The section 6 list does not say which key.

### E50 [code] Section 6 trusted checkpoint: checking order and the "stops" rule when size is bad
(a) TRUSTED_TRUNCATED "stops"; TRUSTED_BAD_SIG is reported before it. So a trusted checkpoint with a changed size (signature no longer matches) reports TRUSTED_BAD_SIG and TRUSTED_TRUNCATED (input e44).
(c) Order as listed (E12). WRONG_OPERATOR and BAD_SIG do not stop later checks.
(d) medium-high.
(e) Low-medium.

### E51 [code] Section 7 `summary.registered`: counted by successful register_key entries
(a) "the number of keys registered, not counting the operator".
(c) Count of register_key entries that registered a key (entries with integrity errors do not count since they are skipped).
(d) high.
(e) Low.

### E52 [code] Section 7 `comments`: "number of valid comments"
(c) A comment entry that passed every check (no integrity or rule error). A comment that is only TIME_REVERSED (an error but "the check goes on") is a rule error; I still count it, because TIME_REVERSED says the check goes on and the entry is otherwise processed. Input rule-time-reversed shows comments: 3 versus 2 in the base log.
(d) medium.
(e) Yes. "valid" could mean "has no error at all". Summary counts of other kinds (signatures) have the same question: a TIME_REVERSED sign is still recorded.

### E53 [code] Section 6 step 1: TIME_REVERSED does not end the entry
(a) "The check goes on." I implemented it so, and the entry is processed (and may add state) even though it is reported.
(d) high.
(e) Low. See E52 for the consequence for the summary.

### E54 [code] Command line: `verify` option forms
(a) "a command line they do not understand" is exit 2, never defined.
(c) `verify <log> [--trusted <file>]` options in any order; a second positional, an unknown option, a repeated --trusted or a missing value is exit 2. For `checkpoint`, `--index` with a non-integer is exit 2, a negative or huge integer "does not exist" (exit 1, nothing on stdout).
(d) low-medium.
(e) Yes.

### E55 [code] Section 6 BAD_PREV when the previous entry is not an object or lacks a string hash
(a) E10. Implemented: previous stored `hash` must be a string equal to this entry's `prev`; otherwise BAD_PREV. A malformed previous entry whose hash is a valid 64 hex still serves as the reference.
(d) medium.
(e) Yes.

### E56 [run] The supplied good logs verify end to end
(a) inputs/good.json gives ok true with all hashes, signatures and Merkle roots matching, which exercises sections 2, 3, 4.2 (written on math/big) and 5 together. RFC 8032 test vectors 1 and 2 give true, S+L gives false, upper-case hex gives false, a small-order key gives false. A real check that my canonical form and signature code agree with whatever produced the inputs; no expected outputs were consulted.
(d) n/a.

### E57 [run] Section 5.1 Compare: sizes differ AND roots differ, or sizes equal and roots equal
(a) The relation list: identical (same size and root), different-size, conflict (same size, different roots). Same root with different size is not possible in a real log but is possible in hand-made files. Time is ignored.
(c) Different size wins: any size difference is different-size, whatever the roots; same size: root equal is identical (even with different times), else conflict.
(d) medium-high.
(e) Low.

### E58 [run] Section 5.1 Compare: CMP_BAD_SIG for a size 0 checkpoint (c08)
(a) Size 0 is well formed (E7). Input c08 has a signature that does not verify (it was edited after signing, presumably), so CMP_BAD_SIG; had it been validly signed, compare would give different-size.
(c) No size rule in compare, as E7. Result: relation null and CMP_BAD_SIG only.
(d) medium.
(e) Possible.

### E59 [run] Spec text oddities seen while coding (typos and cross-reference problems)
(a) 1. Section 4.2 "Why" paragraph: "All accepted the same 15 of those 40, and 13 of those break rule 2 or rule 3". Section 4.2 "test cases" says 1 of 41 must pass. 15 - 13 = 2 accepted by libraries that break neither rule 2 nor 3; only one of them can be the honest signature, so the other must be refused by rule 4 or by rule 5 (added later, with the 41st case). The numbers are not verifiable from SPEC.md alone and read as slightly inconsistent.
2. Section 4.2 rule 1: "the signature is 128 (sections 3 to 5)" lacks the noun (characters).
3. Section 1: "The same goes for the other two files a verifier reads" while section 5.1 has a fourth input kind (checkpoints for compare). It is stated in the same sentence, so fine.
4. Section 4.1 says the schema describes "everything in sections 1 to 5" and the tests compare it "on every test log"; schema and vectors are not in this folder (E28).
5. Section 6 intro: "for the trusted checkpoint, where is trusted" but section 5.1 compare errors use `a`, `b`, `both`; `where` has different vocabularies in the two outputs. By design (stated in 5.1).
6. Section 7: "Both programs exit with 0..." refers to the Node and Python programs; there is no statement for Compare/Save exit codes (E36).
7. Section 9 q7 says a checkpoint in an empty log gets CP_WRONG_OPERATOR and CP_BAD_SIZE; it can also get CP_BAD_SIG if the signature is wrong (E49).
(d) n/a.
(e) n/a.

### E60 [run] bad-checkpoint.json is a log, not a checkpoint file
(a) The task rule says skip names containing "checkpoint"; inputs/bad-checkpoint.json is actually a log with a bad second checkpoint (CP_BAD_SIG, CP_BAD_ROOT at checkpoint 1). I also saved its output as outputs/bad-checkpoint.out/.code in addition to the requested set.
(d) n/a.
