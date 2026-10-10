# DECISIONS (cold read of SPEC.md "CIP test log format and verification rules, draft v0.1")

Format per entry: (a) spec place, (b) readings, (c) chosen + why, (d) confidence, (e) would two careful implementers differ?
Entries are appended as I read and code. "Batch 1" = written after the first full read, before any code.

## Batch 1 (reading)

### D1 Unparseable file / invalid JSON
(a) §1 "Anything else is BAD_FORMAT (location log)"; §6 has no code for "not JSON".
(b) invalid JSON could be (i) BAD_FORMAT/log, (ii) a crash/usage error with no JSON result, (iii) some unnamed code.
(c) (i): BAD_FORMAT, where "log", index null, verification stops, summary null. It is the only code with location `log`.
(d) medium. (e) Probably some would exit with an I/O error instead.

### D2 `where` and `index` of errors that are not about checkpoints
(a) §6 "The verifier reports errors as {code, where, index}"; only checkpoint ("checkpoint", position), trusted ("trusted", 0), and "log" (BAD_FORMAT) are named; compare names a/b/both.
(b) For entry errors `where` could be "entry", "entries", "log", the record, ...; index could be the entry position (clear). For log-level BAD_FORMAT and CMP_* with `both`, index could be null, 0, or absent.
(c) entry integrity errors and all rule errors: where "entry", index = position. Log-level: where "log", index null. Compare: where "a"/"b"/"both", index null. Key always present.
(d) low on the strings "entry" and null. (e) YES, near certain: `where` for entry/rule errors is simply not specified.

### D3 Output formatting / exit code
(a) §7 "print the same JSON"; nothing on whitespace, key order, exit codes.
(c) pretty JSON (2 spaces), key order as listed in §7 (ok, integrity_errors, rule_errors, summary). Exit 0 if ok true, 1 if ok false, 2 on usage or unreadable file. sigcheck prints true/false and exits 0 either way. Compare: 0 if ok, 1 if not.
(d) high that it is a free choice. (e) YES on exit codes (spec silent).

### D4 Missing/unreadable files
(a) nothing. (c) Treated as an environment error: message on stderr, exit 2, no JSON. For --trusted likewise (I do not map a missing file to TRUSTED_BAD_FORMAT, since "format" is about content; an unparseable one IS TRUSTED_BAD_FORMAT).
(d) medium. (e) yes.

### D5 BAD_FORMAT vs BAD_BODY overlap
(a) §6 integrity 1 "the entry or its record breaks section 3 or 4" vs rule 3 "BAD_BODY: the body does not match section 4". §4 includes the body shapes, so by integrity 1 a bad body is BAD_FORMAT and the entry would then be skipped in the rule stage, so BAD_BODY could never fire. §4.1 says "BAD_FORMAT, BAD_BODY and CP_BAD_FORMAT checks" look at shape (so BAD_BODY is a shape check).
(b) (i) BAD_FORMAT covers everything but per-type body shape; BAD_BODY covers per-type body shape (keys, types, ranges, lengths, hex). (ii) BAD_FORMAT covers body too, BAD_BODY dead code.
(c) (i). Entry-level: five keys, types, index/time integers, time>=0, prev/hash hex64, record exactly 4 keys, type is a string, author hex64, sig hex128, body is an object, and "nothing from section 2" anywhere inside. BAD_BODY: body keys/ranges/lengths/hex for its type, and unknown type.
(d) medium. (e) YES, this is a major divergence point.

### D6 Unknown record `type` string
(a) §4 table lists six types; says nothing about others. (b) BAD_FORMAT (record breaks §4) / BAD_BODY (no body shape fits) / ignored. (c) BAD_BODY (the type string is just a string; the shape table fails). At entry 0 this means NO_GENESIS then BAD_BODY. (d) low-medium. (e) YES.

### D7 Section-2 violations inside a body (e.g. `"threshold": 1.5`, `true`, `null`, a body with an array of floats)
(a) §2 "Not allowed anywhere"; §6 integrity 1 "contains something not allowed by section 2". (c) BAD_FORMAT (integrity), not BAD_BODY, whenever such a value appears anywhere in the entry, even in a field the type would not check. (d) medium-high. (e) some may call a float threshold BAD_BODY.

### D8 Duplicate object keys
(a) spec silent (§2 "so that every JSON parser sees the same value" hints it cares). (b) last wins / first wins / reject. (c) A repeated key means the object does not have "exactly" the right keys, and is also treated as not allowed anywhere inside an entry, so: BAD_FORMAT for the entry (CP_BAD_FORMAT, TRUSTED_BAD_FORMAT, CMP_BAD_FORMAT for checkpoints; BAD_FORMAT/log at top level). Duplicate keys at any depth inside an entry also give BAD_FORMAT. (d) medium. (e) YES (parsers differ: JS and Python both take last).

### D9 Numbers: what "integer" means for out-of-range, `-0`, exponent forms
(a) §2. Whole number with |v| <= 2^53-1 is read as integer "however it was written" (1.0, 1e3). I parse JSON myself with exact decimal arithmetic (serde_json would lose 1e400, 1.0000000000000000001 etc.). Value -0 and 0.0e5 are 0 and canonicalise as `0`. `1.5e1` = 15 is whole so is accepted. `1e400`, `9007199254740992`, `0.5`, `1.0000000000000000000001` are "other numbers" (not allowed). A very large exponent on zero (`0e999999999`) is 0. (d) medium-high. (e) Possibly: an implementer using f64 would call 9007199254740993.0 or 1.00000000000000001 differently. The spec does not say whether the *value* is judged exactly (I do) or after a double conversion.

### D10 Negative integers
(a) §3 only says time >= 0; "index and time are integers". Negative `index` therefore is not a format error but BAD_INDEX. Negative checkpoint `size`/`time` is format-valid; negative size gives CP_BAD_SIZE ("below 1"). §2 allows |v| <= 2^53-1 so negatives are legal numbers. (d) medium. (e) yes (a JSON-Schema with minimum 0 on index would differ).

### D11 `format` value
(a) §1 "Exactly those three keys" shows the value "cip-test-log/0" in the example only. (c) I require the string "cip-test-log/0" exactly, otherwise BAD_FORMAT/log. Also `entries` and `checkpoints` must be arrays. (d) medium-high. (e) a bit.

### D12 Empty entries list
(a) nothing. With zero entries no entry-0 rule fires, so no NO_GENESIS; the result is ok true, summary null. Checkpoints (if any) get CP_WRONG_OPERATOR + CP_BAD_SIZE. (d) low. (e) yes. (Looks like a hole: an empty log is "ok".)

### D13 Which entry is "valid genesis" => who is the operator
(a) §5 "The operator is the author of entry 0 when entry 0 is a valid genesis record." "valid" is not defined; §6 ordering has the integrity checks (checkpoints) needing the operator, while genesis body validity (BAD_BODY) is a rule-stage check.
(b) valid = type genesis only / + record signature OK / + no integrity error / + body OK.
(c) entry 0 has no integrity error (BAD_FORMAT/INDEX/PREV/HASH/SIG), type is genesis, and body matches the genesis shape. Same as "usable genesis" in the rule stage and in §7, so the operator, the settings, and "summary not null" agree.
(d) medium. (e) YES (e.g. entry 0 with BAD_HASH: valid record, wrong entry).

### D14 Does the operator's own key count as "already registered" for DUPLICATE_KEY
(a) §6 rule 5 "DUPLICATE_KEY if already registered" vs rule 6 "(the operator counts as registered)" vs §7 "registered (registered keys, not counting the operator)".
(b) operator registering itself: (i) DUPLICATE_KEY; (ii) accepted, and then excluded from the `registered` count.
(c) (i): the operator counts as registered everywhere, so `registered` is simply the size of the set of keys added by register_key. (d) low-medium. (e) YES.

### D15 Number of errors per entry in step 10 (sign)
(a) §6 rules 5 and 8 say "Each ends the entry". Rule 10 does not. (b) STALE_VERSION and DUPLICATE_SIGNATURE can both be reported for one entry / first ends. (c) both are independent checks; "Otherwise records the signature" only if neither fired. DUPLICATE_SIGNATURE is judged against the author's membership in the proposal's current signature set (which is emptied by each amend), regardless of the version named in the entry. (d) low-medium. (e) YES.

### D16 TIME_REVERSED: which "previous entry"
(a) §6 rule 1 "the previous entry's time is an integer and this entry's time is smaller". (b) previous in file position (even if skipped/malformed) / previous non-skipped. The phrase "is an integer" suggests the previous entry can be malformed, hence position. (c) position i-1 raw `time` value, whatever integrity state it is in, if it is an allowed integer (including negative). Equal times are fine. (d) medium. (e) yes.

### D17 Rule-stage handling of entry 0 skipped by integrity error
(a) §6 "Entries that have any integrity error are skipped." (c) Entry 0 skipped => no NO_GENESIS error for it (entry is skipped), no settings. Later non-genesis entries: BAD_BODY is still checked (rule 3 precedes rule 4), then nothing else. A later `genesis` entry is DUPLICATE_GENESIS even though none was ever set ("a genesis anywhere else"). (d) medium. (e) yes.

### D18 Genesis with bad body at entry 0
(a) rule 2 "Entry 0's genesis sets the settings" and rule 3 BAD_BODY "entry is done". (c) Settings are set only if the body is valid. A bad genesis body: BAD_BODY, no settings, summary null. (d) medium. (e) some.

### D19 Genesis is checked for UNREGISTERED_AUTHOR?
(a) rule 6 "Every other type". Entry 0 genesis author is the operator, which counts as registered, so harmless. No difference in outcome. (d) high.

### D20 Closed-state test and time before threshold time
(a) §6 States. "collecting while signatures < threshold; comment from threshold time until threshold time + comment_seconds (not including that moment); closed from then on." For an entry whose `time` is earlier than the threshold time (possible after TIME_REVERSED) no state is defined. (c) closed iff signatures >= threshold AND t >= threshold_time + comment_seconds. Otherwise (earlier t) it is "comment". Collecting is by count only. (d) medium. (e) yes (edge case only).

### D21 Threshold time after amend / more signatures
(a) rule 9 "clears all signatures"; rule 10 "When the count reaches the threshold, this entry's time becomes the threshold time." (c) amend (allowed in comment state) clears signatures AND the threshold time, so the proposal goes back to collecting. Signatures after the threshold is reached keep adding to the set but do not move the threshold time (count "reaches" it once). (d) medium-high. (e) small.

### D22 Open question 4 vs §6 states text
(a) §9.4 "What should happen at the exact moment a comment period ends?" vs §6 "(not including that moment)". The text already answers: closed at that moment. I treat §6 as normative and §9.4 as stale. Closed at t >= tt + cs. With comment_seconds 0 the comment period is empty. (d) high on reading, but the question suggests the authors may be unsure. (e) low.

### D23 Summary: counts or lists
(a) §7 "`entries`, `registered` (registered keys, not counting the operator), `comments` (valid comments), and `proposals` ... `versions`, `version` (current version hash), `signatures`".
(b) `entries`, `registered`, `comments`, `versions`, `signatures` as numbers vs as lists (registered keys, versions hashes, signers). `version` being the current hash separately suggests `versions` is a count; "valid comments" suggests a count of comments; "registered keys" could be a list.
(c) all five are integers. `entries` = length of the entries array (all entries, including those with integrity errors). `signatures` = count on the current version. (d) low-medium. (e) YES.

### D24 Summary `state` strings and summary time
(a) §7 / §6 States name the states "collecting", "comment", "closed". I use exactly those lowercase strings. Summary time = `time` of the last entry (by position) that has no integrity error; (this is not the maximum time). If that entry... always exists when summary is not null (genesis passed). (d) medium-high. (e) small.

### D25 What `valid comment` / `registered` count in the summary
(a) §7. valid comment = a `comment` entry that passed every rule check (no rule error). Registered = successfully registered keys. (d) high. (e) low.

### D26 Version hash, versions on identical amend
(a) §4 "a new one for each amend". An amend with the same text gives the same version hash again. I still append, `versions` counts amends+1. (d) medium. (e) low-medium.

### D27 Merkle root details
(a) §5. One leaf: root = SHA-256(0x00 || h). Split at largest power of two strictly smaller than count (RFC 6962). Leaf data = the 32 bytes decoded from the recomputed hash hex; for a BAD_FORMAT entry (hash "64 zeros") it is 32 zero bytes. (d) high. (e) low, except an implementer might hash the 64-char text.

### D28 Which sig key is used for CP_BAD_SIG when operator is wrong
(a) §5 "sig is by operator", §6 rules 2 and 3 are separate. (c) the signature is verified against the checkpoint's own `operator` field, independently of CP_WRONG_OPERATOR, so both errors can appear. (d) medium-high. (e) some.

### D29 Checkpoint stop rules and what size error implies
(a) §6 CP_BAD_SIZE "Stops the checks for that checkpoint"; CP_BAD_ROOT after. CP_WRONG_OPERATOR and CP_BAD_SIG do not stop. (c) as written. (d) high. (e) low.

### D30 Checkpoint `size`/`time` and format (§5)
(a) §5 "size and time are integers" — no minimum (see D10). (c) time may be negative; not used. (d) medium.

### D31 Trusted checkpoint when the log has a log-level BAD_FORMAT
(a) §1 "verification stops". (c) --trusted is then not examined; output has only the BAD_FORMAT. (d) medium. (e) yes.

### D32 §4.2 on keys that are not a point
(a) rule 2 only checks y < p and the x=0 sign rule; it does not say the y must give a point. (c) a key (or R) whose y gives no x on the curve fails (can't compute rule 4/5). (d) high. (e) low.

### D33 §4.2 "R must be the canonical encoding of a point"
(a) rule 4. The canonical-key rule (rule 2) is spelled out but for R only the phrase is given. (c) same test as rule 2 applied to R plus it must decode (y<p; x=0 => sign 0). R of small order is NOT refused by rule 4 itself but by rule 5 unless it is the identity, which passes (R = identity encoding 0100..00 is accepted by rules 4 and 5; the text says so itself for A in rule 5 only for the identity "passes this rule"). (d) medium. (e) yes: whether R=identity (or any torsion-free point) can ever pass is a corner nobody may test.

### D34 §4.2 rule 1 vs BAD_FORMAT
(a) rule 1 says shape is checked by 4.2; in `verify` shapes were already a BAD_FORMAT (hex lengths, lowercase) for records, CP_BAD_FORMAT, etc., which "stop" before the sig check, so rule 1 never fires there; only sigcheck (and compare via CMP_BAD_FORMAT first) can see it. §6 says BAD_SIG covers "an invalid key or signature" – i.e. rules 2-5 only. (d) high. (e) low.

### D35 Hash of an entry that is BAD_FORMAT
(a) §6 "its recomputed hash is treated as 64 zeros". (c) used for Merkle leaves (32 zero bytes). It is NOT used for the next entry's prev check, which uses the *stored* hash (§3). If that stored hash is absent or not a string, then no prev can match: BAD_PREV for the next entry. (d) medium-high. (e) some.

### D36 Strings: length, normalization, unpaired surrogates
(a) §4 "strings are measured in Unicode code points", §2 "strings with unpaired surrogates" not allowed. (c) lengths counted in code points on the decoded string; no Unicode normalization; \u escapes parsed as UTF-16 units, pair 😀 is one code point, any lone half is a section-2 violation (BAD_FORMAT / CP_BAD_FORMAT ...). Invalid UTF-8 in the file or a UTF-8 BOM => not valid JSON (D1). Raw control chars in strings invalid JSON. Keys are strings too (lone surrogate in key is a violation). (d) medium. (e) some (BOM!).

### D37 Spec references not available
(a) §4.1, §4.2 mention schema/cip-test-log.schema.json, schema/examples, vectors/ed25519-odd-cases.json, vectors/other-libraries, python/make-ed25519-vectors.py, docs/phase-3-plan.md, prototype/, node/cip-log.js, python/verify.py. None are in the folder; I could not run the 41 vector cases. The spec says "the two verifiers", it does not mention a third; "both verifiers provide" Save/Compare — Save has no CLI here.
(e) n/a. A cold reader cannot check §4.2 against the 41 vectors without them.


## Batch 2 (coding, review and runs)

### D38 Where trusted-checkpoint errors are listed
(a) §6 "Trusted checkpoint (optional, where is trusted, index 0)" sits under the "Integrity errors" heading, after the per-checkpoint checks; §7 "Errors are listed integrity first, in the order above".
(b) trusted errors in integrity_errors (after the log's own checkpoint errors) / in rule_errors / in a separate list.
(c) integrity_errors, after all CP_* errors, before any rule error. §7 names only two error lists and §6 puts it in the integrity part.
(d) medium-high. (e) low-medium.

### D39 Command line shape and exit codes
(a) §7 silent on CLI; the task gives `verify <log> [--trusted <cp>]`. (c) `--trusted` accepted after or before the log path. exit 0 = ok true, 1 = ok false, 2 = usage / unreadable file (no JSON). sigcheck prints true/false, exit 0 either way. compare: 0 if ok else 1. (d) high that it is free. (e) YES (exit codes are not specified at all).

### D40 Compare: what stops what
(a) §5.1 "The errors, in order, are CMP_BAD_FORMAT (where is a or b; per checkpoint), CMP_DIFFERENT_OPERATOR (where is both), CMP_BAD_SIG (per checkpoint)... relation (null when a format, operator or signature error stops the comparison)".
(b) (i) any format error stops everything after it (operator and sig checks need both well-formed files); an operator error then still allows the two sig checks; (ii) an operator error also stops the sig checks; (iii) all sig checks run whenever the checkpoint itself is well-formed.
(c) (i): if either file is badly formed, only the CMP_BAD_FORMAT errors (a then b) are reported; otherwise operator check, then both sig checks (a then b) even if the operators differ; relation/operator null if any error so far; else relation computed. CMP_CONFLICT is added to `errors` only for a conflict, and then relation is "conflict" and operator is set (the spec says relation is null only when format/operator/sig error stops it, and a conflict is not one of those). `time` and `sig` are ignored in the relation: same size and same root is `identical` even if the times differ.
(d) medium. (e) YES: whether sig checks run after a different-operator error, and whether a half-bad pair still reports the other file's problems.

### D41 Compare: `index` of errors, and is a conflict `ok`
(a) §5.1 "ok (true only when there are no errors)"; CMP_CONFLICT is "reported as" an error. (c) so a conflict gives ok false. `index` key is present and null (no position in a two-file operation). A "different-size" relation with no errors is ok true. (d) medium. (e) yes (index null vs absent vs 0).

### D42 Compare: what "format" means
(a) §5.1 CMP_BAD_FORMAT is per checkpoint file. (c) same test as CP_BAD_FORMAT: valid JSON, exactly five keys, hex shapes (lowercase, 64/64/128), size and time integers per §2, nothing from §2 forbidden, no duplicate keys. Unparseable file = CMP_BAD_FORMAT too. Extra key = format error. Negative size or size 0 is NOT a format error (a log is needed to judge size). (d) medium-high. (e) low-medium.

### D43 sigcheck argument handling
(a) task text: "message is the argument's UTF-8 bytes". (c) public key and signature must be lowercase hex of exact length (rule 1), otherwise false (so uppercase hex, odd length, non-hex all print false, never an error). Message used as given, no hex decoding, no trailing newline added; empty argument is the empty message. (d) high. (e) low.

### D44 §4.2 rule 5 ordering is unobservable
(a) rule 5 "checked in addition to rules 2 to 4, after the equation". Result is a boolean in the end, so the order cannot change the printed outcome; I run it last as written. (d) high. (e) no. (The text says rules 2 and 3 are not made redundant by rule 5 but only argues it for rule 3; rule 2 is also not redundant, since a non-canonical spelling of a prime-order point passes rule 5. Minor wording gap.)

### D45 §4.2 point decoding: which points are "a point"
(a) rule 2 gives y < p and the x = 0 sign rule; rule 4 says R "must be the canonical encoding of a point". (c) key and R are decoded with the same function: y < p, y must give x on the curve (x^2 = (y^2-1)/(dy^2+1) must be a square), x = 0 with sign bit 1 is refused, otherwise the sign bit selects the root. A key with y not on the curve fails (it is not a point). (d) high. (e) low. (RFC 8032 section 5.1.3 steps; consistent with D32/D33.)

### D46 Cascading rule errors are reported
(a) §6 "Entries that have any integrity error are skipped" and "It does not stop at the first error". The spec does not say to suppress follow-on errors. (c) when e.g. a register_key entry is skipped (integrity error), later entries by that author get UNREGISTERED_AUTHOR, and later references to a skipped proposal get UNKNOWN_PROPOSAL. All are reported (see bad-format.json, tamper-text.json, rule-bad-label.json in the run table). (d) high on the literal reading. (e) low, but an implementer who wants fewer cascades would differ.

### D47 Checkpoint rule order when operator is missing
(a) §6 CP_WRONG_OPERATOR "(or the log has none)". (c) with no operator the checkpoint still gets CP_BAD_SIG judged against its own operator field and CP_BAD_SIZE / CP_BAD_ROOT are still judged (the log has entries) . (d) medium. (e) some.

### D48 STALE_VERSION + DUPLICATE_SIGNATURE on one entry (observed in an input)
(a) rule-stale-version.json entry 22: author 750e0b already signed proposal 0d167f at entry 16 (version 2f22a8) and now signs it again naming version 5e8eeb (not the current version). §6 step 10 "STALE_VERSION unless version is the current version; DUPLICATE_SIGNATURE if this author already signed it. Otherwise records the signature."
(b) report both (independent checks, first one does not end the entry) / report only STALE_VERSION (it is listed first; step 10 does not say "ends the entry", unlike steps 5 and 8, which suggests no early end).
(c) both, as in D15. I did not change this because the input looks like it was meant to test only STALE_VERSION: the spec's words do not make the second check depend on the first. This is the clearest case in the inputs of how an unstated ordering rule changes the output.
(d) low-medium. (e) YES.

### D49 Time of a truncated or rewritten log, no trusted checkpoint
(a) §8 says a hash chain alone cannot expose a full rewrite. (c) consistent with the run: rewritten-history.json and truncated.json are ok true on their own. Nothing to decide, recorded as a sanity check against the spec's own words.

### D50 `Save` operation (§5.1) has no command
(a) §5.1 "Two operations are defined... both verifiers provide them" (Save and Compare); task lists no save command. Not implemented. A "Save" output format (a file with exactly the five keys) is determinable, but "which checkpoint of the log" (index? latest?) is not stated. (d) n/a. (e) YES.

### D51 Typos, broken cross-references and wobbles found in SPEC.md
1. §4.1 says the schema describes sections "1 to 5" and lists "BAD_FORMAT, BAD_BODY and CP_BAD_FORMAT" as the shape checks; TRUSTED_BAD_FORMAT and CMP_BAD_FORMAT are shape checks too but not mentioned.
2. §6 integrity item 1 (BAD_FORMAT: "breaks section 3 or 4") and rule item 3 (BAD_BODY: "does not match section 4") overlap; section 4 contains the body shapes (see D5). Plain contradiction unless BAD_FORMAT is limited to the record envelope.
3. §4.2 mentions "40 cases" (the three-platform test) and later "41 cases" (the vector file and the thirteen-library test, "1 must pass, 40 must fail"); the counts differ by one without explanation.
4. §4.2 final paragraph "What this does not cover" lists Rust's `ring` among untested libraries while the earlier text says Rust libraries were tested; fine, but "the same languages" wording is loose.
5. §9.4 asks what happens at the exact moment a comment period ends; §6 already answers ("not including that moment"). Stale question (D22).
6. §5.1 "both verifiers provide" Save and Compare, but §7 and §6 define output only for verify; Save has no output spec (D50).
7. §7 "summary (null when there is no usable genesis)": "usable" is not defined anywhere (D13); §5 uses "valid genesis record"; the two may or may not mean the same thing.
8. §6 rule-stage item 2 says "(The checks go on from here, except where a step says it ends the entry.)" which makes step 10 (no "ends the entry") ambiguous (D15, D48).
9. Several links (schema/, vectors/, python/, docs/, prototype/, node/) point to files not supplied (D37).
10. §3 vs §6: `hash` is said to be "SHA-256 (lowercase hex)" but only §2's general "A hex string means lowercase" makes an uppercase stored hash a BAD_FORMAT; an uppercase hash that equals the recomputed one case-insensitively is treated as BAD_FORMAT by me.

## Run results

Built with `cargo build --release` in verifier/ (one dead-code warning). Output of each run is in outputs.json (script: run-all.py). "Integrity" and "rule" columns list the distinct error codes.

| input | ok | integrity codes | rule codes |
|---|---|---|---|
| bad-checkpoint.json | false | CP_BAD_SIG, CP_BAD_ROOT (checkpoint 1) | - |
| bad-format.json | false | BAD_FORMAT (entry 3), CP_BAD_ROOT x3 | UNREGISTERED_AUTHOR, UNKNOWN_PROPOSAL |
| delete-entry.json | false | BAD_INDEX, BAD_PREV (entry 9), CP_BAD_ROOT x2, CP_BAD_SIZE | - |
| forged-sig.json | false | BAD_HASH, BAD_SIG (entry 7), CP_BAD_ROOT x3 | - |
| good.json | true | - | - |
| reorder.json | false | BAD_INDEX, BAD_PREV, CP_BAD_ROOT x3 | - |
| rewritten-history.json | true | - | - |
| rule-bad-label.json | false | - | BAD_LABEL, UNREGISTERED_AUTHOR, UNKNOWN_PROPOSAL |
| rule-duplicate-sig.json | false | - | DUPLICATE_SIGNATURE |
| rule-late-sign.json | false | - | PROPOSAL_CLOSED |
| rule-not-proposer.json | false | - | NOT_PROPOSER |
| rule-ok-new-signer.json | true | - | - |
| rule-stale-version.json | false | - | STALE_VERSION, DUPLICATE_SIGNATURE (see D48) |
| rule-time-reversed.json | false | - | TIME_REVERSED |
| rule-unknown-proposal.json | false | - | UNKNOWN_PROPOSAL |
| rule-unregistered.json | false | - | UNREGISTERED_AUTHOR |
| tamper-text.json | false | BAD_HASH, BAD_SIG (entry 5), CP_BAD_ROOT x3 | UNKNOWN_PROPOSAL |
| tamper-time.json | false | BAD_HASH (entry 9), CP_BAD_ROOT x3 | - |
| truncated.json | true | - | - |
| unicode.json | true | - | - |
| rewritten-history.json + trusted good.checkpoint-21 | false | TRUSTED_MISMATCH | - |
| truncated.json + trusted good.checkpoint-21 | false | TRUSTED_TRUNCATED | - |
| good.json + trusted good.checkpoint-21 (extra) | true | - | - |
| good.json + trusted split-view.checkpoint-21 (extra) | false | TRUSTED_MISMATCH | - |
| compare good, good | true | - (relation identical) | |
| compare good, split-view (either order) | false | CMP_CONFLICT (relation conflict) | |
| compare split-view, split-view | true | - (relation identical) | |

Other checks (not in outputs.json): sigcheck gives true on RFC 8032 test vectors 1 and 2 (from memory), false on a wrong message, on S+L, on uppercase hex, and on a small-order key. Compare on the three checkpoints of good.json (sizes 10, 12, 22): identical-operator pair of different sizes gives relation different-size, ok true; bad format, other operator and bad sig cases give the error lists described in D40. The 41-case vector file was not available (D37), so section 4.2 is only spot-checked.
