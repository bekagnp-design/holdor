// Local stand-in for Supabase Edge Functions + Telegram (test only): serves backend/edge/stars/handler.js on :8788
// (the app's POST /functions/v1/stars comes here through fakerest.py) and a fake Telegram Bot API on :8789 that records every call.
// GET :8789/_log → the calls so far; POST :8789/_reset clears them; POST :8789/_fail?on=1 makes createInvoiceLink fail.
import http from 'node:http';
import { makeHandler } from '../edge/stars/handler.js';
const TOKEN = '123456789:TESTTOKENabcDEFghiJKLmnoPQRstuVWXyz';
let log = [], failInvoice = false;
const read = req => new Promise(r => { const c = []; req.on('data', d => c.push(d)); req.on('end', () => r(Buffer.concat(c))); });
http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/_log') { res.end(JSON.stringify(log)); return; }
  if (u.pathname === '/_reset') { log = []; failInvoice = false; res.end('{}'); return; }
  if (u.pathname === '/_fail') { failInvoice = u.searchParams.get('on') === '1'; res.end('{}'); return; }
  const m = /^\/bot([^/]+)\/(\w+)$/.exec(u.pathname);
  const body = JSON.parse((await read(req)).toString() || '{}');
  res.setHeader('Content-Type', 'application/json');
  if (!m || m[1] !== TOKEN) { res.statusCode = 401; res.end(JSON.stringify({ ok: false, description: 'Unauthorized' })); return; }
  log.push({ method: m[2], body });
  if (m[2] === 'createInvoiceLink') {
    if (failInvoice) { res.end(JSON.stringify({ ok: false, description: 'Bad Request: something' })); return; }
    res.end(JSON.stringify({ ok: true, result: 'https://t.me/$test_' + body.payload })); return; }
  res.end(JSON.stringify({ ok: true, result: true }));
}).listen(8789, '127.0.0.1');
const handle = makeHandler({ url: 'http://127.0.0.1:8787', key: 'TESTSERVICEKEY_1234567890abcdef', tgBase: 'http://127.0.0.1:8789' });
http.createServer(async (req, res) => {
  const body = ['GET', 'HEAD', 'OPTIONS'].includes(req.method) ? undefined : await read(req);
  const r = await handle(new Request('http://127.0.0.1:8788' + req.url, { method: req.method, headers: req.headers, body }));
  res.statusCode = r.status; r.headers.forEach((v, k) => res.setHeader(k, v)); res.end(Buffer.from(await r.arrayBuffer()));
}).listen(8788, '127.0.0.1');
