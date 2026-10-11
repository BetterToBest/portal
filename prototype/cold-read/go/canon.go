package main

// Section 2 canonical form and hashing helpers.

import (
	"crypto/sha256"
	"encoding/hex"
	"sort"
	"strconv"
	"strings"
	"unicode/utf16"
)

func (v *Value) get(k string) *Value {
	if v == nil || v.K != KObj {
		return nil
	}
	return v.Map[k]
}

// disallowed reports anything section 2 does not allow: non-integers, large numbers,
// booleans, null, strings (or keys) with unpaired surrogates.
func disallowed(v *Value) bool {
	switch v.K {
	case KOther, KBool, KNull:
		return true
	case KStr:
		return v.Bad
	case KObj:
		if v.Bad {
			return true
		}
		for _, c := range v.Map {
			if disallowed(c) {
				return true
			}
		}
	case KArr:
		for _, c := range v.Arr {
			if disallowed(c) {
				return true
			}
		}
	}
	return false
}

func writeCanonString(sb *strings.Builder, s string) {
	sb.WriteByte('"')
	for _, r := range s {
		switch {
		case r == '"':
			sb.WriteString(`\"`)
		case r == '\\':
			sb.WriteString(`\\`)
		case r == '\b':
			sb.WriteString(`\b`)
		case r == '\f':
			sb.WriteString(`\f`)
		case r == '\n':
			sb.WriteString(`\n`)
		case r == '\r':
			sb.WriteString(`\r`)
		case r == '\t':
			sb.WriteString(`\t`)
		case r < 0x20:
			const hx = "0123456789abcdef"
			sb.WriteString(`\u00`)
			sb.WriteByte(hx[r>>4])
			sb.WriteByte(hx[r&15])
		default:
			sb.WriteRune(r)
		}
	}
	sb.WriteByte('"')
}

func utf16Less(a, b string) bool {
	x := utf16.Encode([]rune(a))
	y := utf16.Encode([]rune(b))
	for i := 0; i < len(x) && i < len(y); i++ {
		if x[i] != y[i] {
			return x[i] < y[i]
		}
	}
	return len(x) < len(y)
}

func writeCanonKeys(sb *strings.Builder, v *Value, keys []string) {
	ks := append([]string(nil), keys...)
	sort.Slice(ks, func(i, j int) bool { return utf16Less(ks[i], ks[j]) })
	sb.WriteByte('{')
	for i, k := range ks {
		if i > 0 {
			sb.WriteByte(',')
		}
		writeCanonString(sb, k)
		sb.WriteByte(':')
		writeCanon(sb, v.Map[k])
	}
	sb.WriteByte('}')
}

// writeCanon assumes the value contains nothing that section 2 disallows.
func writeCanon(sb *strings.Builder, v *Value) {
	switch v.K {
	case KStr:
		writeCanonString(sb, v.Str)
	case KInt:
		sb.WriteString(strconv.FormatInt(v.Int, 10))
	case KArr:
		sb.WriteByte('[')
		for i, c := range v.Arr {
			if i > 0 {
				sb.WriteByte(',')
			}
			writeCanon(sb, c)
		}
		sb.WriteByte(']')
	case KObj:
		writeCanonKeys(sb, v, v.Keys)
	}
}

// canonSubset: canonical form of the object made of the named keys of v.
func canonSubset(v *Value, keys ...string) []byte {
	var sb strings.Builder
	writeCanonKeys(&sb, v, keys)
	return []byte(sb.String())
}

func sha256hex(b []byte) string {
	h := sha256.Sum256(b)
	return hex.EncodeToString(h[:])
}

// versionHash: SHA-256 hex of canonical {"title","text"}.
func versionHash(title, text string) string {
	var sb strings.Builder
	sb.WriteString(`{"text":`)
	writeCanonString(&sb, text)
	sb.WriteString(`,"title":`)
	writeCanonString(&sb, title)
	sb.WriteByte('}')
	return sha256hex([]byte(sb.String()))
}

// Merkle tree hash, RFC 6962 section 2.1, over 32-byte entry hashes.
func merkleRoot(hashes [][]byte) []byte {
	n := len(hashes)
	if n == 1 {
		h := sha256.Sum256(append([]byte{0}, hashes[0]...))
		return h[:]
	}
	k := 1
	for k*2 < n {
		k *= 2
	}
	l := merkleRoot(hashes[:k])
	r := merkleRoot(hashes[k:])
	buf := append([]byte{1}, l...)
	buf = append(buf, r...)
	h := sha256.Sum256(buf)
	return h[:]
}
