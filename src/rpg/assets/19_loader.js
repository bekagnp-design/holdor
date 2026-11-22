/* A04 — the asset loader: turns the extracted art (A_ENEMY, A_CHAMP, A_MAP, A_GATE from assets/1x_*.js) into Image objects on R.assets.
   R.assets = {
     enemy: {key: Image},            the 34 enemy sprite sheets (ENEMY_ART keys = the ED keys: axe, sword, archer, hound, walker, giant, …)
     champ: {key: Image},            id (idle sheet), id_attack (attack sheet), id_portrait (card portrait) for the 49 champions (+ drogon idle)
     map: Image,                     the Westeros art, 1200×2048
     gate: [null, Image ×5],         the door by damage stage
     ready: Promise<R.assets>,       resolves when every image has loaded or errored — never hangs (15 s cap)
     done, total, loaded, failed[],  progress; failed holds 'enemy:axe'-style keys of images that errored
     src: {enemy, champ, map, gate, icon},   the raw tables (A_ENEMY, A_CHAMP, A_MAP, A_GATE, A_ICON)
     meta: {enemy, champ, gate, enemyCfg},   sheet geometry {cx,by,w,h,C} per key, gate {w,h,ox,oy}, enemy {h,an}
     ok(img) → bool; img(kind, key) → Image|null (kind 'enemy'|'champ'|'gate'|'map'); portrait(id) → Image|null;
     white(kind, key) → canvas|null (a white silhouette, cached, for hit flashes); icon(name, px) → svg string sized px (or '')
   }
   Loads before js/00_core.js, so it creates window.R when absent and only adds R.assets. */
window.R = window.R || {};
(function () {
  const A = R.assets = R.assets || {};
  const E = typeof A_ENEMY !== 'undefined' ? A_ENEMY : { art: {}, meta: {}, cfg: {}, names: {}, white: {} };
  const C = typeof A_CHAMP !== 'undefined' ? A_CHAMP : { art: {}, meta: {}, list: [], byId: {}, houses: {} };
  const M = typeof A_MAP !== 'undefined' ? A_MAP : { src: '', w: 1200, h: 2048, stages: [] };
  const G = typeof A_GATE !== 'undefined' ? A_GATE : { art: [], meta: [] };
  const I = typeof A_ICON !== 'undefined' ? A_ICON : {};
  A.src = { enemy: E, champ: C, map: M, gate: G, icon: I };
  A.meta = { enemy: E.meta || {}, champ: C.meta || {}, gate: G.meta || [], enemyCfg: E.cfg || {} };
  A.enemy = {}; A.champ = {}; A.gate = []; A.map = null;
  A.total = 0; A.loaded = 0; A.failed = []; A.done = false;
  const pend = [];
  function load(src, key) {
    const im = new Image(); im.decoding = 'async'; A.total++;
    pend.push(new Promise(res => {
      const fin = ok => { A.loaded++; if (!ok) A.failed.push(key); res(im); };
      im.onload = () => fin(true); im.onerror = () => fin(false);
    }));
    im.src = src; return im;
  }
  for (const k in E.art) A.enemy[k] = load(E.art[k], 'enemy:' + k);
  for (const k in C.art) A.champ[k] = load(C.art[k], 'champ:' + k);
  if (M.src) A.map = load(M.src, 'map');
  (G.art || []).forEach((u, i) => { A.gate[i] = u ? load(u, 'gate:' + i) : null; });
  let timer = 0;
  A.ready = Promise.race([Promise.all(pend), new Promise(r => { timer = setTimeout(r, 15000); })]).then(() => { clearTimeout(timer); A.done = true; return A; });
  A.ok = im => !!im && im.complete && im.naturalWidth > 0;
  A.img = (kind, key) => { const im = kind === 'map' ? A.map : (A[kind] || {})[key]; return A.ok(im) ? im : null; };
  A.portrait = id => A.img('champ', id + '_portrait');
  const white = {};
  A.white = (kind, key) => {
    const ck = kind + ':' + key; if (white[ck]) return white[ck];
    const im = A.img(kind, key); if (!im) return null;
    const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight;
    const x = c.getContext('2d'); x.drawImage(im, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
    return white[ck] = c;
  };
  A.icon = (name, px) => { const s = I[name]; return typeof s === 'string' ? s.replace('<svg ', '<svg width="' + (px || 22) + '" height="' + (px || 22) + '" ') : ''; };
})();
