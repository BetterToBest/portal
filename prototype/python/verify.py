"""CIP Phase 3 prototype: second verifier for the test log, written from prototype/SPEC.md.

A research prototype on TEST DATA. Not a voting system. It reads the files you give it and prints
a result; it makes no network connections and stores nothing. The only dependency is the
`cryptography` package (for Ed25519).

    python3 prototype/python/verify.py <log.json> [--trusted <checkpoint.json>]
    python3 prototype/python/verify.py checkpoint <log.json> [--index N] [--out <file>]
    python3 prototype/python/verify.py compare <checkpoint-a.json> <checkpoint-b.json>

verify (the default): exit code 0 when the log passes every check, 1 otherwise; the result is
printed as JSON. checkpoint: checks the log's integrity, then prints (or saves) one of its
checkpoints as a standalone file, the last one unless --index says otherwise; exit 1 if the log
fails. compare: checks two checkpoints against each other (SPEC section 5.1); exit 0 unless it
reports errors. It writes a file only when you pass --out to checkpoint.
"""
import functools
import hashlib
import json
import re
import sys

from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey

SAFE = 2 ** 53 - 1
# fullmatch, not match: with '$', Python's match also accepts a trailing newline, and bytes.fromhex skips
# whitespace, so 'sig + newline' would verify. The spec says lowercase 0-9a-f only.
HEX64 = re.compile(r'[0-9a-f]{64}')
HEX128 = re.compile(r'[0-9a-f]{128}')


def normalize(v):
    """Read whole-number floats inside the safe range as integers (SPEC section 2)."""
    if isinstance(v, float):
        if v == v and abs(v) <= SAFE and v == int(v):
            return int(v)
        return v
    if isinstance(v, list):
        return [normalize(x) for x in v]
    if isinstance(v, dict):
        return {k: normalize(x) for k, x in v.items()}
    return v


def canon(v):
    if isinstance(v, bool) or v is None or isinstance(v, float):
        raise ValueError('type not allowed')
    if isinstance(v, int):
        if abs(v) > SAFE:
            raise ValueError('integer too large')
        return str(v)
    if isinstance(v, str):
        v.encode('utf-8')  # raises on unpaired surrogates
        return json.dumps(v, ensure_ascii=False)
    if isinstance(v, list):
        return '[' + ','.join(canon(x) for x in v) + ']'
    if isinstance(v, dict):
        keys = sorted(v.keys(), key=lambda k: k.encode('utf-16-be', 'surrogatepass'))
        return '{' + ','.join(canon(k) + ':' + canon(v[k]) for k in keys) + '}'
    raise ValueError('type not allowed')


def canon_ok(v):
    try:
        canon(v)
        return True
    except (ValueError, UnicodeEncodeError):
        return False


def sha(b):
    return hashlib.sha256(b).digest()


def sha_hex(s):
    return sha(s.encode('utf-8')).hex()


P25519 = 2 ** 255 - 19
# SPEC section 4.2, rule 3: the eight points of small order, as canonical encodings.
SMALL_ORDER = {
    '01' + '00' * 31, 'ec' + 'ff' * 30 + '7f', '00' * 32, '00' * 31 + '80',
    'c7176a703d4dd84fba3c0b760d10670f2a2053fa2c39ccc64ec7fd7792ac037a', 'c7176a703d4dd84fba3c0b760d10670f2a2053fa2c39ccc64ec7fd7792ac03fa',
    '26e8958fc2b227b045c3f489f2ef98f0d5dfac05d3c63339b13802886d53fc05', '26e8958fc2b227b045c3f489f2ef98f0d5dfac05d3c63339b13802886d53fc85',
}


def key_allowed(pub):
    """SPEC section 4.2, rules 2 and 3 (rule 5 is in_prime_subgroup, below). Common libraries accept non-canonical and small-order keys, so
    this check is ours, made before the library is asked."""
    y = int.from_bytes(bytes.fromhex(pub), 'little')
    sign = y >> 255
    y &= (1 << 255) - 1
    if y >= P25519:
        return False  # not the canonical form of y
    if sign and y in (1, P25519 - 1):
        return False  # x is 0 here, so a set sign bit is not allowed
    return pub not in SMALL_ORDER


# SPEC section 4.2, rule 5: the public key and R must lie in the prime-order subgroup, that is, [L] times the
# point is the identity. Libraries differ on points that carry a small-order component (some check the
# equation with the cofactor, some without), so this check is ours, made after the library says yes. The
# arithmetic is the textbook Edwards form on Python integers; results are cached because a log repeats
# the same few keys.
L25519 = 2 ** 252 + 27742317777372353535851937790883648493
D25519 = -121665 * pow(121666, P25519 - 2, P25519) % P25519
SQRT_M1 = pow(2, (P25519 - 1) // 4, P25519)


def _decode_point(h):
    """None unless the 32 bytes are a canonical encoding of a curve point."""
    y = int.from_bytes(bytes.fromhex(h), 'little')
    sign = y >> 255
    y &= (1 << 255) - 1
    if y >= P25519:
        return None
    y2 = y * y % P25519
    x2 = (y2 - 1) * pow(D25519 * y2 + 1, P25519 - 2, P25519) % P25519
    if x2 == 0:
        return None if sign else (0, y, 1, 0)
    x = pow(x2, (P25519 + 3) // 8, P25519)
    if (x * x - x2) % P25519:
        x = x * SQRT_M1 % P25519
    if (x * x - x2) % P25519:
        return None
    if (x & 1) != sign:
        x = P25519 - x
    return (x, y, 1, x * y % P25519)


def _ed_add(p, q):
    a, b = (p[1] - p[0]) * (q[1] - q[0]) % P25519, (p[1] + p[0]) * (q[1] + q[0]) % P25519
    c, d = 2 * p[3] * q[3] * D25519 % P25519, 2 * p[2] * q[2] % P25519
    e, f, g, h = b - a, d - c, d + c, b + a
    return (e * f % P25519, g * h % P25519, f * g % P25519, e * h % P25519)


@functools.lru_cache(maxsize=4096)
def in_prime_subgroup(h):
    pt = _decode_point(h)
    if pt is None:
        return False
    r, base, s = (0, 1, 1, 0), pt, L25519
    while s > 0:
        if s & 1:
            r = _ed_add(r, base)
        base = _ed_add(base, base)
        s >>= 1
    return r[0] % P25519 == 0 and (r[1] - r[2]) % P25519 == 0


def verify_sig(pub, msg, sig):
    try:
        if not (isinstance(pub, str) and isinstance(sig, str) and HEX64.fullmatch(pub) and HEX128.fullmatch(sig)):
            return False
        if not key_allowed(pub):
            return False
        Ed25519PublicKey.from_public_bytes(bytes.fromhex(pub)).verify(bytes.fromhex(sig), msg.encode('utf-8'))
        return in_prime_subgroup(pub) and in_prime_subgroup(sig[:64])
    except Exception:
        return False


def is_int(v):
    return isinstance(v, int) and not isinstance(v, bool) and abs(v) <= SAFE


def is_hex64(v):
    return isinstance(v, str) and HEX64.fullmatch(v) is not None


def is_hex128(v):
    return isinstance(v, str) and HEX128.fullmatch(v) is not None


def is_str(v, lo, hi):
    return isinstance(v, str) and lo <= len(v) <= hi


def keys_are(o, ks):
    return isinstance(o, dict) and sorted(o.keys()) == sorted(ks)


def merkle_root(hashes):
    def leaf(h):
        return sha(b'\x00' + bytes.fromhex(h))

    def go(lo, hi):
        n = hi - lo
        if n == 1:
            return leaf(hashes[lo])
        k = 1
        while k * 2 < n:
            k *= 2
        return sha(b'\x01' + go(lo, lo + k) + go(lo + k, hi))

    return go(0, len(hashes)).hex()


def record_payload(r):
    return canon({'type': r['type'], 'author': r['author'], 'body': r['body']})


def entry_hash(e):
    return sha_hex(canon({'index': e['index'], 'prev': e['prev'], 'record': e['record'], 'time': e['time']}))


def version_hash(title, text):
    return sha_hex(canon({'title': title, 'text': text}))


def entry_format_ok(e):
    if not keys_are(e, ['index', 'prev', 'time', 'record', 'hash']):
        return False
    r = e['record']
    return (is_int(e['index']) and is_hex64(e['prev']) and is_int(e['time']) and e['time'] >= 0
            and is_hex64(e['hash']) and keys_are(r, ['type', 'author', 'body', 'sig'])
            and isinstance(r['type'], str) and is_hex64(r['author']) and is_hex128(r['sig'])
            and isinstance(r['body'], dict) and canon_ok(r['body']))


def body_ok(t, b):
    if t == 'genesis':
        return keys_are(b, ['threshold', 'comment_seconds']) and is_int(b['threshold']) and b['threshold'] >= 1 \
            and is_int(b['comment_seconds']) and b['comment_seconds'] >= 0
    if t == 'register_key':
        return keys_are(b, ['public_key', 'label']) and is_hex64(b['public_key']) and is_str(b['label'], 1, 40)
    if t == 'propose':
        return keys_are(b, ['title', 'text']) and is_str(b['title'], 1, 120) and is_str(b['text'], 1, 20000)
    if t == 'amend':
        return keys_are(b, ['proposal', 'title', 'text']) and is_hex64(b['proposal']) \
            and is_str(b['title'], 1, 120) and is_str(b['text'], 1, 20000)
    if t == 'sign':
        return keys_are(b, ['proposal', 'version']) and is_hex64(b['proposal']) and is_hex64(b['version'])
    if t == 'comment':
        return keys_are(b, ['proposal', 'text']) and is_hex64(b['proposal']) and is_str(b['text'], 1, 2000)
    return False


def checkpoint_payload(c):
    return canon({'operator': c['operator'], 'root': c['root'], 'size': c['size'], 'time': c['time']})


def check_checkpoint(prefix, c, operator, n_entries, hashes, errors, where, index):
    def err(code):
        errors.append({'code': prefix + code, 'where': where, 'index': index})

    if not (keys_are(c, ['operator', 'root', 'size', 'time', 'sig']) and is_hex64(c['operator'])
            and is_hex64(c['root']) and is_int(c['size']) and is_int(c['time']) and is_hex128(c['sig'])):
        return err('BAD_FORMAT')
    if c['operator'] != operator:
        err('WRONG_OPERATOR')
    if not verify_sig(c['operator'], checkpoint_payload(c), c['sig']):
        err('BAD_SIG')
    out_of_range = c['size'] < 1 or c['size'] > n_entries
    if prefix == 'CP_':
        if out_of_range:
            return err('BAD_SIZE')
        if merkle_root(hashes[:c['size']]) != c['root']:
            err('BAD_ROOT')
    else:
        if out_of_range:
            return err('TRUNCATED')
        if merkle_root(hashes[:c['size']]) != c['root']:
            err('MISMATCH')


class Proposal:
    def __init__(self, author, title, vhash):
        self.author, self.title, self.versions = author, title, [vhash]
        self.sigs, self.threshold_time = set(), None

    def state(self, settings, now):
        if len(self.sigs) < settings['threshold']:
            return 'collecting'
        return 'comment' if now < self.threshold_time + settings['comment_seconds'] else 'closed'


def verify_log(log, trusted=None, have_trusted=False):
    res = {'ok': False, 'integrity_errors': [], 'rule_errors': [], 'summary': None}
    if not (keys_are(log, ['format', 'entries', 'checkpoints']) and log['format'] == 'cip-test-log/0'
            and isinstance(log['entries'], list) and isinstance(log['checkpoints'], list)):
        res['integrity_errors'].append({'code': 'BAD_FORMAT', 'where': 'log', 'index': 0})
        return res
    E = log['entries']
    ie, re_ = res['integrity_errors'], res['rule_errors']
    bad = set()
    hashes = []
    zero = '0' * 64
    for i, e in enumerate(E):
        def flag(code, i=i):
            ie.append({'code': code, 'where': 'entry', 'index': i})
            bad.add(i)
        if not entry_format_ok(e):
            flag('BAD_FORMAT')
            hashes.append(zero)
            continue
        if e['index'] != i:
            flag('BAD_INDEX')
        if i == 0:
            want_prev = zero
        else:
            before = E[i - 1]
            want_prev = before.get('hash') if isinstance(before, dict) else None
        if e['prev'] != want_prev:
            flag('BAD_PREV')
        h = entry_hash(e)
        hashes.append(h)
        if h != e['hash']:
            flag('BAD_HASH')
        if not verify_sig(e['record']['author'], record_payload(e['record']), e['record']['sig']):
            flag('BAD_SIG')

    operator = None
    if E and isinstance(E[0], dict) and isinstance(E[0].get('record'), dict):
        r0 = E[0]['record']
        if r0.get('type') == 'genesis' and is_hex64(r0.get('author')):
            operator = r0['author']
    for j, c in enumerate(log['checkpoints']):
        check_checkpoint('CP_', c, operator, len(E), hashes, ie, 'checkpoint', j)
    if have_trusted:
        check_checkpoint('TRUSTED_', trusted, operator, len(E), hashes, ie, 'trusted', 0)

    keys, proposals, order = set(), {}, []
    settings = None
    last_time, comments, registered = 0, 0, 0
    for i, e in enumerate(E):
        if i in bad:
            continue

        def err(code, i=i):
            re_.append({'code': code, 'where': 'entry', 'index': i})
        r, b, t = e['record'], e['record']['body'], e['record']['type']
        prev = E[i - 1] if i > 0 else None
        if i > 0 and isinstance(prev, dict) and is_int(prev.get('time')) and e['time'] < prev['time']:
            err('TIME_REVERSED')
        last_time = e['time']
        if i == 0:
            if t != 'genesis':
                err('NO_GENESIS')
        elif t == 'genesis':
            err('DUPLICATE_GENESIS')
            continue
        if not body_ok(t, b):
            err('BAD_BODY')
            continue
        if t == 'genesis':
            if i == 0:
                settings = {'threshold': b['threshold'], 'comment_seconds': b['comment_seconds']}
                keys.add(r['author'])
            continue
        if settings is None:
            continue
        if t == 'register_key':
            if b['public_key'] != r['author']:
                err('SELF_REGISTER_MISMATCH')
            elif b['public_key'] in keys:
                err('DUPLICATE_KEY')
            elif not b['label'].startswith('test-'):
                err('BAD_LABEL')
            else:
                keys.add(b['public_key'])
                registered += 1
            continue
        if r['author'] not in keys:
            err('UNREGISTERED_AUTHOR')
            continue
        if t == 'propose':
            pid = hashes[i]
            proposals[pid] = Proposal(r['author'], b['title'], version_hash(b['title'], b['text']))
            order.append(pid)
            continue
        p = proposals.get(b['proposal'])
        if p is None:
            err('UNKNOWN_PROPOSAL')
            continue
        if p.state(settings, e['time']) == 'closed':
            err('PROPOSAL_CLOSED')
            continue
        if t == 'amend':
            if r['author'] != p.author:
                err('NOT_PROPOSER')
                continue
            p.versions.append(version_hash(b['title'], b['text']))
            p.title, p.sigs, p.threshold_time = b['title'], set(), None
        elif t == 'sign':
            if b['version'] != p.versions[-1]:
                err('STALE_VERSION')
                continue
            if r['author'] in p.sigs:
                err('DUPLICATE_SIGNATURE')
                continue
            p.sigs.add(r['author'])
            if len(p.sigs) == settings['threshold']:
                p.threshold_time = e['time']
        elif t == 'comment':
            comments += 1

    if settings is not None:
        res['summary'] = {
            'entries': len(E), 'registered': registered, 'comments': comments,
            'proposals': [{'id': pid, 'title': proposals[pid].title, 'versions': len(proposals[pid].versions),
                           'version': proposals[pid].versions[-1], 'signatures': len(proposals[pid].sigs),
                           'state': proposals[pid].state(settings, last_time)} for pid in order]}
    res['ok'] = not ie and not re_
    return res


def compare_checkpoints(a, b):
    """Compare two saved checkpoints with no log (SPEC section 5.1)."""
    res = {'ok': False, 'errors': [], 'relation': None, 'operator': None}

    def err(code, where):
        res['errors'].append({'code': code, 'where': where})

    usable = []
    for where, c in (('a', a), ('b', b)):
        if cp_shape_ok(c):
            usable.append((where, c))
        else:
            err('CMP_BAD_FORMAT', where)
    if len(usable) == 2 and a['operator'] != b['operator']:
        err('CMP_DIFFERENT_OPERATOR', 'both')
    for where, c in usable:
        if not verify_sig(c['operator'], checkpoint_payload(c), c['sig']):
            err('CMP_BAD_SIG', where)
    if not res['errors']:
        res['operator'] = a['operator']
        if a['size'] != b['size']:
            res['relation'] = 'different-size'
        elif a['root'] == b['root']:
            res['relation'] = 'identical'
        else:
            res['relation'] = 'conflict'
            err('CMP_CONFLICT', 'both')
    res['ok'] = not res['errors']
    return res


def cp_shape_ok(c):
    return (keys_are(c, ['operator', 'root', 'size', 'time', 'sig']) and is_hex64(c['operator'])
            and is_hex64(c['root']) and is_int(c['size']) and is_int(c['time']) and is_hex128(c['sig']))


def extract_checkpoint(log, index=None):
    """Pick one checkpoint out of a log with no integrity errors. Returns a dict with either
    'checkpoint' (and 'index', 'rule_errors') or 'error' (and maybe 'details')."""
    r = verify_log(log)
    if r['integrity_errors']:
        return {'error': 'the log has integrity errors, so no checkpoint was taken from it',
                'details': r['integrity_errors']}
    cps = log['checkpoints']
    if not cps:
        return {'error': 'the log holds no checkpoints'}
    i = len(cps) - 1 if index is None else index
    if not isinstance(i, int) or i < 0 or i >= len(cps):
        return {'error': 'there is no checkpoint at position %s (the log holds %d, numbered from 0)' % (index, len(cps))}
    return {'checkpoint': cps[i], 'index': i, 'rule_errors': len(r['rule_errors'])}


def format_checkpoint(c):
    return json.dumps(c, indent=1) + '\n'  # same layout as the files in testdata/


def main(argv):
    usage = ('usage:\n  verify.py <log.json> [--trusted <checkpoint.json>]\n'
             '  verify.py checkpoint <log.json> [--index N] [--out <file>]\n'
             '  verify.py compare <checkpoint-a.json> <checkpoint-b.json>\n')
    if not argv or argv[0] in ('-h', '--help'):
        sys.stderr.write(usage)
        return 2

    def read(path):
        with open(path, encoding='utf-8') as f:
            return normalize(json.load(f))

    def opt(name):
        return argv[argv.index(name) + 1] if name in argv and argv.index(name) > 0 and argv.index(name) + 1 < len(argv) else None

    if argv[0] == 'checkpoint' and len(argv) > 1:
        ix, out = opt('--index'), opt('--out')
        if ('--index' in argv and not (ix and ix.isdigit() and ix.isascii())) or ('--out' in argv and not out):
            sys.stderr.write(usage)
            return 2
        r = extract_checkpoint(read(argv[1]), None if ix is None else int(ix))
        if 'error' in r:
            sys.stderr.write('not saved: ' + r['error'] + '\n')
            if 'details' in r:
                sys.stderr.write(json.dumps(r['details'], separators=(',', ':')) + '\n')
            return 1
        if r['rule_errors']:
            sys.stderr.write('note: the log breaks %d rule(s); run verify to see them. The checkpoint itself is intact.\n' % r['rule_errors'])
        if out:
            with open(out, 'w', encoding='utf-8') as f:
                f.write(format_checkpoint(r['checkpoint']))
            sys.stderr.write('saved checkpoint %d (size %d) to %s\n' % (r['index'], r['checkpoint']['size'], out))
        else:
            sys.stdout.write(format_checkpoint(r['checkpoint']))
        return 0
    if argv[0] == 'compare' and len(argv) > 2:
        result = compare_checkpoints(read(argv[1]), read(argv[2]))
        print(json.dumps(result, indent=2))
        return 0 if result['ok'] else 1
    if argv[0] in ('checkpoint', 'compare'):
        sys.stderr.write(usage)
        return 2
    log = read(argv[0])
    if '--trusted' in argv:
        result = verify_log(log, read(argv[argv.index('--trusted') + 1]), True)
    else:
        result = verify_log(log)
    print(json.dumps(result, indent=2))
    return 0 if result['ok'] else 1


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
