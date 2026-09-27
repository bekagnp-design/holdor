#!/usr/bin/env python3
# HOLDOR build — the v1.0.44 baseline + src/parts/*.py (exact-string patches, run in name order).
# usage: python3 src/build.py [out]      (default: beta/index.html; release = copy beta/index.html to index.html)
import re, sys, base64, json, os
V = os.path.dirname(os.path.abspath(__file__)) + '/'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = V + 'base/index.v1.0.44.html'
OUT = os.path.join(ROOT, sys.argv[1] if len(sys.argv) > 1 else 'beta/index.html')
s = open(BASE, encoding='utf-8').read()

def rep(old, new, n=1, label=''):
    global s
    c = s.count(old)
    assert c == n, f'{label}: expected {n}, got {c}: {old[:120]!r}'
    s = s.replace(old, new)

def mod(name):
    return open(V + 'mod/' + name, encoding='utf-8').read()

for part in sorted(os.listdir(V + 'parts')):
    if part.endswith('.py'):
        exec(open(V + 'parts/' + part, encoding='utf-8').read(), globals())

open(OUT, 'w', encoding='utf-8').write(s)
print('wrote', OUT, len(s))
