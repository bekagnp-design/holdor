#!/usr/bin/env python3
"""
extract_assets.py — lifts the old HOLDOR tower-defense build's inline art and data tables into src/rpg/assets/*.js.

The old game kept every sprite inline as a data URI inside one HTML file.  This reads that file and writes:
  10_enemy.js   const A_ENEMY = {art, white, meta, cfg, names, order}       (ENEMY_ART / ENEMY_META / ENEMY_CFG / the ED table)
  11_champ.js   const A_CHAMP = {art, meta, list, byId, ids, houses, houseOrder, unlockAt, skills}   (CHAMP_ART / CHAMP_META / CH / HOUSES / SK)
  12_map.js     const A_MAP   = {w, h, src, k, old, stages, regions}          (src/assets/westeros_1200.webp + MAPPOS + LEVELS + REGIONS)
  13_misc.js    const A_GATE  = {art, meta};  const A_ICON = {…svg strings…};  const A_ICONS = A_ICON   (GATE_ART / GATE_META / ICONS / HUB_ICON / CUR_* / *_SVG)
19_loader.js is hand-written (it turns these into Image objects on R.assets) and is not touched here.

Source: the first of these that holds `const ENEMY_ART=`:
  argv[1] (a path)  →  beta/index.html  →  `git show <LAST_TD_SHA>:beta/index.html` (the last tower-defense build, v1.5.1)
  →  src/base/index.v1.0.44.html.
The git fallback matters: once the RPG build takes over beta/index.html the old art is only in history.

Usage: python3 src/rpg/tools/extract_assets.py [source.html]
"""
import json, os, re, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
RPG = os.path.dirname(HERE)                       # src/rpg
ROOT = os.path.dirname(os.path.dirname(RPG))      # repo root
OUT = os.path.join(RPG, 'assets')
WEBP = os.path.join(ROOT, 'src', 'assets', 'westeros_1200.webp')
LAST_TD_SHA = '5658ef4'                           # merge of PR #50: beta/index.html = v1.5.1, the last tower-defense build
MARK = 'const ENEMY_ART='
LIMIT = 9 * 1024 * 1024                           # the budget for every generated file together
OLD_W, OLD_H, OLD_BEYOND = 720, 1229, 200         # the old map frame (CSS px) MAPPOS lives in; the art itself is 1200×2048
MAP_W, MAP_H = 1200, 2048

# ------------------------------------------------------------------ source
def read_source(argv):
    cands = []
    if len(argv) > 1 and not argv[1].startswith('--'):
        cands.append(('file', argv[1]))
    cands += [('file', os.path.join(ROOT, 'beta', 'index.html')),
              ('git', LAST_TD_SHA + ':beta/index.html'),
              ('file', os.path.join(ROOT, 'src', 'base', 'index.v1.0.44.html'))]
    for kind, ref in cands:
        try:
            if kind == 'file':
                if not os.path.isfile(ref): continue
                s = open(ref, encoding='utf-8').read()
            else:
                s = subprocess.run(['git', '-C', ROOT, 'show', ref], capture_output=True, check=True).stdout.decode('utf-8')
        except Exception as e:  # noqa
            print('  skip', ref, '-', e.__class__.__name__); continue
        if MARK in s:
            return s, (ref if kind == 'file' else 'git:' + ref)
        print('  skip', ref, '- no', MARK)
    sys.exit('no source holds ' + MARK)

# ------------------------------------------------------------------ a small JS-literal parser (data only; functions are dropped)
FN = object()          # marker: a function value, the key is dropped
ID = re.compile(r'[A-Za-z_$][\w$]*')
NUM = re.compile(r'[-+]?(?:0[xX][0-9a-fA-F]+|(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)')
ESC = {'n': '\n', 't': '\t', 'r': '\r', 'b': '\b', 'f': '\f', 'v': '\v', '0': '\0'}

class P:
    def __init__(self, s, i): self.s, self.i = s, i
    def err(self, msg): raise SyntaxError('%s at %d: %r' % (msg, self.i, self.s[self.i:self.i + 60]))
    def ws(self):
        s, n = self.s, len(self.s)
        while self.i < n:
            c = s[self.i]
            if c in ' \t\r\n': self.i += 1
            elif s.startswith('//', self.i): j = s.find('\n', self.i); self.i = n if j < 0 else j
            elif s.startswith('/*', self.i): j = s.find('*/', self.i + 2); self.i = n if j < 0 else j + 2
            else: break
    def value(self):
        self.ws(); s = self.s; c = s[self.i]
        if c == '{': return self.obj()
        if c == '[': return self.arr()
        if c in '\'"`': return self.str()
        if c == '(': return self.fn()
        if c in '-+.' or c.isdigit(): return self.num()
        m = ID.match(s, self.i)
        if not m: self.err('unexpected')
        w = m.group(0); self.i = m.end(); self.ws()
        if s.startswith('=>', self.i): self.i += 2; self.skip_expr(); return FN
        if w == 'function': self.skip_expr(); return FN
        if w == 'true': return True
        if w == 'false': return False
        if w in ('null', 'undefined'): return None
        self.err('identifier ' + w)
    def fn(self):
        self.skip_balanced(); self.ws()
        if not self.s.startswith('=>', self.i): self.err('parenthesised value')
        self.i += 2; self.skip_expr(); return FN
    def skip_balanced(self):
        s, d = self.s, 0
        while True:
            c = s[self.i]
            if c in '\'"`': self.skip_str(); continue
            if c in '([{': d += 1
            elif c in ')]}':
                d -= 1
                if d == 0: self.i += 1; return
            self.i += 1
    def skip_expr(self):
        s, d = self.s, 0
        while self.i < len(s):
            c = s[self.i]
            if c in '\'"`': self.skip_str(); continue
            if c in '([{': d += 1
            elif c in ')]}':
                if d == 0: return
                d -= 1
            elif c == ',' and d == 0: return
            self.i += 1
    def skip_str(self):
        s = self.s; q = s[self.i]; self.i += 1
        while s[self.i] != q:
            self.i += 2 if s[self.i] == '\\' else 1
        self.i += 1
    def str(self):
        s = self.s; q = s[self.i]; self.i += 1; out = []
        while True:
            c = s[self.i]
            if c == '\\':
                d = s[self.i + 1]
                if d == 'u':
                    if s[self.i + 2] == '{':
                        j = s.find('}', self.i + 3); out.append(chr(int(s[self.i + 3:j], 16))); self.i = j + 1
                    else:
                        out.append(chr(int(s[self.i + 2:self.i + 6], 16))); self.i += 6
                elif d == 'x': out.append(chr(int(s[self.i + 2:self.i + 4], 16))); self.i += 4
                elif d == '\n': self.i += 2
                else: out.append(ESC.get(d, d)); self.i += 2
                continue
            if c == q: self.i += 1; break
            if q == '`' and s.startswith('${', self.i): self.err('template with ${}')
            out.append(c); self.i += 1
        r = ''.join(out)
        if any('\ud800' <= ch <= '\udfff' for ch in r):
            r = r.encode('utf-16', 'surrogatepass').decode('utf-16')
        return r
    def num(self):
        m = NUM.match(self.s, self.i)
        if not m: self.err('number')
        t = m.group(0); self.i = m.end()
        if t[1:3].lower().startswith('x') or t[:2].lower() == '0x': return int(t, 16)
        return float(t) if ('.' in t or 'e' in t.lower()) else int(t)
    def obj(self):
        s = self.s; self.i += 1; o = {}
        while True:
            self.ws()
            if s[self.i] == '}': self.i += 1; return o
            if s[self.i] in '\'"': k = self.str()
            elif s[self.i].isdigit(): k = str(self.num())
            else:
                m = ID.match(s, self.i)
                if not m: self.err('key')
                k = m.group(0); self.i = m.end()
            self.ws()
            if s[self.i] != ':': self.err('colon')
            self.i += 1
            v = self.value()
            if v is not FN: o[k] = v
            self.ws()
            if s[self.i] == ',': self.i += 1
    def arr(self):
        s = self.s; self.i += 1; a = []
        while True:
            self.ws()
            if s[self.i] == ']': self.i += 1; return a
            if s[self.i] == ',': self.i += 1; a.append(None); continue
            v = self.value(); a.append(None if v is FN else v)
            self.ws()
            if s[self.i] == ',': self.i += 1

def find_lit(src, name, opens='{['):
    """index of the literal that `name = ` introduces (the first match whose value starts with one of `opens`), or -1"""
    for m in re.finditer(r'(?<![\w$.])%s\s*=\s*' % re.escape(name), src):
        j = m.end()
        if j < len(src) and src[j] in opens: return j
    return -1

def lit(src, name, opens='{[', need=True):
    j = find_lit(src, name, opens)
    if j < 0:
        if need: sys.exit('literal %s not found' % name)
        print('  (no %s in this source)' % name); return None
    return P(src, j).value()

def str_const(src, name):
    j = find_lit(src, name, '\'"`')
    return P(src, j).str() if j >= 0 else None

# ------------------------------------------------------------------ writing
def js(v):
    t = json.dumps(v, ensure_ascii=False, separators=(',', ':'))
    return t.replace('</', '<\\/').replace('\u2028', '\\u2028').replace('\u2029', '\\u2029')

def js_rows(v):
    """one entry per line: a list → [\n a,\n b\n], a dict → {\n "k":v,\n ...}"""
    if isinstance(v, dict):
        return '{\n' + ',\n'.join(' %s:%s' % (js(k), js(x)) for k, x in v.items()) + '\n}'
    return '[\n' + ',\n'.join(' ' + js(x) for x in v) + '\n]'

def write(name, body, head):
    p = os.path.join(OUT, name)
    open(p, 'w', encoding='utf-8').write('/* generated by src/rpg/tools/extract_assets.py — do not edit by hand.\n   %s */\n%s\n' % (head, body))
    n = os.path.getsize(p); print('  wrote %-12s %9d bytes' % (name, n)); return n

def main(argv):
    src, origin = read_source(argv)
    m = re.search(r'(?:const|let|var)\s+VERSION\s*=\s*[\'"]([^\'"]+)', src)
    ver = m.group(1) if m else 'unknown'
    head = 'source: %s (HOLDOR v%s)' % (os.path.relpath(origin, ROOT) if os.path.isabs(origin) else origin, ver)
    print('source', head)
    os.makedirs(OUT, exist_ok=True)
    total = 0

    # ---- enemies
    art = lit(src, 'ENEMY_ART'); meta = lit(src, 'ENEMY_META'); cfg = lit(src, 'ENEMY_CFG'); ed = lit(src, 'ED')
    white = lit(src, 'ENEMY_WHITE_ART', need=False) or {}
    assert len(art) >= 20 and all(v.startswith('data:image') for v in art.values()), 'ENEMY_ART'
    names, order = {}, []
    for i, d in enumerate(ed):
        # the old game: {key:d[0],n:d[1],e:d[2],arch:d[3],hp:d[4],spd:d[5],dps:d[6],gold:d[7],r:d[8],c:d[9]||1} + d[10]
        k = d[0]
        e = {'key': k, 'n': d[1], 'e': d[2], 'arch': d[3], 'hp': d[4], 'spd': d[5], 'dmg': d[6], 'dps': d[6], 'gold': d[7], 'r': d[8], 'c': d[9] or 1}
        if len(d) > 10 and isinstance(d[10], dict): e.update(d[10])
        if k in cfg: e['h'] = cfg[k].get('h'); e['an'] = cfg[k].get('an')
        e['art'] = k in art; e['i'] = i; e['raw'] = d
        names[k] = e; order.append(k)
    body = 'const A_ENEMY={\nart:%s,\nwhite:%s,\nmeta:%s,\ncfg:%s,\nnames:%s,\norder:%s\n};' % (js(art), js(white), js(meta), js(cfg), js_rows(names), js(order))
    total += write('10_enemy.js', body, head + '\n   A_ENEMY: art/white = {key: data URI}, meta = {key:{cx,by,w,h,C}} (sheet geometry), cfg = {key:{h,an}} (height in world px at scale 1, walk kind),\n   names = {key:{key,n,e,arch,hp,spd,dmg,dps,gold,r,c,…extras(pal,ranged,pack,big,boss…),h,an,art,i,raw}} from the ED table, order = the ED order')
    print('    enemies: %d art, %d meta, %d cfg, %d ED rows, %d white' % (len(art), len(meta), len(cfg), len(ed), len(white)))

    # ---- champions
    cart = lit(src, 'CHAMP_ART'); cmeta = lit(src, 'CHAMP_META'); ch = lit(src, 'CH'); houses = lit(src, 'HOUSES')
    horder = lit(src, 'HOUSE_ORDER', need=False) or list(houses.keys())
    unlock = lit(src, 'UNLOCK_AT', need=False) or []
    try: sk = lit(src, 'SK', need=False) or {}
    except SyntaxError as e: print('  (SK skipped: %s)' % e); sk = {}
    assert len(cart) >= 40 and all(v.startswith('data:image') for v in cart.values()), 'CHAMP_ART'
    by, ids = {}, []
    for i, r in enumerate(ch):
        by[r[0]] = {'id': r[0], 'house': r[1], 'n': r[2], 'e': r[3], 'type': r[4], 'sk': list(r[5:8]), 'i': i,
                    'art': {'idle': r[0] in cart, 'attack': r[0] + '_attack' in cart, 'portrait': r[0] + '_portrait' in cart}}
        ids.append(r[0])
    body = 'const A_CHAMP={\nart:%s,\nmeta:%s,\nlist:%s,\nbyId:%s,\nids:%s,\nhouses:%s,\nhouseOrder:%s,\nunlockAt:%s,\nskills:%s\n};' % (
        js(cart), js(cmeta), js_rows(ch), js_rows(by), js(ids), js_rows(houses), js(horder), js(unlock), js_rows(sk))
    nidle = sum(1 for k in cart if '_' not in k); natt = sum(1 for k in cart if k.endswith('_attack')); npor = sum(1 for k in cart if k.endswith('_portrait'))
    total += write('11_champ.js', body, head + '\n   A_CHAMP: art = {id | id_attack | id_portrait: data URI}, meta = {key:{cx,by,w,h,C}}, list = the CH rows [id,house,name,emoji,type,sk1,sk2,sk3],\n   byId = {id:{id,house,n,e,type,sk:[3],i,art:{idle,attack,portrait}}}, ids, houses = {house:{n,e,words,col,col2,seat}}, houseOrder, unlockAt, skills = the old SK table without its text functions')
    print('    champions: %d CH rows, art %d (idle %d, attack %d, portrait %d), meta %d, houses %d, skills %d' % (len(ch), len(cart), nidle, natt, npor, len(cmeta), len(houses), len(sk)))

    # ---- map
    import base64
    wb = open(WEBP, 'rb').read()
    assert wb[:4] == b'RIFF' and wb[8:12] == b'WEBP', WEBP
    mappos = lit(src, 'MAPPOS'); levels = lit(src, 'LEVELS'); regions = lit(src, 'REGIONS', need=False) or []
    land = str_const(src, 'LAND'); isles = lit(src, 'ISLES', need=False) or []
    k = MAP_W / OLD_W
    stages = []
    for L in levels:
        mx, my = mappos[str(L['id'])]
        stages.append({'id': L['id'], 'n': L['n'], 'sub': L.get('sub', ''), 'biome': L.get('biome', ''), 'x': round(mx * k), 'y': round(my * k), 'mx': mx, 'my': my,
                       'waves': L.get('waves'), 'boss': bool(L.get('boss')), 'mult': L.get('mult'), 'gold': L.get('gold'), 'offMap': my < 0})
    regs = [{'n': r[2], 'x': round(r[0] * k), 'y': round(r[1] * k), 'mx': r[0], 'my': r[1], 'fs': r[3]} for r in regions]
    assert len(stages) == 50 and len(mappos) == 50, 'stages'
    body = ('const A_MAP={\nw:%d,h:%d,\nk:%s,\nold:{w:%d,h:%d,beyond:%d,land:%s,isles:%s},\nstages:%s,\nregions:%s,\nsrc:%s\n};'
            % (MAP_W, MAP_H, js(k), OLD_W, OLD_H, OLD_BEYOND, js(land), js(isles), js_rows(stages), js_rows(regs), js('data:image/webp;base64,' + base64.b64encode(wb).decode('ascii'))))
    total += write('12_map.js', body, head + '\n   A_MAP: src = the Westeros art (1200×2048 webp, src/assets/westeros_1200.webp — byte-identical to the old MAP_ART), w, h,\n   stages = the 50 old campaign stages {id,n,sub,biome,x,y,mx,my,waves,boss,mult,gold,offMap}: mx,my = MAPPOS in the old 720×1229 CSS frame, x,y = the same point in\n   art pixels (× k = 1200/720); stages 48–50 lie above the art (y < 0, offMap) where the old game drew a %d-px snow strip (old.beyond). World units = x,y × 6.\n   regions = the old region labels {n,x,y,mx,my,fs}; old.land / old.isles = the land outline SVG paths in the 720 frame' % OLD_BEYOND)
    print('    map: %d bytes webp, %d stages (%d off the art), %d regions' % (len(wb), len(stages), sum(1 for s in stages if s['offMap']), len(regs)))

    # ---- misc: gate + icons
    gart = lit(src, 'GATE_ART'); gmeta = lit(src, 'GATE_META', need=False) or []
    assert sum(1 for u in gart if u) >= 2, 'GATE_ART'
    icons = {}
    for tbl in ('ICONS', 'HUB_ICON'):
        t = lit(src, tbl, need=False) or {}
        icons.update({kk: v for kk, v in t.items() if isinstance(v, str) and v.startswith('<svg')})
    for m2 in re.finditer(r'(?<![\w$.])HUB_ICON\.(\w+)\s*=\s*(?=[\'"`]<svg)', src):
        icons[m2.group(1)] = P(src, m2.end()).str()
    for name, const in (('gold', 'CUR_GOLD'), ('gem', 'CUR_GEM'), ('star', 'STAR_SVG'), ('trophy', 'TROPHY_SVG'), ('lock', 'SH_LOCK_SVG')):
        v = str_const(src, const)
        if v and v.startswith('<svg'): icons[name] = v
    unit = lit(src, 'UNIT_SVG', need=False) or {}
    if unit: icons['unit'] = unit
    body = 'const A_GATE={\nart:%s,\nmeta:%s\n};\nconst A_ICON=%s;\nconst A_ICONS=A_ICON;' % (js(gart), js(gmeta), js_rows(icons))
    total += write('13_misc.js', body, head + '\n   A_GATE: art = [null, data URI ×5] (the door by damage stage 1..5), meta = [null, {w,h,ox,oy} ×5].\n   A_ICON (= A_ICONS): SVG source strings with viewBox 0 0 24 24 and no size — the old ICONS (city,tavern,forge,daily,season,gift,door,quests,social,friends),\n   HUB_ICON (shop,coll,battle,tasks,earn,events,hold,clan,trials), gold (CUR_GOLD), gem (CUR_GEM), star, trophy, lock, unit:{foot,archer,rider}.\n   There is no static chest icon in the old build (chests were drawn in code)')
    print('    misc: %d gate images, %d gate meta, %d icons: %s' % (sum(1 for u in gart if u), sum(1 for u in gmeta if u), len(icons), ' '.join(sorted(icons))))

    print('total generated %d bytes (%.2f MB), budget %.0f MB' % (total, total / 1048576, LIMIT / 1048576))
    if total > LIMIT: sys.exit('over the %d MB budget' % (LIMIT // 1048576))

if __name__ == '__main__':
    main(sys.argv)
