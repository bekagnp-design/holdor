# Wraps the artifact page the way the artifact viewer does, with the phone's bottom safe area (34 px) as :root padding.
import sys
src, out = sys.argv[1], sys.argv[2]
body = open(src, encoding='utf-8').read()
if '<body' in body:  # a full game file: strip its own skeleton the same way mk_artifact does
    body = body.replace('<script src="https://telegram.org/js/telegram-web-app.js"></script>\n', '')
    for t in ['<!DOCTYPE html>\n', '<html lang="en">\n', '<head>\n', '</head>\n', '<body>\n', '</body>\n', '</html>\n', '</html>']:
        body = body.replace(t, '', 1)
skel = ('<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover">'
        '<style>:root{color-scheme:light;padding-top:0px;padding-bottom:34px}body{margin:0;font:14px -apple-system,sans-serif;background:#faf9f5;color:#141413}'
        'img{max-width:100%}[hidden]{display:none!important}</style></head><body>\n')
open(out, 'w', encoding='utf-8').write(skel + body + '\n</body></html>')
print('wrote', out)
