"""Builds prototype/vectors/ed25519-odd-cases.json: public key, message and signature cases that
different Ed25519 libraries can treat differently, each with the result SPEC section 4.2 requires.

    python3 prototype/python/make-ed25519-vectors.py            write the file
    python3 prototype/python/make-ed25519-vectors.py --check    fail if the committed file differs

Standard library only. The expected result of every case is computed here from first principles
(RFC 8032 arithmetic on Python integers), not taken from any library, so the file is an independent
check for any verifier. The eight small-order points are derived by arithmetic and compared with the
list written in SPEC section 4.2. Signing keys come from a fixed test label, so the output is the same
on every run. Test data only.
"""
import hashlib
import json
import os
import sys

P = 2 ** 255 - 19
Q = 2 ** 252 + 27742317777372353535851937790883648493
D = -121665 * pow(121666, P - 2, P) % P
SQRT_M1 = pow(2, (P - 1) // 4, P)
NEUTRAL = (0, 1, 1, 0)


def inv(x):
    return pow(x, P - 2, P)


def add(p, q):
    a, b = (p[1] - p[0]) * (q[1] - q[0]) % P, (p[1] + p[0]) * (q[1] + q[0]) % P
    c, d = 2 * p[3] * q[3] * D % P, 2 * p[2] * q[2] % P
    e, f, g, h = b - a, d - c, d + c, b + a
    return (e * f % P, g * h % P, f * g % P, e * h % P)


def mul(s, p):
    r = NEUTRAL
    while s > 0:
        if s & 1:
            r = add(r, p)
        p = add(p, p)
        s >>= 1
    return r


def same(p, q):
    return (p[0] * q[2] - q[0] * p[2]) % P == 0 and (p[1] * q[2] - q[1] * p[2]) % P == 0


def recover_x(y, sign, strict=True):
    if strict and y >= P:
        return None
    y %= P
    x2 = (y * y - 1) * inv(D * y * y + 1) % P
    if x2 == 0:
        return None if (sign and strict) else 0
    x = pow(x2, (P + 3) // 8, P)
    if (x * x - x2) % P != 0:
        x = x * SQRT_M1 % P
    if (x * x - x2) % P != 0:
        return None
    if (x & 1) != sign:
        x = P - x
    return x


def decode(s, strict=True):
    y = int.from_bytes(s, 'little')
    sign = y >> 255
    y &= (1 << 255) - 1
    x = recover_x(y, sign, strict)
    if x is None:
        return None
    y %= P
    return (x, y, 1, x * y % P)


def encode(p):
    zi = inv(p[2])
    x, y = p[0] * zi % P, p[1] * zi % P
    return int.to_bytes(y | ((x & 1) << 255), 32, 'little')


GY = 4 * inv(5) % P
GX = recover_x(GY, 0)
BASE = (GX, GY, 1, GX * GY % P)


def h512(b):
    return int.from_bytes(hashlib.sha512(b).digest(), 'little')


def spec_verify(pub, msg, sig):
    """SPEC section 4.2, rule 4: RFC 8032 section 5.1.7 without the cofactor, S below L, and
    canonical encodings for the public key and R (a non-canonical encoding fails to decode)."""
    a = decode(pub)
    r = decode(sig[:32])
    if a is None or r is None:
        return False
    s = int.from_bytes(sig[32:], 'little')
    if s >= Q:
        return False
    k = h512(sig[:32] + pub + msg) % Q
    return same(mul(s, BASE), add(r, mul(k, a)))


# ---- the eight points of small order, derived by arithmetic ----
def torsion_encodings():
    for y in range(2, 1000):
        x = recover_x(y, 0)
        if x is None:
            continue
        t = mul(Q, (x, y, 1, x * y % P))          # kills the large-order part; what is left has order dividing 8
        if not same(mul(4, t), NEUTRAL):          # order exactly 8
            pts = [mul(k, t) for k in range(8)]
            return {encode(p).hex() for p in pts}
    raise RuntimeError('no point of order 8 found')


# The list written in SPEC section 4.2 (canonical encodings, lowercase hex).
SMALL_ORDER = [
    '01' + '00' * 31,
    'ec' + 'ff' * 30 + '7f',
    '00' * 32,
    '00' * 31 + '80',
    'c7176a703d4dd84fba3c0b760d10670f2a2053fa2c39ccc64ec7fd7792ac037a',
    'c7176a703d4dd84fba3c0b760d10670f2a2053fa2c39ccc64ec7fd7792ac03fa',
    '26e8958fc2b227b045c3f489f2ef98f0d5dfac05d3c63339b13802886d53fc05',
    '26e8958fc2b227b045c3f489f2ef98f0d5dfac05d3c63339b13802886d53fc85',
]
assert set(SMALL_ORDER) == torsion_encodings(), 'the small-order list does not match the arithmetic'


def key_allowed(pub):
    """SPEC section 4.2, rules 2 and 3."""
    y = int.from_bytes(pub, 'little')
    sign = y >> 255
    y &= (1 << 255) - 1
    if y >= P:
        return False
    if sign and y in (1, P - 1):                  # x is 0 here, and a set sign bit is not allowed
        return False
    return pub.hex() not in SMALL_ORDER


def expect(pub, msg, sig):
    return key_allowed(pub) and spec_verify(pub, msg, sig)


def build():
    t8 = decode(bytes.fromhex(SMALL_ORDER[4]))
    id_enc, zero_s = bytes.fromhex(SMALL_ORDER[0]), bytes(32)
    cases = []

    def add_case(name, pub, msg, sig):
        cases.append({'name': name, 'pub': pub.hex(), 'msg': msg.decode('ascii'), 'sig': sig.hex(), 'expect': expect(pub, msg, sig)})

    seed = hashlib.sha256(b'cip-test-identity:test-alice').digest()
    hh = hashlib.sha512(seed).digest()
    a = (int.from_bytes(hh[:32], 'little') & ((1 << 254) - 8)) | (1 << 254)
    prefix = hh[32:]
    big_a = mul(a, BASE)
    pub = encode(big_a)

    def sign(msg, r_add=None, key=None):
        r = h512(prefix + msg) % Q
        rp = mul(r, BASE)
        if r_add is not None:
            rp = add(rp, r_add)
        rs = encode(rp)
        k = h512(rs + (key or pub) + msg) % Q
        return rs + int.to_bytes((r + k * a) % Q, 32, 'little')

    msg = b'hello'
    good = sign(msg)
    s = int.from_bytes(good[32:], 'little')
    add_case('valid signature', pub, msg, good)
    add_case('S + L (S not below L)', pub, msg, good[:32] + int.to_bytes(s + Q, 32, 'little'))
    add_case('S + 8L (S above 2^255)', pub, msg, good[:32] + int.to_bytes(s + 8 * Q, 32, 'little'))
    add_case('S + 2^253 (high bits set)', pub, msg, good[:32] + int.to_bytes(s + 2 ** 253, 32, 'little'))
    add_case('S = L exactly', pub, msg, good[:32] + int.to_bytes(Q, 32, 'little'))
    add_case('S = 0', pub, msg, good[:32] + bytes(32))
    add_case('R carries an order-8 component (cofactored check passes, plain check fails)', pub, msg, sign(msg, r_add=t8))

    pub_t = encode(add(big_a, t8))
    for want_even in (True, False):
        for i in range(1000):
            m = ('t%d' % i).encode()
            r = h512(prefix + m) % Q
            rs = encode(mul(r, BASE))
            k = h512(rs + pub_t + m) % Q
            if (k % 8 == 0) == want_even:
                add_case('public key has an order-8 component, hash multiple of 8 is %s' % ('true' if want_even else 'false'),
                         pub_t, m, rs + int.to_bytes((r + k * a) % Q, 32, 'little'))
                break

    names = ['identity (y=1)', 'order 2 (y=-1)', 'order 4, even', 'order 4, odd', 'order 8 a', 'order 8 b', 'order 8 c', 'order 8 d']
    noncanon = {
        'non-canonical identity (y=p+1)': 'ee' + 'ff' * 30 + '7f',
        'non-canonical y=p': 'ed' + 'ff' * 30 + '7f',
        'non-canonical y=p, sign bit set': 'ed' + 'ff' * 30 + 'ff',
        'x=0 with sign bit set (y=1)': '01' + '00' * 30 + '80',
        'non-canonical identity, sign bit set': 'ee' + 'ff' * 30 + 'ff',
    }
    sig0 = id_enc + zero_s
    identity = decode(id_enc)
    for label, hx in list(zip(names, SMALL_ORDER)) + list(noncanon.items()):
        pb = bytes.fromhex(hx)
        found_holds = found_fails = False
        for i in range(400):
            m = ('s%d' % i).encode()
            # With S = 0 and R = identity the plain equation reads: identity = identity + k * key.
            holds = same(NEUTRAL, add(identity, mul(h512(sig0[:32] + pb + m) % Q, decode(pb, strict=False))))
            if holds and not found_holds:
                add_case('small-order key [%s], R = identity, S = 0, plain equation holds' % label, pb, m, sig0)
                found_holds = True
            if (not holds) and not found_fails:
                add_case('small-order key [%s], R = identity, S = 0, plain equation fails' % label, pb, m, sig0)
                found_fails = True
            if found_holds and found_fails:
                break

    for label, hx in noncanon.items():
        add_case('public key = identity, R = %s, S = 0' % label, id_enc, b'x', bytes.fromhex(hx) + zero_s)

    for y in range(2, 100):
        if recover_x(y, 0) is None:
            add_case('public key is not a point on the curve (y=%d)' % y, int.to_bytes(y, 32, 'little'), b'x', sig0)
            break
    add_case('public key is 32 bytes of 0xff', b'\xff' * 32, b'x', sig0)
    add_case('valid signature, message changed', pub, b'hellp', good)
    add_case('valid signature, one bit of R changed', pub, msg, bytes([good[0] ^ 1]) + good[1:])

    return {
        'format': 'cip-ed25519-odd-cases/0',
        'about': 'Test data for SPEC section 4.2. Each case is a public key, a message and a signature (hex), and the result a verifier must give. Computed from RFC 8032 arithmetic, not from any library. The keys are test keys.',
        'small_order_keys': SMALL_ORDER,
        'cases': cases,
    }


def main(argv):
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'vectors', 'ed25519-odd-cases.json')
    text = json.dumps(build(), indent=1) + '\n'
    if '--check' in argv:
        have = open(path, encoding='utf-8').read() if os.path.exists(path) else None
        if have != text:
            print('OUT OF DATE: ' + os.path.normpath(path))
            return 1
        print('ok: ' + os.path.normpath(path))
        return 0
    os.makedirs(os.path.dirname(path), exist_ok=True)
    open(path, 'w', encoding='utf-8').write(text)
    print('wrote ' + os.path.normpath(path))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
