// G11 — 07b_architecture.js: every POI type builds textured architecture, triangle budgets (seats + King's Landing ≤ 2500, the rest ≤ 1200),
// ≤ 10 shared materials, deterministic per POI id, null without THREE (A37's fallback answers), the ice Wall, and a game-camera screenshot
// of each great seat at 390×844 → .shots/rpg/arch_<id>.png.
// usage: HOLDOR_HTML=$F RPG_HTML=$F RPG_NOBUILD=1 CHROMIUM_PATH=… node tests/rpg/t_architecture.js   (ARCH_SHOTS=0 skips the screenshots)
'use strict';
const L = require('./lib');
const SEATS = ['winterfell', 'casterly', 'highgarden', 'sunspear', 'pyke', 'stormsend', 'dragonstone', 'kingslanding'];
(async () => {
  L.build();
  const { page, errors, close } = await L.launch({ w: 390, h: 844 });
  await L.boot(page, { save: L.fakeSave({ house: 'stark', lvl: 5 }) });
  const r = await page.evaluate(() => {
    const out = { errors: [], tris: {}, kinds: {}, mats: 0, det: true, three: typeof THREE !== 'undefined' };
    const pois = (R.data.world && R.data.world.pois) || [], mats = new Set();
    for (const p of pois) { try { const o = R.props.build(p); if (!o) { out.errors.push(p.id + ' null'); continue; }
        out.tris[p.id] = { t: o.userData.tris, type: o.userData.type, arch: o.userData.arch, seat: !!o.userData.seat };
        o.traverse(m => { if (m.isMesh && m.material) mats.add(m.material.uuid); });
        if (!o.children.some(c => c.isMesh && /^arch:/.test(c.name))) out.errors.push(p.id + ' not arch'); out.kinds[o.userData.type] = (out.kinds[o.userData.type] || 0) + 1;
      } catch (e) { out.errors.push(p.id + ': ' + e.message); } }
    const sig = o => { const h = []; o.traverse(m => { if (m.isMesh) { const a = m.geometry.attributes.position.array; let s = 0; for (let i = 0; i < a.length; i += 7) s += a[i]; h.push(a.length + ':' + s.toFixed(2)); } }); return h.join(); };
    for (const id of ['winterfell', 'pyke', 'kingslanding', 'camp_barrows', 'dg_crypts']) { const p = pois.find(q => q.id === id); if (!p) continue; if (sig(R.props.build(p)) !== sig(R.props.build(p))) out.det = false; }
    const w = R.props.wall(); out.wall = { tris: w && w.userData.tris, name: w && w.name, kids: w && w.children.length };
    if (w) w.traverse(m => { if (m.isMesh) mats.add(m.material.uuid); });
    out.mats = mats.size; out.matNames = Object.values(R.arch.mats()).map(m => m.name);
    out.textured = Object.values(R.arch.mats()).filter(m => m.map).length;
    const T = window.THREE; window.THREE = undefined; try { out.noThree = R.arch.build({ id: 'x', type: 'castle', x: 10, y: 10 }) === null && R.arch.wall() === null; } catch (e) { out.noThree = 'threw ' + e.message; } window.THREE = T;
    out.unknown = R.arch.build({ id: 'y', type: 'banana' }) === null;
    out.inScene = !!(R.render3d && R.render3d.scene && R.render3d.scene.getObjectByName('wall'));
    return out;
  });
  L.ok('no load/build errors', r.errors.length === 0, r.errors.slice(0, 8).join(' | '));
  L.ok('every POI type builds (' + JSON.stringify(r.kinds) + ')', ['castle', 'town', 'camp', 'dungeon', 'shrine'].every(k => r.kinds[k] > 0));
  const over = Object.entries(r.tris).filter(([id, v]) => v.t > (v.seat ? 2500 : 1200) || v.t < 40).map(([id, v]) => id + ':' + v.t);
  L.ok('triangle budgets (seats ≤ 2500, others ≤ 1200)', over.length === 0, over.join(' '));
  for (const id of SEATS) if (r.tris[id]) console.log('   ' + id + ' ' + r.tris[id].t + ' tris (' + r.tris[id].arch + ')');
  const tot = Object.values(r.tris).filter(v => !v.seat).map(v => v.t); console.log('   others: max ' + Math.max(...tot) + ', mean ' + Math.round(tot.reduce((a, b) => a + b, 0) / tot.length));
  L.ok('≤ 10 materials shared by every POI + the Wall (' + r.mats + ': ' + r.matNames.join(',') + '; ' + r.textured + ' textured)', r.mats <= 10 && r.textured >= 8);
  L.ok('deterministic per POI id', r.det);
  L.ok('the Wall builds (' + JSON.stringify(r.wall) + ') and stands in the scene', r.wall.tris > 500 && r.wall.name === 'wall' && r.inScene);
  L.ok('without THREE build/wall return null, unknown types fall through', r.noThree === true && r.unknown === true, String(r.noThree));
  const shots = [];
  if (process.env.ARCH_SHOTS !== '0') for (const id of (process.env.ARCH_ONLY ? process.env.ARCH_ONLY.split(',') : SEATS)) {
    const ok = await page.evaluate(id => { const p = R.data.world.pois.find(q => q.id === id); if (!p || !R.player) return false;
      R.player.x = p.x + 20; R.player.y = p.y + +(window.ARCH_D || 330); R.player.vx = R.player.vy = 0; R.cam.yaw = 0; R.cam.dist = 420; if (R.camSnap) R.camSnap(); if (R.render && R.render.snapCam) R.render.snapCam(); return true; }, id);
    if (!ok) { L.skip('shot ' + id, 'no POI / player'); continue; }
    await L.steps(page, 20); await page.waitForTimeout(700);
    const st = await page.evaluate(id => { const p = R.render3d && R.render3d.props && R.render3d.props.get(id); return { vis: !!(p && p.obj.visible), arch: p && p.obj.userData.arch, calls: R.render3d && R.render3d.renderer.info.render.calls }; }, id);
    const f = await L.shot(page, 'arch_' + id); shots.push(f);
    L.ok('shot ' + id + ' (' + JSON.stringify(st) + ')', st.vis && !!st.arch);
  }
  L.ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  console.log('shots: ' + shots.join(' '));
  await close(); L.report();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
