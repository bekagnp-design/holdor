# ---- the campaign: 50 stages from Sunspear to the Lands of Always Winter ----
import sys as _sys
_sys.path.insert(0, V)
import importlib as _il
import stages as _st
_il.reload(_st)
LAY = json.load(open(V + 'layouts.json'))
MULTS = json.load(open(V + 'mults.json')) if os.path.exists(V + 'mults.json') else {}

def _js(v):
    if isinstance(v, bool): return 'true' if v else 'false'
    if isinstance(v, (int, float)): return repr(v)
    if isinstance(v, str): return json.dumps(v, ensure_ascii=False)
    if isinstance(v, (list, tuple)): return '[' + ','.join(_js(x) for x in v) + ']'
    raise TypeError(v)

levels = []
for i, S in enumerate(_st.STAGES):
    sid = i + 1; boss = bool(S.get('boss'))
    lay = LAY[str(sid)]
    waves = round(8 + 12 * (sid - 1) / 49) + (2 if boss else 0)
    mult = MULTS.get(str(sid), round(0.95 + 1.05 * ((sid - 1) / 49) ** 1.1, 3))
    gold = 200 + 2 * (sid - 1) + (30 if S['lay'] != 'one' else 0) + (20 if boss else 0)
    d = dict(id=sid, n=S['n'], sub=S['sub'], biome=S['biome'], waves=waves, mult=mult, gold=gold, raw=True, style=lay['style'],
             gates=lay['gates'], routes=lay['routes'])
    if S.get('sea'): d['sea'] = S['sea']; d['seaW'] = 40
    if S.get('river') is not None: d['river'] = S['river']
    if S.get('ponds'): d['ponds'] = S['ponds']
    if sid >= 3: d['archers'] = True
    if sid >= 8: d['walkers'] = True
    if sid >= 11: d['giants'] = True
    if sid >= 19: d['dragon'] = 8
    if sid >= 21: d['lord'] = True
    if sid == 50: d['king'] = waves
    if S.get('mod'): d['mod'] = S['mod']
    if boss: d['boss'] = True
    d['lay'] = S['lay']
    d['intro'] = _st.INTRO.get(sid, '')
    levels.append(d)

levels_js = 'const LEVELS=[\n' + ',\n'.join('  {' + ','.join(k + ':' + _js(v) for k, v in d.items()) + '}' for d in levels) + '\n];'
i = s.find('const LEVELS=['); j = s.find('\n];', i) + 3; assert 0 < i < j
s = s[:i] + levels_js + s[j:]
# stages are single battles now: the old II/III helpers collapse to the one stage
i = s.find('/* ---- 39 battles:'); j = s.find('function stageStars(a,g,s)', i); assert 0 < i < j
s = s[:i] + "/* ---- 50 battles, one per stage. stageLevel(g) is kept for old callers. */\nfunction stageLevel(g,s){return LEVELS[g-1];}\n" + s[j:]
rep("function stageStars(a,g,s){const S=(a||ACC).stg||{};return (S[g]&&S[g][s])||(s===1?((a||ACC).campaign[g]||0):0);}",
    "function stageStars(a,g,s){return (campOf(a)[g])||0;}", label='stageStars')
rep("function stageOpen(a,g,s){return s===1?levelOpen(a,LEVELS[g-1]):stageStars(a,g,s-1)>=1;}",
    "function stageOpen(a,g,s){return levelOpen(a,LEVELS[g-1]);}", label='stageOpen')
pools = 'const POOLS={\n' + ',\n'.join(' %d:%s' % (k, _js(v)) for k, v in sorted(_st.POOLS.items())) + ',\n};'
i = s.find('const POOLS={'); j = s.find('};', i) + 2; s = s[:i] + pools + s[j:]
def _mini(k):
    return ['sword'] if k <= 10 else ['giant'] if k <= 18 else ['giant', 'thenn'] if k <= 26 else ['bear', 'chief'] if k <= 36 else ['chief', 'mammoth'] if k <= 44 else ['mammoth', 'brood', 'chief']
minis = 'const MINIS={' + ','.join('%d:%s' % (k, _js(_mini(k))) for k in range(1, 51)) + '};'
i = s.find('const MINIS={'); j = s.find('};', i) + 2; s = s[:i] + minis + s[j:]
rep("const TOWER_UNLOCK={watch:0,glass:1,keep:2,scorp:3,wild:5,weir:8};", "const TOWER_UNLOCK={watch:0,glass:1,keep:3,scorp:6,wild:10,weir:16};", label='tunlock')
rep("const LVL_GATES=[0,2,4,7,10];", "const LVL_GATES=[0,3,8,15,24];", label='tiers')
rep(" fire:{e:'🔥',n:'Dracarys',cd:60,at:3,", " fire:{e:'🔥',n:'Dracarys',cd:60,at:4,", label='fireat')
rep("const UNLOCK_STAGE=[0,2,3,5,7,9,11];", "const UNLOCK_STAGE=[0,3,6,10,15,21,28];", label='champunlock')
rep(" {id:'winter',e:'❄️',n:\"Winter's end\",d:'Hold all 13 gates.',g:25,f:s=>s.cleared>=13},",
    " {id:'winter',e:'❄️',n:\"Winter's end\",d:'Hold all 50 stages.',g:40,f:s=>s.cleared>=50},", label='achwinter')
# pins on the world map
mappos = 'const MAPPOS={' + ','.join('%d:[%d,%d]' % (k + 1, S['pos'][0], S['pos'][1]) for k, S in enumerate(_st.STAGES)) + '};'
i = s.find('const MAPPOS={'); j = s.find('};', i) + 2; s = s[:i] + mappos + s[j:]
# enemy HP curve: no more II/III compression
rep("const bw=G.level&&G.level.stage>1?LEVELS[G.level.id-1].waves:G.totalWaves;const ne=G.totalWaves>1&&bw>1?1+(n-1)*(bw-1)/(G.totalWaves-1):n;return G.mult*(1+0.10*(ne-1))*Math.pow(1.024,ne-1);",
    "return G.mult*(1+0.10*(n-1))*Math.pow(1.024,n-1);", label='hpmul')
# pass the sea width through
rep("sea:L.sea,river:L.river,", "sea:L.sea,seaW:L.seaW,river:L.river,", label='seaW')
