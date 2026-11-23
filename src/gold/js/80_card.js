/* Heavy Gold — share card (80_card.js), wave 5 of src/gold/GOLD.md.
   - The round: the biggest take of a 'rob' where the thief is G.S.me (the victim's name, whether he is a bot, the take).
   - On 'end': a 1080×1920 story card on an offscreen canvas: the arena's stone ground, the god's circle with his sign (G.sym),
     the player's name, his flag, "#rank of N", the banked gold big in gold over a drawn vault (🏦), the best robbery
     ("Robbed Odin (bot) +45", nothing when there was none), "Map #N · <the day god's rule>", t.me/HoldorTDBot/play. The 📤 "Share" icon button (.ib)
     takes the core's 📤 "Invite" slot in #endLinks: it replaces #share and takes its id (the card screen's Send / Copy do that
     button's job, with the card's URL).
   - A round with 0 banked and no robbery makes no card: the core's 📤 Invite stays in its slot.
   - "Share" opens the card screen (the card big, one primary action, the rest as icon buttons with one word, a status line of
     at most 4 words; the owner, 2026-11-23: "too much text"):
       in Telegram the PNG goes up once per card with hg_card_put(token, base64), 30 s for the call (at most G.card.limit bytes; a plainer card
       without the stone texture is tried when the first one is too big), then TG.shareToStory(url, {text, widget_link}) where
       stories exist (Bot API 7.8+, not on desktop): STORY; "Send" opens t.me/share/url with the card's URL in the text;
       outside Telegram, or when the upload fails: "Save" (TG.downloadFile when the card has a URL and Telegram is 8.0+,
       otherwise an <a download> of the PNG) and "Copy".
   - Only the player's own round and profile are drawn; bots are labelled as bots; no Telegram id is read. Text reaches the DOM
     through textContent only, the card through fillText.
   - G.card = { last: {lines, w, h, lite, sig} | null, canvas, best(), data(), render(), png(), share(), open(), close(), story(),
     chat(), chatLink(), save(), copy(), storyOK(), state, err, url, limit, stats } */
(function () {
  const G = window.G; if (!G || !G.on) return;
  const W = 1080, H = 1920, GAME = 'https://t.me/HoldorTDBot/play', GAME_T = 't.me/HoldorTDBot/play', TAU = Math.PI * 2;
  const SERIF = 'Georgia,"Times New Roman",serif', INK = '#f3e7c4', MUTED = '#9aa7ba', GOLD = '#e8b84a';
  const num = v => { const n = Number(v); return isFinite(n) ? Math.round(n) : 0; };
  const fmt = v => num(v).toLocaleString('en-US');
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const inTG = () => { try { const T = G.TG; return !!(T && typeof T.initData === 'string' && T.initData.length); } catch (e) { return false; } };
  const ver = v => { try { const T = G.TG; return !T || typeof T.isVersionAtLeast !== 'function' || !!T.isVersionAtLeast(v); } catch (e) { return false; } };
  /* stories: Bot API 7.8+, phones only (Telegram Desktop, macOS and the web clients cannot post a story) */
  const storyOK = () => { if (!inTG()) return false; const T = G.TG; if (typeof T.shareToStory !== 'function' || !ver('7.8')) return false;
    return !/^(tdesktop|macos|web|weba|webk|unigram)$/i.test(String(T.platform || '')); };

  /* ---------- the round ---------- */
  let best = null, data = null, card = null, P = null, up = null, blobUrl = '', st = 'idle', err = '', busy = false, busyMsg = '', seq = 0, lastRes = null;
  const stats = { renders: 0, puts: 0, stories: 0, chats: 0, saves: [], copies: 0 };
  G.on('start', () => { seq++; best = null; data = null; card = null; P = null; up = null; st = 'idle'; err = ''; lastRes = null; close(); dropImg(); publish(); });
  G.on('rob', (thief, victim, take) => {
    const S = G.S; if (!S || !thief || thief !== S.me || !victim) return;
    const t = num(take); if (t > 0 && (!best || t > best.take)) best = { name: String(victim.name == null ? '' : victim.name), bot: !!victim.bot, take: t };
  });
  function snap(S, res) {
    res = res && typeof res === 'object' ? res : {};
    const me = S && S.me, ps = S && Array.isArray(S.ps) ? S.ps : [];
    const others = ps.filter(p => p && p !== me), bots = others.filter(p => p.bot).length;
    const pr = G.profile || {}, cc = /^[A-Z]{2}$/.test(String(pr.country || '')) ? String(pr.country) : '';
    const GD = G.GODS || {}, god = GD[res.god] ? res.god : (me && GD[me.god] ? me.god : Object.keys(GD)[0]);
    let rule = '', rcol = '';
    try { const D = G.dayGod, k = D && D.active; const d = k && k !== 'none' && Array.isArray(D.all) ? D.all.find(x => x && x.key === k) : null; if (d && d.rule) { rule = String(d.rule); rcol = String(d.col || ''); } } catch (e) {}
    let flag = '', cname = '';
    try { if (cc && typeof G.flag === 'function') flag = G.flag(cc) || ''; if (cc && typeof G.countryName === 'function') cname = G.countryName(cc) || ''; } catch (e) {}
    return { name: String(pr.name || '').replace(/\s+/g, ' ').trim(), country: cc, flag, cname, crown: pr.crown === true,
      god, gname: GD[god] ? GD[god].n : '', gcol: GD[god] ? GD[god].c : GOLD, rank: num(res.rank), of: num(res.of) || ps.length, bots, real: others.length - bots,
      bank: Math.max(0, num(res.bank)), map: num(res.map) || num(G.mapNo) || 1, rule, rcol, best: best ? Object.assign({}, best) : null };
  }
  const robName = b => b.name + (b.bot ? ' (bot)' : '');

  /* ---------- drawing ---------- */
  const font = (w, s, it) => (it ? 'italic ' : '') + w + ' ' + s + 'px ' + SERIF;
  const rr = (c, x, y, w, h, r) => { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); };
  /* the largest font (down to min) that fits maxW, then an ellipsis if it still does not */
  function fit(c, s, wt, size, min, maxW, it) {
    let z = size; c.font = font(wt, z, it);
    while (z > min && c.measureText(s).width > maxW) { z -= 2; c.font = font(wt, z, it); }
    if (c.measureText(s).width <= maxW) return s;
    const cp = [...s]; while (cp.length > 1 && c.measureText(cp.join('') + '…').width > maxW) cp.pop();
    return cp.join('') + '…';
  }
  /* letter-spaced capitals, centred on x (canvas letterSpacing is not everywhere yet) */
  function spaced(c, s, x, y, sp) {
    const ch = [...s], ws = ch.map(k => c.measureText(k).width), tw = ws.reduce((a, b) => a + b, 0) + sp * (ch.length - 1);
    const al = c.textAlign; c.textAlign = 'left'; let cx = x - tw / 2; ch.forEach((k, i) => { c.fillText(k, cx, y); cx += ws[i] + sp; }); c.textAlign = al;
  }
  /* one centred line in several colours: parts = [[text, colour], ...] in the current font */
  function runs(c, parts, x, y) {
    const ws = parts.map(p => c.measureText(p[0]).width), tw = ws.reduce((a, b) => a + b, 0);
    const al = c.textAlign; c.textAlign = 'left'; let cx = x - tw / 2; parts.forEach((p, i) => { c.fillStyle = p[1]; c.fillText(p[0], cx, y); cx += ws[i]; }); c.textAlign = al;
  }
  /* the arena's ground, as in the game: pebbles and cracks from a hash of each tile */
  function stone(c, seed) {
    const T = 240;
    for (let ix = 0; ix < Math.ceil(W / T); ix++) for (let iy = 0; iy < Math.ceil(H / T); iy++) {
      let h = (ix * 73856093) ^ (iy * 19349663) ^ Math.imul(seed | 0, 83492791);
      const hr = () => { h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
      for (let n = 0; n < 6; n++) { const px = ix * T + hr() * T, py = iy * T + hr() * T, pr = 5 + hr() * 16; c.fillStyle = hr() < 0.5 ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.28)'; c.beginPath(); c.ellipse(px, py, pr * 1.4, pr, hr() * 3, 0, TAU); c.fill(); }
      if (hr() < 0.45) { c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 3; c.beginPath(); let x = ix * T + hr() * T, y = iy * T + hr() * T; c.moveTo(x, y);
        for (let m = 0; m < 4; m++) { x += (hr() - 0.5) * 120; y += (hr() - 0.5) * 120; c.lineTo(x, y); } c.stroke(); }
    }
  }
  const COINS = [[168, 1196, 30], [912, 1262, 26], [226, 1352, 17], [872, 1150, 15], [128, 1290, 12], [958, 1366, 12]];
  function coin(c, x, y, r) {
    c.fillStyle = GOLD; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); c.strokeStyle = '#8a6420'; c.lineWidth = Math.max(2, r * 0.12); c.stroke();
    c.strokeStyle = 'rgba(255,240,190,.5)'; c.lineWidth = Math.max(1.5, r * 0.08); c.beginPath(); c.arc(x, y, r * 0.66, 0, TAU); c.stroke();
  }
  /* glows in flat steps, never canvas gradients or shadow blur: Chromium dithers gradients, and dither noise (or the hundred
     contour lines of a smooth ramp) is what a PNG packs worst: 1.8 MB with gradients, a few hundred KB like this.
     A glow: n rings, each a little smaller and as transparent as the total alpha / n; the vignette is the same from outside in. */
  function halo(c, x, y, r0, r1, rgb, a, n) { c.fillStyle = 'rgba(' + rgb + ',' + (a / n).toFixed(4) + ')'; for (let i = 0; i < n; i++) { c.beginPath(); c.arc(x, y, r1 - (r1 - r0) * i / n, 0, TAU); c.fill(); } }
  function vignette(c, x, y, r0, r1, rgb, a, n) { c.fillStyle = 'rgba(' + rgb + ',' + (a / n).toFixed(4) + ')'; for (let i = 0; i < n; i++) { c.beginPath(); c.rect(0, 0, W, H); c.arc(x, y, r1 - (r1 - r0) * i / n, 0, TAU, true); c.fill('evenodd'); } }
  const rgbOf = h => { const m = /^#?([0-9a-f]{6})$/i.exec(String(h || '')); const n = m ? parseInt(m[1], 16) : 0xe8b84a; return (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255); };
  function crown(c, x, y, w, h) {   // the base centred at (x, y)
    c.save(); c.fillStyle = GOLD; c.strokeStyle = '#4a3208'; c.lineWidth = 5; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(x - w / 2, y); c.lineTo(x - w / 2, y - h * 0.62); c.lineTo(x - w / 4, y - h * 0.3); c.lineTo(x, y - h); c.lineTo(x + w / 4, y - h * 0.3); c.lineTo(x + w / 2, y - h * 0.62); c.lineTo(x + w / 2, y); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#ee6a4c'; for (const [dx, dy] of [[-w / 2, -h * 0.62], [0, -h], [w / 2, -h * 0.62]]) { c.beginPath(); c.arc(x + dx, y + dy, h * 0.11, 0, TAU); c.fill(); }
    c.restore();
  }
  /* the vault, drawn (the 🏦 of the HUD; an emoji glyph is not in every canvas font): a pediment, three columns, a step; base at y */
  function vault(c, x, y, s) {
    c.save(); c.fillStyle = '#cfd6e2'; const w = s, h = s * 0.8, top = y - h;
    c.beginPath(); c.moveTo(x - w / 2, top + h * 0.3); c.lineTo(x, top); c.lineTo(x + w / 2, top + h * 0.3); c.closePath(); c.fill();
    const cw = w * 0.14; for (const k of [-1, 0, 1]) c.fillRect(x + k * w * 0.32 - cw / 2, top + h * 0.38, cw, h * 0.44);
    c.fillRect(x - w / 2, y - h * 0.12, w, h * 0.12); c.restore();
  }
  function draw(d, lite) {
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const c = cv.getContext('2d'), lines = [], M = 28, CX = W / 2, MAXW = W - 2 * M - 120;
    stats.renders++;
    // the ground, a vignette, a gold frame
    c.fillStyle = '#070c16'; c.fillRect(0, 0, W, H);
    rr(c, M, M, W - 2 * M, H - 2 * M, 44); c.fillStyle = '#141a22'; c.fill();
    if (!lite) { c.save(); rr(c, M, M, W - 2 * M, H - 2 * M, 44); c.clip(); stone(c, d.map); c.restore(); }
    vignette(c, CX, H * 0.48, 820, 1240, '4,7,14', 0.66, 4);
    halo(c, CX, 490, 150, 290, rgbOf(d.gcol), 0.42, 8);
    halo(c, CX, 1262, 160, 390, '232,184,74', 0.15, 4);
    for (const [x, y, r] of COINS) halo(c, x, y, r, r * 2.3, '255,214,110', 0.36, 3);
    c.lineWidth = 5; c.strokeStyle = 'rgba(232,184,74,.6)'; rr(c, M, M, W - 2 * M, H - 2 * M, 44); c.stroke();
    c.lineWidth = 2; c.strokeStyle = 'rgba(232,184,74,.2)'; rr(c, M + 18, M + 18, W - 2 * M - 36, H - 2 * M - 36, 30); c.stroke();
    c.textAlign = 'center'; c.textBaseline = 'alphabetic';
    // the title
    c.font = font(900, 76); c.fillStyle = GOLD; spaced(c, 'HEAVY GOLD', CX, 214, 12); lines.push('HEAVY GOLD');
    if (d.crown) { const tag = 'CHAMPION'; c.font = font(800, 32); c.fillStyle = GOLD; spaced(c, tag, CX, 270, 8); lines.push(tag); }
    // the god's circle with his sign
    const gx = CX, gy = 490, gr = 150;
    c.lineWidth = 4; c.strokeStyle = 'rgba(232,184,74,.75)'; c.beginPath(); c.arc(gx, gy, gr + 16, 0, TAU); c.stroke();
    c.fillStyle = d.gcol; c.beginPath(); c.arc(gx, gy, gr, 0, TAU); c.fill(); c.lineWidth = 9; c.strokeStyle = '#ffffff'; c.stroke();
    try { if (typeof G.sym === 'function') G.sym(c, d.god, gx, gy, gr * 0.78); } catch (e) {}
    if (d.crown) crown(c, gx, gy - gr + 26, 190, 92);
    c.textAlign = 'center';
    if (d.gname) { const s = d.gname.toUpperCase(); c.font = font(800, 40); c.fillStyle = d.gcol; spaced(c, s, CX, 724, 10); lines.push(s); }
    // the player
    if (d.name) { const s = fit(c, d.name, 800, 86, 54, MAXW); c.fillStyle = INK; c.fillText(s, CX, 832); lines.push(s); }
    if (d.country) { const s = fit(c, d.flag || d.cname || d.country, 400, d.flag ? 64 : 46, 30, MAXW); c.fillStyle = '#cfd6e2'; c.fillText(s, CX, 912); lines.push(s); }
    // the rank
    if (d.rank > 0 && d.of > 0) { const s = '#' + d.rank + ' of ' + d.of; c.font = font(900, 124); c.fillStyle = d.rank === 1 ? GOLD : INK; c.fillText(s, CX, 1036); lines.push(s); }
    // the banked gold, big
    for (const [x, y, r] of COINS) coin(c, x, y, r);
    { const s = fmt(d.bank), t = fit(c, s, 900, 250, 120, W - 2 * M - 300);
      c.lineWidth = 22; c.lineJoin = 'round'; c.strokeStyle = 'rgba(232,184,74,.14)'; c.strokeText(t, CX, 1336);   // a flat halo round the digits
      c.lineWidth = 9; c.strokeStyle = '#2a1d06'; c.strokeText(t, CX, 1336);
      c.fillStyle = '#c8922e'; c.fillText(t, CX, 1336);                                                          // two flat tones: struck gold
      c.save(); c.beginPath(); c.rect(0, 0, W, 1262); c.clip(); c.fillStyle = '#f4cf6a'; c.fillText(t, CX, 1336); c.restore(); lines.push(t);
      vault(c, CX, 1430, 74); lines.push('🏦'); }
    // the best robbery
    if (d.best && d.best.take > 0) {
      const tail = ' +' + fmt(d.best.take); let nm = robName(d.best); c.font = font(700, 52);
      const wOf = n => c.measureText('Robbed ' + n + tail).width;
      if (wOf(nm) > MAXW) { const cp = [...d.best.name], bt = d.best.bot ? ' (bot)' : ''; while (cp.length > 1 && wOf(cp.join('') + '…' + bt) > MAXW) cp.pop(); nm = cp.join('') + '…' + bt; }
      runs(c, [['Robbed ', '#cfd6e2'], [nm, INK], [tail, '#ffd36a']], CX, 1506); lines.push('Robbed ' + nm + tail);
    }   // no robbery: nothing drawn
    // the map of the day and the day god's rule
    { const a = 'Map #' + d.map, b = d.rule ? ' · ' + d.rule : ''; c.font = font(700, 42); runs(c, [[a, '#cfd6e2'], [b, d.rcol || INK]], CX, 1578); lines.push(a + b); }
    // where to play
    c.font = font(700, 52); c.fillStyle = INK; c.fillText(GAME_T, CX, 1730); lines.push(GAME_T);
    return { cv, lines, lite: !!lite };
  }
  /* the card for the current round, drawn again only when its data changed (a profile that synced late, a later robbery) */
  function ensure() {
    if (!data) return null;
    if (G.S && G.S.over) data = snap(G.S, lastRes);
    const sig = JSON.stringify(data);
    if (!card || card.sig !== sig) { card = draw(data, false); card.sig = sig; P = null; publish(); }
    return card;
  }
  const publish = () => { G.card.last = card ? { lines: card.lines.slice(), w: card.cv.width, h: card.cv.height, lite: card.lite, sig: card.sig } : null; G.card.canvas = card ? card.cv : null; };

  /* ---------- the PNG ---------- */
  const limit = () => { const n = Number(G.card && G.card.limit); return isFinite(n) && n > 0 ? n : 409600; };
  const blobOf = cv => new Promise(res => {
    try { if (cv.toBlob) { cv.toBlob(b => res(b || null), 'image/png'); return; }
      const u = cv.toDataURL('image/png'), bin = atob(u.slice(u.indexOf(',') + 1)), a = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i); res(new Blob([a], { type: 'image/png' })); }
    catch (e) { res(null); } });
  /* our own PNG encoder: RGB (no alpha), each row filtered Up or Paeth (whichever is smaller), deflated by the browser's
     CompressionStream — about half of what canvas.toBlob gives in Chromium, whose encoder favours speed over size.
     Without CompressionStream (an old WebView) canvas.toBlob is used. */
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc = (buf, a, b) => { let c = 0xffffffff; for (let i = a; i < b; i++) c = CRC[(c ^ buf[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  async function pngOf(cv) {
    if (typeof CompressionStream !== 'function' || typeof Response !== 'function' || typeof Blob !== 'function') return null;
    const w = cv.width, h = cv.height, px = cv.getContext('2d').getImageData(0, 0, w, h).data, rl = w * 3;
    const raw = new Uint8Array(h * (rl + 1)), prev = new Uint8Array(rl), cur = new Uint8Array(rl), fu = new Uint8Array(rl), fp = new Uint8Array(rl);
    for (let y = 0; y < h; y++) {
      for (let x = 0, i = y * w * 4, j = 0; x < w; x++, i += 4, j += 3) { cur[j] = px[i]; cur[j + 1] = px[i + 1]; cur[j + 2] = px[i + 2]; }
      let su = 0, sp = 0;
      for (let k = 0; k < rl; k++) {
        const a = k >= 3 ? cur[k - 3] : 0, u = prev[k], c = k >= 3 ? prev[k - 3] : 0;
        const vu = (cur[k] - u) & 255; fu[k] = vu; su += vu < 128 ? vu : 256 - vu;
        const q = a + u - c, da = q > a ? q - a : a - q, db = q > u ? q - u : u - q, dc = q > c ? q - c : c - q, pr = da <= db && da <= dc ? a : db <= dc ? u : c;
        const vp = (cur[k] - pr) & 255; fp[k] = vp; sp += vp < 128 ? vp : 256 - vp;
      }
      const o = y * (rl + 1); if (sp < su) { raw[o] = 4; raw.set(fp, o + 1); } else { raw[o] = 2; raw.set(fu, o + 1); }
      prev.set(cur);
      if ((y & 255) === 255) await new Promise(r => setTimeout(r, 0));   // a frame between the slices on a slow phone
    }
    const z = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer());
    const out = new Uint8Array(8 + 25 + 12 + z.length + 12); let p = 0;
    const u32 = v => { out[p++] = v >>> 24 & 255; out[p++] = v >>> 16 & 255; out[p++] = v >>> 8 & 255; out[p++] = v & 255; };
    const chunk = (type, data) => { u32(data.length); const s0 = p; for (let i = 0; i < 4; i++) out[p++] = type.charCodeAt(i); out.set(data, p); p += data.length; u32(crc(out, s0, p)); };
    out.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0); p = 8;
    const ih = new Uint8Array(13), dv = new DataView(ih.buffer); dv.setUint32(0, w); dv.setUint32(4, h); ih[8] = 8; ih[9] = 2;   // 8 bits, RGB
    chunk('IHDR', ih); chunk('IDAT', z); chunk('IEND', new Uint8Array(0));
    return new Blob([out], { type: 'image/png' });
  }
  const pngBlob = async cv => { let b = null; try { b = await pngOf(cv); } catch (e) { b = null; } return b || blobOf(cv); };
  const b64Of = blob => new Promise(res => { try { const fr = new FileReader(); fr.onload = () => { const s = String(fr.result || ''), i = s.indexOf(','); res(i >= 0 ? s.slice(i + 1) : ''); }; fr.onerror = () => res(''); fr.readAsDataURL(blob); } catch (e) { res(''); } });
  /* the card is pinned for the whole encode: a round that starts meanwhile (card = null) or a redraw never reaches it, and the
     result is kept in P only while that card is still the current one */
  async function encode() {
    const c0 = card, d0 = data; if (!c0) return { ok: false, err: 'canvas' };
    if (P && P.sig === c0.sig && P.limit === limit()) return P;
    const sig = c0.sig, lim = limit(); let cur = c0;
    let blob = await pngBlob(cur.cv);
    if (blob && blob.size > lim && !cur.lite && d0) { cur = draw(d0, true); cur.sig = sig; if (card === c0) { card = cur; publish(); } blob = await pngBlob(cur.cv); }
    const keep = r => { if (card === cur) P = r; return r; };
    if (!blob) return keep({ ok: false, err: 'canvas', sig, limit: lim });
    const fits = blob.size <= lim, b64 = fits ? await b64Of(blob) : '';
    return keep({ ok: fits && b64.length > 0, err: !fits ? 'too_big' : b64 ? '' : 'canvas', blob, b64, size: blob.size, lite: cur.lite, sig, limit: lim });
  }

  /* ---------- styles ---------- */
  const css = document.createElement('style');
  css.textContent = [
    '.hgCardScr{background:var(--bg,#070c16);z-index:20}',
    '.hgCd{display:flex;flex-direction:column;align-items:center;gap:12px;width:min(100%,640px)}',
    '.hgCd.land{flex-direction:row;justify-content:center;gap:20px}',
    '.hgCdPv{flex:none;border-radius:14px;overflow:hidden;background:#141a22;box-shadow:0 14px 34px rgba(0,0,0,.7)}',
    '.hgCdPv img,.hgCdPv canvas{display:block;width:100%;height:100%}.hgCdPv [hidden]{display:none}',
    '.hgCdSide{display:flex;flex-direction:column;align-items:center;gap:8px;width:min(100%,360px);min-width:0}',
    '.hgCd.land .hgCdSide{flex:0 1 360px}',
    '.hgCdMsg{font:15px/1.35 Georgia,serif;color:#cfd6e2;text-align:center;max-width:100%;overflow-wrap:anywhere;min-height:20px;user-select:text;-webkit-user-select:text}',
    '.hgCdBtns{display:flex;flex-direction:column;align-items:center;gap:8px;width:100%}',
    '.hgCdPri{width:100%}.hgCdPri:empty{display:none}.hgCdSide .pri{width:100%}',
    '.hgCdRow{display:flex;gap:6px;justify-content:center;flex-wrap:wrap;width:100%}',
    '@media (orientation:landscape) and (max-height:540px){.hgCdSide{gap:6px}.hgCdMsg{font-size:14px}}'
  ].join('\n');
  document.head.appendChild(css);

  /* ---------- the end screen: a 📤 "Share" icon button in the core's #share slot ---------- */
  const ib = (icon, word) => { const b = el('button', 'ib'); b.type = 'button'; b.append(el('i', null, icon), el('span', null, word)); return b; };
  const btn = ib('📤', 'Share'); btn.classList.add('hgCardBtn');
  let core = null;   // the core's 📤 "Invite": out of the DOM, its listener kept for a round without card data
  btn.addEventListener('click', () => { if (!data && core) { core.click(); return; } share(); });
  /* the card button takes #share's place and id in #endLinks; without a core #share it goes into #endLinks (or #endExtra) */
  const place = () => { if (btn.isConnected) return; const old = G.$('share');
    if (old && old !== btn) { core = old; btn.id = 'share'; old.replaceWith(btn); return; }
    btn.id = 'hgCardBtn'; const ex = G.$('endLinks') || G.$('endExtra'); if (ex) ex.appendChild(btn); };
  place();
  G.on('end', (S, res) => {
    lastRes = res && typeof res === 'object' ? Object.assign({}, res) : {}; dropImg();
    data = snap(S, lastRes); card = null; P = null; up = null; st = 'idle'; err = '';
    /* a round with nothing to show (0 banked, no robbery): no card, the core's 📤 Invite stays */
    const dead = !data.bank && !data.best;
    if (dead) { if (core && btn.isConnected) btn.replaceWith(core); btn.hidden = !core; } else { btn.hidden = false; place(); }
    const my = seq; setTimeout(() => { if (my === seq && data) ensure(); }, 40);   // the end screen paints first
  });

  /* ---------- the card screen ---------- */
  const scr = el('div', 'scr hgCardScr'); scr.id = 'hgCard';
  const box = el('div', 'hgCd'), pv = el('div', 'hgCdPv'), img = el('img'), big = el('canvas'), side = el('div', 'hgCdSide');
  img.id = 'hgCardImg'; img.alt = 'Your Heavy Gold card'; img.hidden = true; big.id = 'hgCardBig';
  const msgEl = el('div', 'hgCdMsg'); msgEl.id = 'hgCardMsg'; msgEl.setAttribute('role', 'status');
  const btns = el('div', 'hgCdBtns'); btns.id = 'hgCardBtns';
  const priBox = el('div', 'hgCdPri'), rowEl = el('div', 'hgCdRow links');
  const closeB = ib('✕', 'Close'); closeB.id = 'hgCardClose';
  btns.append(priBox, rowEl);
  pv.append(img, big); side.append(msgEl, btns); box.append(pv, side); scr.appendChild(box); document.body.appendChild(scr);
  closeB.addEventListener('click', () => close());
  G.on('title', () => close());
  const isOpen = () => scr.classList.contains('on');
  function open() { scr.classList.add('on'); paint(); }
  function close() { scr.classList.remove('on'); }
  /* the PNG of another card must never be shown or saved: forget it when a round starts or ends */
  function dropImg() { try { if (blobUrl) URL.revokeObjectURL(blobUrl); } catch (e) {} blobUrl = ''; img.hidden = true; img.removeAttribute('src'); big.hidden = false; }
  function showImg(blob) {
    try { if (blobUrl) URL.revokeObjectURL(blobUrl); } catch (e) {}
    blobUrl = ''; try { blobUrl = URL.createObjectURL(blob); } catch (e) { blobUrl = ''; }
    if (blobUrl) { img.src = blobUrl; img.hidden = false; big.hidden = true; }
  }
  function paintBig(w, h) {
    if (!card || !big || big.hidden) return;
    const dpr = Math.min(3, window.devicePixelRatio || 1), bw = Math.max(1, Math.round(w * dpr)), bh = Math.max(1, Math.round(h * dpr));
    if (big.width !== bw) big.width = bw; if (big.height !== bh) big.height = bh;
    const c = big.getContext('2d'); c.imageSmoothingEnabled = true; try { c.imageSmoothingQuality = 'high'; } catch (e) {} c.drawImage(card.cv, 0, 0, bw, bh);
  }
  /* the card as large as the screen allows: beside the buttons in a wide window, above them in a tall one */
  const SIDE_H = 20 + 56 + 56 + 8 * 3;   // the message, a primary and one row of icon buttons
  function fitScr() {
    if (!isOpen()) return;
    const cs = getComputedStyle(scr), px = v => parseFloat(v) || 0;
    const aw = scr.clientWidth - px(cs.paddingLeft) - px(cs.paddingRight), ah = scr.clientHeight - px(cs.paddingTop) - px(cs.paddingBottom);
    const land = aw > ah * 1.15; box.classList.toggle('land', land);
    let h;
    if (land) { h = ah; const maxW = Math.max(110, aw - 20 - Math.min(360, aw * 0.5)); if (h * 9 / 16 > maxW) h = maxW * 16 / 9; }
    else { h = Math.min(640, ah - Math.max(side.offsetHeight, SIDE_H) - 12); if (h * 9 / 16 > aw) h = aw * 16 / 9; }   // room for the longest set of buttons: no jump
    h = Math.max(96, Math.floor(h)); const w = Math.floor(h * 9 / 16);
    pv.style.width = w + 'px'; pv.style.height = h + 'px';
    paintBig(w, h);
  }
  const PUT_MS = 30000;
  /* status lines: at most 4 words */
  const FAIL = { rate: 'Hourly limit · save it', too_big: 'Too big · save it', bad_png: 'Refused · save it', auth: 'Session ended · save it',
    canvas: 'No image', offline: 'Offline · save it', net: 'Upload failed · save it' };
  /* the actions: the primary one big (icon + word), the others icon buttons with one word, then Close */
  const ACT = { story: ['📸', 'Story', 'hgCardStory', () => story()], chat: ['✈️', 'Send', 'hgCardChat', () => chat()],
    save: ['💾', 'Save', 'hgCardSave', () => save()], copy: ['🔗', 'Copy', 'hgCardCopy', () => copy()] };
  function paint() {
    priBox.textContent = ''; rowEl.textContent = '';
    const pri = k => { const a = ACT[k], b = el('button', 'pri', a[0] + ' ' + a[1].toUpperCase()); b.type = 'button'; b.id = a[2]; b.addEventListener('click', a[3]); priBox.appendChild(b); };
    const sec = k => { const a = ACT[k], b = ib(a[0], a[1]); b.id = a[2]; b.addEventListener('click', a[3]); rowEl.appendChild(b); };
    let m = '';
    if (st === 'busy' || st === 'idle') m = busyMsg || 'Making card…';
    else if (st === 'story') { pri('story'); sec('chat'); sec('save'); }
    else if (st === 'chat') { pri('chat'); sec('save'); sec('copy'); }
    else if (st === 'fail') { m = FAIL[err] || FAIL.net; if (err === 'canvas') { pri('copy'); sec('chat'); } else { pri('save'); sec('chat'); sec('copy'); } }
    else if (st === 'local') { m = P && !P.ok && P.err === 'canvas' ? FAIL.canvas : ''; pri('save'); sec('copy'); }
    rowEl.appendChild(closeB);
    msgEl.textContent = m;
    fitScr();
  }
  const setState = (s, e) => { st = s; err = e || ''; if (isOpen()) paint(); };
  window.addEventListener('resize', fitScr);

  /* ---------- sharing ---------- */
  const cardUrl = () => (up && card && up.sig === card.sig ? up.url : '');
  const line = () => { const d = data; if (!d) return 'Heavy Gold';
    return '🏦 ' + fmt(d.bank) + (d.rank > 0 && d.of > 0 ? ' · #' + d.rank + ' of ' + d.of : '') + ' · Heavy Gold — beat it?'; };
  const storyText = () => line().slice(0, 200);
  const chatText = () => line() + (cardUrl() ? ' ' + cardUrl() : '');
  const chatLink = () => 'https://t.me/share/url?url=' + encodeURIComponent(GAME) + '&text=' + encodeURIComponent(chatText());
  function story() {
    const u = cardUrl(); if (!u || !storyOK()) { setState('chat'); return false; }
    try { G.TG.shareToStory(u, { text: storyText(), widget_link: { url: GAME, name: 'Play Heavy Gold' } }); stats.stories++; try { G.haptic('light'); } catch (e) {} return true; }
    catch (e) { setState('chat'); return false; }
  }
  function chat() {
    const L = chatLink(); stats.chats++;
    try { if (inTG() && typeof G.TG.openTelegramLink === 'function') { G.TG.openTelegramLink(L); return L; } } catch (e) {}
    try { window.open(L, '_blank', 'noopener'); } catch (e) {}
    return L;
  }
  function save() {
    const name = 'heavy-gold-map-' + (data ? data.map : 1) + '.png', T = G.TG, u = cardUrl();
    if (inTG() && u && typeof T.downloadFile === 'function' && ver('8.0')) {
      try { T.downloadFile({ url: u, file_name: name }); stats.saves.push('tg'); return 'tg'; } catch (e) {}
    }
    let href = blobUrl; if (!href && card) { try { href = card.cv.toDataURL('image/png'); } catch (e) { href = ''; } }
    if (!href) { msgEl.textContent = FAIL.canvas; return ''; }   // the card screen covers the toast: its own status line
    const a = document.createElement('a'); a.href = href; a.download = name; a.rel = 'noopener'; a.style.display = 'none';
    document.body.appendChild(a); a.click(); setTimeout(() => { try { a.remove(); } catch (e) {} }, 0);
    stats.saves.push('a');
    if (inTG()) msgEl.textContent = 'Or hold the card';
    return 'a';
  }
  async function copy() {
    const t = chatText() + ' ' + GAME; let ok = false;
    try { if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(t); ok = true; } } catch (e) { ok = false; }
    if (!ok) { try { const ta = document.createElement('textarea'); ta.value = t; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
      document.body.appendChild(ta); ta.select(); ok = !!document.execCommand('copy'); ta.remove(); } catch (e) { ok = false; } }
    stats.copies++;
    msgEl.textContent = ok ? 'Link copied' : t;   // the card screen covers the toast: its own status line (or the text to copy by hand)
    return ok;
  }
  async function share() {
    if (busy) { open(); return st; }
    if (!data) return st;
    busy = true; const my = seq;
    try {
      ensure(); if (!card) return st;
      busyMsg = 'Making card…'; st = 'busy'; open();
      const p = await encode(); if (my !== seq) return st;
      if (p.blob) showImg(p.blob); else dropImg();
      fitScr();
      if (!inTG()) { setState('local'); return st; }
      if (!p.ok) { setState('fail', p.err || 'too_big'); return st; }
      if (!cardUrl()) {
        busyMsg = 'Uploading…'; setState('busy');
        let on = !!(G.net && G.net.on); if (!on && G.net && typeof G.net.login === 'function') { try { on = await G.net.login(); } catch (e) { on = false; } }
        if (my !== seq) return st;
        if (!on || !G.net) { setState('fail', 'offline'); return st; }
        stats.puts++;
        const r = await G.net.rpc('hg_card_put', { token: null, png: p.b64 }, { timeout: PUT_MS }); if (my !== seq) return st;   // ~430 KB up: more than the 8 s default
        if (r && typeof r === 'object' && typeof r.url === 'string' && /^https:\/\/[^\s"'<>\\]+$/.test(r.url)) up = { sig: p.sig, url: r.url, id: String(r.id || '') };
        else { setState('fail', r && typeof r === 'object' && r.error ? String(r.error) : 'net'); return st; }
      }
      if (storyOK()) { setState('story'); if (isOpen()) story(); } else setState('chat');   // closed while it uploaded: no editor out of nowhere
      return st;
    } finally { busy = false; }
  }

  G.card = { W, H, GAME, last: null, canvas: null, limit: 409600, stats,
    best: () => (best ? Object.assign({}, best) : null), data: () => (data ? Object.assign({}, data) : null),
    render: () => { ensure(); return G.card.last; }, png: async () => { ensure(); const p = await encode(); return p && { ok: p.ok, err: p.err, b64: p.b64, size: p.size, lite: p.lite }; },
    share, open, close, story, chat, chatLink, save, copy, storyOK,
    get state() { return st; }, get err() { return err; }, get url() { return cardUrl(); }, get busy() { return busy; } };
})();
