#!/usr/bin/env python3
# v1.0.59 rebalance: the same bot tuned every stage twice — the v1.0.58 build with its old player (Jon always, no
# rarity), and the v1.0.59 build with the new player (the newest Stark champion open at that stage, its rarity bonus).
#   CHROMIUM_PATH=… PAR=2 REP=4 IT=7 HOLDOR_HTML=<v1.0.58 build> node src/tools/tune45.js 1-50 src/tools/tuned59_old.json
#   CHROMIUM_PATH=… PAR=2 REP=4 IT=7 MODEL=v59 node src/tools/tune45.js 1-50 src/tools/tuned59_new.json
# ratio = new / old (> 1: the new player holds more, the stage may push harder). The ratio is noisy per stage, so it is
# smoothed over five neighbours and kept within −8% … +12%; stage 50 (the Night King) stays as it is.
# A verification pass (IT=1 at the final values, REP 4) against the same pass on v1.0.58 then matched the band means
# (≈ 5 bot points per 1% of multiplier): BAND below. Mean score after: v1.0.58 62.5, v1.0.59 63.5; stages under target−30: 7 → 6.
# Run once: python3 src/tools/shift59.py  (it refuses to run twice — mults.json keeps a marker)
import json, os
D = os.path.dirname(os.path.abspath(__file__)); M = os.path.join(os.path.dirname(D), 'mults.json')
old = {int(k): v for k, v in json.load(open(os.path.join(D, 'tuned59_old.json'))).items()}
new = {int(k): v for k, v in json.load(open(os.path.join(D, 'tuned59_new.json'))).items()}
mults = json.load(open(M))
assert '_shift59' not in mults, 'already shifted'
r = {k: new[k] / old[k] for k in old}
BAND = [(11, 20, 0.986), (21, 30, 0.976), (31, 40, 1.025), (41, 49, 1.02)]
out = {}
for k in range(1, 51):
    win = [r[j] for j in range(max(1, k - 2), min(50, k + 2) + 1)]
    f = max(0.92, min(1.12, sum(win) / len(win)))
    for a, b, c in BAND:
        if a <= k <= b: f *= c
    if k == 50: f = 1.0
    out[str(k)] = round(mults[str(k)] * f, 3)
    print('%2d %.3f → %.3f  (raw %.2f, used %.3f)' % (k, mults[str(k)], out[str(k)], r[k], f))
out['_shift59'] = 1
json.dump(out, open(M, 'w'), indent=0)
