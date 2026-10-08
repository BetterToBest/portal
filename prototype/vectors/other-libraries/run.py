"""Runs the 41 odd Ed25519 cases (../ed25519-odd-cases.json) through PyNaCl (libsodium) and PyCryptodome,
and prints a JSON result to standard output. Evidence only: no verifier in this repository uses these
libraries. Run from this folder after installing them (see README.md):
    python3 run.py > py-results.json
"""
import json
import os

import Crypto
import nacl
import nacl.signing
from Crypto.PublicKey import ECC  # noqa: F401  (imported so a missing install fails early)
from Crypto.Signature import eddsa

here = os.path.dirname(os.path.abspath(__file__))
cases = json.load(open(os.path.join(here, '..', 'ed25519-odd-cases.json'), encoding='utf-8'))['cases']


def pynacl(pub, msg, sig):
    nacl.signing.VerifyKey(pub).verify(msg, sig)
    return True


def pycryptodome(pub, msg, sig):
    eddsa.new(eddsa.import_public_key(pub), 'rfc8032').verify(msg, sig)
    return True


results = {}
for name, f in (('PyNaCl (libsodium)', pynacl), ('PyCryptodome', pycryptodome)):
    out = []
    for c in cases:
        try:
            r = bool(f(bytes.fromhex(c['pub']), c['msg'].encode('ascii'), bytes.fromhex(c['sig'])))
        except Exception:  # an exception counts as "refused"
            r = False
        out.append(r)
    results[name] = out
print(json.dumps({'versions': {'PyNaCl': nacl.__version__, 'PyCryptodome': Crypto.__version__}, 'results': results}))
