// HOLDOR RPG — A13 skills: 18 class skills cast on a scene with 5 dummy mobs, cooldowns, rank-ups, the skill screen (real taps),
// autoBar, the cooldown-ring binding, the hero's signature skill. Build first: python3 src/build_rpg.py beta/index.html
// Run: CHROMIUM_PATH=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome node tests/rpg/t_skills.js   (HOLDOR_HTML overrides the page)
const { chromium } = require('playwright'); const path = require('path'), fs = require('fs');
const ROOT = path.resolve(__dirname, '..', '..'); const SC = path.join(ROOT, '.shots') + '/'; fs.mkdirSync(SC, { recursive: true });
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, hasTouch: true });
  const errors = []; page.on('pageerror', e => errors.push('PE:' + e.message + ' @ ' + (e.stack || '').split('\n').slice(0, 2).join(' | ')));
  page.on('console', m => { if (m.type() === 'error' && !/ERR_|Failed to load|net::|telegram/.test(m.text())) errors.push('C:' + m.text()); });
  await page.goto('file://' + path.resolve(ROOT, process.env.HOLDOR_HTML || 'beta/index.html'));
  await page.waitForFunction(() => window.R && R.skills && R.data && R.data.skills && R.screens && R.screens.skills, { timeout: 20000 });
  const out = {}; let fails = 0; const ok = (k, v, info) => { out[k] = (v ? 'OK' : 'FAIL') + (info ? ' ' + info : ''); if (!v) fails++; };
  // the scene: a hero of the given class at level 60 and five sturdy dummies around him
  /* the integrated build runs ~30 systems: the scene keeps the skills' and combat's own, so the world's population (new mobs would add hp
     to the sum), its gates, physics and the hero's stat recalculation (21_player) leave the scene alone */
  const scene = (cls, lvl) => page.evaluate(([cls, lvl]) => { R.sysList = R.sysList.filter(s => ['skills', 'combat', 'ai', 'proj'].includes(s.name)); if (R.phys) R.phys.off = true;
    R.stop && R.stop(); R.paused = false; R.ents.length = 0; R.state = R.newState(); const p = R.state.p; p.cls = cls; p.lvl = lvl; p.skills = {}; p.bar = [null, null, null]; delete p.sigSet; delete p.hero;
    R.player = R.spawn({ kind: 'player', team: 0, x: 3000, y: 6000, r: 14, hp: 400, hpMax: 400, atk: 40, def: 10, lvl, face: 1, name: 'Hero' }); R.cam.x = 3000; R.cam.y = 6000; R.cam.z = 1;
    const at = [[30, 0], [60, 30], [-40, -20], [90, -10], [0, -75]]; for (const [dx, dy] of at) R.spawn({ kind: 'mob', type: 'axe', team: 1, x: 3000 + dx, y: 6000 + dy, r: 14, hp: 100000, hpMax: 100000, atk: 5, def: 2, spd: 100, lvl: 10, name: 'Dummy' });
    R.skills.sync(); return R.skills.list().map(s => s.id); }, [cls, lvl]);
  const mobHp = () => page.evaluate(() => R.ents.filter(e => e.kind === 'mob').reduce((a, e) => a + e.hp, 0));
  const classes = ['knight', 'ranger', 'maester']; const allIds = [];
  const dmgKinds = /melee_aoe|dash_strike|volley|trap|rain|fire_bolt|frost_nova|summon_raven|wildfire|strike|debuff/;
  for (const cls of classes) {
    const ids = await scene(cls, 60); allIds.push(...ids); ok(cls + ' has 6 skills', ids.length === 6, ids.join(','));
    for (const id of ids) {
      const r = await page.evaluate(id => { const sk = R.data.skills[id]; const before = R.ents.filter(e => e.kind === 'mob').reduce((a, e) => a + e.hp, 0); R.player.hp = 150; R.player.cd = {}; R.player.status = {}; R.player.x = 3000; R.player.y = 6000; R.skills.setBar(0, id);
        let threw = null, first = false, second = false; try { first = R.skills.cast(0); second = R.skills.cast(0); } catch (e) { threw = e.message; }
        const cdLeft = R.skills.cdLeft(id); for (let i = 0; i < 150; i++) R.step();
        const after = R.ents.filter(e => e.kind === 'mob').reduce((a, e) => a + e.hp, 0);
        return { kind: sk.kind, cd: sk.cd, unlock: sk.unlock, threw, first, second, cdLeft, dmg: before - after, hp: R.player.hp, shield: R.player.status.shield || 0, ents: R.ents.length, name: sk.name, v: sk.v.length, text: sk.d(sk.v[4]) }; }, id);
      const needDmg = dmgKinds.test(r.kind); const healed = /heal/.test(r.kind) ? r.hp > 150 : true; const shielded = r.kind === 'shield' ? r.shield > 0 : true;
      ok('cast ' + id + ' (' + r.kind + ')', !r.threw && r.first && !r.second && r.cdLeft > 0 && Math.abs(r.cdLeft - r.cd) < 0.05 && (!needDmg || r.dmg > 0) && healed && shielded && r.v === 5 && r.text.length > 10,
        (r.threw ? 'threw ' + r.threw + ' ' : '') + 'dmg=' + r.dmg + ' cd=' + r.cdLeft.toFixed(1) + '/' + r.cd + ' second=' + r.second + (r.kind === 'heal' ? ' hp=' + r.hp : '') + (r.kind === 'shield' ? ' shield=' + r.shield : ''));
    }
    const unl = await page.evaluate(() => R.skills.list().map(s => s.unlock).join(',')); ok(cls + ' unlock levels', unl === '1,1,1,8,14,22', unl);
  }
  ok('18 skills, unique ids and names', allIds.length === 18 && new Set(allIds).size === 18 && await page.evaluate(() => new Set(Object.values(R.data.skills).map(s => s.name)).size === Object.keys(R.data.skills).length));
  ok('kinds cover the contract', await page.evaluate(() => { const need = ['melee_aoe', 'dash_strike', 'shield', 'taunt', 'volley', 'trap', 'rain', 'fire_bolt', 'frost_nova', 'heal', 'summon_raven', 'wildfire']; const have = new Set(Object.values(R.data.skills).map(s => s.kind)); return need.every(k => have.has(k)); }));
  ok('classes: 3 with icon, svg, spread, mods', await page.evaluate(() => ['knight', 'ranger', 'maester'].every(c => { const C = R.data.classes[c]; return C && C.icon && /<svg/.test(C.svg) && C.fantasy && C.base && C.grow && typeof C.hpMul === 'number'; }) && R.data.classes.knight.hpMul === 1.2 && R.data.classes.ranger.critAdd === 0.15 && R.data.classes.maester.skillMul === 1.2 && R.data.classes.knight.arc === 110 && R.data.classes.ranger.range === 320 && R.data.classes.maester.splash === 20));
  // 'cast'(skillId, src, {x, y, dir, kind, r}) for the 3D spell effects; three spells from level 1 with the owner's names
  const ce = await page.evaluate(() => { const got = []; const f = (id, src, o) => got.push({ id, src: !!src && src === R.player, o }); R.bus.on('cast', f);
    R.player.cd = {}; R.skills.setBar(0, 'm_flask'); R.state.p.cls = 'maester'; R.skills.cast(0); R.bus.off('cast', f); const g = got[0] || {};
    const names = ['knight', 'ranger', 'maester'].map(c => Object.values(R.data.skills).filter(s => s.cls === c && !s.hero && s.unlock === 1).map(s => s.name).join('/'));
    return { n: got.length, id: g.id, src: g.src, kind: g.o && g.o.kind, xy: !!(g.o && typeof g.o.x === 'number' && typeof g.o.y === 'number' && g.o.dir), names }; });
  ok("'cast' carries (id, src, {x, y, dir, kind}); Wildfire Bolt is fire", ce.n === 1 && ce.id === 'm_flask' && ce.src && ce.kind === 'fire' && ce.xy, JSON.stringify(ce));
  ok('three spells from level 1: Cleave / Shield Charge / War Cry · Volley / Snare Trap / Roll Shot · Wildfire Bolt / Frost Nova / Mend', ce.names.join(' | ') === 'Cleave/Shield Charge/War Cry | Volley/Snare Trap/Roll Shot | Wildfire Bolt/Frost Nova/Mend', ce.names.join(' | '));
  // the combat API is used when it exists; the fallback runs without it
  const hitUse = await page.evaluate(() => { const old = R.hit; let n = 0; R.hit = (s, t, d, o) => { n++; t.hp -= d; return d; }; R.player.cd = {}; R.skills.setBar(0, 'm_frost'); R.skills.cast(0); for (let i = 0; i < 10; i++) R.step(); if (old) R.hit = old; else delete R.hit; return n; });
  ok('R.hit used for damage', hitUse >= 5, 'calls=' + hitUse);
  const noHit = await page.evaluate(() => { const old = R.hit; delete R.hit; const b = R.ents.filter(e => e.kind === 'mob').reduce((a, e) => a + e.hp, 0); R.player.cd = {}; R.skills.cast(0); for (let i = 0; i < 10; i++) R.step(); if (old) R.hit = old; return b - R.ents.filter(e => e.kind === 'mob').reduce((a, e) => a + e.hp, 0); });
  ok('fallback damage without R.hit', noHit > 0, 'dmg=' + noHit);
  // rank-ups: level 5 knight = 4 points; a point raises the numbers; no point → false; cap 5
  await scene('knight', 5);
  const rk = await page.evaluate(() => { const p = R.state.p; const o = { pts0: R.skills.points(), r0: R.skills.rank('k_cleave'), v0: R.skills.val('k_cleave') }; o.up = R.skills.rankUp('k_cleave'); o.pts1 = p.spts; o.r1 = p.skills.k_cleave; o.v1 = R.skills.val('k_cleave'); o.d1 = R.skills.desc('k_cleave');
    o.locked = R.skills.rankUp('k_shield');   /* Raised Shield opens at 8 */ R.skills.rankUp('k_cleave'); R.skills.rankUp('k_cleave'); R.skills.rankUp('k_cleave'); o.pts2 = p.spts; o.r2 = p.skills.k_cleave; o.capped = R.skills.rankUp('k_cleave'); o.zero = R.skills.rankUp('k_lunge'); return o; });
  ok('rank up spends a point and raises numbers', rk.pts0 === 4 && rk.r0 === 1 && rk.v0 === 150 && rk.up && rk.pts1 === 3 && rk.r1 === 2 && rk.v1 === 175 && /175%/.test(rk.d1), JSON.stringify(rk));
  ok('rank up refused: locked / capped / no points', rk.locked === false && rk.r2 === 5 && rk.pts2 === 0 && rk.capped === false && rk.zero === false, JSON.stringify(rk));
  // autoBar
  const ab = await page.evaluate(() => { const p = R.state.p; p.lvl = 8; p.bar = [null, null, null]; const ch = R.skills.autoBar(); const a = p.bar.slice(); p.lvl = 1; R.skills.sync(); const b = p.bar.slice(); return { ch, a, b }; });
  ok('autoBar fills with the lowest unlocked (three spells from level 1)', ab.ch && ab.a.join(',') === 'k_cleave,k_lunge,k_taunt' && ab.b.join(',') === 'k_cleave,k_lunge,k_taunt', JSON.stringify(ab));
  // the skill screen: opens, 6 cards, a tap puts a skill into slot 2, RANK UP by tap, targets ≥ 44 px
  await scene('knight', 9);
  await page.evaluate(() => R.ui.open('skills')); await page.waitForTimeout(150);
  const cards = await page.$$eval('.sk-card', c => c.map(x => x.dataset.id)); ok('screen opens with 6 cards', cards.length === 6 && cards[0] === 'k_cleave', cards.join(','));
  const pts = await page.$eval('.sk-pts b', b => b.textContent); ok('points pill shows 8', pts === '8', pts);
  const slotBtn = await page.$('.sk-card[data-id="k_shield"] .sk-slot[data-slot="1"]'); const bb = await slotBtn.boundingBox();
  await page.tap('.sk-card[data-id="k_shield"] .sk-slot[data-slot="1"]'); await page.waitForTimeout(120);
  const bar = await page.evaluate(() => R.state.p.bar.slice()); ok('tap puts Raised Shield into slot 2', bar[1] === 'k_shield', bar.join(','));
  ok('slot button ≥ 44 px', bb && bb.height >= 44 && bb.width >= 44, JSON.stringify(bb));
  const onCount = await page.$$eval('.sk-card[data-id="k_shield"] .sk-slot.on', b => b.length); ok('chosen slot highlighted once', onCount === 1, '' + onCount);
  await page.screenshot({ path: SC + 'rpg_skills.png' });
  const upBB = await (await page.$('.sk-card[data-id="k_lunge"] .sk-up')).boundingBox(); await page.tap('.sk-card[data-id="k_lunge"] .sk-up'); await page.waitForTimeout(120);
  const after = await page.evaluate(() => ({ r: R.state.p.skills.k_lunge, pts: R.state.p.spts, pips: document.querySelectorAll('.sk-card[data-id="k_lunge"] .sk-pips i.on').length, pill: document.querySelector('.sk-pts b').textContent }));
  ok('tap RANK UP: rank 2, 7 points, 2 pips', after.r === 2 && after.pts === 7 && after.pips === 2 && after.pill === '7' && upBB.height >= 44, JSON.stringify(after));
  const lockedBtn = await page.$eval('.sk-card.locked .sk-lock', b => b.disabled + ' ' + b.textContent); ok('locked card shows its level', lockedBtn === 'true UNLOCKS AT LEVEL 14', lockedBtn);
  await page.tap('.sk-back'); await page.waitForTimeout(100); ok('BACK closes the screen', await page.evaluate(() => R.ui.cur === null && !document.getElementById('screen').classList.contains('on')));
  // the cooldown ring binding (R.input.setCooldown) + input polling of skill1 + keyboard fallback
  const cdui = await page.evaluate(() => { const hadInput = !!R.input; const calls = []; let pressed = 0; R.input = { move: { x: 0, y: 0 }, setCooldown: (i, f) => calls.push([i, +f.toFixed(2)]), pressed: n => n === 'skill1' && pressed-- > 0 ? true : false };
    R.player.cd = {}; R.skills.setBar(0, 'k_cleave'); pressed = 1; for (let i = 0; i < 30; i++) R.step(); const left = R.skills.cdLeft('k_cleave'); const fr = calls.filter(c => c[0] === 0).map(c => c[1]); if (!hadInput) delete R.input; return { left, n: fr.length, max: Math.max(...fr), min: Math.min(...fr) }; });
  ok('input poll casts slot 1 and setCooldown(0, frac) runs each frame', cdui.left > 5 && cdui.n >= 25 && cdui.max > 0.9 && cdui.min < cdui.max, JSON.stringify(cdui));
  const kb = await page.evaluate(() => { if (R.input) return 'skip'; R.player.cd = {}; return 'go'; });
  if (kb === 'go') { await page.keyboard.press('1'); ok('keyboard 1 casts slot 1 (fallback)', await page.evaluate(() => R.skills.cdLeft('k_cleave') > 0)); }
  // the hero's signature skill (Addendum 2): a 4th skill from R.data.champs[hero].sig, unlocked at 6, slot 3 by default
  await scene('knight', 5);
  const sig = await page.evaluate(() => { const had = R.data.champs; R.data.champs = Object.assign({}, had || {}, { jon: { name: 'Jon', type: 'melee', sig: { kind: 'aoe', name: 'Longclaw Sweep' } } }); const p = R.state.p; p.hero = 'jon'; p.lvl = 5; p.bar = [null, null, null]; delete p.sigSet; R.skills.sync();
    const o = { at5: R.skills.list().length, bar5: p.bar.slice() }; p.lvl = 6; R.skills.sync(); o.at6 = R.skills.list().length; o.bar6 = p.bar.slice(); o.sk = R.data.skills.sig_jon && { name: R.data.skills.sig_jon.name, unlock: R.data.skills.sig_jon.unlock, kind: R.data.skills.sig_jon.kind };
    R.player.cd = {}; const b = R.ents.filter(e => e.kind === 'mob').reduce((a, e) => a + e.hp, 0); o.cast = R.skills.cast(2); for (let i = 0; i < 10; i++) R.step(); o.dmg = b - R.ents.filter(e => e.kind === 'mob').reduce((a, e) => a + e.hp, 0); o.pts = R.skills.points();
    R.ui.open('skills'); o.cards = document.querySelectorAll('.sk-card').length; o.sigCard = !!document.querySelector('.sk-card.sig[data-id="sig_jon"]'); R.ui.close(); if (had) R.data.champs = had; else delete R.data.champs; delete p.hero; return o; });
  ok('signature: 4th skill at level 6 in slot 3, casts, shown', sig.at5 === 7 && sig.bar5.join(',') === 'k_cleave,k_lunge,k_taunt' && sig.at6 === 7 && sig.bar6[2] === 'sig_jon' && sig.sk && sig.sk.name === 'Longclaw Sweep' && sig.sk.unlock === 6 && sig.sk.kind === 'melee_aoe' && sig.cast && sig.dmg > 0 && sig.pts === 5 && sig.cards === 7 && sig.sigCard, JSON.stringify(sig));
  ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' || '));
  for (const k in out) console.log(out[k].startsWith('OK') ? 'OK   ' + k + (out[k].length > 2 ? '  ' + out[k].slice(3) : '') : 'FAIL ' + k + '  ' + out[k].slice(5));
  await browser.close(); console.log(fails ? fails + ' FAIL' : 'ALL OK'); process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
