// A19 — the story data: NPCs, the main chain, side quests, dialogs, lines. Node checks on a fake R, then one Playwright load of the build.
// usage: CHROMIUM_PATH=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome node tests/rpg/t_story.js
const fs = require('fs'), path = require('path'), vm = require('vm'), { execSync } = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
const fails = []; const ok = (c, m) => { if (!c) fails.push(m); };

const W = { window: null, R: { data: {} }, console }; W.window = W; vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'src/rpg/js/11_world_data.js'), 'utf8'), W);
const POIS = W.R.data.world.pois.map(p => p.id);   // the real map's POI ids (js/11): every NPC and quest place must be one of them
const R = { data: { world: W.R.data.world } }; vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'src/rpg/js/41_story.js'), 'utf8'), { R, console });
const D = R.data, S = D.story;
const HOUSES = ['stark', 'lannister', 'baratheon', 'targaryen', 'greyjoy', 'tyrell', 'martell'];
const TYPES = ['kill', 'collect', 'reach', 'boss', 'talk', 'escort'];
const MOBS = ['axe', 'sword', 'archer', 'spear', 'shield', 'child', 'crawler', 'crypt', 'berserk', 'thenn', 'necro', 'skin', 'chief', 'hound', 'wolf', 'boar', 'bear', 'cat', 'elk', 'mammoth', 'giant', 'spider', 'brood', 'raven', 'bat', 'eagle', 'rider', 'outrider', 'wraith', 'shade', 'walker', 'lord', 'king', 'dragon'];
// famous lines that must not appear (the game's own title "hold the door" is allowed; house words are the game's own data, not used here)
const BANNED = ['you know nothing', 'winter is coming', 'what is dead may never die', 'valar morghulis', 'valar dohaeris', 'the night is dark and full', 'chaos is a ladder', 'i drink and i know things',
  'a girl has no name', 'not today', 'the things i do for love', 'game of thrones', 'a mind needs books', 'always pays his debts', 'link start', 'aincrad', 'kirito', 'asuna', 'sword art', 'you win or you die', 'dracarys', 'the north remembers'];

/* ---- NPCs ---- */
ok(D.npcs.length >= 40, 'npcs >= 40: ' + D.npcs.length);
const nid = {}; for (const n of D.npcs) { ok(!nid[n.id], 'dup npc ' + n.id); nid[n.id] = n; ok(POIS.includes(n.poi), 'npc poi unknown ' + n.id + ' ' + n.poi);
  ok(/^(champ|npc):[a-z]+$/.test(n.sprite), 'npc sprite ' + n.id + ' ' + n.sprite); ok(n.lines.greet.length === 3 && n.lines.idle.length === 2, 'npc lines ' + n.id); ok(!!n.name && !!n.role, 'npc name/role ' + n.id); }
for (const h of HOUSES) for (const role of ['steward', 'maester', 'arms', 'innkeep', 'smith']) ok(!!R.story.seatNpc(h, role), 'seat ' + h + ' lacks ' + role);
for (const hub of S.hubs) ok(D.npcs.filter(n => n.poi === hub).length >= 7, 'hub ' + hub + ' has < 7 npcs');
ok(D.npcs.filter(n => n.sprite.indexOf('champ:') === 0).length >= 7, 'named figures with champion portraits');
/* ---- quests ---- */
const Q = D.quests, main = Q.filter(q => q.main), side = Q.filter(q => !q.main);
ok(main.length === 24, 'main quests = 24: ' + main.length); ok(side.length >= 36, 'side quests >= 36: ' + side.length);
ok(JSON.stringify(S.main) === JSON.stringify(main.map(q => q.id)), 'story.main lists the chain in order');
const qid = {}; for (const q of Q) { ok(!qid[q.id], 'dup quest ' + q.id); qid[q.id] = q; }
const npcExists = (id, what) => { if (id.indexOf('seat:') === 0) { for (const h of HOUSES) ok(!!R.story.seatNpc(h, id.slice(5)), what + ' ' + id + ' unresolvable for ' + h); } else ok(!!nid[id], what + ' npc missing: ' + id); };
for (const q of Q) {
  ok(TYPES.includes(q.type), 'quest type ' + q.id + ' ' + q.type); ok(q.poi === 'seat' || POIS.includes(q.poi), 'quest poi ' + q.id + ' ' + q.poi); ok(!!q.title, 'quest title ' + q.id);
  npcExists(q.giver, 'giver of ' + q.id);
  if (q.type === 'talk' || q.type === 'escort') npcExists(q.target, 'target of ' + q.id);
  if (q.type === 'kill') ok(MOBS.includes(q.target), 'kill target is a mob key ' + q.id + ' ' + q.target);
  if (q.type === 'reach') ok(POIS.includes(q.target), 'reach target ' + q.id + ' ' + q.target);
  if (q.type === 'boss') ok(!!S.boss[q.target], 'boss intro missing for ' + q.target);
  if (q.type === 'collect') ok(q.from === 'any' || MOBS.includes(q.from), 'collect source ' + q.id + ' ' + q.from);
  if (q.type === 'escort') ok(POIS.includes(q.to), 'escort destination ' + q.id);
  ok(q.n >= 1 && q.lvl >= 1 && q.lvl <= 60, 'quest n/lvl ' + q.id); ok(q.reward.xp > 0 && q.reward.gold > 0, 'quest reward ' + q.id);
  ok(q.text.offer.length >= 1 && q.text.offer.length <= 3 && !!q.text.progress && !!q.text.done, 'quest text ' + q.id);
  if (q.prev) ok(!!qid[q.prev], 'prev missing ' + q.id + ' → ' + q.prev);
  if (!q.main) ok(S.hubs.includes(nid[q.giver] && nid[q.giver].poi), 'side quest giver not at a hub ' + q.id);
  const g = nid[q.giver]; if (g) ok(g.quests.includes(q.id), 'npc.quests lacks ' + q.id);
}
// the chain: one path, no cycle, non-decreasing levels, from the seat to the Fist
ok(main[0].prev === null, 'first main has no prev');
for (let i = 1; i < main.length; i++) { ok(main[i].prev === main[i - 1].id, 'chain break at ' + main[i].id); ok(main[i].lvl >= main[i - 1].lvl, 'level drops at ' + main[i].id); }
ok(main.filter(q => q.prev === null).length === 1, 'one chain start'); ok(new Set(main.map(q => q.prev)).size === main.length, 'no two main quests share a prev');
let walk = main[main.length - 1], steps = 0; while (walk && steps < 100) { walk = walk.prev ? qid[walk.prev] : null; steps++; } ok(steps === 24, 'walking prev from the end reaches the start in 24 steps: ' + steps);
ok(main[0].poi === 'seat' && main[main.length - 1].type === 'boss', 'chain starts at the seat, ends with a boss');
ok(main.slice(0, 4).every(q => q.poi === 'seat'), 'the first four quests are at the seat');
for (const i of [2, 7, 13, 19]) ok(main[i].rescue && /^house:\d$/.test(main[i].reward.hero), 'rescue hero at main quest ' + (i + 1));
ok(main.filter(q => q.reward.hero).length === 4, 'exactly four hero rescues');
ok([3, 7, 11, 15, 19, 23].every(i => main[i].reward.gems > 0), 'a gem purse every 4th main quest');
for (const hub of S.hubs) ok(side.filter(q => nid[q.giver].poi === hub).length === 3, 'three side quests at ' + hub);
// xp ~1.5 levels at the quest's level
const XP = L => 80 + 45 * L + 6 * L * L; for (const q of main) ok(Math.abs(q.reward.xp - 1.5 * XP(q.lvl)) < 2, 'xp off at ' + q.id);
/* ---- lines: length, banned phrases, placeholders resolve ---- */
const strings = []; const collect = (v, p) => { if (typeof v === 'string') strings.push([p, v]); else if (Array.isArray(v)) v.forEach((x, i) => collect(x, p + '[' + i + ']')); else if (v && typeof v === 'object') for (const k in v) collect(v[k], p + '.' + k); };
collect(D.npcs, 'npcs'); collect(Q, 'quests'); collect(S, 'story');
for (const [p, s] of strings) { ok(s.length <= 110, 'line > 110 at ' + p + ': ' + s); const l = s.toLowerCase(); for (const b of BANNED) ok(!l.includes(b), 'banned phrase "' + b + '" at ' + p); }
for (const h of HOUSES) { for (const q of Q) { const r = R.story.resolve(q, h); ok(r.poi !== 'seat' && r.giver.indexOf('seat:') < 0 && String(r.target).indexOf('seat:') < 0, 'unresolved placeholder ' + q.id + ' ' + h);
    if (r.reward.hero) ok(/^[a-z]+$/.test(r.reward.hero) && r.reward.hero.indexOf('house') < 0, 'hero unresolved ' + q.id + ' ' + h);
    for (const s of [...r.text.offer, r.text.progress, r.text.done]) { ok(s.length <= 110, 'resolved line > 110 ' + q.id + ' ' + h + ': ' + s); ok(!/\{\w+\}/.test(s), 'placeholder left in ' + q.id + ' ' + h + ': ' + s); } }
  const pro = R.story.prologue(h); ok(pro.length === 5 && pro.every(s => s.length <= 110 && !/\{\w+\}/.test(s)), 'prologue ' + h); }
ok(Object.keys(S.regions).length >= 9 && Object.keys(S.boss).length >= 9, 'regions + boss lines');
ok(S.epitaphs.length === 5 && S.nextHero.length === 5 && S.levelup.length === 5 && S.titles.length === 10, 'epitaphs 5, next-hero 5, level-up 5, titles 10');
ok(S.epitaphs.every(s => s.includes('{name}') && s.includes('{killer}')), 'epitaphs name the hero and the killer');
ok(!/\{/.test(R.story.epitaph('Jon Snow', 12, 'a wight giant')), 'epitaph fills in');
/* ---- dialogs ---- */
for (const n of D.npcs) { const d = S.dialogs[n.id]; ok(Array.isArray(d) && d.length >= 1, 'dialog missing ' + n.id); if (!d) continue;
  d.forEach((node, i) => { ok(!!node.text && node.choices.length >= 1, 'dialog node ' + n.id + '#' + i); for (const c of node.choices) { ok(!!c.t, 'choice text ' + n.id);
    if (c.next != null) ok(c.next >= 0 && c.next < d.length, 'dialog next out of range ' + n.id); if (c.quest) ok(!!qid[c.quest], 'dialog quest missing ' + n.id + ' ' + c.quest); } });
  ok(d[0].choices.some(c => c.close), 'dialog has a Leave ' + n.id);
  for (const q of n.quests) ok(d[0].choices.some(c => c.quest === q), 'dialog offers ' + q + ' at ' + n.id);
  if (n.lines.inn) ok(d[0].choices.some(c => c.inn), 'inn choice ' + n.id); if (n.lines.shop) ok(d[0].choices.some(c => c.shop), 'shop choice ' + n.id); }

console.log('NODE', fails.length ? 'FAIL' : 'OK', 'npcs', D.npcs.length, 'main', main.length, 'side', side.length, 'dialogs', Object.keys(S.dialogs).length, 'strings', strings.length);
for (const f of fails.slice(0, 40)) console.log('"FAIL', f);

/* ---- Playwright: the build loads with the module in it ---- */
(async () => {
  if (fails.length) { console.log('FAILS:', fails.length); process.exit(1); }
  const out = path.join(require('os').tmpdir(), 'holdor_rpg_story_build.html');
  execSync('python3 ' + path.join(ROOT, 'src/build_rpg.py') + ' ' + out, { stdio: 'inherit' });
  const { chromium } = require('playwright');
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1243/chrome-linux64/chrome' });
  const pg = await b.newPage({ viewport: { width: 390, height: 844 } }); const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto('file://' + out); await pg.waitForFunction(() => window.R && R.data && R.data.quests && R.story, null, { timeout: 15000 });
  const r = await pg.evaluate(() => { const q = R.story.resolve('m03', 'greyjoy'); return { npcs: R.data.npcs.length, quests: R.data.quests.length, main: R.data.story.main.length, dialogs: Object.keys(R.data.story.dialogs).length, giver: q.giver, hero: q.reward.hero, done: q.text.done, pro: R.story.prologue('stark')[3] }; });
  const pf = [];
  if (r.npcs < 40 || r.quests < 60 || r.main !== 24 || r.dialogs !== r.npcs) pf.push('counts in the build ' + JSON.stringify(r));
  if (r.giver !== 'pk_maester' || r.hero !== 'theon' || !/Theon Greyjoy/.test(r.done) || !/Jon Snow/.test(r.pro)) pf.push('resolve in the build ' + JSON.stringify(r));
  if (errs.length) pf.push('page errors: ' + errs.join(' | '));
  await b.close();
  console.log('BROWSER', pf.length ? 'FAIL' : 'OK', JSON.stringify(r)); for (const f of pf) console.log('"FAIL', f);
  if (pf.length) { console.log('FAILS:', pf.length); process.exit(1); }
  console.log('OK t_story');
})().catch(e => { console.log('"FAIL', e.message); console.log('FAILS: 1'); process.exit(1); });
