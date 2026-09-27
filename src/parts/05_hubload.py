# hub.js (the v1.0.44 block) is edited here and re-injected by 95_hubinject.py
hub = open(V + 'hub.js', encoding='utf-8').read()
def hrep(old, new, n=1, label=''):
    global hub
    c = hub.count(old)
    assert c == n, f'hub {label}: expected {n}, got {c}: {old[:120]!r}'
    hub = hub.replace(old, new)
