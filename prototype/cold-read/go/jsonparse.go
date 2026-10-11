package main

// Own JSON parser: exact numbers, last-wins duplicate keys, lone surrogate tracking.
// encoding/json is NOT used (decision: it cannot report BOM/invalid UTF-8 policy,
// exact big numbers, or lone surrogates the way section 1/2 need).

import (
	"errors"
	"math/big"
	"unicode/utf8"
)

type Kind int

const (
	KObj Kind = iota
	KArr
	KStr
	KInt   // whole number inside the safe range
	KOther // number that section 2 does not allow
	KBool
	KNull
)

type Value struct {
	K    Kind
	Str  string
	Bad  bool // string with an unpaired surrogate (or key with one, for objects)
	Int  int64
	Keys []string          // objects: key order of first appearance
	Map  map[string]*Value // objects: last wins
	Arr  []*Value
}

type parser struct {
	b   []byte
	pos int
}

var errSyntax = errors.New("invalid JSON")

func ParseJSON(data []byte) (*Value, error) {
	if !utf8.Valid(data) {
		return nil, errSyntax
	}
	// A byte order mark is not whitespace, so the generic parser rejects it.
	p := &parser{b: data}
	p.ws()
	v, err := p.value(0)
	if err != nil {
		return nil, err
	}
	p.ws()
	if p.pos != len(p.b) {
		return nil, errSyntax
	}
	return v, nil
}

func (p *parser) ws() {
	for p.pos < len(p.b) {
		c := p.b[p.pos]
		if c == ' ' || c == '\t' || c == '\n' || c == '\r' {
			p.pos++
		} else {
			return
		}
	}
}

func (p *parser) lit(s string) bool {
	if p.pos+len(s) <= len(p.b) && string(p.b[p.pos:p.pos+len(s)]) == s {
		p.pos += len(s)
		return true
	}
	return false
}

func (p *parser) value(depth int) (*Value, error) {
	if depth > 100000 {
		return nil, errSyntax
	}
	if p.pos >= len(p.b) {
		return nil, errSyntax
	}
	switch c := p.b[p.pos]; {
	case c == '{':
		return p.object(depth)
	case c == '[':
		return p.array(depth)
	case c == '"':
		s, bad, err := p.str()
		if err != nil {
			return nil, err
		}
		return &Value{K: KStr, Str: s, Bad: bad}, nil
	case c == 't':
		if p.lit("true") {
			return &Value{K: KBool}, nil
		}
	case c == 'f':
		if p.lit("false") {
			return &Value{K: KBool}, nil
		}
	case c == 'n':
		if p.lit("null") {
			return &Value{K: KNull}, nil
		}
	case c == '-' || (c >= '0' && c <= '9'):
		return p.number()
	}
	return nil, errSyntax
}

func (p *parser) object(depth int) (*Value, error) {
	p.pos++ // {
	v := &Value{K: KObj, Map: map[string]*Value{}}
	p.ws()
	if p.pos < len(p.b) && p.b[p.pos] == '}' {
		p.pos++
		return v, nil
	}
	for {
		p.ws()
		if p.pos >= len(p.b) || p.b[p.pos] != '"' {
			return nil, errSyntax
		}
		k, bad, err := p.str()
		if err != nil {
			return nil, err
		}
		if bad {
			v.Bad = true
		}
		p.ws()
		if p.pos >= len(p.b) || p.b[p.pos] != ':' {
			return nil, errSyntax
		}
		p.pos++
		p.ws()
		val, err := p.value(depth + 1)
		if err != nil {
			return nil, err
		}
		if _, dup := v.Map[k]; !dup {
			v.Keys = append(v.Keys, k)
		}
		v.Map[k] = val // last wins (decision E1)
		p.ws()
		if p.pos >= len(p.b) {
			return nil, errSyntax
		}
		if p.b[p.pos] == ',' {
			p.pos++
			continue
		}
		if p.b[p.pos] == '}' {
			p.pos++
			return v, nil
		}
		return nil, errSyntax
	}
}

func (p *parser) array(depth int) (*Value, error) {
	p.pos++ // [
	v := &Value{K: KArr}
	p.ws()
	if p.pos < len(p.b) && p.b[p.pos] == ']' {
		p.pos++
		return v, nil
	}
	for {
		p.ws()
		val, err := p.value(depth + 1)
		if err != nil {
			return nil, err
		}
		v.Arr = append(v.Arr, val)
		p.ws()
		if p.pos >= len(p.b) {
			return nil, errSyntax
		}
		if p.b[p.pos] == ',' {
			p.pos++
			continue
		}
		if p.b[p.pos] == ']' {
			p.pos++
			return v, nil
		}
		return nil, errSyntax
	}
}

func hexv(c byte) int {
	switch {
	case c >= '0' && c <= '9':
		return int(c - '0')
	case c >= 'a' && c <= 'f':
		return int(c-'a') + 10
	case c >= 'A' && c <= 'F':
		return int(c-'A') + 10
	}
	return -1
}

func (p *parser) u4() (int, bool) {
	if p.pos+4 > len(p.b) {
		return 0, false
	}
	n := 0
	for i := 0; i < 4; i++ {
		h := hexv(p.b[p.pos+i])
		if h < 0 {
			return 0, false
		}
		n = n*16 + h
	}
	p.pos += 4
	return n, true
}

// str parses a string starting at the opening quote. bad = unpaired surrogate escape.
func (p *parser) str() (string, bool, error) {
	p.pos++ // opening quote
	var out []byte
	bad := false
	for {
		if p.pos >= len(p.b) {
			return "", false, errSyntax
		}
		c := p.b[p.pos]
		switch {
		case c == '"':
			p.pos++
			return string(out), bad, nil
		case c < 0x20:
			return "", false, errSyntax
		case c == '\\':
			p.pos++
			if p.pos >= len(p.b) {
				return "", false, errSyntax
			}
			e := p.b[p.pos]
			p.pos++
			switch e {
			case '"', '\\', '/':
				out = append(out, e)
			case 'b':
				out = append(out, 8)
			case 'f':
				out = append(out, 12)
			case 'n':
				out = append(out, 10)
			case 'r':
				out = append(out, 13)
			case 't':
				out = append(out, 9)
			case 'u':
				n, ok := p.u4()
				if !ok {
					return "", false, errSyntax
				}
				if n >= 0xD800 && n <= 0xDBFF {
					// need a following \uDC00-DFFF
					if p.pos+1 < len(p.b) && p.b[p.pos] == '\\' && p.b[p.pos+1] == 'u' {
						save := p.pos
						p.pos += 2
						m, ok2 := p.u4()
						if ok2 && m >= 0xDC00 && m <= 0xDFFF {
							r := rune(0x10000 + (n-0xD800)<<10 + (m - 0xDC00))
							out = utf8.AppendRune(out, r)
							continue
						}
						p.pos = save // reparse the second escape on its own
					}
					bad = true
					out = utf8.AppendRune(out, 0xFFFD)
				} else if n >= 0xDC00 && n <= 0xDFFF {
					bad = true
					out = utf8.AppendRune(out, 0xFFFD)
				} else {
					out = utf8.AppendRune(out, rune(n))
				}
			default:
				return "", false, errSyntax
			}
		default:
			out = append(out, c)
			p.pos++
		}
	}
}

func isDigit(c byte) bool { return c >= '0' && c <= '9' }

func (p *parser) number() (*Value, error) {
	start := p.pos
	neg := false
	if p.b[p.pos] == '-' {
		neg = true
		p.pos++
	}
	if p.pos >= len(p.b) || !isDigit(p.b[p.pos]) {
		return nil, errSyntax
	}
	is := p.pos
	if p.b[p.pos] == '0' {
		p.pos++
	} else {
		for p.pos < len(p.b) && isDigit(p.b[p.pos]) {
			p.pos++
		}
	}
	intPart := string(p.b[is:p.pos])
	frac := ""
	if p.pos < len(p.b) && p.b[p.pos] == '.' {
		p.pos++
		fs := p.pos
		for p.pos < len(p.b) && isDigit(p.b[p.pos]) {
			p.pos++
		}
		if p.pos == fs {
			return nil, errSyntax
		}
		frac = string(p.b[fs:p.pos])
	}
	exp := new(big.Int)
	if p.pos < len(p.b) && (p.b[p.pos] == 'e' || p.b[p.pos] == 'E') {
		p.pos++
		eneg := false
		if p.pos < len(p.b) && (p.b[p.pos] == '+' || p.b[p.pos] == '-') {
			eneg = p.b[p.pos] == '-'
			p.pos++
		}
		es := p.pos
		for p.pos < len(p.b) && isDigit(p.b[p.pos]) {
			p.pos++
		}
		if p.pos == es {
			return nil, errSyntax
		}
		exp.SetString(string(p.b[es:p.pos]), 10)
		if eneg {
			exp.Neg(exp)
		}
	}
	_ = start
	return classifyNumber(neg, intPart, frac, exp), nil
}

const safeMax = 9007199254740991

// classifyNumber: exact value; whole and |v| <= 2^53-1 => KInt, else KOther.
func classifyNumber(neg bool, intPart, frac string, exp *big.Int) *Value {
	digits := intPart + frac
	// strip leading zeros
	i := 0
	for i < len(digits) && digits[i] == '0' {
		i++
	}
	digits = digits[i:]
	if digits == "" {
		return &Value{K: KInt, Int: 0}
	}
	// strip trailing zeros into exponent
	e := new(big.Int).Set(exp)
	e.Sub(e, big.NewInt(int64(len(frac))))
	j := len(digits)
	for j > 0 && digits[j-1] == '0' {
		j--
	}
	e.Add(e, big.NewInt(int64(len(digits)-j)))
	digits = digits[:j]
	if e.Sign() < 0 {
		return &Value{K: KOther}
	}
	if e.BitLen() > 20 || int64(len(digits))+e.Int64() > 16 {
		return &Value{K: KOther}
	}
	n := new(big.Int)
	n.SetString(digits, 10)
	n.Mul(n, new(big.Int).Exp(big.NewInt(10), e, nil))
	if n.Cmp(big.NewInt(safeMax)) > 0 {
		return &Value{K: KOther}
	}
	x := n.Int64()
	if neg {
		x = -x
	}
	return &Value{K: KInt, Int: x}
}
