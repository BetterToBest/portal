"""Reads results.json (what each library said about the 41 cases) and prints how each one compares with
SPEC section 4.2, which requires the result written in ../ed25519-odd-cases.json. Standard library only; that
file's expected results come from RFC 8032 arithmetic in ../../python/make-ed25519-vectors.py.

    python3 analyze.py                          print the table from results.json
    python3 analyze.py --merge A.json B.json    merge two run outputs and print results.json
    python3 analyze.py --json                   the same numbers as JSON (used by the tests)

"After the checks" means the library's answer is accepted only if it also passes the checks that SPEC 4.2
adds in front of any library: the key rules (2 and 3), S below L, and the key and R in the prime-order
subgroup (rule 5). A program built on any of these libraries would do the same.
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


def checks_ok(c):
    """The checks a program adds in front of any library."""
    pub, sig = bytes.fromhex(c['pub']), bytes.fromhex(c['sig'])
    return mk.key_allowed(pub) and int.from_bytes(sig[32:], 'little') < mk.Q and mk.in_prime_subgroup(pub) and mk.in_prime_subgroup(sig[:32])


def analyze(data):
    n = len(cases)
    want = [c['expect'] for c in cases]
    rows = []
    for name, r in data['results'].items():
        after = [r[i] and checks_ok(c) for i, c in enumerate(cases)]
        rows.append({
            'library': name,
            'agrees_alone': sum(r[i] == want[i] for i in range(n)),
            'accepts_what_42_refuses': sum(1 for i in range(n) if r[i] and not want[i]),
            'refuses_what_42_accepts': sum(1 for i in range(n) if not r[i] and want[i]),
            'agrees_after_checks': sum(after[i] == want[i] for i in range(n)),
            'differs_alone': [cases[i]['name'] for i in range(n) if r[i] != want[i]],
        })
    return rows


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
    rows = analyze(data)
    n = len(cases)
    if argv[:1] == ['--json']:
        print(json.dumps({'cases': n, 'must_pass': sum(c['expect'] for c in cases), 'rows': rows}))
        return 0
    print('Versions: ' + ', '.join('%s %s' % kv for kv in data['versions'].items()))
    print('Cases: %d (%d must pass under SPEC 4.2)' % (n, sum(c['expect'] for c in cases)))
    print()
    print('| Library | Agrees on its own | Accepts what 4.2 refuses | Refuses what 4.2 accepts | Agrees after the checks |')
    print('|---|---|---|---|---|')
    for r in rows:
        print('| %s | %d/%d | %d | %d | %d/%d |' % (r['library'], r['agrees_alone'], n, r['accepts_what_42_refuses'], r['refuses_what_42_accepts'], r['agrees_after_checks'], n))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
