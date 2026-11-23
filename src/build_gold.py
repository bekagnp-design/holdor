#!/usr/bin/env python3
"""Heavy Gold build: src/gold/index.tpl.html + src/gold/js/*.js (sorted by name, each in its own <script> with a guard)
-> beta/index.html (or the path given). The core game lives in the template; every module talks to it only through window.G
(G.on, G.addMod, the slots #titleExtra, #titleLinks, #endExtra, #hudExtra). A module that throws at load shows in #err and
the game still runs."""
import sys, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
out = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'beta' / 'index.html'
tpl = (ROOT / 'src' / 'gold' / 'index.tpl.html').read_text(encoding='utf-8')
mods = []
for f in sorted((ROOT / 'src' / 'gold' / 'js').glob('*.js')):
    src = f.read_text(encoding='utf-8').replace('</script', '<\\/script')
    mods.append('<script>/* %s */\n(function(){try{\n%s\n}catch(e){(window.G&&G.showErr?G.showErr:console.error)("module %s: "+(e&&e.message||e));}})();\n</script>' % (f.name, src, f.name))
html = tpl.replace('<!--MODULES-->', '\n'.join(mods))
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(html, encoding='utf-8')
print('wrote', out, len(html), 'bytes,', len(mods), 'modules')
