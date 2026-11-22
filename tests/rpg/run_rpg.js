// tests/rpg/run_rpg.js — runs every tests/rpg/t_*.js one after another, one line per suite (A40).
//   node tests/rpg/run_rpg.js [t_x.js ...]
//   RPG_ONLY=t_core,t_hud    only these suites (names with or without .js; a prefix matches too)
//   RPG_TIMEOUT=120          seconds per suite (default 120); a suite over it is killed and reads FAIL (timeout)
//   RPG_NOBUILD=1            skip the build; the runner builds once (python3 src/build_rpg.py beta/index.html) and passes RPG_NOBUILD=1 to the suites
//   RPG_HTML=path            test that page instead of beta/index.html (no build)
// Prints `OK   t_smoke  3s  (12 OK, 5 SKIP)` / `FAIL t_x  12s` with the failing lines, then a summary. Exit code = the number of failed suites.
'use strict';
const { spawnSync } = require('child_process'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const TIMEOUT = (+process.env.RPG_TIMEOUT || 120) * 1000;

if (process.env.RPG_NOBUILD) console.log('build: skipped (RPG_NOBUILD)');
else if (process.env.RPG_HTML) console.log('build: skipped, testing ' + process.env.RPG_HTML);
else {
  const t0 = Date.now(), r = spawnSync('python3', [path.join(ROOT, 'src', 'build_rpg.py'), path.join(ROOT, 'beta', 'index.html')], { cwd: ROOT, encoding: 'utf8' });
  if (r.status !== 0) { console.log('FAIL build\n     ' + ((r.stderr || '') + (r.stdout || '')).trim().split('\n').slice(-8).join('\n     ')); process.exit(1); }
  console.log('build ' + (r.stdout || '').trim() + '  ' + Math.round((Date.now() - t0) / 1000) + 's');
}

let list = process.argv.slice(2);
if (!list.length) list = fs.readdirSync(__dirname).filter(f => /^t_.*\.js$/.test(f)).sort();
list = list.map(f => /\.js$/.test(f) ? f : f + '.js');
if (process.env.RPG_ONLY) {
  const only = process.env.RPG_ONLY.split(',').map(s => s.trim().replace(/\.js$/, '')).filter(Boolean);
  list = list.filter(f => { const n = path.basename(f, '.js'); return only.some(o => n === o || n.startsWith(o)); });
}
if (!list.length) { console.log('no suites'); process.exit(0); }

let bad = 0;
for (const t of list) {
  const file = path.isAbsolute(t) ? t : path.join(__dirname, path.basename(t)), name = path.basename(file, '.js'), t0 = Date.now();
  const r = spawnSync('node', [file], { cwd: ROOT, encoding: 'utf8', timeout: TIMEOUT, maxBuffer: 64 << 20, env: Object.assign({}, process.env, { RPG_NOBUILD: '1' }) });
  const out = (r.stdout || '') + (r.stderr || ''), lines = out.split('\n'), secs = Math.round((Date.now() - t0) / 1000);
  const timedOut = (r.error && r.error.code === 'ETIMEDOUT') || r.signal === 'SIGTERM';
  const fails = lines.filter(l => /^\s*FAIL\b|^FAILED\b/.test(l));
  const ok = !timedOut && r.status === 0 && !fails.length;
  if (!ok) bad++;
  const sum = (out.match(/^\S+: (\d+) OK, (\d+) SKIP, (\d+) FAIL/m) || [])[0];
  const detail = ok ? [] : (timedOut ? ['timeout after ' + TIMEOUT / 1000 + 's'] : []).concat(fails.length ? fails : lines.filter(l => /Error|^\s+at /.test(l)).slice(-8));
  const tail = !ok && !detail.length ? lines.filter(Boolean).slice(-8) : [];
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name.padEnd(16)} ${String(secs).padStart(3)}s` + (sum ? `  (${sum.replace(/^\S+: /, '')})` : '') +
    (detail.length || tail.length ? '\n     ' + detail.concat(tail).slice(0, 12).map(s => s.trim().slice(0, 240)).join('\n     ') : ''));
}
console.log(`${list.length} suite(s): ${list.length - bad} OK, ${bad} FAIL`);
process.exit(Math.min(bad, 255));
