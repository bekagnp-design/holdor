// Runs the core suites one after another, one line per suite. Exit code 1 if any suite failed.
// usage: node tests/run_core.js [suite.js ...]
const { spawnSync } = require('child_process');
const path = require('path');
const CORE = ['test45.js', 't_cards.js', 't_tut2.js', 't_tut60.js', 't_book.js', 't_castle.js', 't_champs52.js', 't_champs53.js', 't_champs54.js', 't_champs59.js', 't_tavern59.js', 't_stars60.js', 't_daily61.js', 't_gear62.js', 't_gear63.js', 't_city64.js', 't_market72.js', 't_juice77.js', 't_home78.js',
  't_allchamps.js', 't_smoke48.js', 't_lessons.js', 't_hublessons.js', 't_tg.js', 't_ring.js', 't_newflow.js', 't_realms.js'];
const list = process.argv.slice(2).length ? process.argv.slice(2) : CORE;
let bad = 0;
for (const t of list) {
  const t0 = Date.now();
  const r = spawnSync('node', [path.join(__dirname, t)], { encoding: 'utf8', timeout: 20 * 60 * 1000, maxBuffer: 256 << 20 });
  const out = (r.stdout || '') + (r.stderr || '');
  const fails = (out.match(/"FAIL[^\n]*|^FAILS:.*\n.+|^\s*at .*|Error: [^\n]*/gm) || []).filter(x => !/FAILS:\s*$/.test(x));
  const errs = (out.match(/^(ERR|ERRORS:?)\s.*$/gm) || []).filter(x => !/^ERR \[\]$|^ERRORS: none$/.test(x.trim()));
  const ok = r.status === 0 && !fails.length && !errs.length && (t !== 'test45.js' || /ALL PASS/.test(out));
  if (!ok) bad++;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${t.padEnd(18)} ${Math.round((Date.now() - t0) / 1000)}s${ok ? '' : '\n     ' + [...fails, ...errs].slice(0, 6).join('\n     ')}`);
}
console.log(bad ? `${bad} suite(s) failed` : 'all suites OK');
process.exit(bad ? 1 : 0);
