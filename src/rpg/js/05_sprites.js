/* HOLDOR RPG — 05_sprites.js (A03): the old game's sprite pipeline (one image per creature, the walk cycle built from
   sheared slices) for the RPG, in two forms:
   2D (world space → R.w2s + R.cam.z, drawn on R.ctx or o.ctx):
     R.draw.sprite(key, x, y, o)   mob by sprite key. o = {anim:'idle'|'walk'|'attack'|'hurt'|'die', t (animT), face ±1, scale (world
                                   units of body height, default cfg.h × 1.6), walk (distance walked, drives the stride), tint, tintA,
                                   alpha, shadow:true, seed, sx, sy, rot, ctx, screen:true (x,y are screen px), z, dpr}. Returns false
                                   when nothing was drawn (culled, or the death animation is over → remove the corpse).
     R.draw.champ(id, x, y, o)     champion: stance sheet for idle/walk/hurt/die, attack sheet while anim==='attack'.
     R.draw.hero(x, y, o)          the hero is a champion (R.state.p.hero); else R.heroArt.draw (A37), else a placeholder.
     R.draw.shadow(x,y,rx,ry,o) / bar(x,y,w,h,frac,col,o) (x,y = centre) / name(x,y,text,col,o) / zsort(ents) / zkey(e)
     R.draw.portrait(id, size) → cached canvas; R.draw.portraitURL(id)
   3D billboards (Addendum 2): one frame per call, a cached transparent canvas at the sheet's natural size × o.scale:
     R.draw.frame(key, anim, t, face, o) / R.draw.frameKey(key, anim, t, face, o)         mobs
     R.draw.champFrame(id, anim, t, face, o) / R.draw.champFrameKey(...)                   champions (and so the hero)
     R.draw.heroFrame(anim, t, face, o)
     Each canvas carries c.meta = {ax, ay (the feet point in canvas px), w, h (the figure's box), sc, lift, face}. Facing is
     mirrored, hurt flash and the death (fall / shatter / dissolve / drop) are baked. t is quantised: walk 8, idle 4, attack 3,
     die 4, hurt 2 phases (flyers and ghosts: one 8-phase cycle). Repeated calls return the same canvas object.
   Sizes: R.draw.measure(key) → {w, h, fly, an} world units; R.draw.deathKind(key) / deathTime(key).
   Art comes from A04: R.assets.enemy[key] / R.assets.champ[name] (Images) and the globals A_ENEMY {art, meta, cfg} /
   A_CHAMP {art, meta}; without them a coloured placeholder figure is drawn so the game still runs. All frames live in one
   LRU of ≤ 600 canvases. */
(function () {
  const D = R.draw = R.draw || {};
  /* the old game's tables (fallback when A_ENEMY has no entry): cfg.h = height in the old game's px, an = movement kind */
  const CFG0 = {axe:{h:30,an:'walk'},sword:{h:31,an:'walk'},archer:{h:30,an:'walk'},spear:{h:31,an:'walk'},shield:{h:30,an:'walk'},child:{h:30,an:'scurry'},crawler:{h:15,an:'crawl'},crypt:{h:30,an:'shamble'},berserk:{h:31,an:'scurry'},thenn:{h:33,an:'walk'},necro:{h:32,an:'float'},skin:{h:30,an:'shamble'},chief:{h:31,an:'walk'},hound:{h:19,an:'trot'},wolf:{h:26,an:'trot'},boar:{h:25,an:'charge'},bear:{h:27,an:'lumber'},cat:{h:19,an:'stalk'},elk:{h:34,an:'charge'},mammoth:{h:28,an:'lumber'},giant:{h:31,an:'lumber'},spider:{h:18,an:'skitter'},brood:{h:20,an:'skitter'},raven:{h:17,an:'fly'},bat:{h:16,an:'fly'},eagle:{h:26,an:'fly'},dragon:{h:74,an:'fly'},rider:{h:35,an:'gallop'},outrider:{h:37,an:'gallop'},wraith:{h:30,an:'float'},shade:{h:28,an:'float'},walker:{h:30,an:'glide'},lord:{h:30,an:'glide'},king:{h:30,an:'glide'}};
  const META0 = {axe:{cx:80,by:156,w:145,h:147,C:160},hound:{cx:80,by:155,w:148,h:95,C:160},bear:{cx:112,by:219,w:214,h:144,C:224},necro:{cx:80,by:155,w:148,h:103,C:160},lord:{cx:114,by:220,w:161,h:115,C:224},bat:{cx:80,by:151,w:143,h:76,C:160},sword:{cx:80,by:156,w:150,h:143,C:160},wolf:{cx:112,by:219,w:214,h:142,C:224},chief:{cx:107,by:219,w:198,h:127,C:224},elk:{cx:104,by:220,w:195,h:134,C:224},crawler:{cx:83,by:156,w:142,h:79,C:160},outrider:{cx:101,by:220,w:188,h:133,C:224},dragon:{cx:110,by:217,w:197,h:112,C:224},archer:{cx:78,by:156,w:133,h:148,C:160},shield:{cx:80,by:156,w:150,h:112,C:160},thenn:{cx:112,by:220,w:213,h:163,C:224},shade:{cx:77,by:155,w:114,h:81,C:160},eagle:{cx:112,by:217,w:211,h:124,C:224},wraith:{cx:73,by:151,w:132,h:86,C:160},mammoth:{cx:112,by:219,w:183,h:117,C:224},skin:{cx:75,by:155,w:136,h:87,C:160},boar:{cx:112,by:220,w:213,h:144,C:224},brood:{cx:112,by:219,w:186,h:116,C:224},rider:{cx:112,by:219,w:208,h:157,C:224},raven:{cx:82,by:155,w:145,h:87,C:160},king:{cx:112,by:220,w:198,h:117,C:224},cat:{cx:76,by:154,w:139,h:80,C:160},walker:{cx:112,by:220,w:213,h:189,C:224},crypt:{cx:80,by:156,w:149,h:128,C:160},spear:{cx:80,by:156,w:147,h:127,C:160},giant:{cx:112,by:220,w:213,h:138,C:224},child:{cx:76,by:155,w:143,h:137,C:160},spider:{cx:80,by:155,w:150,h:99,C:160},berserk:{cx:80,by:156,w:149,h:92,C:160}};
  const CMETA0 = { cx: 112, by: 220, w: 150, h: 214, C: 224 };   /* a champion sheet whose name A_CHAMP.meta lacks */
  const PMETA = { cx: 80, by: 150, w: 90, h: 150, C: 160 };      /* the placeholder figure's box */
  /* movement: legs = the lower slices shear in opposite directions around the hip, the upper body bobs and tilts, the figure squashes on
     foot contact; flyers hinge their wing halves, ghosts wave three bands */
  const ANIM_P = {
    walk: { stride: 16, A: 0.24, bob: 1.2, tilt: 0.05, hip: 0.46, sq: 0.05, lean: 0.03 },
    shamble: { stride: 20, A: 0.16, bob: 0.8, tilt: 0.10, hip: 0.46, sq: 0.04, lurch: 0.06 },
    scurry: { stride: 8, A: 0.26, bob: 1.4, tilt: 0.06, hip: 0.46, sq: 0.06 },
    trot: { stride: 14, A: 0.34, bob: 1.6, tilt: 0.05, hip: 0.42, sq: 0.05, quad: 1 },
    charge: { stride: 15, A: 0.36, bob: 1.3, tilt: 0.03, hip: 0.40, sq: 0.06, quad: 1, lean: 0.10 },
    lumber: { stride: 28, A: 0.18, bob: 2.4, tilt: 0.06, hip: 0.42, sq: 0.07, quad: 0, puff: 1 },
    glide: { stride: 18, A: 0.12, bob: 0.4, tilt: 0.00, hip: 0.46, sq: 0.02 },
    crawl: { stride: 12, A: 0.00, bob: 0.0, tilt: 0.00, hip: 0.5, sq: 0.00, crawl: 1 },
    stalk: { stride: 14, A: 0.24, bob: 0.6, tilt: 0.03, hip: 0.40, sq: 0.04, quad: 1 },
    skitter: { stride: 5, A: 0.22, bob: 0.6, tilt: 0.04, hip: 0.45, sq: 0.03, quad: 1 },
    gallop: { stride: 20, A: 0.40, bob: 2.2, tilt: 0.08, hip: 0.40, sq: 0.06, quad: 1, lean: 0.06 },
    float: { ghost: 1 },
    fly: { fly: 1 }
  };
  const FLAP_HZ = { bat: 9, raven: 4, eagle: 2.6, dragon: 1.5 };
  const BIG = 1.6, CHAMP_H = 40;                                  /* world height = cfg.h × BIG; a champion = 40 × BIG = 64 units */
  const N = { walk: 8, idle: 4, attack: 3, die: 4, hurt: 2, cyc: 8 }; /* phases per animation (shared by the 2D draw and the 3D frames) */
  const ATK = 0.3, IDLE = 1.6;                                    /* attack length, breath cycle (s) */
  const DMAX = { shatter: 0.4, dissolve: 0.7, drop: 0.75, fall: 0.75 };
  const MAX = 600;
  const PAL = ['#b9553f', '#4f7fb5', '#5f9e55', '#c29a4a', '#8a5fb5', '#4fa39b', '#c27a3a', '#7d8a9a', '#a04a6a', '#6a7fc2'];
  D.ANIM_P = ANIM_P; D.N = N; D.BIG = BIG; D.forceNoArt = false;

  /* ---- art access (A04's loader first, then the raw globals, lazily decoded here) ---- */
  const AE = () => { try { return typeof A_ENEMY !== 'undefined' && A_ENEMY ? A_ENEMY : null; } catch (e) { return null; } };
  const AC = () => { try { return typeof A_CHAMP !== 'undefined' && A_CHAMP ? A_CHAMP : null; } catch (e) { return null; } };
  const IMG = {};
  const mk = url => { const im = new Image(); im.src = url; return im; };
  const okImg = im => !!im && im.complete !== false && (im.naturalWidth == null ? im.width : im.naturalWidth) > 0;
  const enemyImg = key => { if (D.forceNoArt) return null; const as = R.assets; let im = as && as.enemy && as.enemy[key]; if (!im) { const a = AE(); if (a && a.art && a.art[key]) im = IMG['e:' + key] || (IMG['e:' + key] = mk(a.art[key])); } return okImg(im) ? im : null; };
  const champImg = name => { if (D.forceNoArt) return null; const as = R.assets; let im = as && as.champ && as.champ[name]; if (!im) { const a = AC(); if (a && a.art && a.art[name]) im = IMG['c:' + name] || (IMG['c:' + name] = mk(a.art[name])); } return okImg(im) ? im : null; };
  const cfgOf = key => { const a = AE(); return (a && a.cfg && a.cfg[key]) || CFG0[key] || { h: 30, an: 'walk' }; };
  const metaOf = key => { const a = AE(); return (a && a.meta && a.meta[key]) || META0[key] || META0.axe; };
  const cmetaOf = name => { const a = AC(); return (a && a.meta && a.meta[name]) || CMETA0; };
  const known = key => { const a = AE(); return !!(CFG0[key] || (a && ((a.cfg && a.cfg[key]) || (a.art && a.art[key])))); };
  /* a mob type that is not a sprite key may name its sprite in R.data.mobs[type].sprite */
  /* a mob type with no sheet of its own borrows the nearest painted one by its name (bandit → the axeman, bandit_archer → the archer, …), so
     no humanoid shows as the grey placeholder; a mob of R.data.mobs that matches nothing walks as the swordsman */
  const GUESS = [[/archer|bow|hunter|ranger|slinger/, 'archer'], [/spear|pike|lance/, 'spear'], [/shield|guard|knight|soldier|sworn|watch/, 'shield'], [/berserk|savage|frenz/, 'berserk'],
    [/necro|mage|priest|witch|shaman|sorcer|warlock|cultist/, 'necro'], [/chief|captain|lord|warlord|champion/, 'chief'], [/thenn|clans|tribe/, 'thenn'], [/wolf/, 'wolf'], [/hound|dog|jackal/, 'hound'], [/bear/, 'bear'],
    [/boar|pig/, 'boar'], [/spider/, 'spider'], [/crawl|rat|leech/, 'crawler'], [/wight|dead|crypt|skelet|corpse|drown/, 'crypt'], [/shade|ghost|wraith|spirit/, 'wraith'], [/giant/, 'giant'],
    [/rider|horse|mounted/, 'rider'], [/raven|crow/, 'raven'], [/bat/, 'bat'], [/eagle|hawk/, 'eagle'], [/cat|lion/, 'cat'], [/bandit|outlaw|raider|thug|brigand|sellsword|pirate|reaver|wildling|axe|smuggler/, 'axe'], [/sword|blade|duel/, 'sword']];
  const guessed = {};
  const guess = key => { if (key in guessed) return guessed[key]; const k = String(key).toLowerCase(); let v = null; for (const [re, g] of GUESS) if (re.test(k) && known(g)) { v = g; break; } return guessed[key] = v; };
  const resolve = key => { if (known(key)) return key; const M = R.data && R.data.mobs && R.data.mobs[key]; if (M && M.sprite && known(M.sprite)) return M.sprite;
    const g = guess(key) || (M && M.sprite && guess(M.sprite)); if (g) return g; return M ? 'sword' : key; };
  const hash = s => { let h = 7; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); };
  const colFor = key => PAL[hash(key) % PAL.length];
  const houseCol = () => { const h = R.state && R.state.p && R.state.p.house, H = R.data && R.data.houses; return (h && H && H[h] && H[h].col) || '#a9bdd0'; };
  function shade(hex, k) { if (!/^#[0-9a-f]{6}$/i.test(hex)) return hex; const n = parseInt(hex.slice(1), 16); const f = v => Math.max(0, Math.min(255, Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k))); return '#' + ((f(n >> 16) << 16) | (f((n >> 8) & 255) << 8) | f(n & 255)).toString(16).padStart(6, '0'); }

  /* ---- the frame LRU ---- */
  const CACHE = new Map();
  const cget = k => { const v = CACHE.get(k); if (v) { CACHE.delete(k); CACHE.set(k, v); } return v; };
  const cset = (k, v) => { CACHE.set(k, v); while (CACHE.size > MAX) CACHE.delete(CACHE.keys().next().value); return v; };
  D.cacheSize = () => CACHE.size; D.clearCache = () => { CACHE.clear(); for (const k in PORT) delete PORT[k]; };

  /* ---- the figure, in local space: feet at (0,0), facing +x (the drawWalking port) ---- */
  function slice(g, im, m, sc, Dd, fx0, fx1, fy0, fy1) {
    const W = m.w * sc, H = m.h * sc, x0 = -W / 2 + fx0 * W, x1 = -W / 2 + fx1 * W, y0 = -H + fy0 * H, y1 = -H + fy1 * H;
    g.save(); g.beginPath(); g.rect(x0 - 0.5, y0 - 0.5, x1 - x0 + 1, y1 - y0 + 1); g.clip(); g.drawImage(im, -m.cx * sc, -m.by * sc, Dd, Dd); g.restore();
  }
  /* returns the body lift (for the shadow). ph = cycle phase in radians, moving = legs move, k = 0..1 breath phase, swing = extra upper-body rotation */
  function body(g, im, m, sc, Dd, an, ph, moving, k, swing) {
    const P = ANIM_P[an] || ANIM_P.walk, W = m.w * sc, H = m.h * sc, s = H / 30;
    if (P.fly) {
      const kk = (1 + Math.sin(ph)) / 2, wx = 0.78 + 0.22 * kk, wy = 1.06 - 0.10 * kk;   /* wings hinge around the centre line */
      g.save(); g.translate(0, -H / 2); g.scale(wx, wy); g.translate(0, H / 2); slice(g, im, m, sc, Dd, 0, 0.5, 0, 1); slice(g, im, m, sc, Dd, 0.5, 1, 0, 1); g.restore();
      g.save(); g.translate(0, -H / 2); g.scale(1, 1 + 0.03 * Math.sin(ph)); g.translate(0, H / 2); slice(g, im, m, sc, Dd, 0.34, 0.66, 0, 1); g.restore();
      return 0;
    }
    if (P.ghost) { for (let i = 0; i < 3; i++) { g.save(); g.translate(Math.sin(ph + i * 1.3) * 1.6 * s, 0); slice(g, im, m, sc, Dd, 0, 1, i / 3, (i + 1) / 3); g.restore(); } return 0; }
    const step = Math.abs(Math.sin(ph)), mv = moving ? 1 : 0, bob = step * P.bob * s * mv, sq = P.sq * (1 - step) * mv;
    const sy = 1 - sq, sx = 1 + sq * 0.8, lean = (P.lean || 0) * mv;
    const tilt = (Math.sin(ph) * P.tilt + (P.lurch ? Math.sin(ph * 0.5) * P.lurch : 0)) * mv + lean + (swing || 0);
    const breath = moving ? 0 : 0.015 * Math.sin(k * Math.PI * 2);
    if (P.crawl) { const kk = 1 + 0.12 * Math.sin(ph) * mv; g.save(); g.translate(W / 2, 0); g.scale(kk, 1 - 0.05 * Math.sin(ph) * mv); g.translate(-W / 2, 0); g.drawImage(im, -m.cx * sc, -m.by * sc, Dd, Dd); g.restore(); return 0; }
    const hipY = -H * P.hip, qx = P.quad ? 1 + 0.05 * Math.sin(ph) * mv : 1, A = P.A * mv;
    g.save(); g.translate(0, -bob); g.scale(sx * qx * (1 - breath * 0.6), sy * (1 + breath));
    for (const side of [-1, 1]) { const kk = side * A * Math.sin(ph); g.save(); g.transform(1, 0, kk, 1, -kk * hipY, 0); slice(g, im, m, sc, Dd, side < 0 ? 0 : 0.5, side < 0 ? 0.5 : 1, P.hip - 0.02, 1); g.restore(); }
    g.save(); g.translate(0, hipY); g.rotate(tilt); g.translate(0, -hipY); slice(g, im, m, sc, Dd, 0, 1, 0, P.hip + 0.02); g.restore();
    g.restore();
    return bob;
  }
  /* the placeholder figure (no art yet): the same motion on a drawn body in one colour */
  const ell = (g, x, y, rx, ry) => { g.beginPath(); g.ellipse(x, y, Math.max(0.5, rx), Math.max(0.5, ry), 0, 0, Math.PI * 2); g.fill(); };
  const dot = (g, x, y, r) => ell(g, x, y, r, r);
  const rr = (g, x, y, w, h, r) => { r = Math.min(r, w / 2, h / 2); g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); };
  function bodyPH(g, H, W, an, ph, moving, k, swing, col) {
    const P = ANIM_P[an] || ANIM_P.walk, mv = moving ? 1 : 0, dark = shade(col, -0.4), lt = shade(col, 0.35);
    g.lineCap = 'round'; g.lineJoin = 'round';
    if (P.fly) {
      const kk = (1 + Math.sin(ph)) / 2, wy = -H * 0.55; g.fillStyle = dark;
      for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * W * 0.12, wy); g.lineTo(s * W * 0.5, wy - H * 0.45 * (kk - 0.4)); g.lineTo(s * W * 0.42, wy + H * 0.12); g.closePath(); g.fill(); }
      g.fillStyle = col; ell(g, 0, wy, W * 0.24, H * 0.28); g.fillStyle = '#fff'; dot(g, W * 0.12, wy - H * 0.08, Math.max(1, H * 0.035)); return 0;
    }
    if (P.ghost) {
      g.globalAlpha = 0.85; g.fillStyle = col;
      for (let i = 0; i < 3; i++) { const dx = Math.sin(ph + i * 1.3) * 0.05 * H, y0 = -H * (1 - i / 3) + (i ? 0 : H * 0.08), y1 = -H * (1 - (i + 1) / 3); g.fillRect(dx - W * 0.3, y0, W * 0.6, y1 - y0); }
      g.globalAlpha = 1; g.fillStyle = '#0b1220'; dot(g, -W * 0.08, -H * 0.78, H * 0.03); dot(g, W * 0.1, -H * 0.78, H * 0.03); return 0;
    }
    const step = Math.abs(Math.sin(ph)), bob = step * P.bob * (H / 30) * mv, sq = P.sq * (1 - step) * mv, breath = mv ? 0 : 0.015 * Math.sin(k * Math.PI * 2);
    g.save(); g.translate(0, -bob); g.scale((1 + sq * 0.8) * (1 - breath * 0.6), (1 - sq) * (1 + breath));
    const lw = Math.max(1.5, H * 0.075); g.lineWidth = lw; g.strokeStyle = dark;
    if (P.crawl) { g.fillStyle = col; ell(g, 0, -H * 0.3, W * 0.45 * (1 + 0.1 * Math.sin(ph) * mv), H * 0.28); g.fillStyle = lt; dot(g, W * 0.3, -H * 0.4, H * 0.1); g.restore(); return 0; }
    const leg = P.A * mv * Math.sin(ph) * H * 0.3;
    if (P.quad) {
      for (const [bx, s] of [[-W * 0.3, 1], [W * 0.3, -1]]) { g.beginPath(); g.moveTo(bx, -H * 0.45); g.lineTo(bx + s * leg, 0); g.moveTo(bx + lw, -H * 0.45); g.lineTo(bx + lw - s * leg, 0); g.stroke(); }
      g.fillStyle = col; ell(g, 0, -H * 0.55, W * 0.45, H * 0.25); g.fillStyle = lt; dot(g, W * 0.45, -H * 0.68, H * 0.14); g.fillStyle = '#0b1220'; dot(g, W * 0.5, -H * 0.7, Math.max(1, H * 0.025));
      g.restore(); return bob;
    }
    const hipY = -H * P.hip;
    g.beginPath(); g.moveTo(-lw * 0.3, hipY); g.lineTo(-lw * 0.3 - leg, 0); g.moveTo(lw * 0.3, hipY); g.lineTo(lw * 0.3 + leg, 0); g.stroke();
    const tilt = (Math.sin(ph) * P.tilt + (P.lurch ? Math.sin(ph * 0.5) * P.lurch : 0)) * mv + (P.lean || 0) * mv + (swing || 0);
    g.save(); g.translate(0, hipY); g.rotate(tilt); g.translate(0, -hipY);
    g.fillStyle = col; rr(g, -W * 0.22, -H * 0.86, W * 0.44, hipY + H * 0.86, H * 0.06); g.fill(); g.fillStyle = 'rgba(255,255,255,0.15)'; g.fillRect(-W * 0.22, -H * 0.86, W * 0.14, hipY + H * 0.86);
    g.strokeStyle = dark; g.lineWidth = lw * 0.8; g.beginPath(); g.moveTo(W * 0.12, -H * 0.78); g.lineTo(W * 0.42, -H * 0.62); g.stroke();
    g.strokeStyle = lt; g.lineWidth = lw * 0.55; g.beginPath(); g.moveTo(W * 0.4, -H * 0.6); g.lineTo(W * 0.62, -H * 0.95); g.stroke();
    g.fillStyle = '#d9b48f'; dot(g, 0, -H * 0.93, H * 0.1); g.fillStyle = dark; g.beginPath(); g.arc(0, -H * 0.95, H * 0.1, Math.PI, 0); g.fill(); g.fillStyle = '#0b1220'; dot(g, H * 0.04, -H * 0.92, Math.max(0.8, H * 0.016));
    g.restore(); g.restore();
    return bob;
  }

  /* ---- one base frame: a canvas with the figure at body height pxH, feet at (meta.ax, meta.ay), facing +x ---- */
  function renderFrame(im, m, an, pxH, animName, fi, col, fo) {
    const sc = pxH / m.h, W = m.w * sc, H = pxH, Dd = m.C * sc;
    const mx = Math.ceil(W / 2 + 0.5 * H + 2), top = Math.ceil(1.14 * H + 2), bot = Math.ceil((m.C - m.by) * sc + 0.06 * H + 2);
    const c = document.createElement('canvas'); c.width = 2 * mx; c.height = top + bot;
    const g = c.getContext('2d'); g.translate(mx, top);
    let phase = 0, mode = 'idle', swing = 0, lunge = 0, back = 0;
    if (animName === 'walk' || animName === 'cyc') { phase = (fi + 0.5) / N[animName]; mode = 'move'; }
    else if (animName === 'idle') phase = (fi + 0.5) / N.idle;
    else if (animName === 'attack') { const kk = (fi + 0.5) / N.attack; swing = fo && fo.noSwing ? 0 : kk < 0.3 ? -0.2 * (kk / 0.3) : 0.4 * Math.sin(Math.PI * (kk - 0.3) / 0.7); lunge = Math.sin(Math.PI * kk) * 0.15 * H * (fo && fo.ranged ? -0.4 : 1); mode = 'attack'; }
    else if (animName === 'hurt') back = fi ? 0.06 * H : 0;
    g.translate(lunge - back, 0);
    const ph = phase * Math.PI * 2;
    const lift = im ? body(g, im, m, sc, Dd, an, ph, mode === 'move', phase, swing) : bodyPH(g, H, W, an, ph, mode === 'move', phase, swing, col);
    c.meta = { ax: mx, ay: top, w: W, h: H, sc, lift, face: 1 };
    return c;
  }
  function base(ns, sheet, im, m, an, animName, fi, pxH, tint, tA, col, fo) {
    const k = 'B|' + ns + '|' + sheet + '|' + (im ? 'a' : 'p') + '|' + animName + '|' + fi + '|' + pxH + '|' + (tint ? tint + tA : '') + (fo && fo.noSwing ? '|ns' : '') + (fo && fo.ranged ? '|r' : '');
    let c = cget(k); if (c) return c;
    c = renderFrame(im, m, an, pxH, animName, fi, col, fo);
    if (tint) { const g = c.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-atop'; g.globalAlpha = tA; g.fillStyle = tint; g.fillRect(0, 0, c.width, c.height); }
    return cset(k, c);
  }
  /* which phase of which cycle an entity shows at time t */
  function phaseOf(P, sheet, anim, t, walk, hW) {
    const cyc = P.fly || P.ghost;
    const cycFi = () => { const c = P.fly ? t * (FLAP_HZ[sheet] || 4) : t / 2; return Math.floor((((c % 1) + 1) % 1) * N.cyc) % N.cyc; };
    if (anim === 'die') return { an: cyc ? 'cyc' : 'idle', fi: 0 };
    if (anim === 'hurt') { const fl = t < 0.1; return cyc ? { an: 'cyc', fi: cycFi(), flash: fl } : { an: 'hurt', fi: fl ? 0 : 1, flash: fl }; }
    if (cyc) return { an: 'cyc', fi: cycFi() };
    if (anim === 'attack') return { an: 'attack', fi: Math.min(N.attack - 1, Math.floor(Math.max(0, t) / ATK * N.attack)) };
    if (anim === 'walk') { const ph = walk != null ? walk / (P.stride * hW / 30) : t * 1.9 * 16 / P.stride; return { an: 'walk', fi: Math.floor((((ph % 1) + 1) % 1) * N.walk) % N.walk }; }
    return { an: 'idle', fi: Math.floor((((t / IDLE) % 1) + 1) % 1 * N.idle) % N.idle };
  }
  const deathKindOf = (ns, key, an) => ns !== 'e' ? 'fall' : an === 'glide' || key === 'giant' || key === 'mammoth' ? 'shatter' : an === 'float' ? 'dissolve' : an === 'fly' ? 'drop' : 'fall';
  const blit = (g, fr, r) => g.drawImage(fr, -fr.meta.ax * r, -fr.meta.ay * r, fr.width * r, fr.height * r);
  /* the death, drawn from the base frame around the feet point (already translated there). k 0→1, hover = where a flyer's body was */
  function deathDraw(g, fr, r, kind, k, H, face, hover, px) {
    if (kind === 'fall') { const rot = Math.min(1, k / 0.45); g.globalAlpha *= k < 0.55 ? 1 : 1 - (k - 0.55) / 0.45; g.rotate(-rot * Math.PI / 2 * face); g.scale(face, 1); blit(g, fr, r); }
    else if (kind === 'dissolve') { g.globalAlpha *= 1 - k; g.translate(0, -k * 0.5 * H); g.scale(face * (1 + k * 0.2), 1 - k * 0.3); blit(g, fr, r); }
    else if (kind === 'drop') { g.globalAlpha *= 1 - k * k; g.translate(0, -hover + k * k * (hover + 0.2 * H) - H * 0.5); g.rotate(k * 1.6 * face); g.scale(face, 1); g.translate(0, H * 0.5); blit(g, fr, r); }
    else { const a0 = g.globalAlpha, gg = 1 + k * 0.35; g.save(); g.globalAlpha = a0 * (1 - k); g.scale(face * gg, gg); blit(g, fr, r); g.restore();
      g.globalAlpha = a0 * (1 - k) * 0.9; g.fillStyle = '#e6f6ff'; const rad = 0.2 * H + k * 1.3 * H;
      for (let i = 0; i < 7; i++) { const a = i * 0.9 + (px || 0) * 0.01; g.beginPath(); g.arc(Math.cos(a) * rad, -H * 0.5 + Math.sin(a) * rad * 0.6, Math.max(1, 0.07 * H), 0, Math.PI * 2); g.fill(); } }
  }

  /* ---- 2D: draw an entity in world space ---- */
  function shadowPx(g, x, y, rx, ry, a) { g.save(); g.globalAlpha *= a; g.fillStyle = '#000'; ell(g, x, y, rx, ry); g.restore(); }
  function draw2d(ns, key, sheet, im, m, an, hDef, x, y, o, col) {
    o = o || {}; const g = o.ctx || R.ctx; if (!g) return false;
    const scr = !!o.screen, z = scr ? (o.z || 1) : (R.cam.z || 1), dpr = o.ctx ? (o.dpr || 1) : (R.dpr || 1);
    const p = scr ? { x, y } : R.w2s(x, y); if (!p) return false;
    const hW = o.scale || hDef, hpx = hW * z; if (hpx < 2) return false;
    if (!scr) { const mg = hpx * 1.6; if (p.x < -mg || p.x > R.vw + mg || p.y < -mg || p.y > R.vh + mg) return false; }
    const anim = o.anim || 'idle', t = o.t || 0, face = o.face < 0 ? -1 : 1, seed = o.seed || 0;
    const P = ANIM_P[an] || ANIM_P.walk, fly = !!P.fly, ghost = !!P.ghost;
    const qh = Math.max(8, Math.round(hpx * dpr / 8) * 8), r = hpx / qh;             /* frame px → css px */
    const ph = phaseOf(P, sheet, anim, t, o.walk, hW);
    let tint = o.tint || null, tA = o.tintA == null ? 0.45 : o.tintA; if (ph.flash) { tint = '#ffffff'; tA = 0.4; }
    const fr = base(ns, sheet, im, m, an, ph.an, ph.fi, qh, tint, tA, col, o.fo);
    const hover = fly ? hpx * 0.5 + Math.sin(t * 4 + seed) * 0.05 * hpx : ghost ? Math.sin(t * 2.5 + seed) * 0.06 * hpx : 0;
    let alpha = o.alpha == null ? 1 : o.alpha; if (ghost) alpha *= 0.82 + 0.18 * Math.sin(t * 3.1 + seed);
    let dk = null, k = 0;
    if (anim === 'die') { dk = o.death || deathKindOf(ns, key, an); k = t / (DMAX[dk] || 0.75); if (k >= 1) return false; }
    g.save();
    if (o.shadow) { const W = fr.meta.w * r, lift = fr.meta.lift * r, s = fly ? 0.6 : ghost ? 0.5 : 1; shadowPx(g, p.x, p.y + 1, Math.max(2, W * 0.42 * s * (1 - lift / hpx)), Math.max(1, W * 0.15 * s), 0.35 * s * (dk ? 1 - k : 1) * (o.alpha == null ? 1 : o.alpha)); }
    g.globalAlpha *= alpha;
    if (dk) { g.translate(p.x, p.y + 1); deathDraw(g, fr, r, dk, k, hpx, face, fly ? hpx * 0.5 : 0, p.x); }
    else {
      const lunge = anim === 'attack' && (fly || ghost) ? Math.sin(Math.PI * Math.min(1, t / ATK)) * 0.15 * hpx : 0;
      g.translate(p.x + lunge * face, p.y + 1 - hover); if (o.rot) g.rotate(o.rot); g.scale(face * (o.sx || 1), o.sy || 1); blit(g, fr, r);
    }
    g.restore(); return true;
  }
  D.sprite = (key0, x, y, o) => { const key = resolve(key0), cf = cfgOf(key), im = enemyImg(key); return draw2d('e', key, key, im, im ? metaOf(key) : PMETA, cf.an, cf.h * BIG, x, y, o, colFor(key)); };
  const champSheet = (id, anim) => anim === 'attack' && champImg(id + '_attack') ? id + '_attack' : id;
  D.champ = (id, x, y, o) => { o = o || {}; const sheet = champSheet(id, o.anim), im = champImg(sheet); const fo = sheet !== id ? Object.assign({ noSwing: true }, o.fo) : o.fo; return draw2d('c', id, sheet, im, im ? cmetaOf(sheet) : PMETA, 'walk', CHAMP_H * BIG, x, y, Object.assign({}, o, { fo }), colFor(id)); };
  D.hero = (x, y, o) => { const id = R.state && R.state.p && R.state.p.hero; if (id) return D.champ(id, x, y, o); if (R.heroArt && R.heroArt.draw) { /* A37's signature is (ctx, sx, sy, o) in screen px */ const g = (o && o.ctx) || R.ctx; let sx = x, sy = y; if (!(o && o.screen)) { const p = R.w2s(x, y, (o && o.z) || 0); sx = p.x; sy = p.y; } return R.heroArt.draw(g, sx, sy, o); } return draw2d('h', 'hero', 'hero', null, PMETA, 'walk', CHAMP_H * BIG, x, y, o, (o && o.col) || houseCol()); };

  /* ---- 3D: one frame as a canvas (billboard texture) ---- */
  function frameX(ns, key, sheet, im, m, an, anim, t, face, o, col) {
    o = o || {}; const sc = o.scale || 1, pxH = Math.max(4, Math.round(m.h * sc)); face = face < 0 ? -1 : 1;
    const P = ANIM_P[an] || ANIM_P.walk, cyc = !!(P.fly || P.ghost);
    let tint = o.tint || null, tA = o.tintA == null ? 0.45 : o.tintA, ph, dk = null, dfi = 0;
    if (anim === 'die') { dk = o.death || deathKindOf(ns, key, an); dfi = Math.min(N.die - 1, Math.floor(Math.max(0, t) / (DMAX[dk] || 0.75) * N.die)); ph = { an: cyc ? 'cyc' : 'idle', fi: 0 }; }
    else { ph = phaseOf(P, sheet, anim, t, o.walk, m.h * BIG); if (ph.flash) { tint = '#ffffff'; tA = 0.4; } }
    const k2 = 'F|' + ns + '|' + sheet + '|' + (im ? 'a' : 'p') + '|' + (dk ? 'die.' + dk : ph.an) + '|' + (dk ? dfi : ph.fi) + '|' + face + '|' + pxH + '|' + (tint ? tint + tA : '') + (o.fo && o.fo.noSwing ? '|ns' : '');
    if (o.keyOnly) return k2;
    let c = cget(k2); if (c) return c;
    const b = base(ns, sheet, im, m, an, ph.an, ph.fi, pxH, tint, tA, col, o.fo);
    if (!dk && face > 0) c = b;
    else if (!dk) { c = document.createElement('canvas'); c.width = b.width; c.height = b.height; const g = c.getContext('2d'); g.translate(b.width, 0); g.scale(-1, 1); g.drawImage(b, 0, 0); c.meta = Object.assign({}, b.meta, { ax: b.width - b.meta.ax, face: -1 }); }
    else {
      const H = pxH, W = b.meta.w, ax = Math.ceil(1.25 * Math.max(H, W)), ay = Math.ceil(1.2 * H + 2);
      c = document.createElement('canvas'); c.width = 2 * ax; c.height = ay + Math.ceil(0.5 * H + 4); const g = c.getContext('2d'); g.translate(ax, ay);
      deathDraw(g, b, 1, dk, (dfi + 0.5) / N.die, H, face, 0, 0);
      c.meta = Object.assign({}, b.meta, { ax, ay, face, death: dk, k: (dfi + 0.5) / N.die });
    }
    return cset(k2, c);
  }
  D.frame = (key0, anim, t, face, o) => { const key = resolve(key0), cf = cfgOf(key), im = enemyImg(key); return frameX('e', key, key, im, im ? metaOf(key) : PMETA, cf.an, anim || 'idle', t || 0, face, o, colFor(key)); };
  D.frameKey = (key, anim, t, face, o) => D.frame(key, anim, t, face, Object.assign({}, o, { keyOnly: true }));
  D.champFrame = (id, anim, t, face, o) => { o = o || {}; const sheet = champSheet(id, anim), im = champImg(sheet); const fo = sheet !== id ? Object.assign({ noSwing: true }, o.fo) : o.fo; return frameX('c', id, sheet, im, im ? cmetaOf(sheet) : PMETA, 'walk', anim || 'idle', t || 0, face, Object.assign({}, o, { fo }), colFor(id)); };
  D.champFrameKey = (id, anim, t, face, o) => D.champFrame(id, anim, t, face, Object.assign({}, o, { keyOnly: true }));
  D.heroFrame = (anim, t, face, o) => { const id = R.state && R.state.p && R.state.p.hero; if (id) return D.champFrame(id, anim, t, face, o); return frameX('h', 'hero', 'hero', null, PMETA, 'walk', anim || 'idle', t || 0, face, o, (o && o.col) || houseCol()); };
  D.heroFrameKey = (anim, t, face, o) => D.heroFrame(anim, t, face, Object.assign({}, o, { keyOnly: true }));

  /* ---- sizes, deaths, keys, readiness ---- */
  D.measure = key0 => { const key = resolve(key0), m = metaOf(key), c = cfgOf(key), h = c.h * BIG; return { w: m.w / m.h * h, h, fly: c.an === 'fly', float: c.an === 'float', an: c.an }; };
  D.champMeasure = id => { const m = champImg(id) ? cmetaOf(id) : PMETA, h = CHAMP_H * BIG; return { w: m.w / m.h * h, h, fly: false, an: 'walk' }; };
  D.deathKind = key0 => { const key = resolve(key0); return deathKindOf('e', key, cfgOf(key).an); };
  D.deathTime = key0 => DMAX[D.deathKind(key0)];
  D.champDeathTime = () => DMAX.fall;
  D.keys = () => { const s = new Set(Object.keys(CFG0)), a = AE(); if (a) { for (const k in (a.cfg || {})) s.add(k); for (const k in (a.art || {})) s.add(k); } return [...s]; };
  D.champIds = () => { const a = AC(), s = new Set(); if (a) for (const k of Object.keys(a.meta || {}).concat(Object.keys(a.art || {}))) if (!/_attack$|_portrait$/.test(k)) s.add(k); if (R.data && R.data.champs) for (const k in R.data.champs) s.add(k); return [...s]; };
  D.hasArt = key => !!enemyImg(resolve(key)); D.hasChampArt = id => !!champImg(id);
  D.cfg = key => cfgOf(resolve(key)); D.meta = key => metaOf(resolve(key));
  D.ready = () => {
    if (R.assets && R.assets.ready) return Promise.resolve(R.assets.ready).then(() => true, () => true);
    const ps = [], wait = im => new Promise(res => { if (im.complete) return res(); im.onload = im.onerror = () => res(); });
    const a = AE(), c = AC();
    if (a && a.art) for (const k in a.art) ps.push(wait(IMG['e:' + k] || (IMG['e:' + k] = mk(a.art[k]))));
    if (c && c.art) for (const k in c.art) ps.push(wait(IMG['c:' + k] || (IMG['c:' + k] = mk(c.art[k]))));
    return Promise.race([Promise.all(ps), new Promise(r => setTimeout(r, 4000))]).then(() => true);
  };
  /* pre-render the idle + walk frames of a sprite at the current zoom (call at spawn to avoid a first-frame hitch) */
  D.warm = (key0, scale) => { const key = resolve(key0), cf = cfgOf(key), im = enemyImg(key), m = im ? metaOf(key) : PMETA, P = ANIM_P[cf.an] || ANIM_P.walk; const qh = Math.max(8, Math.round((scale || cf.h * BIG) * (R.cam.z || 1) * (R.dpr || 1) / 8) * 8);
    if (P.fly || P.ghost) { for (let i = 0; i < N.cyc; i++) base('e', key, im, m, cf.an, 'cyc', i, qh, null, 0, colFor(key)); return; }
    for (let i = 0; i < N.walk; i++) base('e', key, im, m, cf.an, 'walk', i, qh, null, 0, colFor(key)); for (let i = 0; i < N.idle; i++) base('e', key, im, m, cf.an, 'idle', i, qh, null, 0, colFor(key)); };

  /* ---- portraits ---- */
  const PORT = {};
  D.portrait = (id, size) => {
    size = size || 64; const k = id + ':' + size; if (PORT[k]) return PORT[k];
    const dpr = R.dpr || 1, c = document.createElement('canvas'); c.width = c.height = Math.round(size * dpr); c.style.width = c.style.height = size + 'px';
    const g = c.getContext('2d'), im = champImg(id + '_portrait');
    if (im) g.drawImage(im, 0, 0, c.width, c.height);
    else { const col = colFor(id); g.fillStyle = shade(col, -0.55); g.fillRect(0, 0, c.width, c.height); g.fillStyle = col; dot(g, c.width / 2, c.height * 0.56, c.width * 0.34); g.fillStyle = '#f3e7c4'; g.font = '800 ' + Math.round(c.width * 0.42) + 'px Cinzel,Georgia,serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText((id || '?')[0].toUpperCase(), c.width / 2, c.height * 0.58); }
    const a = AC(), pending = !im && a && a.art && a.art[id + '_portrait'];     /* the real one is still decoding: do not cache the stand-in */
    if (!pending) PORT[k] = c; return c;
  };
  D.portraitURL = id => { const a = AC(); return (a && a.art && a.art[id + '_portrait']) || D.portrait(id, 96).toDataURL(); };

  /* ---- small world-space helpers ---- */
  const at = (x, y, o) => { o = o || {}; const scr = !!o.screen; return { g: o.ctx || R.ctx, z: scr ? (o.z || 1) : (R.cam.z || 1), p: scr ? { x, y } : R.w2s(x, y) }; };
  D.shadow = (x, y, rx, ry, o) => { const { g, z, p } = at(x, y, o); if (!g || !p) return; shadowPx(g, p.x, p.y, Math.max(1, rx * z), Math.max(1, ry * z), o && o.alpha != null ? o.alpha : 0.35); };
  D.bar = (x, y, w, h, frac, col, o) => { const { g, z, p } = at(x, y, o); if (!g || !p) return; const W = Math.max(6, w * z), H = Math.max(2, h * z), f = Math.max(0, Math.min(1, frac || 0));
    g.save(); g.fillStyle = 'rgba(0,0,0,0.55)'; rr(g, p.x - W / 2, p.y - H / 2, W, H, H / 2); g.fill();
    if (f > 0) { g.fillStyle = col || '#7fd06a'; rr(g, p.x - W / 2 + 1, p.y - H / 2 + 1, Math.max(0.5, (W - 2) * f), H - 2, (H - 2) / 2); g.fill(); }
    g.strokeStyle = 'rgba(255,255,255,0.25)'; g.lineWidth = 1; rr(g, p.x - W / 2, p.y - H / 2, W, H, H / 2); g.stroke(); g.restore(); };
  D.name = (x, y, text, col, o) => { const { g, z, p } = at(x, y, o); if (!g || !p || !text) return; const fs = Math.max(10, Math.min(15, Math.round(11 * z)));
    g.save(); g.font = '800 ' + fs + 'px Cinzel,Georgia,serif'; g.textAlign = 'center'; g.textBaseline = 'bottom'; g.lineJoin = 'round'; g.lineWidth = 3; g.strokeStyle = 'rgba(6,11,20,0.85)'; g.strokeText(text, p.x, p.y); g.fillStyle = col || '#e9eef5'; g.fillText(text, p.x, p.y); g.restore(); };
  /* painter's order: ground things first, then by y (feet), flyers last */
  D.zkey = e => (e.kind === 'drop' || e.kind === 'portal' || e.ground ? -1e7 : 0) + (e.y || 0) + (e.fly || (e.type && cfgOf(e.type).an === 'fly') ? 1e7 : 0);
  D.zsort = ents => ents.sort((a, b) => (D.zkey(a) - D.zkey(b)) || ((a.id || 0) - (b.id || 0)));
})();
