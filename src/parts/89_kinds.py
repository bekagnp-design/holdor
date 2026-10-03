# v1.0.86 — the gear kinds grow from 54 to 224 (backend v22). The app's names come from src/gear_kinds.json, written by
# `python3 backend/gear_kinds.py --v22`; the first 54 keep their places, so every item already rolled keeps its kind.
import json, os, re
_K = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'gear_kinds.json')))
_js = 'const GEAR_KIND=' + json.dumps(_K, ensure_ascii=False, separators=(',', ':')) + ';'
_m = re.findall(r"const GEAR_KIND=\{[^\n]*?\};", s); assert len(_m) == 1, ('GEAR_KIND', len(_m))
s = s.replace(_m[0], _js)
