# Final enemy multipliers per stage: bot-tuned values (tuned*.json), a little easier for people (×0.92),
# a gentle ramp for the first eight stages, and each value kept within ±18% of its layout-class trend.
import json, sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from stages import STAGES
D = os.path.dirname(os.path.abspath(__file__)) + '/'
t = {}
for f in ('tuned_pass1.json', 'tuned2.json', 'tuned3.json'):
    if os.path.exists(D + f):
        for k, v in json.load(open(D + f)).items(): t[int(k)] = v
# pass 1 hit the lower bound on these (all losses) — pass 2 re-tuned them
EARLY = [1.30, 1.45, 1.60, 1.75, 1.90, 2.00, 2.10, 2.20]
def trend(sid, lay):
    if lay in ('one', 'merge'): return 2.6 + 0.1 * (sid - 9) / 41
    if lay == 'fork': return 1.96 + 0.4 * (sid - 30) / 14
    if lay == 'twin': return 1.5 + 0.38 * (sid - 14) / 35
    return 1.6
out = {}
for i, S in enumerate(STAGES):
    sid = i + 1; lay = S['lay']; tr = trend(sid, lay)
    v = t.get(sid, tr)
    v = max(tr * 0.82, min(tr * 1.18, v))
    if sid == 50: v = t.get(50, 1.12)          # the Night King's own stage
    m = 0.92 * v
    if sid <= 8: m = min(m, EARLY[sid - 1])
    out[str(sid)] = round(m, 3)
# softened after the verification pass (bot lost or scraped through)
for sid, f in {30: 0.9, 34: 0.94, 38: 0.88, 43: 0.88, 50: 0.95}.items(): out[str(sid)] = round(out[str(sid)] * f, 3)
json.dump(out, open(D + 'mults.json', 'w'), indent=0)
for i in range(0, 50, 10):
    print(' '.join('%2d:%.2f%s' % (j + 1, out[str(j + 1)], STAGES[j]['lay'][0]) for j in range(i, min(50, i + 10))))
