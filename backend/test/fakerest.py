# Minimal PostgREST-like RPC endpoint: POST /rest/v1/rpc/<fn> with JSON body -> select fn(named args)
import json,http.server,psycopg2,sys,traceback,urllib.request
conn=psycopg2.connect(host='127.0.0.1',dbname='postgres',user='postgres',password='pg');conn.autocommit=True
LOG=[]
class H(http.server.BaseHTTPRequestHandler):
    def log_message(self,*a):pass
    def _cors(self):
        self.send_header('Access-Control-Allow-Origin','*');self.send_header('Access-Control-Allow-Headers','*');self.send_header('Access-Control-Allow-Methods','POST, OPTIONS')
    def do_OPTIONS(self):
        self.send_response(204);self._cors();self.end_headers()
    def do_GET(self):   # only the Edge Function shim answers GET (the one-time webhook setup)
        if not self.path.startswith('/functions/v1/'): self.send_response(404);self._cors();self.end_headers();return
        try:
            with urllib.request.urlopen('http://127.0.0.1:8788'+self.path,timeout=20) as r: out=r.read();code=r.status
        except urllib.error.HTTPError as e: out=e.read();code=e.code
        except Exception as e: out=json.dumps({'error':str(e)}).encode();code=502
        self.send_response(code);self._cors();self.send_header('Content-Type','application/json');self.end_headers();self.wfile.write(out)
    def do_POST(self):
        n=int(self.headers.get('Content-Length',0));body=json.loads(self.rfile.read(n) or b'{}')
        fn=self.path.rsplit('/',1)[-1]
        if self.path.startswith('/functions/v1/'):   # the Edge Function shim (node) — the app posts here for Stars invoices
            try:
                rq=urllib.request.Request('http://127.0.0.1:8788'+self.path,data=json.dumps(body).encode(),headers={'Content-Type':'application/json','x-telegram-bot-api-secret-token':self.headers.get('x-telegram-bot-api-secret-token','')},method='POST')
                with urllib.request.urlopen(rq,timeout=20) as r: out=r.read();code=r.status
            except urllib.error.HTTPError as e: out=e.read();code=e.code
            except Exception as e: out=json.dumps({'error':str(e)}).encode();code=502
            self.send_response(code);self._cors();self.send_header('Content-Type','application/json');self.end_headers();self.wfile.write(out);return
        key=self.headers.get('apikey');role='anon' if key=='TESTANONKEY_1234567890abcdef' else 'service_role' if key=='TESTSERVICEKEY_1234567890abcdef' else None
        if role is None:
            self.send_response(401);self._cors();self.end_headers();self.wfile.write(b'{"message":"no api key"}');return
        try:
            with conn.cursor() as c:
                c.execute('set role '+role)
                args=', '.join(f'{k} := %({k})s' for k in body)
                params={k:(json.dumps(v) if isinstance(v,(dict,list)) else v) for k,v in body.items()}
                if fn=='save_progress': params['save']=json.dumps(body.get('save'))
                c.execute(f'select {fn}({args})',params)
                out=c.fetchone()[0]
                c.execute('reset role')
            LOG.append((fn,len(json.dumps(body))))
            self.send_response(200);self._cors();self.send_header('Content-Type','application/json');self.end_headers();self.wfile.write(json.dumps(out).encode())
        except Exception as e:
            conn.rollback()
            with conn.cursor() as c: c.execute('reset role')
            self.send_response(400);self._cors();self.send_header('Content-Type','application/json');self.end_headers();self.wfile.write(json.dumps({'message':str(e).split('\n')[0]}).encode())
if __name__=='__main__':
    http.server.ThreadingHTTPServer(('127.0.0.1',8787),H).serve_forever()
