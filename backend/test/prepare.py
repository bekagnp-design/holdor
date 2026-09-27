# Writes backend/test/index_test.html (the beta build pointed at the local shim on :8787) and init.txt
# (a Telegram initData signed with the TEST bot token used by the local database — never the real one).
import os, re, hmac, hashlib, time, json, urllib.parse
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(os.path.dirname(HERE))
s = open(os.path.join(ROOT, 'beta', 'index.html'), encoding='utf-8').read()
s2 = re.sub(r"const SB=\{url:'[^']*',key:'[^']*'\};", "const SB={url:'http://127.0.0.1:8787',key:'TESTANONKEY_1234567890abcdef'};", s, count=1)
assert s2 != s, 'SB line not found'
open(os.path.join(HERE, 'index_test.html'), 'w', encoding='utf-8').write(s2)
TOKEN = '123456789:TESTTOKENabcDEFghiJKLmnoPQRstuVWXyz'
user = json.dumps({"id": 777000123, "first_name": "ტესტი", "last_name": "K", "username": "holdor_test", "language_code": "ka"}, ensure_ascii=False, separators=(',', ':'))
f = {'query_id': 'AAHdF6IQAAAAAN0XohDhrOrc', 'user': user, 'auth_date': str(int(time.time()))}
dcs = '\n'.join(f'{k}={f[k]}' for k in sorted(f))
secret = hmac.new(b'WebAppData', TOKEN.encode(), hashlib.sha256).digest()
f['hash'] = hmac.new(secret, dcs.encode(), hashlib.sha256).hexdigest()
open(os.path.join(HERE, 'init.txt'), 'w').write(urllib.parse.urlencode(f))
print('wrote index_test.html and init.txt')
