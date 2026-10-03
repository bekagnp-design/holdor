// v1.0.63 gear III without a server: 54 kinds (names, shapes and pools agree with backend/holdor_v12.sql), perks = skill mechanics granted by items
// (rank from rarity + tier, best of the worn items, never below the champion's own rank), every perk runs in a real battle, the sheet shows it.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const SC = path.resolve(__dirname, '..', '.shots') + '/'; fs.mkdirSync(SC, { recursive: true });
const rd = f => fs.readFileSync(path.resolve(__dirname, '..', 'backend', f), 'utf8');
const CFG = JSON.parse(/insert into econ_config \(k, v\) values \('gear', '(\{[\s\S]*?\})'::jsonb\) on conflict/.exec(rd('holdor_v11.sql'))[1]);
Object.assign(CFG, JSON.parse(/v \|\| '(\{[\s\S]*?\})'::jsonb where k = 'gear'/.exec(rd('holdor_v12.sql'))[1]));
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push('PE:' + e.message));
  await page.goto('file://' + path.resolve(__dirname, '..', process.env.HOLDOR_HTML || 'beta/index.html'));
  await page.waitForFunction(() => window.HOLDOR && window.HOLDOR_GEAR && window.HOLDOR_GEAR.gearPerks, { timeout: 20000 }); await page.waitForTimeout(300);
  const R = {}; const ok = (k, v, info) => { R[k] = (v ? 'OK' : 'FAIL') + (info ? ' ' + info : ''); };
  const perkIds = [...new Set(Object.values(CFG.kinds).flat().flatMap(k => k.perks))];
  const total = Object.values(CFG.kinds).flat().length;
  // ---- the kinds ----
  const K = await page.evaluate(() => { const G = window.HOLDOR_GEAR; return Object.fromEntries(Object.keys(G.GEAR_KIND).map(s => [s, G.GEAR_KIND[s].map(x => x[0])])); });
  ok('54 kinds; the names and their order agree with the server config', total === 54 && Object.keys(CFG.kinds).every(s => JSON.stringify(K[s]) === JSON.stringify(CFG.kinds[s].map(k => k.n))), JSON.stringify(K));
  ok('an item shows the kind it was rolled with (kind 5 of weapons = Staff, kind 2 of rings = Band)', await page.evaluate(() => { const G = window.HOLDOR_GEAR; return G.gearKind({ slot: 'weapon', kind: 5 })[0] === 'Staff' && G.gearKind({ slot: 'ring', kind: 2 })[0] === 'Band'; }));
  // ---- every perk is a real, non-ultimate skill mechanic ----
  const P = await page.evaluate(ids => { const G = window.HOLDOR_GEAR; return ids.map(id => { const S = G.SK[id]; return { id, has: !!S, ult: !!(S && S.ult), n: S && S.v.length, txt: S && G.gearPerkText(id, 3) }; }); }, perkIds);
  ok(`all ${perkIds.length} perks exist as skills, none is an ultimate, each has 3+ ranks`, P.every(p => p.has && !p.ult && p.n >= 3), JSON.stringify(P.filter(p => !p.has || p.ult || p.n < 3)));
  ok('the perk text reads (name, rank, effect)', P.every(p => /\d\/5 — /.test(p.txt) && !/undefined|NaN/.test(p.txt)), JSON.stringify(P.filter(p => /undefined|NaN/.test(p.txt))));
  // ---- ranks ----
  const rk = await page.evaluate(() => { const G = window.HOLDOR_GEAR; const r = (r, tier) => G.gearPerkRank({ r, tier }); return [r(0, 1), r(2, 2), r(3, 3), r(4, 5), r(4, 1), G.gearPerkRank({ r: 0, tier: 1, pr: 4 })]; });
  ok('rank = ⌈(rarity + tier) / 2⌉, 1–5 (the server value wins)', JSON.stringify(rk) === '[1,2,3,5,3,4]', JSON.stringify(rk));
  // ---- in battle: each perk, at rank 5, on a real hero ----
  const B = await page.evaluate(async ([cfg, ids]) => {
    const H = window.HOLDOR, G = H.G, GX = window.HOLDOR_GEAR, out = { perErr: [], vals: {}, worn: {} };
    const a = H.newAccount('stark', 0, 'squire'); a.intro = 1; a.tut = 1; a.tours = {}; for (let i = 1; i <= 30; i++) a.campaign[i] = 3; a.sel = 'jon'; a.copen = { jon: 1 }; a.champs.jon = { lvl: 10, sk: [1, 1, 1] }; H.setAcc(a);
    const it = (perks, extra) => Object.assign({ id: 'pp' + Math.random().toString(16).slice(2, 6), slot: 'weapon', kind: 0, r: 4, tier: 5, cap: 20, set: 'wolf', lvl: 0, champ: 'jon', main: { k: 'dmg', v: 5 }, subs: [], perks }, extra || {});
    for (const id of ids) {
      try {
        GX.gearTestBag([it([id])], cfg); H.startGame({ level: 9 }); G.waveDone = false; G.nextIn = 1e9;
        const h = G.hero; out.vals[id] = [h.perk && h.perk[id], GX.skLvl(h, id), GX.skVal(h, id)];
        for (let k = 0; k < 6; k++) window.HOLDOR_CASTLE.spawn('sword', 200 + k * 30, 0);
        for (let s = 0; s < 900; s++) H.step();
      } catch (e) { out.perErr.push(id + ': ' + e.message); }
    }
    // best of the worn items; another champion's item does not count; his own higher rank stays
    GX.gearTestBag([it(['thorns'], { r: 0, tier: 1 }), it(['thorns'], { r: 4, tier: 5 }), it(['thorns'], { r: 4, tier: 5, champ: 'arya' })], cfg); out.worn.best = GX.gearPerks('jon'); out.worn.other = GX.gearPerks('arya'); out.worn.nobody = GX.gearPerks('rob');
    GX.gearTestBag([it(['bleed', 'sunder'], { r: 3, tier: 3 })], cfg); out.worn.two = GX.gearPerks('jon');
    GX.gearTestBag([], cfg); H.startGame({ level: 9 }); out.none = { perk: G.hero.perk, thorns: GX.skVal(G.hero, 'thorns') };
    return out; }, [CFG, perkIds]);
  ok('no perk breaks a battle', B.perErr.length === 0, JSON.stringify(B.perErr));
  ok('every perk arrives on the hero at rank 5 with a positive value', perkIds.every(id => B.vals[id] && B.vals[id][0] === 5 && B.vals[id][1] === 5 && B.vals[id][2] > 0), JSON.stringify(perkIds.filter(id => !(B.vals[id] && B.vals[id][0] === 5 && B.vals[id][2] > 0)).map(id => [id, B.vals[id]])));
  ok('two Common ★1 + Legendary ★5 thorns: the best rank counts (5); an item worn by another champion counts only for him', B.worn.best.thorns === 5 && B.worn.other.thorns === 5 && !B.worn.nobody.thorns, JSON.stringify(B.worn));
  ok('an Epic ★3 item with two perks: rank 3 each', B.worn.two.bleed === 3 && B.worn.two.sunder === 3, JSON.stringify(B.worn.two));
  ok('no gear: no perks, no skill value', Object.keys(B.none.perk || {}).length === 0 && B.none.thorns === 0, JSON.stringify(B.none));
  // ---- behaviour: perks really change the battle ----
  const Bh = await page.evaluate(async ([cfg]) => {
    const H = window.HOLDOR, G = H.G, GX = window.HOLDOR_GEAR, C2 = window.HOLDOR_CH52, C3 = window.HOLDOR_CH53, S = window.HOLDOR_CASTLE, out = {};
    const a = H.newAccount('stark', 0, 'squire'); a.intro = 1; a.tut = 1; a.tours = {}; for (let i = 1; i <= 30; i++) a.campaign[i] = 3; a.sel = 'jon'; a.copen = { jon: 1 }; a.champs.jon = { lvl: 10, sk: [1, 1, 1] }; H.setAcc(a);
    const it = (perks) => ({ id: 'bb' + perks.join(''), slot: 'weapon', kind: 0, r: 4, tier: 5, cap: 20, set: 'wolf', lvl: 0, champ: 'jon', main: { k: 'dmg', v: 5 }, subs: [], perks });
    const run = (perks, f) => { GX.gearTestBag(perks.length ? [it(perks)] : [], cfg); H.startGame({ level: 9 }); G.waveDone = false; G.nextIn = 1e9; G.enemies.length = 0; G.allies.length = 0; G.rng = () => 0.99; return f(G.hero); };
    const foe = () => { S.spawn('sword', 300, 0); const e = G.enemies[G.enemies.length - 1]; e.hp = e.max = 5000; return e; };
    // burn / poison: an attack leaves a damage-over-time mark
    for (const p of ['burn', 'poison']) out[p] = run([p], h => { const e = foe(); C2.heroHit(e, 100); return { dot: !!(e.burn || e.poison), keys: Object.keys(e).filter(k => /burn|poison|dot/i.test(k)) }; });
    out.plain = run([], h => { const e = foe(); C2.heroHit(e, 100); return { dot: !!(e.burn || e.poison) }; });
    // thorns: a blow at the hero hurts the attacker (look at total damage taken by an adjacent enemy)
    const th = (perks) => run(perks, h => { h.dmg = 0; S.spawn('sword', G.map.routes[0].total - 70, 0); const e = G.enemies[G.enemies.length - 1]; e.hp = e.max = 99999; h.hp = h.max = 99999; G.doorHp = G.doorMax = 1e9; for (let k = 0; k < 900; k++) H.step(); return Math.round(99999 - e.hp); }); out.thorns = [th([]), th(['thorns'])];
    // goldtouch: kills of the hero give more gold
    // quickstudy / howl: periodic skills tick on the timer
    out.howl = run(['howl'], h => { for (let s = 0; s < 1800; s++) H.step(); return Object.keys(h.skT || {}); });
    return out; }, [CFG]);
  ok('burn and poison perks mark what the champion hits; a bare champion does not', Bh.burn.dot && Bh.poison.dot && !Bh.plain.dot, JSON.stringify([Bh.burn, Bh.poison, Bh.plain]));
  ok('thorns perk: a blow at the hero hurts the attacker (more damage than a bare champion)', Bh.thorns[1] > Bh.thorns[0] + 30, JSON.stringify(Bh.thorns));
  ok('a periodic perk (howl) is picked up by the skill timers', Bh.howl.includes('howl'), JSON.stringify(Bh.howl));
  // ---- the screens: the sheet shows the perks and the icon marks them ----
  await page.evaluate(([cfg]) => { const H = window.HOLDOR, GX = window.HOLDOR_GEAR; const a = H.newAccount('stark', 0, 'squire'); a.intro = 1; a.tut = 1; a.tours = {}; a.gold = 99999; a.sel = 'jon'; a.copen = { jon: 1 }; H.setAcc(a);
    const its = [['weapon', 6, ['execute', 'poison'], 4, 5], ['ring', 4, ['reave'], 3, 2], ['banner', 3, [], 0, 1]].map(([slot, kind, perks, r, tier], i) => ({ id: 'a' + i + 'ce', slot, kind, r, tier, cap: tier * 4, set: 'wolf', lvl: 0, champ: 'jon', main: { k: 'dmg', v: 5 }, subs: [{ k: 'crit', v: 2 }], perks }));
    GX.gearTestBag(its, cfg); GX.showForge('jon'); }, [CFG]);
  await page.waitForTimeout(500);
  const F = await page.evaluate(() => ({ marks: [...document.querySelectorAll('.gslot .gpk2')].map(e => e.textContent), label: [...document.querySelectorAll('.gslot')].map(e => e.textContent.replace(/\s+/g, ' ')).join('|') }));
  ok('icons carry a ✦ per perk (2, 1, none)', JSON.stringify(F.marks.sort()) === JSON.stringify(['✦', '✦✦']), JSON.stringify(F));
  await page.screenshot({ path: SC + 'gear63_forge.png' });
  await page.evaluate(() => window.HOLDOR_GEAR.gearSheet('a0ce', 'jon')); await page.waitForTimeout(300);
  const SH = await page.evaluate(() => ({ t: document.querySelector('#ecoModal .eh').textContent.replace(/\s+/g, ' '), head: document.querySelector('#ecoModal .gsheet').textContent }));
  ok('the sheet names the kind (Dagger) and lists both perks with their rank (Legendary ★5 = 5/5)', /Dagger/.test(SH.head) && /Execute 5\/5/.test(SH.t) && /Venom 5\/5/.test(SH.t), JSON.stringify(SH));
  await page.screenshot({ path: SC + 'gear63_sheet.png' });
  // ---- art: six kind sheets ----
  const S6 = await page.evaluate(async () => { const G = window.HOLDOR_GEAR; const c = document.createElement('canvas'); c.width = 300; c.height = 300; const x = c.getContext('2d'); x.fillStyle = '#ff00ff'; x.fillRect(0, 0, 300, 300); x.fillStyle = '#336699'; for (let i = 0; i < 9; i++) x.fillRect((i % 3) * 100 + 30, Math.floor(i / 3) * 100 + 30, 40, 40);
    for (let n = 1; n <= 6; n++) G.setGearSheet('kinds' + n, c.toDataURL()); await new Promise(r => setTimeout(r, 900)); return Object.keys(G.GEAR_ART); });
  ok('six kind sheets of nine cut into 54 icons, one per kind', S6.length === 54 && S6.every(k => { const [s, n] = k.split(':'); return K[s] && K[s].includes(n); }), S6.length);
  console.log(JSON.stringify(R, null, 1));
  console.log('ERR', errors);
  await browser.close();
  process.exit(Object.values(R).some(v => v.startsWith('FAIL')) || errors.length ? 1 : 0);
})();
