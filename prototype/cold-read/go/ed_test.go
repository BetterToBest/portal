package main

import "testing"

func TestBase(t *testing.T) {
	if !isIdentity(smul(fL, bpt)) {
		t.Fatal("[L]B not identity")
	}
	// the eight small-order points: decode, 8*P identity
	for k := range smallOrder {
		p, ok := decodeCanonical(hexDecode(k))
		if !ok {
			// non-canonical encodings (y>=p, or sign bit with x=0) are expected to fail rule 2
			t.Logf("not canonical/point: %s", k)
			continue
		}
		q := smul(bigI(8), p)
		if !isIdentity(q) {
			t.Fatalf("8P not identity for %s", k)
		}
	}
}
