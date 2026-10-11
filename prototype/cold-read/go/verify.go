package main

import (
	"encoding/hex"
	"unicode/utf8"
)

type Err struct {
	Code  string `json:"code"`
	Where string `json:"where"`
	Index int    `json:"index"`
}

type PropSummary struct {
	ID         string `json:"id"`
	Title      string `json:"title"`
	Versions   int    `json:"versions"`
	Version    string `json:"version"`
	Signatures int    `json:"signatures"`
	State      string `json:"state"`
}

type Summary struct {
	Entries    int           `json:"entries"`
	Registered int           `json:"registered"`
	Comments   int           `json:"comments"`
	Proposals  []PropSummary `json:"proposals"`
}

type Result struct {
	OK              bool     `json:"ok"`
	IntegrityErrors []Err    `json:"integrity_errors"`
	RuleErrors      []Err    `json:"rule_errors"`
	Summary         *Summary `json:"summary"`
}

const zeros64 = "0000000000000000000000000000000000000000000000000000000000000000"

func hasExactKeys(v *Value, keys ...string) bool {
	if v == nil || v.K != KObj || len(v.Map) != len(keys) {
		return false
	}
	for _, k := range keys {
		if _, ok := v.Map[k]; !ok {
			return false
		}
	}
	return true
}

func isIntV(v *Value) bool { return v != nil && v.K == KInt }
func isHexV(v *Value, n int) bool {
	return v != nil && v.K == KStr && !v.Bad && isHex(v.Str, n)
}

// entryShapeOK: section 3 and the record shape of section 4, plus section 2.
func entryShapeOK(e *Value) bool {
	if e == nil || e.K != KObj || !hasExactKeys(e, "index", "prev", "time", "record", "hash") {
		return false
	}
	if disallowed(e) {
		return false
	}
	if !isIntV(e.Map["index"]) || !isIntV(e.Map["time"]) || e.Map["time"].Int < 0 {
		return false
	}
	if !isHexV(e.Map["prev"], 64) || !isHexV(e.Map["hash"], 64) {
		return false
	}
	r := e.Map["record"]
	if !hasExactKeys(r, "type", "author", "body", "sig") {
		return false
	}
	if r.Map["type"].K != KStr || !isHexV(r.Map["author"], 64) || !isHexV(r.Map["sig"], 128) || r.Map["body"].K != KObj {
		return false
	}
	return true
}

// checkpointShapeOK: section 5 shape (and section 2).
func checkpointShapeOK(c *Value) bool {
	if c == nil || c.K != KObj || !hasExactKeys(c, "operator", "root", "size", "time", "sig") {
		return false
	}
	if disallowed(c) {
		return false
	}
	return isHexV(c.Map["operator"], 64) && isHexV(c.Map["root"], 64) && isIntV(c.Map["size"]) &&
		isIntV(c.Map["time"]) && isHexV(c.Map["sig"], 128)
}

func checkpointSigOK(c *Value) bool {
	msg := canonSubset(c, "operator", "root", "size", "time")
	return sigOK(c.Map["operator"].Str, c.Map["sig"].Str, msg)
}

type entryInfo struct {
	raw        *Value
	formatOK   bool
	recomputed string
	errs       []string
}

// logOperator: section 5, author of entry 0 when it is a genesis with a 64 hex author.
func logOperator(entries []*Value) (string, bool) {
	if len(entries) == 0 {
		return "", false
	}
	e := entries[0]
	if e.K != KObj {
		return "", false
	}
	r := e.Map["record"]
	if r == nil || r.K != KObj {
		return "", false
	}
	t := r.Map["type"]
	a := r.Map["author"]
	if t == nil || t.K != KStr || t.Str != "genesis" || !isHexV(a, 64) {
		return "", false
	}
	return a.Str, true
}

// Trusted holds the optional trusted checkpoint input.
type Trusted struct {
	Present bool
	Data    []byte // file bytes
}

func Verify(data []byte, loadTrusted func() ([]byte, bool)) Result {
	res := Result{IntegrityErrors: []Err{}, RuleErrors: []Err{}}
	doc, err := ParseJSON(data)
	if err != nil || doc.K != KObj || !hasExactKeys(doc, "format", "entries", "checkpoints") ||
		doc.Map["format"].K != KStr || doc.Map["format"].Str != "cip-test-log/0" || doc.Map["format"].Bad ||
		doc.Map["entries"].K != KArr || doc.Map["checkpoints"].K != KArr {
		res.IntegrityErrors = append(res.IntegrityErrors, Err{"BAD_FORMAT", "log", 0})
		return res
	}
	entries := doc.Map["entries"].Arr
	cps := doc.Map["checkpoints"].Arr
	infos := make([]entryInfo, len(entries))
	addI := func(code string, where string, idx int) {
		res.IntegrityErrors = append(res.IntegrityErrors, Err{code, where, idx})
	}
	for i, e := range entries {
		in := &infos[i]
		in.raw = e
		if !entryShapeOK(e) {
			in.recomputed = zeros64
			in.errs = append(in.errs, "BAD_FORMAT")
			addI("BAD_FORMAT", "entry", i)
			continue
		}
		in.formatOK = true
		fail := func(code string) {
			in.errs = append(in.errs, code)
			addI(code, "entry", i)
		}
		if e.Map["index"].Int != int64(i) {
			fail("BAD_INDEX")
		}
		if i == 0 {
			if e.Map["prev"].Str != zeros64 {
				fail("BAD_PREV")
			}
		} else {
			p := entries[i-1]
			ph := p.get("hash")
			if ph == nil || ph.K != KStr || ph.Str != e.Map["prev"].Str {
				fail("BAD_PREV")
			}
		}
		in.recomputed = sha256hex(canonSubset(e, "index", "prev", "record", "time"))
		if e.Map["hash"].Str != in.recomputed {
			fail("BAD_HASH")
		}
		r := e.Map["record"]
		msg := canonSubset(r, "type", "author", "body")
		if !sigOK(r.Map["author"].Str, r.Map["sig"].Str, msg) {
			fail("BAD_SIG")
		}
	}

	// checkpoints of the log
	opKey, hasOp := logOperator(entries)
	leaves := make([][]byte, len(infos))
	for i := range infos {
		b, _ := hex.DecodeString(infos[i].recomputed)
		leaves[i] = b
	}
	for i, c := range cps {
		if !checkpointShapeOK(c) {
			addI("CP_BAD_FORMAT", "checkpoint", i)
			continue
		}
		if !hasOp || c.Map["operator"].Str != opKey {
			addI("CP_WRONG_OPERATOR", "checkpoint", i)
		}
		if !checkpointSigOK(c) {
			addI("CP_BAD_SIG", "checkpoint", i)
		}
		size := c.Map["size"].Int
		if size < 1 || size > int64(len(entries)) {
			addI("CP_BAD_SIZE", "checkpoint", i)
			continue
		}
		root := hex.EncodeToString(merkleRoot(leaves[:size]))
		if c.Map["root"].Str != root {
			addI("CP_BAD_ROOT", "checkpoint", i)
		}
	}

	// trusted checkpoint (lazy: only read when the log file itself was fine)
	if loadTrusted != nil {
		tdata, _ := loadTrusted()
		t, terr := ParseJSON(tdata)
		if terr != nil || !checkpointShapeOK(t) {
			addI("TRUSTED_BAD_FORMAT", "trusted", 0)
		} else {
			if !hasOp || t.Map["operator"].Str != opKey {
				addI("TRUSTED_WRONG_OPERATOR", "trusted", 0)
			}
			if !checkpointSigOK(t) {
				addI("TRUSTED_BAD_SIG", "trusted", 0)
			}
			size := t.Map["size"].Int
			if size < 1 || size > int64(len(entries)) {
				addI("TRUSTED_TRUNCATED", "trusted", 0)
			} else if t.Map["root"].Str != hex.EncodeToString(merkleRoot(leaves[:size])) {
				addI("TRUSTED_MISMATCH", "trusted", 0)
			}
		}
	}

	runRules(&res, entries, infos)
	res.OK = len(res.IntegrityErrors) == 0 && len(res.RuleErrors) == 0
	return res
}

// ---------------- rule checks ----------------

type proposal struct {
	id       string
	proposer string
	title    string
	versions int
	version  string
	sigs     map[string]bool
	count    int
	hasT     bool
	T        int64
}

func codePoints(s string) int { return utf8.RuneCountInString(s) }

func strIn(v *Value, lo, hi int) bool {
	if v == nil || v.K != KStr {
		return false
	}
	n := codePoints(v.Str)
	return n >= lo && n <= hi
}

// bodyOK: the body of section 4 for the type. Unknown types never match.
func bodyOK(typ string, b *Value) bool {
	switch typ {
	case "genesis":
		return hasExactKeys(b, "threshold", "comment_seconds") && isIntV(b.Map["threshold"]) && b.Map["threshold"].Int >= 1 &&
			isIntV(b.Map["comment_seconds"]) && b.Map["comment_seconds"].Int >= 0
	case "register_key":
		return hasExactKeys(b, "public_key", "label") && isHexV(b.Map["public_key"], 64) && strIn(b.Map["label"], 1, 40)
	case "propose":
		return hasExactKeys(b, "title", "text") && strIn(b.Map["title"], 1, 120) && strIn(b.Map["text"], 1, 20000)
	case "amend":
		return hasExactKeys(b, "proposal", "title", "text") && isHexV(b.Map["proposal"], 64) &&
			strIn(b.Map["title"], 1, 120) && strIn(b.Map["text"], 1, 20000)
	case "sign":
		return hasExactKeys(b, "proposal", "version") && isHexV(b.Map["proposal"], 64) && isHexV(b.Map["version"], 64)
	case "comment":
		return hasExactKeys(b, "proposal", "text") && isHexV(b.Map["proposal"], 64) && strIn(b.Map["text"], 1, 2000)
	}
	return false
}

func runRules(res *Result, entries []*Value, infos []entryInfo) {
	var threshold, commentSeconds int64
	haveSettings := false
	registered := map[string]bool{}
	registeredCount := 0
	comments := 0
	props := map[string]*proposal{}
	var order []*proposal

	stateAt := func(p *proposal, t int64) string {
		if int64(p.count) < threshold {
			return "collecting"
		}
		if t >= p.T+commentSeconds {
			return "closed"
		}
		return "comment"
	}

	lastGood := -1
	for i := range entries {
		if len(infos[i].errs) == 0 {
			lastGood = i
		}
	}

	for i, e := range entries {
		in := infos[i]
		if len(in.errs) > 0 {
			continue
		}
		add := func(code string) {
			res.RuleErrors = append(res.RuleErrors, Err{code, "entry", i})
		}
		t := e.Map["time"].Int
		// 1 TIME_REVERSED
		if i > 0 {
			pt := entries[i-1].get("time")
			if pt != nil && pt.K == KInt && t < pt.Int {
				add("TIME_REVERSED")
			}
		}
		rec := e.Map["record"]
		typ := rec.Map["type"].Str
		author := rec.Map["author"].Str
		body := rec.Map["body"]
		// 2 genesis
		if i == 0 {
			if typ != "genesis" {
				add("NO_GENESIS")
			}
		} else if typ == "genesis" {
			add("DUPLICATE_GENESIS")
			continue
		}
		// 3 BAD_BODY
		if !bodyOK(typ, body) {
			add("BAD_BODY")
			continue
		}
		if i == 0 && typ == "genesis" {
			haveSettings = true
			threshold = body.Map["threshold"].Int
			commentSeconds = body.Map["comment_seconds"].Int
			registered[author] = true
		}
		// 4
		if !haveSettings {
			continue
		}
		// 5
		if typ == "register_key" {
			pk := body.Map["public_key"].Str
			if pk != author {
				add("SELF_REGISTER_MISMATCH")
				continue
			}
			if registered[pk] {
				add("DUPLICATE_KEY")
				continue
			}
			if len(body.Map["label"].Str) < 5 || body.Map["label"].Str[:5] != "test-" {
				add("BAD_LABEL")
				continue
			}
			registered[pk] = true
			registeredCount++
			continue
		}
		// 6
		if typ != "genesis" && !registered[author] {
			add("UNREGISTERED_AUTHOR")
			continue
		}
		// 7
		if typ == "propose" {
			title := body.Map["title"].Str
			p := &proposal{id: in.recomputed, proposer: author, title: title, versions: 1,
				version: versionHash(title, body.Map["text"].Str), sigs: map[string]bool{}}
			props[p.id] = p
			order = append(order, p)
			continue
		}
		if typ != "amend" && typ != "sign" && typ != "comment" {
			continue
		}
		// 8
		p := props[body.Map["proposal"].Str]
		if p == nil {
			add("UNKNOWN_PROPOSAL")
			continue
		}
		if stateAt(p, t) == "closed" {
			add("PROPOSAL_CLOSED")
			continue
		}
		switch typ {
		case "amend":
			if p.proposer != author {
				add("NOT_PROPOSER")
				continue
			}
			p.title = body.Map["title"].Str
			p.versions++
			p.version = versionHash(p.title, body.Map["text"].Str)
			p.sigs = map[string]bool{}
			p.count = 0
			p.hasT = false
		case "sign":
			if body.Map["version"].Str != p.version {
				add("STALE_VERSION")
				continue
			}
			if p.sigs[author] {
				add("DUPLICATE_SIGNATURE")
				continue
			}
			p.sigs[author] = true
			p.count++
			if int64(p.count) == threshold {
				p.hasT = true
				p.T = t
			}
		case "comment":
			comments++
		}
	}

	// summary
	if len(entries) > 0 && len(infos[0].errs) == 0 && haveSettings {
		s := &Summary{Entries: len(entries), Registered: registeredCount, Comments: comments, Proposals: []PropSummary{}}
		var tl int64
		if lastGood >= 0 {
			tl = entries[lastGood].Map["time"].Int
		}
		for _, p := range order {
			s.Proposals = append(s.Proposals, PropSummary{p.id, p.title, p.versions, p.version, p.count, stateAt(p, tl)})
		}
		res.Summary = s
	}
}
