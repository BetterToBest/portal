package main

// Section 4.2 signature check, written on math/big only. No library Ed25519 is used.

import (
	"crypto/sha512"
	"math/big"
)

var (
	fp  = new(big.Int).Sub(new(big.Int).Lsh(big.NewInt(1), 255), big.NewInt(19))
	fL  = newL()
	fD  *big.Int
	fD2 *big.Int
	fI  *big.Int // sqrt(-1)
	bpt *point
)

func newL() *big.Int {
	l := new(big.Int).Lsh(big.NewInt(1), 252)
	c, _ := new(big.Int).SetString("27742317777372353535851937790883648493", 10)
	return l.Add(l, c)
}

type point struct{ X, Y, Z, T *big.Int }

func fmul(a, b *big.Int) *big.Int {
	r := new(big.Int).Mul(a, b)
	return r.Mod(r, fp)
}
func fadd(a, b *big.Int) *big.Int {
	r := new(big.Int).Add(a, b)
	return r.Mod(r, fp)
}
func fsub(a, b *big.Int) *big.Int {
	r := new(big.Int).Sub(a, b)
	return r.Mod(r, fp)
}
func finv(a *big.Int) *big.Int {
	return new(big.Int).Exp(a, new(big.Int).Sub(fp, big.NewInt(2)), fp)
}

func init() {
	fD = fmul(new(big.Int).Sub(fp, big.NewInt(121665)), finv(big.NewInt(121666)))
	fD2 = fadd(fD, fD)
	// sqrt(-1) = 2^((p-1)/4)
	e := new(big.Int).Rsh(new(big.Int).Sub(fp, big.NewInt(1)), 2)
	fI = new(big.Int).Exp(big.NewInt(2), e, fp)
	by := fmul(big.NewInt(4), finv(big.NewInt(5)))
	bx, ok := recoverX(by, 0)
	if !ok {
		panic("base point")
	}
	bpt = &point{bx, by, big.NewInt(1), fmul(bx, by)}
}

// recoverX returns x with x^2 = (y^2-1)/(d y^2+1) and x&1 == sign.
func recoverX(y *big.Int, sign uint) (*big.Int, bool) {
	y2 := fmul(y, y)
	u := fsub(y2, big.NewInt(1))
	v := fadd(fmul(fD, y2), big.NewInt(1))
	x2 := fmul(u, finv(v))
	if x2.Sign() == 0 {
		if sign == 1 {
			return nil, false
		}
		return big.NewInt(0), true
	}
	x := new(big.Int).Exp(x2, new(big.Int).Rsh(new(big.Int).Add(fp, big.NewInt(3)), 3), fp)
	if fmul(x, x).Cmp(x2) != 0 {
		x = fmul(x, fI)
	}
	if fmul(x, x).Cmp(x2) != 0 {
		return nil, false
	}
	if x.Bit(0) != sign {
		x = new(big.Int).Sub(fp, x)
	}
	return x, true
}

func identity() *point {
	return &point{big.NewInt(0), big.NewInt(1), big.NewInt(1), big.NewInt(0)}
}

// add: complete addition for a = -1 (RFC 8032 section 5.1.4); also used for doubling.
func padd(p, q *point) *point {
	a := fmul(fsub(p.Y, p.X), fsub(q.Y, q.X))
	b := fmul(fadd(p.Y, p.X), fadd(q.Y, q.X))
	c := fmul(fmul(p.T, fD2), q.T)
	d := fmul(fadd(p.Z, p.Z), q.Z)
	e := fsub(b, a)
	f := fsub(d, c)
	g := fadd(d, c)
	h := fadd(b, a)
	return &point{fmul(e, f), fmul(g, h), fmul(f, g), fmul(e, h)}
}

func smul(k *big.Int, p *point) *point {
	r := identity()
	for i := k.BitLen() - 1; i >= 0; i-- {
		r = padd(r, r)
		if k.Bit(i) == 1 {
			r = padd(r, p)
		}
	}
	return r
}

func isIdentity(p *point) bool {
	return p.X.Sign() == 0 && p.Y.Cmp(p.Z) == 0
}

func peq(p, q *point) bool {
	return fmul(p.X, q.Z).Cmp(fmul(q.X, p.Z)) == 0 && fmul(p.Y, q.Z).Cmp(fmul(q.Y, p.Z)) == 0
}

func leInt(b []byte) *big.Int {
	r := make([]byte, len(b))
	for i := range b {
		r[len(b)-1-i] = b[i]
	}
	return new(big.Int).SetBytes(r)
}

// decodeCanonical applies rule 2 (canonical spelling) and then reads the bytes as a point.
// ok is false if the spelling is not canonical or there is no such point.
func decodeCanonical(b []byte) (*point, bool) {
	if len(b) != 32 {
		return nil, false
	}
	c := make([]byte, 32)
	copy(c, b)
	sign := uint(c[31] >> 7)
	c[31] &= 0x7f
	y := leInt(c)
	if y.Cmp(fp) >= 0 {
		return nil, false
	}
	if (y.Cmp(big.NewInt(1)) == 0 || y.Cmp(new(big.Int).Sub(fp, big.NewInt(1))) == 0) && sign == 1 {
		return nil, false
	}
	x, ok := recoverX(y, sign)
	if !ok {
		return nil, false
	}
	return &point{x, y, big.NewInt(1), fmul(x, y)}, true
}

var smallOrder = map[string]bool{
	"0100000000000000000000000000000000000000000000000000000000000000": true,
	"ecffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7f": true,
	"0000000000000000000000000000000000000000000000000000000000000000": true,
	"0000000000000000000000000000000000000000000000000000000000000080": true,
	"c7176a703d4dd84fba3c0b760d10670f2a2053fa2c39ccc64ec7fd7792ac037a": true,
	"c7176a703d4dd84fba3c0b760d10670f2a2053fa2c39ccc64ec7fd7792ac03fa": true,
	"26e8958fc2b227b045c3f489f2ef98f0d5dfac05d3c63339b13802886d53fc05": true,
	"26e8958fc2b227b045c3f489f2ef98f0d5dfac05d3c63339b13802886d53fc85": true,
}

var subgroupCache = map[string]bool{}

func inPrimeSubgroup(raw []byte, p *point) bool {
	k := string(raw)
	if v, ok := subgroupCache[k]; ok {
		return v
	}
	v := isIdentity(smul(fL, p))
	subgroupCache[k] = v
	return v
}

func hexDecode(s string) []byte {
	out := make([]byte, len(s)/2)
	for i := range out {
		out[i] = byte(hexv(s[2*i])<<4 | hexv(s[2*i+1]))
	}
	return out
}

// sigOK implements section 4.2 (all five rules). pkHex and sigHex are checked for shape (rule 1).
func sigOK(pkHex, sigHex string, msg []byte) bool {
	if !isHex(pkHex, 64) || !isHex(sigHex, 128) {
		return false
	}
	pk := hexDecode(pkHex)
	sig := hexDecode(sigHex)
	// rule 2
	A, ok := decodeCanonical(pk)
	if !ok {
		return false
	}
	// rule 3
	if smallOrder[pkHex] {
		return false
	}
	// rule 4
	Rb := sig[:32]
	S := leInt(sig[32:])
	if S.Cmp(fL) >= 0 {
		return false
	}
	R, ok := decodeCanonical(Rb)
	if !ok {
		return false
	}
	h := sha512.New()
	h.Write(Rb)
	h.Write(pk)
	h.Write(msg)
	k := leInt(h.Sum(nil))
	k.Mod(k, fL)
	lhs := smul(S, bpt)
	rhs := padd(R, smul(k, A))
	if !peq(lhs, rhs) {
		return false
	}
	// rule 5
	if !inPrimeSubgroup(pk, A) || !inPrimeSubgroup(Rb, R) {
		return false
	}
	return true
}

func isHex(s string, n int) bool {
	if len(s) != n {
		return false
	}
	for i := 0; i < len(s); i++ {
		c := s[i]
		if !((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f')) {
			return false
		}
	}
	return true
}

func bigI(n int64) *big.Int { return big.NewInt(n) }
