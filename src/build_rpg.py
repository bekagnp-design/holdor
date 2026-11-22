#!/usr/bin/env python3
"""Builds the HOLDOR RPG: src/rpg/index.tpl.html + css/*.css + assets/*.js + js/*.js → beta/index.html (or argv[1])."""
import glob, os, sys
H = os.path.dirname(os.path.abspath(__file__)); V = os.path.join(H, 'rpg'); ROOT = os.path.dirname(H)
out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'beta', 'index.html')
tpl = open(os.path.join(V, 'index.tpl.html'), encoding='utf-8').read()
def cat(pat, sep):
    parts = []
    for f in sorted(glob.glob(os.path.join(V, pat))):
        parts.append('/* ==== %s ==== */\n' % os.path.relpath(f, V) + open(f, encoding='utf-8').read().rstrip('\n') + '\n')
    return sep.join(parts)
css = cat('css/*.css', '\n')
js = cat('assets/*.js', '\n') + '\n' + cat('js/*.js', '\n')
assert '</style>' in tpl and '</script>' in tpl, 'template needs </style> and </script>'
s = tpl.replace('</style>', css + '\n</style>', 1).replace('</script>', js + '\n</script>', 1)
os.makedirs(os.path.dirname(out), exist_ok=True)
open(out, 'w', encoding='utf-8').write(s)
print('wrote', out, len(s))
