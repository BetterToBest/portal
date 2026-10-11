package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"
	"strconv"
	"strings"
)

func usage() {
	fmt.Fprintln(os.Stderr, "usage: cip-verify verify <log.json> [--trusted <checkpoint.json>]")
	fmt.Fprintln(os.Stderr, "       cip-verify compare <checkpoint-a.json> <checkpoint-b.json>")
	fmt.Fprintln(os.Stderr, "       cip-verify checkpoint <log.json> [--index N]")
	fmt.Fprintln(os.Stderr, "       cip-verify sigcheck <public-key-hex> <message> <signature-hex>")
	os.Exit(2)
}

func readOrDie(path string) []byte {
	b, err := os.ReadFile(path)
	if err != nil {
		fmt.Fprintf(os.Stderr, "cannot read %s: %v\n", path, err)
		os.Exit(2)
	}
	return b
}

func printJSON(v interface{}) {
	var buf bytes.Buffer
	enc := json.NewEncoder(&buf)
	enc.SetEscapeHTML(false)
	if err := enc.Encode(v); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(2)
	}
	os.Stdout.Write(buf.Bytes())
}

func main() {
	if len(os.Args) < 2 {
		usage()
	}
	args := os.Args[2:]
	switch os.Args[1] {
	case "verify":
		var logPath, trustedPath string
		haveTrusted := false
		for i := 0; i < len(args); i++ {
			if args[i] == "--trusted" {
				if i+1 >= len(args) || haveTrusted {
					usage()
				}
				haveTrusted = true
				trustedPath = args[i+1]
				i++
			} else if logPath == "" && !strings.HasPrefix(args[i], "--") {
				logPath = args[i]
			} else {
				usage()
			}
		}
		if logPath == "" {
			usage()
		}
		data := readOrDie(logPath)
		var lt func() ([]byte, bool)
		if haveTrusted {
			lt = func() ([]byte, bool) { return readOrDie(trustedPath), true }
		}
		res := Verify(data, lt)
		printJSON(res)
		if res.OK {
			os.Exit(0)
		}
		os.Exit(1)
	case "compare":
		if len(args) != 2 {
			usage()
		}
		a := readOrDie(args[0])
		b := readOrDie(args[1])
		out := Compare(a, b)
		printJSON(out)
		if out.OK {
			os.Exit(0)
		}
		os.Exit(1)
	case "checkpoint":
		var logPath string
		idx := -1
		haveIdx := false
		for i := 0; i < len(args); i++ {
			if args[i] == "--index" {
				if i+1 >= len(args) || haveIdx {
					usage()
				}
				n, err := strconv.ParseInt(args[i+1], 10, 64)
				if err != nil {
					usage()
				}
				haveIdx = true
				idx = int(n)
				if n < 0 || n > 1<<40 {
					idx = -2 // a position that does not exist
				}
				i++
			} else if logPath == "" && !strings.HasPrefix(args[i], "--") {
				logPath = args[i]
			} else {
				usage()
			}
		}
		if logPath == "" {
			usage()
		}
		data := readOrDie(logPath)
		res := Verify(data, nil)
		if len(res.IntegrityErrors) > 0 {
			fmt.Fprintln(os.Stderr, "nothing saved: the log has integrity errors")
			os.Exit(1)
		}
		doc, _ := ParseJSON(data)
		cps := doc.Map["checkpoints"].Arr
		if len(cps) == 0 {
			fmt.Fprintln(os.Stderr, "nothing saved: the log has no checkpoints")
			os.Exit(1)
		}
		if !haveIdx {
			idx = len(cps) - 1
		}
		if idx < 0 || idx >= len(cps) {
			fmt.Fprintf(os.Stderr, "nothing saved: no checkpoint at position %s\n", args[len(args)-1])
			os.Exit(1)
		}
		c := cps[idx]
		var sb strings.Builder
		// section 5 key order
		sb.WriteString(`{"operator":`)
		writeCanon(&sb, c.Map["operator"])
		sb.WriteString(`,"root":`)
		writeCanon(&sb, c.Map["root"])
		sb.WriteString(`,"size":`)
		writeCanon(&sb, c.Map["size"])
		sb.WriteString(`,"time":`)
		writeCanon(&sb, c.Map["time"])
		sb.WriteString(`,"sig":`)
		writeCanon(&sb, c.Map["sig"])
		sb.WriteString("}\n")
		os.Stdout.WriteString(sb.String())
		os.Exit(0)
	case "sigcheck":
		if len(args) != 3 {
			usage()
		}
		if sigOK(args[0], args[2], []byte(args[1])) {
			fmt.Println("true")
		} else {
			fmt.Println("false")
		}
		os.Exit(0)
	default:
		usage()
	}
}

// ---------------- compare (section 5.1) ----------------

type CmpErr struct {
	Code  string `json:"code"`
	Where string `json:"where"`
}

type CmpResult struct {
	OK       bool     `json:"ok"`
	Errors   []CmpErr `json:"errors"`
	Relation *string  `json:"relation"`
	Operator *string  `json:"operator"`
}

func Compare(adata, bdata []byte) CmpResult {
	res := CmpResult{Errors: []CmpErr{}}
	parse := func(d []byte) *Value {
		v, err := ParseJSON(d)
		if err != nil || !checkpointShapeOK(v) {
			return nil
		}
		return v
	}
	a, b := parse(adata), parse(bdata)
	if a == nil {
		res.Errors = append(res.Errors, CmpErr{"CMP_BAD_FORMAT", "a"})
	}
	if b == nil {
		res.Errors = append(res.Errors, CmpErr{"CMP_BAD_FORMAT", "b"})
	}
	if a != nil && b != nil && a.Map["operator"].Str != b.Map["operator"].Str {
		res.Errors = append(res.Errors, CmpErr{"CMP_DIFFERENT_OPERATOR", "both"})
	}
	if a != nil && !checkpointSigOK(a) {
		res.Errors = append(res.Errors, CmpErr{"CMP_BAD_SIG", "a"})
	}
	if b != nil && !checkpointSigOK(b) {
		res.Errors = append(res.Errors, CmpErr{"CMP_BAD_SIG", "b"})
	}
	if len(res.Errors) == 0 {
		op := a.Map["operator"].Str
		res.Operator = &op
		var rel string
		if a.Map["size"].Int != b.Map["size"].Int {
			rel = "different-size"
		} else if a.Map["root"].Str == b.Map["root"].Str {
			rel = "identical"
		} else {
			rel = "conflict"
			res.Errors = append(res.Errors, CmpErr{"CMP_CONFLICT", "both"})
		}
		res.Relation = &rel
	}
	res.OK = len(res.Errors) == 0
	return res
}
