// Section 4.2 implemented from scratch on BigUint point arithmetic (no library verify).
use num_bigint::BigUint;
use num_traits::{One, Zero};
use sha2::{Digest, Sha512};

fn big(s: &str) -> BigUint {
    BigUint::parse_bytes(s.as_bytes(), 10).unwrap()
}

struct Ctx {
    p: BigUint,
    d: BigUint,
    d2: BigUint,
    l: BigUint,
    sqrtm1: BigUint,
    b: Pt,
}

#[derive(Clone)]
struct Pt {
    x: BigUint,
    y: BigUint,
    z: BigUint,
    t: BigUint,
}

fn modinv(a: &BigUint, p: &BigUint) -> BigUint {
    a.modpow(&(p - 2u32), p)
}

impl Ctx {
    fn new() -> Ctx {
        let p = (BigUint::one() << 255) - 19u32;
        let d = (&p - 121665u32) * modinv(&BigUint::from(121666u32), &p) % &p;
        let d2 = (&d * 2u32) % &p;
        let l = (BigUint::one() << 252) + big("27742317777372353535851937790883648493");
        let sqrtm1 = BigUint::from(2u32).modpow(&((&p - 1u32) / 4u32), &p);
        let mut c = Ctx { p, d, d2, l, sqrtm1, b: Pt { x: BigUint::zero(), y: BigUint::one(), z: BigUint::one(), t: BigUint::zero() } };
        let y = BigUint::from(4u32) * modinv(&BigUint::from(5u32), &c.p) % &c.p;
        c.b = c.decompress_y(&y, false).expect("base point");
        c
    }
    fn mk(&self, x: BigUint, y: BigUint) -> Pt {
        let t = &x * &y % &self.p;
        Pt { x, y, z: BigUint::one(), t }
    }
    /// y must be < p already. x=0 with sign set => None.
    fn decompress_y(&self, y: &BigUint, sign: bool) -> Option<Pt> {
        let p = &self.p;
        let y2 = y * y % p;
        let u = (&y2 + p - 1u32) % p;
        let v = (&self.d * &y2 + 1u32) % p;
        let x2 = u * modinv(&v, p) % p;
        let mut x = x2.modpow(&((p + 3u32) / 8u32), p);
        if &(&x * &x % p) != &x2 {
            x = x * &self.sqrtm1 % p;
            if &(&x * &x % p) != &x2 {
                return None;
            }
        }
        if x.is_zero() && sign {
            return None;
        }
        let odd = (&x & BigUint::one()) == BigUint::one();
        if odd != sign {
            x = p - x;
        }
        Some(self.mk(x, y.clone()))
    }
    /// Canonical decoding of a 32-byte encoding: y < p, point exists, x=0 => sign bit 0.
    fn decode(&self, b: &[u8; 32]) -> Option<Pt> {
        let mut yb = *b;
        let sign = yb[31] & 0x80 != 0;
        yb[31] &= 0x7f;
        let y = BigUint::from_bytes_le(&yb);
        if y >= self.p {
            return None;
        }
        self.decompress_y(&y, sign)
    }
    fn add(&self, a: &Pt, b: &Pt) -> Pt {
        let p = &self.p;
        let aa = (&a.y + p - &a.x) % p * ((&b.y + p - &b.x) % p) % p;
        let bb = (&a.y + &a.x) % p * ((&b.y + &b.x) % p) % p;
        let cc = &a.t * &self.d2 % p * &b.t % p;
        let dd = &a.z * 2u32 % p * &b.z % p;
        let e = (&bb + p - &aa) % p;
        let f = (&dd + p - &cc) % p;
        let g = (&dd + &cc) % p;
        let h = (&bb + &aa) % p;
        Pt { x: &e * &f % p, y: &g * &h % p, t: &e * &h % p, z: &f * &g % p }
    }
    fn ident(&self) -> Pt {
        Pt { x: BigUint::zero(), y: BigUint::one(), z: BigUint::one(), t: BigUint::zero() }
    }
    fn mul(&self, k: &BigUint, a: &Pt) -> Pt {
        let mut r = self.ident();
        for i in (0..k.bits()).rev() {
            r = self.add(&r, &r);
            if k.bit(i) {
                r = self.add(&r, a);
            }
        }
        r
    }
    fn eq(&self, a: &Pt, b: &Pt) -> bool {
        let p = &self.p;
        (&a.x * &b.z % p) == (&b.x * &a.z % p) && (&a.y * &b.z % p) == (&b.y * &a.z % p)
    }
    fn is_ident(&self, a: &Pt) -> bool {
        a.x.is_zero() && (&a.y % &self.p) == (&a.z % &self.p)
    }
}

const SMALL: [&str; 8] = [
    "0100000000000000000000000000000000000000000000000000000000000000",
    "ecffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff7f",
    "0000000000000000000000000000000000000000000000000000000000000000",
    "0000000000000000000000000000000000000000000000000000000000000080",
    "c7176a703d4dd84fba3c0b760d10670f2a2053fa2c39ccc64ec7fd7792ac037a",
    "c7176a703d4dd84fba3c0b760d10670f2a2053fa2c39ccc64ec7fd7792ac03fa",
    "26e8958fc2b227b045c3f489f2ef98f0d5dfac05d3c63339b13802886d53fc05",
    "26e8958fc2b227b045c3f489f2ef98f0d5dfac05d3c63339b13802886d53fc85",
];

pub fn is_lower_hex(s: &str, n: usize) -> bool {
    s.len() == n && s.bytes().all(|c| c.is_ascii_digit() || (b'a'..=b'f').contains(&c))
}

/// All five rules of section 4.2.
pub fn verify42(pk_hex: &str, msg: &[u8], sig_hex: &str) -> bool {
    // rule 1
    if !is_lower_hex(pk_hex, 64) || !is_lower_hex(sig_hex, 128) {
        return false;
    }
    let pkv = hex::decode(pk_hex).unwrap();
    let sg = hex::decode(sig_hex).unwrap();
    let mut pk = [0u8; 32];
    pk.copy_from_slice(&pkv);
    let c = Ctx::new();
    // rule 2
    let mut yb = pk;
    let sign = yb[31] & 0x80 != 0;
    yb[31] &= 0x7f;
    let y = BigUint::from_bytes_le(&yb);
    if y >= c.p {
        return false;
    }
    if (y == BigUint::one() || y == &c.p - 1u32) && sign {
        return false;
    }
    // rule 3
    if SMALL.contains(&pk_hex) {
        return false;
    }
    // rule 4
    let a = match c.decode(&pk) {
        Some(a) => a,
        None => return false,
    };
    let mut rb = [0u8; 32];
    rb.copy_from_slice(&sg[..32]);
    let s = BigUint::from_bytes_le(&sg[32..]);
    if s >= c.l {
        return false;
    }
    let r = match c.decode(&rb) {
        Some(r) => r,
        None => return false,
    };
    let mut h = Sha512::new();
    h.update(rb);
    h.update(pk);
    h.update(msg);
    let k = BigUint::from_bytes_le(&h.finalize()) % &c.l;
    let lhs = c.mul(&s, &c.b);
    let rhs = c.add(&r, &c.mul(&k, &a));
    if !c.eq(&lhs, &rhs) {
        return false;
    }
    // rule 5
    c.is_ident(&c.mul(&c.l, &a)) && c.is_ident(&c.mul(&c.l, &r))
}
