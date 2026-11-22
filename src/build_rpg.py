#!/usr/bin/env python3
"""Builds the HOLDOR RPG: src/rpg/index.tpl.html + css/*.css + assets/*.js + js/*.js → beta/index.html (or argv[1])."""
import glob, os, sys
H = os.path.dirname(os.path.abspath(__file__)); V = os.path.join(H, 'rpg'); ROOT = os.path.dirname(H)
out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'beta', 'index.html')
tpl = open(os.path.join(V, 'index.tpl.html'), encoding='utf-8').read()
def cat(pat, sep, guard=False):
    parts = []
    for f in sorted(glob.glob(os.path.join(V, pat))):
        rel = os.path.relpath(f, V); body = open(f, encoding='utf-8').read().rstrip('\n')
        if guard:   # every js module is an IIFE: a load-time throw in one must not abort the ones after it
            body = 'try{\n' + body + '\n}catch(e){console.error("[rpg] %s", e); if(window.R&&R.err)R.err("%s: "+(e&&e.message||e));}' % (rel, rel)
        parts.append('/* ==== %s ==== */\n' % rel + body + '\n')
    return sep.join(parts)
css = cat('css/*.css', '\n')
js = cat('vendor/*.js', '\n') + '\n' + cat('assets/*.js', '\n') + '\n' + cat('js/*.js', '\n', True)
assert '</style>' in tpl and '</script>' in tpl, 'template needs </style> and </script>'
s = tpl.replace('</style>', css + '\n</style>', 1)
k = s.rfind('</script>'); assert k > 0
s = s[:k] + js + '\n' + s[k:]          # the LAST script tag is the inline one (the first is the Telegram SDK include)
os.makedirs(os.path.dirname(out), exist_ok=True)
open(out, 'w', encoding='utf-8').write(s)
print('wrote', out, len(s))
