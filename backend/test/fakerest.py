# Minimal PostgREST-like RPC endpoint: POST /rest/v1/rpc/<fn> with JSON body -> select fn(named args)
import json,http.server,psycopg2,sys,traceback
conn=psycopg2.connect(host='127.0.0.1',dbname='postgres',user='postgres',password='pg');conn.autocommit=True
LOG=[]
class H(http.server.BaseHTTPRequestHandler):
    def log_message(self,*a):pass
    def _cors(self):
        self.send_header('Access-Control-Allow-Origin','*');self.send_header('Access-Control-Allow-Headers','*');self.send_header('Access-Control-Allow-Methods','POST, OPTIONS')
    def do_OPTIONS(self):
        self.send_response(204);self._cors();self.end_headers()
    def do_POST(self):
        n=int(self.headers.get('Content-Length',0));body=json.loads(self.rfile.read(n) or b'{}')
        fn=self.path.rsplit('/',1)[-1]
        if self.headers.get('apikey')!='TESTANONKEY_1234567890abcdef':
            self.send_response(401);self._cors();self.end_headers();self.wfile.write(b'{"message":"no api key"}');return
        try:
            with conn.cursor() as c:
                c.execute('set role anon')
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
