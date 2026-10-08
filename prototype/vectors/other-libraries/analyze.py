"""Reads results.json (what each library said about the 40 cases) and prints how each one compares with
SPEC section 4.2, and with 4.2 plus the prime-order-subgroup rule that SPEC section 9 question 5 asks about.
Standard library only; the expected results come from RFC 8032 arithmetic in ../../python/make-ed25519-vectors.py.

    python3 analyze.py                          print the table from results.json
    python3 analyze.py --merge A.json B.json    merge two run outputs and print results.json
    python3 analyze.py --json                   the same numbers as JSON (used by the tests)
"""
import importlib.util
import json
import os
import sys

here = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location('mk', os.path.join(here, '..', '..', 'python', 'make-ed25519-vectors.py'))
mk = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mk)
cases = json.load(open(os.path.join(here, '..', 'ed25519-odd-cases.json'), encoding='utf-8'))['cases']


def in_prime_subgroup(enc):
    pt = mk.decode(enc)
    return pt is not None and mk.same(mk.mul(mk.Q, pt), mk.NEUTRAL)


def wrapper_ok(c):
    """Checks a program would add in front of any library: the 4.2 key rules, S below L, key and R in the prime-order subgroup."""
    pub, sig = bytes.fromhex(c['pub']), bytes.fromhex(c['sig'])
    return mk.key_allowed(pub) and int.from_bytes(sig[32:], 'little') < mk.Q and in_prime_subgroup(pub) and in_prime_subgroup(sig[:32])


def analyze(data):
    key_ok = [mk.key_allowed(bytes.fromhex(c['pub'])) for c in cases]
    want42 = [c['expect'] for c in cases]
    want_sub = [c['expect'] and wrapper_ok(c) for c in cases]
    rows = []
    for name, r in data['results'].items():
        with_keys = [r[i] and key_ok[i] for i in range(len(cases))]
        with_all = [r[i] and wrapper_ok(c) for i, c in enumerate(cases)]
        n = len(cases)
        rows.append({
            'library': name,
            'alone_vs_42': sum(r[i] == want42[i] for i in range(n)),
            'accepts_what_42_refuses': sum(1 for i in range(n) if r[i] and not want42[i]),
            'refuses_what_42_accepts': sum(1 for i in range(n) if not r[i] and want42[i]),
            'with_key_rules_vs_42': sum(with_keys[i] == want42[i] for i in range(n)),
            'alone_vs_subgroup_rule': sum(r[i] == want_sub[i] for i in range(n)),
            'with_wrapper_vs_subgroup_rule': sum(with_all[i] == want_sub[i] for i in range(n)),
        })
    changed = [c['name'] for i, c in enumerate(cases) if want42[i] != want_sub[i]]
    return rows, changed


def main(argv):
    if argv[:1] == ['--merge']:
        merged = {'versions': {}, 'results': {}}
        for f in argv[1:]:
            d = json.load(open(f, encoding='utf-8'))
            merged['versions'].update(d['versions'])
            merged['results'].update(d['results'])
        print(json.dumps(merged, indent=1))
        return 0
    data = json.load(open(os.path.join(here, 'results.json'), encoding='utf-8'))
    rows, changed = analyze(data)
    n = len(cases)
    if argv[:1] == ['--json']:
        print(json.dumps({'cases': n, 'rows': rows, 'expectation_changes_under_subgroup_rule': changed}))
        return 0
    print('Versions: ' + ', '.join('%s %s' % kv for kv in data['versions'].items()))
    print('Cases: %d (%d must pass under 4.2). Under the subgroup rule %d must pass; expectation changes for: %s' % (n, sum(c['expect'] for c in cases), sum(c['expect'] and wrapper_ok(c) for c in cases), '; '.join(changed) or 'none'))
    print()
    print('| Library | Agrees with 4.2 on its own | Accepts what 4.2 refuses | Refuses what 4.2 accepts | Agrees with 4.2 after the key rules (2 and 3) | Agrees with the subgroup rule on its own | Agrees with the subgroup rule after the checks |')
    print('|---|---|---|---|---|---|---|')
    for r in rows:
        print('| %s | %d/%d | %d | %d | %d/%d | %d/%d | %d/%d |' % (r['library'], r['alone_vs_42'], n, r['accepts_what_42_refuses'], r['refuses_what_42_accepts'], r['with_key_rules_vs_42'], n, r['alone_vs_subgroup_rule'], n, r['with_wrapper_vs_subgroup_rule'], n))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
