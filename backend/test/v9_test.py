# v9 (Telegram Stars) checks against the local database, the local Edge Function (edge_shim.mjs) and a fake Telegram Bot API.
# Needs the chain up to holdor_v9.sql, fakerest.py (:8787) and edge_shim.mjs (:8788/:8789) — run_all.sh starts them. Re-runnable: players 950000001–3.
import os, json, uuid, subprocess, time, urllib.request, urllib.error
import psycopg2
HERE = os.path.dirname(os.path.abspath(__file__))
db = psycopg2.connect(host='127.0.0.1', dbname='postgres', user='postgres', password='pg'); db.autocommit = True
TOKEN = '123456789:TESTTOKENabcDEFghiJKLmnoPQRstuVWXyz'
def q(sql, *a):
    with db.cursor() as c: c.execute(sql, a); return c.fetchall() if c.description else []
def q1(sql, *a):
    r = q(sql, *a); return r[0][0] if r else None
def post(url, body, headers=None, raw=False):
    rq = urllib.request.Request(url, data=json.dumps(body).encode(), headers=dict({'Content-Type': 'application/json'}, **(headers or {})), method='POST')
    try:
        with urllib.request.urlopen(rq, timeout=20) as r: t = r.read().decode(); code = r.status
    except urllib.error.HTTPError as e: t = e.read().decode(); code = e.code
    ALL.append(t)
    return code, (json.loads(t) if t and not raw else t)
def get(url):
    try:
        with urllib.request.urlopen(url, timeout=20) as r: t = r.read().decode(); code = r.status
    except urllib.error.HTTPError as e: t = e.read().decode(); code = e.code
    ALL.append(t); return code, json.loads(t)
ALL = []
FN = 'http://127.0.0.1:8787/functions/v1/stars'
def rpc(fn, key, **kw): return post('http://127.0.0.1:8787/rest/v1/rpc/' + fn, kw, {'apikey': key})
ANON, SVC = 'TESTANONKEY_1234567890abcdef', 'TESTSERVICEKEY_1234567890abcdef'
def tglog(): return json.loads(urllib.request.urlopen('http://127.0.0.1:8789/_log').read())
def tgreset(): urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:8789/_reset', data=b'{}', method='POST')).read()
fails = []
def check(name, cond, info=''):
    print(('OK  ' if cond else 'FAIL'), name, '' if cond and not os.environ.get('V') else info)
    if not cond: fails.append(name)
# the shim (an Edge Function stand-in + a fake Telegram) — started here when it is not running yet
try: urllib.request.urlopen('http://127.0.0.1:8789/_log', timeout=2)
except Exception:
    subprocess.Popen(['node', os.path.join(HERE, 'edge_shim.mjs')], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1.5)
C = q1("select v from econ_config where k = 'stars'")['skus']
T1, T2, T3 = 950000001, 950000002, 950000003
for t in ('payments', 'econ_flags', 'econ_ops', 'ledger', 'econ_legacy', 'daily_scores', 'scores', 'sessions', 'players'):
    q(f'delete from {t} where tg_id in (%s, %s, %s)', T1, T2, T3)
def seat(house, made): return {'house': house, 'langI': 0, 'made': made, 'campaign': {}, 'stats': {'kills': 0, 'onlineBest': 0}}
for t, nm in ((T1, 'P1'), (T2, 'P2'), (T3, 'P3')):
    q("insert into players (tg_id, name, house, realm, save, save_ver) values (%s, %s, 'stark', 0, %s, 1)", t, nm, json.dumps({'v': 4, 'cur': 0, 'ver': 1, 'slots': [seat('stark', '2026-09-29'), None, None]}))
tok = {t: q1('insert into sessions (tg_id) values (%s) returning token::text', t) for t in (T1, T2, T3)}
for t in (T1, T2, T3): post('http://127.0.0.1:8787/rest/v1/rpc/econ_state', {'token': tok[t], 'seat': 0}, {'apikey': ANON})
def W(t): return q("select gems, gold, cards, claims from wallets where tg_id = %s and seat = 0", t)[0]
HOOK = q1("select v from app_secrets where k = 'webhook_secret'")
H = {'x-telegram-bot-api-secret-token': HOOK}
n = [0]
def upd(**kw): n[0] += 1; return dict(update_id=n[0], **kw)
def pre(order, payer, stars, cur='XTR'): return upd(pre_checkout_query={'id': 'q' + str(n[0]), 'from': {'id': payer}, 'currency': cur, 'total_amount': stars, 'invoice_payload': order})
def paid(order, payer, stars, charge, cur='XTR'): return upd(message={'from': {'id': payer}, 'successful_payment': {'currency': cur, 'total_amount': stars, 'invoice_payload': order, 'telegram_payment_charge_id': charge}})
def invoice(t, sku, seat_=0): return post(FN, {'op': 'invoice', 'token': tok[t], 'seat': seat_, 'sku': sku})

# ---------- 1. who may call what ----------
c1, r1 = rpc('pay_create', ANON, token=tok[T1], seat=0, sku='gems_s')
check('anon cannot make an order, confirm or read secrets', c1 == 400 and 'permission denied' in r1.get('message', '') and rpc('pay_confirm', ANON, id=str(uuid.uuid4()), tg=1, stars=1, currency='XTR', charge='x')[0] == 400 and rpc('pay_secret', ANON, k='bot_token')[0] == 400, r1)
c2, r2 = rpc('pay_shop', ANON, token=tok[T1], seat=0)
check('anon may ask whether the Starter pack is bought (with its own token)', c2 == 200 and r2 == {'starter': False}, r2)
check('the secrets are not readable through the tables', q1("select has_table_privilege('anon', 'app_secrets', 'select')") is False and q1("select has_table_privilege('anon', 'payments', 'select')") is False)

# ---------- 2. an invoice ----------
tgreset()
c, r = invoice(T1, 'gems_m')
oid = r.get('id')
check('invoice: a Telegram link and the order id', c == 200 and r.get('ok') and r['link'] == 'https://t.me/$test_' + str(oid) and r['stars'] == 125, (c, r))
call = [x for x in tglog() if x['method'] == 'createInvoiceLink'][0]['body']
check('Telegram was asked in Stars, without a provider token, the order as payload',
      call['currency'] == 'XTR' and 'provider_token' not in call and call['payload'] == oid and call['prices'] == [{'label': call['title'], 'amount': 125}] and len(call['title']) <= 32, call)
check('the order is stored: pending, right price, right seat', q("select status, stars, sku, seat from payments where id = %s", oid) == [('pending', 125, 'gems_m', 0)])
check('a bad item is refused', invoice(T1, 'gems_xl')[0] == 400 and invoice(T1, 'gems_xl')[1]['error'] == 'bad item')
check('a bad session is refused', post(FN, {'op': 'invoice', 'token': str(uuid.uuid4()), 'seat': 0, 'sku': 'gems_s'})[0] == 400)
check('a bad request is refused', post(FN, {'op': 'invoice', 'seat': 0})[0] == 400 and post(FN, {'op': 'invoice', 'token': tok[T1], 'seat': 'a', 'sku': 'gems_s'})[0] == 400)
check('a seat that does not exist is refused', invoice(T1, 'gems_s', 2)[0] == 400)
tgreset(); urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:8789/_fail?on=1', data=b'{}', method='POST')).read()
cf, rf = invoice(T2, 'gems_s')
urllib.request.urlopen(urllib.request.Request('http://127.0.0.1:8789/_fail?on=0', data=b'{}', method='POST')).read()
check('Telegram refusing the link: the app is told, the order stays pending', cf == 502 and 'Telegram could not make the invoice' in rf['error'], (cf, rf))

# ---------- 3. the webhook is Telegram's only ----------
check('no secret header: refused', post(FN, pre(oid, T1, 125))[0] == 401)
check('a wrong secret: refused', post(FN, pre(oid, T1, 125), {'x-telegram-bot-api-secret-token': 'nope'})[0] == 401)
check('the app cannot fake a payment through the function', post(FN, {'op': 'pay', 'order': oid})[0] == 400)

# ---------- 4. pre-checkout ----------
def answers(): return [x['body'] for x in tglog() if x['method'] == 'answerPreCheckoutQuery']
tgreset()
post(FN, pre(oid, T1, 125), H)
post(FN, pre(oid, T1, 100), H)
post(FN, pre(oid, T2, 125), H)
post(FN, pre(oid, T1, 125, 'USD'), H)
post(FN, pre(str(uuid.uuid4()), T1, 125), H)
post(FN, pre('garbage', T1, 125), H)
a = answers()
check('pre-checkout: only the right payer, amount and currency may pay', [x['ok'] for x in a] == [True, False, False, False, False, False], a)
check('every answer carries a reason when it says no', all(x.get('error_message') for x in a if not x['ok']), a)
check('the mismatches are flagged', q1("select count(*) from econ_flags where kind = 'pay_mismatch' and tg_id = %s", T1) >= 3)

# ---------- 5. a payment credits once ----------
g0, gold0 = W(T1)[0], W(T1)[1]
ch1 = 'charge_' + uuid.uuid4().hex
c, r = post(FN, paid(oid, T1, 125, ch1), H)
g1 = W(T1)
check('paid: +400 dragonglass on the seat, the order is paid', c == 200 and g1[0] - g0 == 400 and q("select status, charge_id from payments where id = %s", oid) == [('paid', ch1)], (c, g1[0] - g0))
check('the ledger says why', q("select cur, delta, reason, ref from ledger where tg_id = %s and reason = 'stars'", T1) == [('gems', 400, 'stars', ch1)])
post(FN, paid(oid, T1, 125, ch1), H)
check('the same message twice changes nothing', W(T1)[0] - g0 == 400 and q1("select count(*) from ledger where tg_id = %s and reason = 'stars'", T1) == 1)
o2 = invoice(T1, 'gems_s')[1]['id']
post(FN, paid(o2, T1, 50, ch1), H)
check('the same Telegram charge on another order is refused', W(T1)[0] - g0 == 400 and q1("select status from payments where id = %s", o2) == 'pending' and q1("select count(*) from econ_flags where kind = 'pay_repeat'") >= 1)
check('the app can read the order state, another player cannot', rpc('pay_status', ANON, token=tok[T1], id=oid)[1] == {'status': 'paid'} and rpc('pay_status', ANON, token=tok[T2], id=oid)[0] == 400)
check('ledger = wallet (gems)', q1("select sum(delta) from ledger where tg_id = %s and cur = 'gems'", T1) == W(T1)[0])

# ---------- 6. the Starter pack: once ----------
s1 = invoice(T1, 'starter')[1]['id']
w0 = W(T1)
post(FN, paid(s1, T1, 75, 'charge_' + uuid.uuid4().hex), H)
w1 = W(T1)
check('Starter: +300 dragonglass, +5000 gold, 3 Rare books', w1[0] - w0[0] == 300 and w1[1] - w0[1] == 5000 and w1[2].get('b:r') == 3, (w1[0] - w0[0], w1[1] - w0[1], w1[2]))
c, r = invoice(T1, 'starter')
check('a second Starter pack is refused', c == 400 and r['error'] == 'already bought', r)
check('the shop says it is bought', rpc('pay_shop', ANON, token=tok[T1], seat=0)[1] == {'starter': True})
s2 = q1("insert into payments (tg_id, seat, made, sku, stars) values (%s, 0, '2026-09-29/stark', 'starter', 75) returning id::text", T1)
a0 = len(answers()); tgreset(); post(FN, pre(s2, T1, 75), H)
check('even an order made another way cannot buy the Starter pack twice (pre-checkout)', answers()[0]['ok'] is False, answers())
check('ledger = wallet (gold)', q1("select sum(delta) from ledger where tg_id = %s and cur = 'gold'", T1) == W(T1)[1])

# ---------- 7. a payment that does not match is not credited ----------
o3 = invoice(T2, 'gems_l')[1]['id']
g2 = W(T2)[0]
post(FN, paid(o3, T3, 350, 'charge_' + uuid.uuid4().hex), H)
check('another payer: nothing credited, the order is failed and flagged', W(T2)[0] == g2 and q1("select status from payments where id = %s", o3) == 'failed' and q1("select count(*) from econ_flags where kind = 'pay_mismatch' and tg_id = %s", T2) >= 1)
o4 = invoice(T2, 'gems_l')[1]['id']
post(FN, paid(o4, T2, 1, 'charge_' + uuid.uuid4().hex), H)
check('a smaller amount: nothing credited', W(T2)[0] == g2 and q1("select status from payments where id = %s", o4) == 'failed')
post(FN, paid(str(uuid.uuid4()), T2, 350, 'charge_' + uuid.uuid4().hex), H)
post(FN, paid('garbage', T2, 350, 'charge_' + uuid.uuid4().hex), H)
check('an unknown order or garbage: nothing credited, Telegram is not left retrying', W(T2)[0] == g2 and q1("select count(*) from econ_flags where kind = 'pay_unknown'") >= 1)
# a seat replaced by a new one after the invoice: the Stars are not credited to the stranger
o5 = invoice(T3, 'gems_m')[1]['id']
q("update players set save = jsonb_set(save, '{slots,0,made}', '\"2026-10-01\"') where tg_id = %s", T3)
post('http://127.0.0.1:8787/rest/v1/rpc/econ_state', {'token': tok[T3], 'seat': 0}, {'apikey': ANON})
g3 = W(T3)[0]
post(FN, paid(o5, T3, 125, 'charge_' + uuid.uuid4().hex), H)
check('a replaced seat: orphan, nothing credited, flagged (the owner refunds the Stars)', W(T3)[0] == g3 and q1("select status from payments where id = %s", o5) == 'orphan' and q1("select count(*) from econ_flags where kind = 'pay_orphan' and tg_id = %s", T3) == 1)

# ---------- 8. a refund takes back what is left ----------
gb = W(T1)[0]
post(FN, upd(message={'from': {'id': T1}, 'refunded_payment': {'currency': 'XTR', 'total_amount': 125, 'invoice_payload': oid, 'telegram_payment_charge_id': ch1}}), H)
check('refund: 400 dragonglass taken back, the order is refunded, flagged', W(T1)[0] == gb - 400 and q1("select status from payments where id = %s", oid) == 'refunded' and q1("select count(*) from econ_flags where kind = 'pay_refunded' and tg_id = %s", T1) == 1, (gb, W(T1)[0]))
post(FN, upd(message={'from': {'id': T1}, 'refunded_payment': {'currency': 'XTR', 'total_amount': 125, 'invoice_payload': oid, 'telegram_payment_charge_id': ch1}}), H)
check('the same refund twice takes nothing more', W(T1)[0] == gb - 400)
check('ledger = wallet after the refund (gems)', q1("select sum(delta) from ledger where tg_id = %s and cur = 'gems'", T1) == W(T1)[0])
# a refund when the dragonglass is already spent: the wallet never goes below zero
o6 = invoice(T2, 'gems_m')[1]['id']; chx = 'charge_' + uuid.uuid4().hex
post(FN, paid(o6, T2, 125, chx), H)
cur = W(T2)[0]
q("update wallets set gems = 10 where tg_id = %s and seat = 0", T2)
q("insert into ledger (tg_id, seat, cur, delta, bal, reason) values (%s, 0, 'gems', %s, 10, 'test')", T2, 10 - cur)
post(FN, upd(message={'from': {'id': T2}, 'refunded_payment': {'currency': 'XTR', 'total_amount': 125, 'invoice_payload': o6, 'telegram_payment_charge_id': chx}}), H)
check('a refund after spending: takes what is left, never below zero', W(T2)[0] == 0, W(T2)[0])

# ---------- 9. limits, the dashboard, other updates ----------
q("delete from payments where tg_id = %s and status = 'pending'", T2)
res = [invoice(T2, 'gems_s')[0] for _ in range(21)]
check('open invoices are capped (20 an hour)', res[:20] == [200] * 20 and res[20] == 400, res[-3:])
check('v_revenue counts paid orders only', q1("select sum(orders) from v_revenue where day = (now() at time zone 'utc')::date") >= 1 and q1("select has_table_privilege('anon', 'v_revenue', 'select')") is False)
check('other Telegram updates are ignored politely', post(FN, upd(message={'from': {'id': T1}, 'text': 'hello'}), H)[0] == 200)
check('a GET without a code only says hello', get(FN)[1] == {'ok': True, 'name': 'holdor-stars'})

# ---------- 10. the one-time setup ----------
tgreset()
check('setup with a wrong code: refused', get(FN + '?setup=wrong')[0] == 403 and not [x for x in tglog() if x['method'] == 'setWebhook'])
code = q1("select v from app_secrets where k = 'setup_code'")
c, r = get(FN + '?setup=' + code)
sw = [x['body'] for x in tglog() if x['method'] == 'setWebhook']
check('setup: the webhook points at the function, with the secret and only the updates we handle', c == 200 and len(sw) == 1 and sw[0]['secret_token'] == HOOK and sw[0]['url'].endswith('/functions/v1/stars') and set(sw[0]['allowed_updates']) == {'pre_checkout_query', 'message'}, (c, sw))
check('the setup code is gone: it works once', q1("select count(*) from app_secrets where k = 'setup_code'") == 0 and get(FN + '?setup=' + code)[0] == 403)

# ---------- 11. the bot token never leaves ----------
check('the bot token is in no response the app or Telegram could see', not any(TOKEN in t for t in ALL))
check('no order was credited twice: every paid order has one ledger entry', q1("select count(*) from payments p where p.status = 'paid' and (select count(*) from ledger l where l.ref = p.charge_id and l.reason = 'stars' and l.cur = 'gems') <> 1 and p.sku like 'gems%%'") == 0)
print('FAILS', fails)
raise SystemExit(1 if fails else 0)
