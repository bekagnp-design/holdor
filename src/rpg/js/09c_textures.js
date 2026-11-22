/* HOLDOR RPG — the texture + plant art library (G10). Painterly-realistic, procedural, on <canvas>; no files, no copied art.
   Used by the renderer (08_render, 07_props), nature (09_nature) and water (09b_water) instead of flat colours and primitives.
   Everything is deterministic (an own seeded PRNG per item: R.rng is never consumed) and seamless (periodic value noise,
   periodic Voronoi / rows, overlays drawn wrapped), generated lazily: a background pump works ≤ 4 ms per animation frame
   (rAF slices, a timer when rAF is throttled) through the common set; a synchronous call for an item not made yet makes just
   that item at once (finishing its half-done slices if the pump had started it).
   API (call it at use time, never at load):
     R.tex.get(name, o)      → THREE.Texture (RepeatWrapping, mipmaps, anisotropy ≤ 4, sRGB) cached by name + o.size; null without THREE
                               or for an unknown name. Shared: clone() it before changing .repeat / .offset.
     R.tex.canvas(name, size)→ the seamless source canvas (size: 512, 256 on low-end).   R.tex.names() → the list.
     R.tex.normal(name, o)   → the matching normal map (OpenGL convention, linear) from the painted height, cached.
     R.tex.avg(name)         → '#rrggbb' mean colour (for vertex tints / minimap / fog).   R.tex.height(name) → {data:Uint16Array, size}.
     R.tex.tree(kind, seed)  → {canvas, w, h, ax, ay, worldH}: a plant on a transparent canvas, feet at (ax, ay) px, worldH = its height in
                               world units (the hero is 64); ≤ 3 variants per kind (seed % 3), cached.
     R.tex.treeTex(kind, seed)→ THREE.Texture of it (DataTexture with the colour bled into the clear pixels: alphaTest 0.5 shows no dark
                               fringe; flipY already applied: v = 0 is the feet), cached; null without THREE.
     R.tex.kinds() → the plant kinds.   R.tex.biomePlants(biome) → [[kind, weight], …] for a region id of 11_world_data (north, …,
                               dragonstone) or a biome word (snow, desert, reach, storm, mountain, sea, ash, city, coast, river, vale, wall).
     R.tex.ready → Promise, resolved when the common set (every texture + variant 0 of every plant) is made.
     R.tex.stats → {ms (work so far), items:{key: ms}, frames, maxSlice, size, plantH, low}.   R.tex.makeAll() (tests: everything now).
   Light comes from the upper left in every painting; ground textures keep their baked shading gentle so any sun direction works. */
(function () {
  const T = {}; R.tex = T;
  const now = () => (window.performance && performance.now ? performance.now() : Date.now());
  const SLICE = 4;

  /* ---------- seeded PRNG + hashes ---------- */
  function hs(s) { let h = 2166136261 >>> 0; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function prng(seed) { let a = (seed >>> 0) || 1; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
  const sm = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

  /* ---------- sizes ---------- */
  function low() { try { if (R.lowEnd === true) return true; if (R.lowEnd === false) return false; return (window.devicePixelRatio || 1) < 2 && (navigator.hardwareConcurrency || 8) <= 4; } catch (e) { return false; } }
  const baseSize = () => low() ? 256 : 512;
  const plantH = () => low() ? 128 : 256;

  /* ---------- colour ---------- */
  const hex = h => { const n = parseInt(h.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const mixc = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const css = (c, k = 1, a) => { const r = clamp(c[0] * k | 0, 0, 255), g = clamp(c[1] * k | 0, 0, 255), b = clamp(c[2] * k | 0, 0, 255); return a == null ? 'rgb(' + r + ',' + g + ',' + b + ')' : 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')'; };
  function lut(stops) {   // [[t, '#hex'], …] → Uint8Array(768)
    const L = new Uint8Array(768), S = stops.map(s => [s[0], hex(s[1])]);
    for (let i = 0; i < 256; i++) {
      const t = i / 255; let k = 0; while (k < S.length - 2 && t > S[k + 1][0]) k++;
      const a = S[k], b = S[k + 1], u = clamp((t - a[0]) / ((b[0] - a[0]) || 1), 0, 1);
      for (let c = 0; c < 3; c++) L[i * 3 + c] = a[1][c] + (b[1][c] - a[1][c]) * u;
    }
    return L;
  }
  const ramp = (P, v) => { v = clamp(v, 0, 1); const n = P.length - 1, f = v * n, i = Math.min(n - 1, f | 0); return mixc(P[i], P[i + 1], f - i); };

  function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

  /* ---------- periodic value noise (generators: they yield every 64 rows so the pump can slice) ---------- */
  function* oct(out, S, px, py, rnd, amp, mode) {   // adds amp × noise with px × py cells over S (periodic) into out
    const L = new Float32Array(px * py); for (let i = 0; i < L.length; i++) L[i] = rnd();
    const cx = S / px, cy = S / py, X0 = new Int32Array(S), X1 = new Int32Array(S), SX = new Float32Array(S);
    for (let x = 0; x < S; x++) { const f = x / cx, i = Math.floor(f), t = f - i; X0[x] = i % px; X1[x] = (i + 1) % px; SX[x] = t * t * (3 - 2 * t); }
    for (let y = 0; y < S; y++) {
      const f = y / cy, i = Math.floor(f), t = f - i, sy = t * t * (3 - 2 * t), r0 = (i % py) * px, r1 = ((i + 1) % py) * px, o = y * S;
      for (let x = 0; x < S; x++) {
        const s = SX[x], a = L[r0 + X0[x]], b = L[r0 + X1[x]], c = L[r1 + X0[x]], d = L[r1 + X1[x]];
        const tp = a + (b - a) * s; let v = tp + (c + (d - c) * s - tp) * sy;
        if (mode === 1) v = 1 - Math.abs(2 * v - 1);
        out[o + x] += amp * v;
      }
      if ((y & 63) === 63) yield;
    }
  }
  // fractal sum, normalised to ≈ [0, 1] (mean 0.5, ±2.2σ)
  function* fbm(S, px, py, n, rnd, gain = 0.5, mode = 0, spread = 2.2) {
    const out = new Float32Array(S * S); let a = 1;
    for (let k = 0; k < n; k++) { const qx = px << k, qy = py << k; if (qx > S || qy > S) break; yield* oct(out, S, qx, qy, rnd, a, mode); a *= gain; }
    yield* norm(out, spread); return out;
  }
  function* norm(F, spread = 2.2) {
    let m = 0, q = 0; const N = F.length, st = N > 4096 ? 7 : 1; let c = 0;
    for (let i = 0; i < N; i += st) { m += F[i]; q += F[i] * F[i]; c++; }
    m /= c; const sd = Math.sqrt(Math.max(1e-9, q / c - m * m)), k = 0.5 / (spread * sd);
    for (let i = 0; i < N; i++) { const v = (F[i] - m) * k + 0.5; F[i] = v < 0 ? 0 : v > 1 ? 1 : v; if ((i & 65535) === 65535) yield; }
  }
  // bilinear, wrapped sample of a field of size S at (x, y) in its own pixels
  function samp(F, S, x, y) {
    x = ((x % S) + S) % S; y = ((y % S) + S) % S;
    const x0 = x | 0, y0 = y | 0, x1 = (x0 + 1) % S, y1 = (y0 + 1) % S, fx = x - x0, fy = y - y0;
    const a = F[y0 * S + x0], b = F[y0 * S + x1], c = F[y1 * S + x0], d = F[y1 * S + x1];
    return a + (b - a) * fx + (c + (d - c) * fx - a - (b - a) * fx) * fy;
  }
  // low-frequency fields are made at a quarter of the size and sampled up
  function* lowField(S, p, n, rnd, gain) { const s = Math.max(16, S >> 2), F = yield* fbm(s, p, p, n, rnd, gain); return { F, s, k: s / S }; }
  const lf = (L, x, y) => samp(L.F, L.s, x * L.k, y * L.k);
  function* warp(F, S, amt, rnd, p = 3) {
    const WX = yield* lowField(S, p, 3, rnd, 0.5), WY = yield* lowField(S, p, 3, rnd, 0.5), G = new Float32Array(S * S);
    for (let y = 0; y < S; y++) { for (let x = 0; x < S; x++) G[y * S + x] = samp(F, S, x + (lf(WX, x, y) - 0.5) * amt, y + (lf(WY, x, y) - 0.5) * amt); if ((y & 63) === 63) yield; }
    return G;
  }

  /* ---------- the painted result of a texture: canvas + height ---------- */
  function finish(S, img, H, hk) {   // img: Uint8ClampedArray RGBA; H: Float32Array heights 0..1
    const c = mkCanvas(S, S), x = c.getContext('2d'), id = x.createImageData(S, S); id.data.set(img); x.putImageData(id, 0, 0);
    const h = new Uint16Array(S * S); for (let i = 0; i < h.length; i++) h[i] = clamp(H[i], 0, 1) * 65535;
    return { canvas: c, H: h, S, hk: hk || 4 };
  }
  // shading baked from the height: light from the upper left (gentle on grounds)
  const lit = (H, S, i, x, y) => { const a = H[((y + 1) % S) * S + (x + 1) % S], b = H[((y + S - 1) % S) * S + (x + S - 1) % S]; return a - b; };
  // draw a shape at every wrapped copy that touches the tile
  function wrapDraw(S, x, y, r, fn) {
    const xs = [0], ys = [0]; if (x - r < 0) xs.push(S); if (x + r > S) xs.push(-S); if (y - r < 0) ys.push(S); if (y + r > S) ys.push(-S);
    for (const dx of xs) for (const dy of ys) fn(x + dx, y + dy);
  }

  /* ---------- grounds: warped fbm through a palette, a second palette by a macro field, baked relief, grain, overlays ---------- */
  function* ground(S, rnd, o) {
    const N = S * S;
    let H = yield* fbm(S, o.p || 4, o.p || 4, o.oct || 6, rnd, o.gain || 0.52, o.ridge ? 1 : 0);
    if (o.str) { const Q = yield* fbm(S, o.str[0], o.str[1], o.str[2] || 4, rnd, 0.55); for (let i = 0; i < N; i++) H[i] = H[i] * (1 - o.str[3]) + Q[i] * o.str[3]; }
    if (o.warp) H = yield* warp(H, S, o.warp * S / 512, rnd);
    const M = yield* lowField(S, o.mp || 2, 4, rnd, 0.55), L1 = lut(o.pal), L2 = lut(o.pal2 || o.pal), img = new Uint8ClampedArray(N * 4);
    const sh = (o.shade == null ? 2.2 : o.shade), gr = o.grain == null ? 0.06 : o.grain, mlo = o.mlo == null ? 0.35 : o.mlo, mhi = o.mhi == null ? 0.65 : o.mhi;
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const i = y * S + x, h = H[i], li = (h * 255 | 0) * 3, m = sm(mlo, mhi, lf(M, x, y));
        const s = (1 + sh * lit(H, S, i, x, y)) * (1 + gr * (rnd() - 0.5) * 2), j = i * 4;
        img[j] = (L1[li] + (L2[li] - L1[li]) * m) * s; img[j + 1] = (L1[li + 1] + (L2[li + 1] - L1[li + 1]) * m) * s;
        img[j + 2] = (L1[li + 2] + (L2[li + 2] - L1[li + 2]) * m) * s; img[j + 3] = 255;
      }
      if ((y & 31) === 31) yield;
    }
    const r = finish(S, img, H, o.hk);
    if (o.post) yield* o.post(r.canvas.getContext('2d'), S, rnd, H, M);
    return r;
  }

  // short strokes in colour buckets (one path per bucket): grass blades, straw, needles on the ground
  function* blades(ctx, S, rnd, H, n, cols, o = {}) {
    const k = S / 512, paths = cols.map(() => new Path2D()), lw = (o.lw || 1.3) * k, len = (o.len || 7) * k;
    for (let i = 0; i < n; i++) {
      const x = rnd() * S, y = rnd() * S, h = H ? H[(y | 0) * S + (x | 0)] : rnd(), b = clamp((h * 0.7 + rnd() * 0.5) * cols.length | 0, 0, cols.length - 1);
      const a = (o.ang != null ? o.ang : -1.57) + (rnd() - 0.5) * (o.spr || 2.2), l = len * (0.5 + rnd());
      wrapDraw(S, x, y, l + 2, (px, py) => { paths[b].moveTo(px, py); paths[b].quadraticCurveTo(px + Math.cos(a) * l * 0.5 + (rnd() - 0.5) * 2 * k, py + Math.sin(a) * l * 0.5, px + Math.cos(a) * l, py + Math.sin(a) * l); });
      if ((i & 1023) === 1023) yield;
    }
    ctx.lineCap = 'round'; ctx.lineWidth = lw; ctx.globalAlpha = o.alpha || 0.85;
    cols.forEach((c, i) => { ctx.strokeStyle = c; ctx.stroke(paths[i]); });
    ctx.globalAlpha = 1;
  }
  // small round dabs (pebbles, flowers, lichen) in colour buckets
  function* dabs(ctx, S, rnd, n, cols, r0, r1, where, o = {}) {
    const k = S / 512, paths = cols.map(() => new Path2D());
    for (let i = 0, t = 0; i < n && t < n * 6; t++) {
      const x = rnd() * S, y = rnd() * S; if (where && !where(x, y)) continue; i++;
      const r = (r0 + (r1 - r0) * rnd()) * k, b = (rnd() * cols.length) | 0, e = 0.6 + rnd() * 0.5, a = rnd() * 3.14;
      wrapDraw(S, x, y, r + 1, (px, py) => { paths[b].moveTo(px + r, py); paths[b].ellipse(px, py, r, r * e, a, 0, 6.283); });
      if ((i & 1023) === 1023) yield;
    }
    ctx.globalAlpha = o.alpha || 1; cols.forEach((c, i) => { ctx.fillStyle = c; ctx.fill(paths[i]); }); ctx.globalAlpha = 1;
  }
  function* pebbles(ctx, S, rnd, n, base, r0, r1, where) {   // stones with a shadow under and a lit top-left
    const k = S / 512, P = [];
    for (let i = 0, t = 0; i < n && t < n * 6; t++) { const x = rnd() * S, y = rnd() * S; if (where && !where(x, y)) continue; i++; P.push([x, y, (r0 + (r1 - r0) * rnd()) * k, 0.55 + rnd() * 0.4, rnd() * 3.14, 0.8 + rnd() * 0.4]); }
    const sh = new Path2D(); P.forEach(p => wrapDraw(S, p[0], p[1], p[2] + 3, (x, y) => { sh.moveTo(x + p[2] + 1, y + 1.2 * k); sh.ellipse(x + 0.8 * k, y + 1.2 * k, p[2] * 1.1, p[2] * p[3] * 1.1, p[4], 0, 6.283); }));
    ctx.fillStyle = 'rgba(20,14,8,0.35)'; ctx.fill(sh); yield;
    for (const p of P) wrapDraw(S, p[0], p[1], p[2] + 3, (x, y) => {
      ctx.fillStyle = css(base, p[5]); ctx.beginPath(); ctx.ellipse(x, y, p[2], p[2] * p[3], p[4], 0, 6.283); ctx.fill();
      ctx.fillStyle = css(base, p[5] * 1.35, 0.7); ctx.beginPath(); ctx.ellipse(x - p[2] * 0.3, y - p[2] * p[3] * 0.3, p[2] * 0.5, p[2] * p[3] * 0.45, p[4], 0, 6.283); ctx.fill();
    });
  }

  /* ---------- Voronoi over a periodic jittered grid: per-pixel nearest / second distance + cell id ---------- */
  function* voronoi(S, n, rnd, jit = 0.8) {
    const c = S / n, P = new Float32Array(n * n * 2), N = S * S, D1 = new Float32Array(N), D2 = new Float32Array(N), ID = new Int32Array(N);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const k = (j * n + i) * 2; P[k] = (i + 0.5 + (rnd() - 0.5) * jit) * c; P[k + 1] = (j + 0.5 + (rnd() - 0.5) * jit) * c; }
    for (let y = 0; y < S; y++) {
      const cj = Math.floor(y / c);
      for (let x = 0; x < S; x++) {
        const ci = Math.floor(x / c); let d1 = 1e9, d2 = 1e9, id = 0;
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
          let ii = ci + di, jj = cj + dj, ox = 0, oy = 0;
          if (ii < 0) { ii += n; ox = -S; } else if (ii >= n) { ii -= n; ox = S; }
          if (jj < 0) { jj += n; oy = -S; } else if (jj >= n) { jj -= n; oy = S; }
          const k = (jj * n + ii) * 2, dx = P[k] + ox - x, dy = P[k + 1] + oy - y, d = dx * dx + dy * dy;
          if (d < d1) { d2 = d1; d1 = d; id = jj * n + ii; } else if (d < d2) d2 = d;
        }
        const i = y * S + x; D1[i] = Math.sqrt(d1); D2[i] = Math.sqrt(d2); ID[i] = id;
      }
      if ((y & 31) === 31) yield;
    }
    return { D1, D2, ID, c };
  }

  // stones set in mortar (cobble) from Voronoi cells, with warped edges, per-stone tint, bevel and a lit upper-left rim
  function* cobble(S, rnd, o) {
    const N = S * S, D = yield* fbm(S, 8, 8, 5, rnd, 0.5), Wd = yield* fbm(S, 24, 24, 3, rnd, 0.5);   // Wd: fine detail
    const V = yield* voronoi(S, o.n || 9, rnd, 0.85), tint = new Float32Array(V.ID.length ? (o.n || 9) ** 2 : 1).map(() => rnd());
    const H = new Float32Array(N), Ls = lut(o.pal), Lm = lut(o.mortar), img = new Uint8ClampedArray(N * 4), mw = (o.mw || 3.2) * S / 512, bev = (o.bev || 9) * S / 512;
    for (let i = 0; i < N; i++) {
      const e = (V.D2[i] - V.D1[i]) * 0.5 + (D[i] - 0.5) * mw * 1.6, t = tint[V.ID[i]];
      if (e < mw) H[i] = 0.12 + Wd[i] * 0.15; else { const b = sm(mw, mw + bev, e); H[i] = 0.3 + 0.55 * Math.sqrt(b) * (0.85 + 0.15 * (1 - V.D1[i] / V.c)) + (Wd[i] - 0.5) * 0.18; }
      if ((i & 65535) === 65535) yield;
    }
    const M = yield* lowField(S, 2, 3, rnd, 0.5);
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const i = y * S + x, j = i * 4, e = (V.D2[i] - V.D1[i]) * 0.5 + (D[i] - 0.5) * mw * 1.6, s = 1 + 5.5 * lit(H, S, i, x, y);
        let c;
        if (e < mw) { const li = clamp(Wd[i] * 255, 0, 255) * 3 | 0; c = [Lm[li], Lm[li + 1], Lm[li + 2]]; if (o.moss && lf(M, x, y) > 0.55) c = mixc(c, o.moss, 0.6); }
        else { const t = tint[V.ID[i]], li = clamp((t * 0.55 + Wd[i] * 0.45) * 255, 0, 255) * 3 | 0; c = [Ls[li], Ls[li + 1], Ls[li + 2]]; const w = clamp(1 - (e - mw) / (bev * 2.5), 0, 1) * 0.22; c = mixc(c, Lm.slice(390, 393), w); }
        const g = 1 + (rnd() - 0.5) * 0.08;
        img[j] = c[0] * s * g; img[j + 1] = c[1] * s * g; img[j + 2] = c[2] * s * g; img[j + 3] = 255;
      }
      if ((y & 31) === 31) yield;
    }
    return finish(S, img, H, 6);
  }

  // dressed blocks in courses (walls): exact rows and widths that sum to the tile, chipped edges, per-block tint
  function* blocks(S, rnd, o) {
    const N = S * S, nr = o.rows || 8, rh = S / nr, D = yield* fbm(S, 6, 6, 5, rnd, 0.55), F = yield* fbm(S, 16, 16, 3, rnd, 0.5);
    const rows = [];
    for (let r = 0; r < nr; r++) {
      const ws = []; let sum = 0; while (sum < S) { const w = S * (o.wmin || 0.14) + rnd() * S * (o.wvar || 0.16); ws.push(w); sum += w; }
      const k = S / sum, bs = [0]; let acc = 0; ws.forEach(w => { acc += w * k; bs.push(acc); }); bs[bs.length - 1] = S;
      rows.push({ bs, off: rnd() * S, tint: ws.map(() => rnd()) });
    }
    const H = new Float32Array(N), Ls = lut(o.pal), Lm = lut(o.mortar), img = new Uint8ClampedArray(N * 4), mw = (o.mw || 3) * S / 512, bev = (o.bev || 7) * S / 512;
    const TI = new Float32Array(N), E = new Float32Array(N);
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const i = y * S + x, yy = y + (D[i] - 0.5) * 3 * S / 512, r = ((Math.floor(yy / rh) % nr) + nr) % nr, v = yy - Math.floor(yy / rh) * rh, R0 = rows[r];
        const xx = (((x + R0.off + (D[y * S + (x + 97) % S] - 0.5) * 3 * S / 512) % S) + S) % S; let b = 0; while (b < R0.bs.length - 2 && xx >= R0.bs[b + 1]) b++;
        const e = Math.min(xx - R0.bs[b], R0.bs[b + 1] - xx, v, rh - v) + (F[i] - 0.5) * mw * 2.2;
        E[i] = e; TI[i] = R0.tint[b];
        H[i] = e < mw ? 0.1 + D[i] * 0.1 : 0.35 + 0.45 * Math.sqrt(sm(mw, mw + bev, e)) + (D[i] - 0.5) * 0.3 + (F[i] - 0.5) * 0.08;
      }
      if ((y & 31) === 31) yield;
    }
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const i = y * S + x, j = i * 4, e = E[i], s = 1 + 4.5 * lit(H, S, i, x, y); let c;
        if (e < mw) { const li = clamp(D[i] * 255, 0, 255) * 3 | 0; c = [Lm[li], Lm[li + 1], Lm[li + 2]]; }
        else { const li = clamp((TI[i] * 0.5 + D[i] * 0.5) * 255, 0, 255) * 3 | 0; c = [Ls[li], Ls[li + 1], Ls[li + 2]]; if (o.stain) c = mixc(c, o.stain, clamp((D[i] - 0.62) * 3, 0, 0.5)); }
        const g = 1 + (rnd() - 0.5) * 0.07;
        img[j] = c[0] * s * g; img[j + 1] = c[1] * s * g; img[j + 2] = c[2] * s * g; img[j + 3] = 255;
      }
      if ((y & 31) === 31) yield;
    }
    return finish(S, img, H, 6);
  }

  // roofs: staggered rows; each piece lies over the next (shadow under the lip above, a lit lip at its own bottom edge)
  function* roof(S, rnd, o) {
    const N = S * S, nr = o.rows || 10, rh = S / nr, nc = o.cols || 9, cw = S / nc, D = yield* fbm(S, 6, 6, 5, rnd, 0.55), G = yield* fbm(S, o.gx || 4, o.gy || 4, 4, rnd, 0.55);
    const tint = new Float32Array(nr * nc).map(() => rnd()), L = lut(o.pal), H = new Float32Array(N), C = new Float32Array(N), img = new Uint8ClampedArray(N * 4);
    const OFF = new Float32Array(nr + 1).map((_, r) => (r & 1) * 0.5 * cw + (o.jit ? rnd() * cw * o.jit : 0)); OFF[nr] = OFF[0];
    const piece = (x, y) => {   // → [row, col, u, v] of the piece visible at (x, y)
      let r = Math.floor(y / rh), v = y / rh - r;
      let xx = x + OFF[((r % nr) + nr) % nr], c = Math.floor(xx / cw), u = xx / cw - c;
      const edge = o.round ? 1 - 0.28 * Math.pow(2 * u - 1, 2) : 1 - 0.05 * Math.abs(Math.sin(c * 12.9 + r * 4.1));
      if (v > edge) { r += 1; v = v - 1; xx = x + OFF[((r % nr) + nr) % nr]; c = Math.floor(xx / cw); u = xx / cw - c; }
      return [((r % nr) + nr) % nr, ((c % nc) + nc) % nc, u, v, edge];
    };
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const i = y * S + x, q = piece(x + (D[i] - 0.5) * 2, y), u = q[2], v = q[3], t = tint[q[0] * nc + q[1]];
        const gap = Math.min(u, 1 - u) * cw, shadowTop = v < 0 ? 0 : sm(0, 0.35, v), lip = v > 0 ? sm(q[4] - 0.12, q[4], v) : 0;
        let h = v < 0 ? 0.1 + 0.25 * (v + 1) : 0.3 + 0.5 * v; if (o.round) h += 0.18 * Math.sin(Math.PI * u);
        if (gap < 1.4 * S / 512) h -= 0.25;
        H[i] = clamp(h + (D[i] - 0.5) * 0.1, 0, 1);
        let val = t * 0.45 + G[i] * 0.4 + 0.15 - (1 - shadowTop) * 0.35 + lip * 0.25 + (o.round ? (Math.sin(Math.PI * u) - 0.6) * 0.35 : 0);
        if (v < 0) val = 0.08 + G[i] * 0.15;
        if (gap < 1.4 * S / 512) val *= 0.55;
        C[i] = val;
      }
      if ((y & 31) === 31) yield;
    }
    const M = yield* lowField(S, 3, 3, rnd, 0.5), moss = o.moss ? hex(o.moss) : null;
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const i = y * S + x, j = i * 4, li = clamp(C[i] * 255, 0, 255) * 3 | 0, s = 1 + 2 * lit(H, S, i, x, y), g = 1 + (rnd() - 0.5) * 0.07;
        let c = [L[li], L[li + 1], L[li + 2]]; if (moss) c = mixc(c, moss, clamp((lf(M, x, y) - 0.62) * 2.2, 0, 0.45) * (0.5 + D[i]));
        img[j] = c[0] * s * g; img[j + 1] = c[1] * s * g; img[j + 2] = c[2] * s * g; img[j + 3] = 255;
      }
      if ((y & 31) === 31) yield;
    }
    return finish(S, img, H, 5);
  }

  function* planks(S, rnd) {
    const N = S * S, np = 6, ph = S / np, G = yield* fbm(S, 2, 48, 5, rnd, 0.6), D = yield* fbm(S, 8, 8, 4, rnd, 0.5), L = lut([[0, '#2c1d12'], [0.35, '#4f3420'], [0.7, '#76553a'], [1, '#9a7a58']]);
    const P = []; for (let p = 0; p < np; p++) P.push({ t: rnd(), j: rnd() * S, k: [rnd() * S, rnd() * ph] });
    const H = new Float32Array(N), img = new Uint8ClampedArray(N * 4);
    for (let y = 0; y < S; y++) {
      const p = Math.floor(y / ph), v = y - p * ph, Pp = P[p];
      for (let x = 0; x < S; x++) {
        const i = y * S + x; let dx = ((x - Pp.j) % S + S) % S; dx = Math.min(dx, S - dx);
        let kx = x - Pp.k[0]; kx -= Math.round(kx / S) * S; const ky = v - Pp.k[1], kd = Math.sqrt(kx * kx * 0.15 + ky * ky), knot = Math.exp(-kd * kd / 40) * 0.6;
        const ring = 0.5 + 0.5 * Math.sin((G[i] * 9 + v / ph * 3 + knot * 8) * 6.283);
        const seam = Math.min(v, ph - v), sj = dx;
        let val = Pp.t * 0.35 + G[i] * 0.35 + ring * 0.18 + 0.1 - knot * 0.5 + (D[i] - 0.5) * 0.15;
        let h = 0.55 + ring * 0.12 + (G[i] - 0.5) * 0.3 - knot * 0.3;
        if (seam < 2 * S / 512 || sj < 1.5 * S / 512) { val *= 0.3; h = 0.05; } else if (seam < 5 * S / 512) { val *= 0.75; h -= 0.15; }
        H[i] = clamp(h, 0, 1); const li = clamp(val * 255, 0, 255) * 3 | 0, j = i * 4, g = 1 + (rnd() - 0.5) * 0.06;
        img[j] = L[li] * g; img[j + 1] = L[li + 1] * g; img[j + 2] = L[li + 2] * g; img[j + 3] = 255;
      }
      if ((y & 31) === 31) yield;
    }
    const r = finish(S, img, H, 5), ctx = r.canvas.getContext('2d'), k = S / 512;
    ctx.fillStyle = 'rgba(20,16,12,0.85)';   // nails by the joints
    P.forEach((Pp, p) => [ph * 0.3, ph * 0.7].forEach(yy => wrapDraw(S, (Pp.j + 6 * k) % S, p * ph + yy, 3, (x, y) => { ctx.beginPath(); ctx.arc(x, y, 1.6 * k, 0, 6.283); ctx.fill(); })));
    return r;
  }

  function* bark(S, rnd, o) {
    const N = S * S, C = yield* fbm(S, o.birch ? 3 : 7, 1, 6, rnd, 0.55, 1), D = yield* fbm(S, 4, 12, 5, rnd, 0.5), H = new Float32Array(N), img = new Uint8ClampedArray(N * 4), L = lut(o.pal);
    for (let i = 0; i < N; i++) { H[i] = o.birch ? 0.6 + D[i] * 0.2 - Math.pow(C[i], 6) * 0.2 : Math.pow(C[i], 1.6) * 0.75 + D[i] * 0.25; if ((i & 65535) === 65535) yield; }
    for (let y = 0; y < S; y++) {
      for (let x = 0; x < S; x++) {
        const i = y * S + x, j = i * 4, s = 1 + 3 * lit(H, S, i, x, y), li = clamp(H[i] * 255, 0, 255) * 3 | 0, g = 1 + (rnd() - 0.5) * 0.08;
        img[j] = L[li] * s * g; img[j + 1] = L[li + 1] * s * g; img[j + 2] = L[li + 2] * s * g; img[j + 3] = 255;
      }
      if ((y & 31) === 31) yield;
    }
    const r = finish(S, img, H, 6);
    if (o.birch) {   // lenticels and black patches
      const ctx = r.canvas.getContext('2d'), k = S / 512;
      for (let n = 0; n < 260; n++) { const x = rnd() * S, y = rnd() * S, w = (6 + rnd() * 26) * k, h = (1 + rnd() * 2.2) * k;
        wrapDraw(S, x, y, w, (px, py) => { ctx.fillStyle = css([34, 30, 27], 1, 0.55 + rnd() * 0.4); ctx.beginPath(); ctx.ellipse(px, py, w / 2, h, (rnd() - 0.5) * 0.12, 0, 6.283); ctx.fill(); }); }
      for (let n = 0; n < 14; n++) { const x = rnd() * S, y = rnd() * S, w = (14 + rnd() * 30) * k, h = (8 + rnd() * 18) * k;
        wrapDraw(S, x, y, w, (px, py) => { ctx.fillStyle = 'rgba(28,25,22,0.85)'; ctx.beginPath(); ctx.ellipse(px, py, w / 2, h / 2, rnd(), 0, 6.283); ctx.fill(); ctx.fillStyle = 'rgba(175,150,110,0.4)'; ctx.beginPath(); ctx.ellipse(px + 3 * k, py - h * 0.4, w * 0.35, h * 0.2, 0, 0, 6.283); ctx.fill(); }); }
      yield;
    }
    return r;
  }

  // a dense mass of leaves (canopy meshes, hedges, ivy)
  function* leafMass(S, rnd) {
    const c = mkCanvas(S, S), ctx = c.getContext('2d'), k = S / 512, P = [hex('#16200f'), hex('#2a3a19'), hex('#4b5e2a'), hex('#7a8a45'), hex('#a7ad6c')];
    ctx.fillStyle = '#121a0c'; ctx.fillRect(0, 0, S, S);
    const n = Math.round(2600 * k * k * 4 / 4);
    for (let i = 0; i < n; i++) {
      const x = rnd() * S, y = rnd() * S, l = (7 + rnd() * 7) * k, a = rnd() * 6.283, v = clamp(i / n * 0.75 + rnd() * 0.35, 0, 1), col = ramp(P, v);
      wrapDraw(S, x, y, l + 2, (px, py) => {
        ctx.save(); ctx.translate(px, py); ctx.rotate(a); ctx.fillStyle = css(col);
        ctx.beginPath(); ctx.moveTo(-l, 0); ctx.quadraticCurveTo(0, -l * 0.55, l, 0); ctx.quadraticCurveTo(0, l * 0.55, -l, 0); ctx.fill();
        ctx.strokeStyle = css(col, 0.7, 0.6); ctx.lineWidth = 0.6 * k; ctx.beginPath(); ctx.moveTo(-l * 0.9, 0); ctx.lineTo(l * 0.8, 0); ctx.stroke();
        ctx.fillStyle = css(col, 1.25, 0.5); ctx.beginPath(); ctx.ellipse(-l * 0.2, -l * 0.12, l * 0.45, l * 0.16, 0, 0, 6.283); ctx.fill(); ctx.restore();
      });
      if ((i & 255) === 255) yield;
    }
    return fromCanvas(c, S);
  }
  function fromCanvas(c, S, hk) {   // height from luminance (for overlay-made textures)
    const d = c.getContext('2d').getImageData(0, 0, S, S).data, H = new Float32Array(S * S);
    for (let i = 0; i < H.length; i++) H[i] = (d[i * 4] * 0.3 + d[i * 4 + 1] * 0.59 + d[i * 4 + 2] * 0.11) / 255;
    return finish(S, d, H, hk || 4);
  }

  /* ---------- the texture recipes ---------- */
  const GR = ['#2f3d1c', '#3f5124', '#53662d', '#6a7a38', '#848c48'];
  const TEX = {
    grass: (S, r) => ground(S, r, { pal: [[0, '#2c3a1b'], [0.45, '#4a5c28'], [0.8, '#667634'], [1, '#808a44']], pal2: [[0, '#38401e'], [0.5, '#5b6330'], [1, '#858647']], warp: 60, shade: 1.2, grain: 0.07,
      post: function* (ctx, S, r, H) { yield* blades(ctx, S, r, H, 5200 * (S / 512) ** 2, GR, { len: 8 }); } }),
    grass_dry: (S, r) => ground(S, r, { pal: [[0, '#5a5230'], [0.5, '#857842'], [1, '#ab9c64']], pal2: [[0, '#55522c'], [0.5, '#76733e'], [1, '#9a9258']], warp: 60, shade: 1.2,
      post: function* (ctx, S, r, H) { yield* blades(ctx, S, r, H, 4600 * (S / 512) ** 2, ['#5b5130', '#7b6e40', '#9d8f58', '#bcae78', '#6d6a3a'], { len: 9 }); } }),
    meadow_flowers: (S, r) => ground(S, r, { pal: [[0, '#2e3c1b'], [0.5, '#4d602a'], [1, '#748240']], pal2: [[0, '#36401d'], [0.5, '#5a6631'], [1, '#808a48']], warp: 60, shade: 1.2,
      post: function* (ctx, S, r, H, M) { yield* blades(ctx, S, r, H, 4200 * (S / 512) ** 2, GR, { len: 8 });
        const wf = (x, y) => lf(M, x, y) > 0.48;
        yield* dabs(ctx, S, r, 900 * (S / 512) ** 2, ['#d8d3c2', '#e6e0cc', '#c9b35a', '#d6c06a', '#a8464a', '#8a6a9c', '#c7c4e0'], 1.4, 2.8, wf);
        yield* dabs(ctx, S, r, 500 * (S / 512) ** 2, ['rgba(255,250,230,0.8)'], 0.6, 1.0, wf); } }),
    snow: (S, r) => ground(S, r, { pal: [[0, '#a9b6c4'], [0.4, '#cfd8e0'], [0.75, '#e6ecf1'], [1, '#f7f9fb']], pal2: [[0, '#b4bfcb'], [0.5, '#dbe2e9'], [1, '#fbfcfd']], str: [2, 12, 4, 0.35], warp: 50, shade: 2.5, grain: 0.03,
      post: function* (ctx, S, r) { yield* dabs(ctx, S, r, 700 * (S / 512) ** 2, ['rgba(255,255,255,0.9)', 'rgba(220,235,255,0.8)'], 0.5, 0.9); } }),
    ice: (S, r) => (function* () {
      const res = yield* ground(S, r, { pal: [[0, '#5f8aa0'], [0.45, '#8fb4c6'], [0.8, '#bcd6e2'], [1, '#e2eef3']], pal2: [[0, '#6b8f9e'], [0.5, '#a3c2cf'], [1, '#e8f2f6']], p: 3, warp: 120, shade: 0.8, grain: 0.03 });
      const V = yield* voronoi(S, 5, r, 0.9), ctx = res.canvas.getContext('2d'), id = ctx.getImageData(0, 0, S, S), d = id.data, k = S / 512;
      for (let i = 0; i < S * S; i++) { const e = V.D2[i] - V.D1[i]; if (e < 2.2 * k) { const a = (1 - e / (2.2 * k)) * 0.75; d[i * 4] += (245 - d[i * 4]) * a; d[i * 4 + 1] += (250 - d[i * 4 + 1]) * a; d[i * 4 + 2] += (255 - d[i * 4 + 2]) * a; res.H[i] *= 0.85; } else if (e < 5 * k) { d[i * 4] *= 0.93; d[i * 4 + 1] *= 0.95; } }
      ctx.putImageData(id, 0, 0); yield* dabs(ctx, S, r, 160 * (S / 512) ** 2, ['rgba(255,255,255,0.45)', 'rgba(230,245,255,0.35)'], 0.8, 2.2); return res; })(),
    sand: (S, r) => ground(S, r, { pal: [[0, '#a68a5c'], [0.5, '#c8ad7c'], [1, '#e1caa0']], pal2: [[0, '#ab9064'], [0.5, '#cdb487'], [1, '#e4d0aa']], str: [1, 16, 3, 0.45], warp: 70, shade: 3, grain: 0.09 }),
    sand_red: (S, r) => ground(S, r, { pal: [[0, '#7e4a31'], [0.5, '#a96d4a'], [1, '#c99267']], pal2: [[0, '#8a5a3a'], [0.5, '#b37e57'], [1, '#d3a47a']], str: [1, 16, 3, 0.45], warp: 70, shade: 3, grain: 0.09,
      post: function* (ctx, S, r) { yield* pebbles(ctx, S, r, 90 * (S / 512) ** 2, hex('#8a5a40'), 1.5, 4); } }),
    rock: (S, r) => ground(S, r, { pal: [[0, '#3f3c38'], [0.35, '#615c55'], [0.7, '#837d73'], [1, '#a59f93']], pal2: [[0, '#45423b'], [0.5, '#6e6a5e'], [1, '#9c9886']], p: 3, ridge: true, warp: 90, shade: 6, grain: 0.08, hk: 7,
      post: function* (ctx, S, r, H, M) { yield* dabs(ctx, S, r, 260 * (S / 512) ** 2, ['rgba(150,160,110,0.45)', 'rgba(185,180,140,0.4)', 'rgba(120,130,95,0.4)'], 2, 6, (x, y) => lf(M, x, y) > 0.55); } }),
    rock_dark: (S, r) => ground(S, r, { pal: [[0, '#1c1b1b'], [0.4, '#2f2d2c'], [0.75, '#46423f'], [1, '#625c57']], pal2: [[0, '#1d1d20'], [0.5, '#34343a'], [1, '#585a60']], p: 3, ridge: true, warp: 90, shade: 7, grain: 0.08, hk: 7 }),
    mud: (S, r) => ground(S, r, { pal: [[0, '#2e241a'], [0.45, '#47392a'], [0.8, '#5e4d39'], [1, '#76644c']], pal2: [[0, '#2a2219'], [0.5, '#3d3224'], [1, '#5a4c3a']], warp: 80, shade: 2.5, grain: 0.06,
      post: function* (ctx, S, r, H, M) { yield* dabs(ctx, S, r, 120 * (S / 512) ** 2, ['rgba(120,125,120,0.18)', 'rgba(160,165,160,0.14)'], 6, 16, (x, y) => lf(M, x, y) > 0.6);
        yield* pebbles(ctx, S, r, 60 * (S / 512) ** 2, hex('#5d5246'), 1.5, 3.5); } }),
    dirt_road: (S, r) => ground(S, r, { pal: [[0, '#56462f'], [0.5, '#7b6648'], [1, '#9c8564']], pal2: [[0, '#5e5036'], [0.5, '#857155'], [1, '#a8936f']], warp: 60, shade: 2, grain: 0.1,
      post: function* (ctx, S, r) { yield* pebbles(ctx, S, r, 340 * (S / 512) ** 2, hex('#7d7366'), 1.2, 3.6); yield* dabs(ctx, S, r, 900 * (S / 512) ** 2, ['rgba(60,48,32,0.35)', 'rgba(170,150,115,0.3)'], 0.6, 1.4); } }),
    moss: (S, r) => ground(S, r, { pal: [[0, '#263016'], [0.4, '#3e4d21'], [0.75, '#5d6d2e'], [1, '#7f8b3f']], pal2: [[0, '#2c3418'], [0.5, '#4f5b27'], [1, '#8d9246']], p: 6, oct: 6, warp: 30, shade: 4, grain: 0.14,
      post: function* (ctx, S, r) { yield* dabs(ctx, S, r, 1800 * (S / 512) ** 2, ['rgba(150,160,80,0.35)', 'rgba(40,52,22,0.4)', 'rgba(110,125,55,0.35)'], 0.8, 2.2); } }),
    cobble: (S, r) => cobble(S, r, { n: 9, pal: [[0, '#4b4741'], [0.5, '#6f6a61'], [1, '#948d80']], mortar: [[0, '#2a241d'], [0.5, '#3d352b'], [1, '#544a3d']], moss: hex('#4a5428') }),
    stone_wall: (S, r) => blocks(S, r, { rows: 8, pal: [[0, '#6a655c'], [0.5, '#8a8476'], [1, '#aca592']], mortar: [[0, '#4d473e'], [1, '#6e675a']], stain: hex('#4f5040') }),
    stone_dark: (S, r) => blocks(S, r, { rows: 7, wmin: 0.12, wvar: 0.2, mw: 3.5, bev: 9, pal: [[0, '#25252a'], [0.5, '#3a3a40'], [1, '#55545a']], mortar: [[0, '#161618'], [1, '#26262a']], stain: hex('#2a3028') }),
    plaster: (S, r) => ground(S, r, { pal: [[0, '#a99d86'], [0.4, '#c4b9a2'], [0.8, '#d6ccb6'], [1, '#e2d9c5']], pal2: [[0, '#9f9480'], [0.5, '#bdb29b'], [1, '#d9cfba']], p: 3, oct: 6, warp: 40, shade: 1.5, grain: 0.05, mlo: 0.55, mhi: 0.8,
      post: function* (ctx, S, r) { const k = S / 512; ctx.strokeStyle = 'rgba(80,70,58,0.35)'; ctx.lineWidth = 0.9 * k;
        for (let n = 0; n < 7; n++) { let x = r() * S, y = r() * S, a = r() * 6.28; const p = new Path2D(); p.moveTo(x, y); for (let s = 0; s < 14; s++) { a += (r() - 0.5) * 1.2; x += Math.cos(a) * 5 * k; y += Math.sin(a) * 5 * k; p.lineTo(x, y); } wrapDraw(S, x, y, 80 * k, (px, py) => { ctx.save(); ctx.translate(px - x, py - y); ctx.stroke(p); ctx.restore(); }); }
        yield* dabs(ctx, S, r, 40 * (S / 512) ** 2, ['rgba(120,105,80,0.08)', 'rgba(90,85,70,0.07)'], 20, 50); } }),
    wood_planks: (S, r) => planks(S, r),
    roof_tiles_red: (S, r) => roof(S, r, { rows: 10, cols: 9, round: true, gx: 3, gy: 10, pal: [[0, '#3b1d14'], [0.35, '#6e3423'], [0.7, '#94503a'], [1, '#b8775a']], moss: '#5e5a34' }),
    roof_slate: (S, r) => roof(S, r, { rows: 12, cols: 7, jit: 0.3, gx: 6, gy: 6, pal: [[0, '#1f2328'], [0.4, '#3a4048'], [0.75, '#545b63'], [1, '#737b82']], moss: '#4c5a3a' }),
    roof_thatch: (S, r) => roof(S, r, { rows: 6, cols: 3, gx: 64, gy: 2, pal: [[0, '#2f2414'], [0.35, '#5f4a2a'], [0.7, '#8c7446'], [1, '#b49b68']] }),
    bark: (S, r) => bark(S, r, { pal: [[0, '#1d1611'], [0.35, '#3a2e24'], [0.7, '#5c4d3f'], [1, '#7d6e5e']] }),
    bark_birch: (S, r) => bark(S, r, { birch: true, pal: [[0, '#8f8a80'], [0.5, '#cbc6ba'], [1, '#e8e4da']] }),
    leaves: (S, r) => leafMass(S, r),
  };
  const NAMES = Object.keys(TEX);

  /* ---------- plants: painted with a trunk, limbs and many leaf clusters (each a soft blob of small leaf dabs) ---------- */
  const PAL = {
    oak: ['#1b2412', '#33431f', '#54652f', '#7c8645', '#a9aa6e'], birch: ['#273516', '#4d6327', '#7a8d3b', '#a3ad56', '#cfcd87'],
    ash: ['#1a2719', '#334a2c', '#527043', '#7d9465', '#aab78f'], apple: ['#1c2c14', '#365224', '#5a7a37', '#83a052', '#b3bf80'],
    olive: ['#262d22', '#465140', '#6c7862', '#949d86', '#bcc1ad'], willow: ['#223019', '#435a2a', '#6a8140', '#97a65f', '#c2c58c'],
    weirwood: ['#360c0b', '#6a1a16', '#952e22', '#bb5234', '#d98a5e'], cypress: ['#11180f', '#1f2c1a', '#344630', '#536650', '#7d8b72'],
    fir: ['#0d1712', '#1a2c22', '#2f4636', '#4c6553', '#73887a'], pine: ['#131d13', '#253824', '#3f553a', '#62775a', '#8d9b80'],
    shrub: ['#18240f', '#304221', '#4f6534', '#768a50', '#a0ad78'], dry: ['#3a3322', '#5c5234', '#80744a', '#a59766', '#c7bb8c'],
    heather: ['#2a1f2a', '#4c3550', '#74557a', '#9c7aa0', '#c2a6c2'], palm: ['#1c2512', '#3a4a22', '#5d6e35', '#87924f', '#b3b67a'],
  };
  for (const k in PAL) PAL[k] = PAL[k].map(hex);
  const BARK = { brown: [hex('#2a2018'), hex('#6e5c48')], grey: [hex('#3a3632'), hex('#837a6c')], birch: [hex('#5d5850'), hex('#e4e0d4')], white: [hex('#8f887c'), hex('#ece7dc')],
    pine: [hex('#3a2418'), hex('#9a6644')], palm: [hex('#4a3c2a'), hex('#9c8762')], dead: [hex('#3c3833'), hex('#9a9184')] };

  function limb(ctx, x0, y0, x1, y1, w0, w1, B, bend) {
    const dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l, mx = (x0 + x1) / 2 + nx * (bend || 0), my = (y0 + y1) / 2 + ny * (bend || 0);
    ctx.fillStyle = css(B[0]); ctx.beginPath(); ctx.moveTo(x0 + nx * w0, y0 + ny * w0); ctx.quadraticCurveTo(mx + nx * (w0 + w1) / 2, my + ny * (w0 + w1) / 2, x1 + nx * w1, y1 + ny * w1);
    ctx.lineTo(x1 - nx * w1, y1 - ny * w1); ctx.quadraticCurveTo(mx - nx * (w0 + w1) / 2, my - ny * (w0 + w1) / 2, x0 - nx * w0, y0 - ny * w0); ctx.closePath(); ctx.fill();
    const s = nx < 0 || (nx === 0 && ny < 0) ? 1 : -1;   // the side facing the upper left gets the light
    ctx.strokeStyle = css(B[1], 1, 0.75); ctx.lineWidth = Math.max(0.6, (w0 + w1) * 0.35); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x0 + s * nx * w0 * 0.45, y0 + s * ny * w0 * 0.45); ctx.quadraticCurveTo(mx + s * nx * (w0 + w1) * 0.22, my + s * ny * (w0 + w1) * 0.22, x1 + s * nx * w1 * 0.45, y1 + s * ny * w1 * 0.45); ctx.stroke();
  }
  // one leaf cluster: a dark core, then small dabs sorted so the lit ones (upper left of the cluster and of the crown) come last
  function cluster(ctx, rnd, cx, cy, R, P, gl, o) {
    const n = Math.round(R * R * (o.dens || 0.3)) + 8, ls = o.leaf || 2.4, el = o.el || 0.55;
    ctx.fillStyle = css(P[0], 1, 0.9); ctx.beginPath(); ctx.ellipse(cx + R * 0.08, cy + R * 0.12, R * 0.78, R * 0.66, 0, 0, 6.283); ctx.fill();
    const D = [];
    for (let i = 0; i < n; i++) {
      const a = rnd() * 6.283, r = Math.sqrt(rnd()) * R, x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * 0.86;
      const l = 0.5 - ((x - cx) * 0.55 + (y - cy) * 0.8) / R * 0.5;
      D.push([clamp(l * 0.55 + gl * 0.45 + (rnd() - 0.5) * 0.28, 0, 1), x, y, rnd()]);
    }
    D.sort((a, b) => a[0] - b[0]);
    for (const d of D) {
      ctx.fillStyle = css(ramp(P, d[0] * 0.92)); ctx.beginPath(); ctx.ellipse(d[1], d[2], ls * (0.7 + d[3] * 0.6), ls * el * (0.8 + d[3] * 0.5), o.ang != null ? o.ang + (d[3] - 0.5) * 0.8 : d[3] * 6.28, 0, 6.283); ctx.fill();
    }
    if (gl > 0.45) {   // rim light on the upper left edge of the lit clusters
      ctx.fillStyle = css(P[P.length - 1], 1, 0.55 * (gl - 0.3));
      for (let i = 0; i < n * 0.12; i++) { const a = 3.4 + rnd() * 1.6, r = R * (0.75 + rnd() * 0.25); ctx.beginPath(); ctx.ellipse(cx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.86, ls * 0.8, ls * el * 0.8, rnd() * 3, 0, 6.283); ctx.fill(); }
    }
    if (o.fruit && rnd() < o.fruit) { for (let i = 0; i < 2; i++) { const x = cx + (rnd() - 0.5) * R, y = cy + (rnd() - 0.2) * R * 0.7; ctx.fillStyle = css(hex('#7d2a1e')); ctx.beginPath(); ctx.arc(x, y, ls * 0.9, 0, 6.283); ctx.fill(); ctx.fillStyle = css(hex('#c0604a'), 1, 0.8); ctx.beginPath(); ctx.arc(x - ls * 0.3, y - ls * 0.3, ls * 0.35, 0, 6.283); ctx.fill(); } }
  }
  // a broadleaf crown: clusters inside an envelope, a back layer (dark), limbs, a front layer (lit)
  function* crown(ctx, rnd, W, o) {
    const C = [];
    for (let i = 0; i < o.n; i++) {
      let x, y, t = 0; do { const a = rnd() * 6.283, r = Math.sqrt(rnd()); x = o.cx + Math.cos(a) * r * o.rx; y = o.cy + Math.sin(a) * r * o.ry; t++; } while (o.inside && !o.inside(x, y) && t < 20);
      C.push({ x, y, R: o.r0 + rnd() * (o.r1 - o.r0) });
    }
    const gl = c => clamp(0.55 - ((c.x - o.cx) / o.rx * 0.45 + (c.y - o.cy) / o.ry * 0.6) * 0.55, 0.05, 1);
    for (const c of C) { cluster(ctx, rnd, c.x + 3, c.y + 4, c.R * 1.05, o.P, gl(c) * 0.45, o); }
    yield;
    if (o.limbs) o.limbs(C);
    C.sort((a, b) => a.y - b.y);
    for (const c of C) if (rnd() < (o.front || 0.7)) cluster(ctx, rnd, c.x, c.y, c.R * 0.8, o.P, gl(c), o);
    yield;
    return C;
  }
  function trunk(ctx, rnd, x, y0, y1, wb, wt, B, lean = 0) {
    const segs = 6; let px = x, py = y0;
    for (let s = 0; s < segs; s++) { const t0 = s / segs, t1 = (s + 1) / segs, nx = x + lean * t1 * t1 + (rnd() - 0.5) * wb * 0.25, ny = y0 + (y1 - y0) * t1;
      limb(ctx, px, py, nx, ny, wb + (wt - wb) * t0, wb + (wt - wb) * t1, B, 0); px = nx; py = ny; }
    ctx.fillStyle = css(B[0]); ctx.beginPath(); ctx.ellipse(x, y0, wb * 1.6, wb * 0.4, 0, 0, 6.283); ctx.fill();   // root flare
    ctx.strokeStyle = css(B[0], 0.7, 0.5); ctx.lineWidth = 0.7;   // bark cracks
    for (let i = 0; i < wb * 1.2; i++) { const xx = x + (rnd() - 0.5) * wb * 1.2, yy = y0 - rnd() * (y0 - y1) * 0.8; ctx.beginPath(); ctx.moveTo(xx, yy); ctx.lineTo(xx + (rnd() - 0.5), yy - 4 - rnd() * 10); ctx.stroke(); }
    return [px, py];
  }
  function ground_shadow(ctx, x, y, rx) { const g = ctx.createRadialGradient(x, y, 0, x, y, rx); g.addColorStop(0, 'rgba(10,12,8,0.45)'); g.addColorStop(1, 'rgba(10,12,8,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y, rx, rx * 0.22, 0, 0, 6.283); ctx.fill(); }

  // conifer: layered drooping tiers of needle dabs, bottom first; snow on the top surfaces
  function* conifer(ctx, rnd, W, o) {
    const cx = W / 2, base = o.base, top = o.top, n = o.tiers, P = o.P;
    trunk(ctx, rnd, cx, base + 2, top + (base - top) * 0.15, o.tw, o.tw * 0.3, o.B);
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1), y = o.y0 - (o.y0 - top) * Math.pow(t, o.curve || 1), w = o.w * Math.pow(1 - t * 0.92, o.shape || 1) * (0.85 + rnd() * 0.3) + 3;
      ctx.fillStyle = css(P[0]); ctx.beginPath(); ctx.moveTo(cx - w * 0.6, y + w * 0.16 * o.droop); ctx.quadraticCurveTo(cx, y - w * 0.32, cx + w * 0.6, y + w * 0.16 * o.droop); ctx.lineTo(cx, y + w * 0.12); ctx.fill();
      const nb = Math.max(2, Math.round(w / 12));
      for (let s = -1; s <= 1; s += 2) for (let b = 0; b < nb; b++) {
        const len = w * (0.55 + 0.45 * (b + 1) / nb) * (0.85 + rnd() * 0.25), yb = y - (rnd() * 0.5) * (o.gap || 8), dr = o.droop * len * 0.35;
        const steps = Math.max(5, len / 1.8);
        for (let k = 0; k < steps; k++) {
          const u = k / steps, bx = cx + s * len * u, by = yb + dr * u * u - len * 0.08 * u * (1 - u) * 2, th = (o.th || 5) * (1 - u * 0.65) + 1;
          for (let q = 0; q < 3; q++) {
            const off = (rnd() - 0.6) * th * 2, side = s < 0 ? 0.12 : -0.08, v = clamp(0.62 - off / th * 0.28 + side + (1 - t) * -0.12 + (rnd() - 0.5) * 0.25 - (1 - u) * 0.12, 0, 1);
            ctx.fillStyle = css(ramp(P, v)); ctx.beginPath(); ctx.ellipse(bx + (rnd() - 0.5) * 2, by + off, 2.3, 1.0, s * (0.35 + u * 0.5) + (rnd() - 0.5) * 0.6, 0, 6.283); ctx.fill();
          }
          if (o.snow && u > 0.12 && u < 0.92 && rnd() < o.snow) {
            ctx.fillStyle = css(hex('#9fb0c0'), 1, 0.8); ctx.beginPath(); ctx.ellipse(bx + 0.6, by - th * 0.45 + 1.2, 2.8, 1.3, s * 0.4, 0, 6.283); ctx.fill();
            ctx.fillStyle = css(hex(s < 0 ? '#f4f7fa' : '#dde5ec')); ctx.beginPath(); ctx.ellipse(bx, by - th * 0.55, 2.6, 1.2, s * 0.4, 0, 6.283); ctx.fill();
          }
        }
      }
      if ((i & 1) === 1) yield;
    }
    // the leader at the top
    ctx.strokeStyle = css(P[2]); ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(cx, top + 10); ctx.lineTo(cx + 0.5, top - 2); ctx.stroke();
    if (o.snow) { ctx.fillStyle = '#eef2f6'; ctx.beginPath(); ctx.ellipse(cx, top + 4, 2.4, 3.5, 0, 0, 6.283); ctx.fill(); }
  }

  function* branchy(ctx, rnd, x, y, a, len, w, depth, B, tips) {   // recursive bare limbs → tips [[x, y]]
    const x1 = x + Math.cos(a) * len, y1 = y + Math.sin(a) * len;
    limb(ctx, x, y, x1, y1, w, w * 0.62, B, (rnd() - 0.5) * len * 0.15);
    if (depth <= 0 || len < 5) { tips.push([x1, y1]); return; }
    const k = 1 + (rnd() < 0.55 ? 1 : 0) + (depth > 2 && rnd() < 0.3 ? 1 : 0);
    for (let i = 0; i < k + 1; i++) yield* branchy(ctx, rnd, x1, y1, a + (rnd() - 0.5) * 1.3 + (i - k / 2) * 0.35, len * (0.62 + rnd() * 0.18), w * 0.62, depth - 1, B, tips);
  }

  function blade(ctx, x, y, h, bend, w, col) { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(x - w, y); ctx.quadraticCurveTo(x + bend * 0.4, y - h * 0.6, x + bend, y - h); ctx.quadraticCurveTo(x + bend * 0.4 + w * 0.3, y - h * 0.6, x + w, y); ctx.fill(); }
  function* tuft(ctx, rnd, cx, base, n, h, spread, P, o = {}) {
    const B = [];
    for (let i = 0; i < n; i++) { const x = cx + (rnd() - 0.5) * spread, hh = h * (0.45 + rnd() * 0.55), bend = (x - cx) * (0.6 + rnd()) + (rnd() - 0.5) * h * 0.4; B.push([rnd(), x, hh, bend]); }
    B.sort((a, b) => a[0] - b[0]);
    for (const b of B) { const v = clamp(0.2 + b[0] * 0.75, 0, 1); blade(ctx, b[1], base, b[2], b[3], o.w || 1.6, css(ramp(P, v))); if (o.seed && b[0] > 0.7) { ctx.fillStyle = css(P[P.length - 1], 0.95); ctx.beginPath(); ctx.ellipse(b[1] + b[3], base - b[2] - 3, 1.4, 4, b[3] * 0.02, 0, 6.283); ctx.fill(); } }
    yield;
  }
  function flower(ctx, x, y, r, col, eye) { const c = hex(col); for (let p = 0; p < 5; p++) { const a = p * 1.2566 - 1.2; ctx.fillStyle = css(c, 0.85 + (p % 2) * 0.2); ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * r * 0.7, y + Math.sin(a) * r * 0.55, r * 0.6, r * 0.42, a, 0, 6.283); ctx.fill(); } ctx.fillStyle = css(c, 1.25, 0.8); ctx.beginPath(); ctx.ellipse(x - r * 0.3, y - r * 0.3, r * 0.4, r * 0.3, 0, 0, 6.283); ctx.fill(); ctx.fillStyle = eye || '#d1a83c'; ctx.beginPath(); ctx.arc(x, y, r * 0.28, 0, 6.283); ctx.fill(); }
  function* flowers(ctx, rnd, W, base, col, P) {
    yield* tuft(ctx, rnd, W / 2, base, 26, 46, 60, P);
    for (let i = 0; i < 9; i++) { const x = W / 2 + (rnd() - 0.5) * 70, h = 40 + rnd() * 45, bend = (rnd() - 0.5) * 16;
      ctx.strokeStyle = css(P[1]); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x, base); ctx.quadraticCurveTo(x + bend * 0.3, base - h * 0.5, x + bend, base - h); ctx.stroke();
      blade(ctx, x + bend * 0.2, base - h * 0.3, 10, (rnd() - 0.5) * 14, 1.4, css(P[2]));
      flower(ctx, x + bend, base - h, 5 + rnd() * 2.5, col); }
    yield* tuft(ctx, rnd, W / 2, base, 10, 26, 70, P);
  }

  // every kind: w = canvas width at plant height 256, worldH = world units tall, paint(ctx, rnd, W, H) in 256-px units
  const KIND = {
    pine: { w: 150, worldH: 210, paint: function* (c, r, W) { yield* conifer(c, r, W, { base: 248, top: 8, y0: 150, tiers: 10, w: 62, tw: 6, droop: 0.7, th: 4.5, gap: 10, shape: 0.8, curve: 1.1, P: PAL.pine, B: BARK.pine }); } },
    fir: { w: 150, worldH: 190, paint: function* (c, r, W) { yield* conifer(c, r, W, { base: 248, top: 6, y0: 236, tiers: 14, w: 66, tw: 5, droop: 0.9, th: 5.5, shape: 1, P: PAL.fir, B: BARK.brown }); } },
    spruce_snow: { w: 130, worldH: 180, paint: function* (c, r, W) { yield* conifer(c, r, W, { base: 248, top: 6, y0: 238, tiers: 15, w: 56, tw: 5, droop: 1.25, th: 5, shape: 1.05, snow: 0.55, P: PAL.fir, B: BARK.brown }); } },
    pine_snow: { w: 150, worldH: 210, paint: function* (c, r, W) { yield* conifer(c, r, W, { base: 248, top: 8, y0: 150, tiers: 10, w: 62, tw: 6, droop: 0.8, th: 4.5, gap: 10, shape: 0.8, curve: 1.1, snow: 0.45, P: PAL.pine, B: BARK.pine }); } },
    birch: { w: 150, worldH: 180, paint: function* (c, r, W) {
      const [tx, ty] = trunk(c, r, W / 2, 248, 70, 5, 2, BARK.white, 4);
      c.fillStyle = css(hex('#25211d'), 1, 0.85); for (let i = 0; i < 14; i++) { const y = 240 - r() * 165; c.fillRect(W / 2 - 4 + (r() - 0.5) * 2 + (240 - y) / 180 * 4 * ((240 - y) / 180), y, 3 + r() * 4, 1 + r() * 1.5); }
      yield* crown(c, r, W, { n: 30, cx: W / 2 + 4, cy: 78, rx: 46, ry: 66, r0: 9, r1: 15, P: PAL.birch, dens: 0.22, leaf: 2.1, front: 0.6, limbs: C => C.slice(0, 8).forEach(k => limb(c, tx, ty + 30 + r() * 40, k.x, k.y, 1.6, 0.6, BARK.white, 4)) }); } },
    oak: { w: 256, worldH: 170, paint: function* (c, r, W) {
      const [tx, ty] = trunk(c, r, W / 2, 250, 120, 14, 8, BARK.brown, 3);
      yield* crown(c, r, W, { n: 40, cx: W / 2, cy: 92, rx: 100, ry: 64, r0: 16, r1: 26, P: PAL.oak, dens: 0.26, leaf: 2.6, inside: (x, y) => y < 150,
        limbs: C => C.filter((k, i) => i % 3 === 0).forEach(k => limb(c, tx, ty + 10, k.x, k.y + 6, 5, 1.5, BARK.brown, (r() - 0.5) * 20)) }); } },
    oak_windbent: { w: 256, worldH: 150, paint: function* (c, r, W) {
      const [tx, ty] = trunk(c, r, W / 2 - 30, 250, 130, 12, 6, BARK.brown, 50);
      yield* crown(c, r, W, { n: 34, cx: W / 2 + 34, cy: 108, rx: 96, ry: 44, r0: 14, r1: 23, P: PAL.oak, dens: 0.26, leaf: 2.5, ang: 0.2,
        limbs: C => C.filter((k, i) => i % 3 === 0).forEach(k => limb(c, tx, ty + 6, k.x, k.y + 4, 4, 1.2, BARK.brown, -8)) }); } },
    willow: { w: 256, worldH: 160, paint: function* (c, r, W) {
      const [tx, ty] = trunk(c, r, W / 2, 250, 120, 11, 6, BARK.grey, -6);
      const C = yield* crown(c, r, W, { n: 22, cx: W / 2, cy: 78, rx: 86, ry: 44, r0: 15, r1: 22, P: PAL.willow, dens: 0.24, leaf: 2.3, el: 0.4, ang: 1.5, front: 0.5,
        limbs: C => C.slice(0, 7).forEach(k => limb(c, tx, ty + 8, k.x, k.y, 4, 1.2, BARK.grey, -14)) });
      for (let i = 0; i < 70; i++) {   // the hanging curtain
        const x0 = W / 2 + (r() - 0.5) * 190, y0 = 60 + r() * 50, len = 70 + r() * 90 - Math.abs(x0 - W / 2) * 0.3, gl = clamp(0.6 - (x0 - W / 2) / 120, 0.1, 0.95);
        for (let k = 0; k < len; k += 2.6) { const x = x0 + Math.sin(k * 0.04 + i) * 3 + k * (x0 - W / 2) * 0.0015, y = y0 + k; c.fillStyle = css(ramp(PAL.willow, clamp(gl * 0.7 + (r() - 0.5) * 0.35 + (1 - k / len) * 0.15, 0, 1))); c.beginPath(); c.ellipse(x + (r() - 0.5) * 2.5, y, 1.1, 2.6, 0.1, 0, 6.283); c.fill(); }
        if ((i & 15) === 15) yield;
      } } },
    weirwood: { w: 256, worldH: 190, paint: function* (c, r, W) {
      const [tx, ty] = trunk(c, r, W / 2, 250, 110, 17, 9, BARK.white, -4);
      // the carved face, red sap tears
      const fy = 175; c.fillStyle = 'rgba(60,40,36,0.85)'; c.beginPath(); c.ellipse(W / 2 - 6, fy, 4, 2.2, 0.3, 0, 6.283); c.ellipse(W / 2 + 7, fy, 4, 2.2, -0.3, 0, 6.283); c.fill();
      c.beginPath(); c.ellipse(W / 2, fy + 16, 5, 2.6, 0, 0, 6.283); c.fill(); c.strokeStyle = 'rgba(140,24,20,0.85)'; c.lineWidth = 1.3;
      [[-6, 2], [7, 2]].forEach(e => { c.beginPath(); c.moveTo(W / 2 + e[0], fy + e[1]); c.quadraticCurveTo(W / 2 + e[0] + 1, fy + 10, W / 2 + e[0] - 0.5, fy + 18); c.stroke(); });
      yield* crown(c, r, W, { n: 42, cx: W / 2, cy: 86, rx: 104, ry: 64, r0: 15, r1: 25, P: PAL.weirwood, dens: 0.27, leaf: 2.8, el: 0.75, inside: (x, y) => y < 150,
        limbs: C => C.filter((k, i) => i % 3 === 0).forEach(k => limb(c, tx, ty + 12, k.x, k.y + 6, 6, 1.6, BARK.white, (r() - 0.5) * 30)) }); } },
    ash: { w: 200, worldH: 175, paint: function* (c, r, W) {
      const [tx, ty] = trunk(c, r, W / 2, 250, 120, 9, 5, BARK.grey, 2);
      yield* crown(c, r, W, { n: 46, cx: W / 2, cy: 84, rx: 70, ry: 76, r0: 11, r1: 18, P: PAL.ash, dens: 0.24, leaf: 2.1, el: 0.45,
        limbs: C => C.filter((k, i) => i % 3 === 0).forEach(k => limb(c, tx, ty + 14, k.x, k.y + 4, 3.5, 1, BARK.grey, (r() - 0.5) * 16)) }); } },
    apple: { w: 220, worldH: 110, paint: function* (c, r, W) {
      const [tx, ty] = trunk(c, r, W / 2, 250, 160, 10, 6, BARK.brown, 6);
      yield* crown(c, r, W, { n: 34, cx: W / 2, cy: 118, rx: 90, ry: 60, r0: 14, r1: 22, P: PAL.apple, dens: 0.27, leaf: 2.4, fruit: 0.35, inside: (x, y) => y < 182,
        limbs: C => C.filter((k, i) => i % 3 === 0).forEach(k => limb(c, tx, ty + 6, k.x, k.y + 6, 4, 1.2, BARK.brown, (r() - 0.5) * 22)) }); } },
    olive: { w: 220, worldH: 100, paint: function* (c, r, W) {
      trunk(c, r, W / 2 - 4, 250, 170, 13, 8, BARK.grey, 10);
      const L = [[W / 2 - 40, 130], [W / 2 + 34, 120], [W / 2 + 4, 104]]; L.forEach(p => limb(c, W / 2 + 4, 176, p[0], p[1], 6, 2, BARK.grey, (r() - 0.5) * 30));
      yield* crown(c, r, W, { n: 34, cx: W / 2, cy: 112, rx: 92, ry: 52, r0: 13, r1: 21, P: PAL.olive, dens: 0.17, leaf: 2.3, el: 0.35, front: 0.6 }); } },
    cypress: { w: 90, worldH: 200, paint: function* (c, r, W) {
      trunk(c, r, W / 2, 250, 200, 4, 3, BARK.brown);
      const C = []; for (let i = 0; i < 46; i++) { const t = r(), y = 236 - t * 226, wv = 24 * Math.sin(Math.pow(t, 0.75) * Math.PI) * (t < 0.15 ? 0.7 + t * 2 : 1) + 2; C.push({ x: W / 2 + (r() - 0.5) * 2 * wv * 0.7, y, R: 7 + wv * 0.35 }); }
      C.sort((a, b) => b.y - a.y);
      for (const k of C) cluster(c, r, k.x + 2, k.y + 2, k.R, PAL.cypress, 0.15, { dens: 0.4, leaf: 1.8, el: 0.6, ang: -1.4 });
      yield; for (const k of C) cluster(c, r, k.x, k.y, k.R * 0.75, PAL.cypress, clamp(0.6 - (k.x - W / 2) / 30, 0.1, 1), { dens: 0.4, leaf: 1.8, el: 0.6, ang: -1.4 }); } },
    palm: { w: 220, worldH: 190, paint: function* (c, r, W) {
      let px = W / 2, py = 250; const bend = 24 + r() * 16;
      for (let s = 0; s < 14; s++) { const t = (s + 1) / 14, nx = W / 2 + bend * t * t, ny = 250 - 190 * t; limb(c, px, py, nx, ny, 6 - t * 2, 6 - t * 2.2, BARK.palm, 0); c.strokeStyle = css(BARK.palm[0], 0.8, 0.8); c.lineWidth = 1; c.beginPath(); c.moveTo(nx - 5, ny + 2); c.lineTo(nx + 5, ny); c.stroke(); px = nx; py = ny; }
      const fr = 13; yield;
      for (let f = 0; f < fr; f++) {
        const a = -Math.PI / 2 + (f / (fr - 1) - 0.5) * 3.6 + (r() - 0.5) * 0.2, len = 58 + r() * 26, dry = f % 6 === 0;
        const P = dry ? PAL.dry : PAL.palm, gl = clamp(0.55 - Math.cos(a) * 0.35 + (Math.sin(a) > 0 ? -0.25 : 0.1), 0.05, 1);
        for (let k = 0; k < 1; k += 0.035) { const x = px + Math.cos(a) * len * k, y = py + Math.sin(a) * len * k + len * 0.55 * k * k, lw = 13 * Math.sin(Math.PI * Math.min(1, k * 1.2)) + 2;
          for (const s of [-1, 1]) { c.strokeStyle = css(ramp(P, clamp(gl + s * 0.12 + (r() - 0.5) * 0.2, 0, 1))); c.lineWidth = 1.2; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a + s * 1.2 + 0.6) * lw, y + Math.sin(a + s * 1.2 + 0.6) * lw + lw * 0.6); c.stroke(); } }
        c.strokeStyle = css(P[1]); c.lineWidth = 1.4; c.beginPath(); c.moveTo(px, py); c.quadraticCurveTo(px + Math.cos(a) * len * 0.5, py + Math.sin(a) * len * 0.5 + len * 0.1, px + Math.cos(a) * len, py + Math.sin(a) * len + len * 0.55); c.stroke();
      }
      c.fillStyle = css(hex('#4a3a22')); c.beginPath(); c.arc(px, py + 3, 5, 0, 6.283); c.fill(); } },
    dead_tree: { w: 220, worldH: 150, paint: function* (c, r, W) {
      const [tx, ty] = trunk(c, r, W / 2, 250, 140, 10, 6, BARK.dead, 4); const tips = [];
      yield* branchy(c, r, tx, ty, -1.57 + (r() - 0.5) * 0.3, 42, 6, 4, BARK.dead, tips); yield* branchy(c, r, tx, ty + 20, -2.4, 34, 4, 3, BARK.dead, tips); yield* branchy(c, r, tx, ty + 34, -0.6, 32, 4, 3, BARK.dead, tips); } },
    shrub: { w: 140, top: 150, worldH: 45, paint: function* (c, r, W) {
      yield* crown(c, r, W, { n: 22, cx: W / 2, cy: 200, rx: 56, ry: 38, r0: 14, r1: 22, P: PAL.shrub, dens: 0.3, leaf: 2.6, inside: (x, y) => y < 236 }); } },
    gorse: { w: 140, top: 160, worldH: 40, paint: function* (c, r, W) {
      const P = PAL.shrub;
      for (let i = 0; i < 420; i++) { const a = -Math.PI * (0.08 + r() * 0.84), l = 20 + r() * 50, x = W / 2 + (r() - 0.5) * 50, y = 246; const ex = x + Math.cos(a) * l, ey = y + Math.sin(a) * l * 0.9; c.strokeStyle = css(ramp(P, clamp(0.25 + (ey < 210 ? 0.35 : 0) + (ex < W / 2 ? 0.15 : 0) + (r() - 0.5) * 0.3, 0, 1))); c.lineWidth = 1; c.beginPath(); c.moveTo(ex - Math.cos(a) * 8, ey - Math.sin(a) * 8); c.lineTo(ex, ey); c.stroke(); if ((i & 127) === 127) yield; }
      const F = ['#b8902e', '#d0a93e', '#e2c35c']; for (let i = 0; i < 130; i++) { const a = -Math.PI * (0.1 + r() * 0.8), l = 25 + r() * 42; c.fillStyle = F[(r() * 3) | 0]; c.beginPath(); c.ellipse(W / 2 + Math.cos(a) * l * 1.1, 246 + Math.sin(a) * l * 0.85, 1.8, 1.4, 0, 0, 6.283); c.fill(); } } },
    heather: { w: 140, top: 196, worldH: 22, paint: function* (c, r, W) {
      
      yield* tuft(c, r, W / 2, 248, 50, 40, 100, PAL.shrub, { w: 1.2 });
      for (let i = 0; i < 360; i++) { const x = W / 2 + (r() - 0.5) * 110, top = 248 - 40 * (1 - Math.pow(Math.abs(x - W / 2) / 60, 2)), y = top + r() * 22; c.fillStyle = css(ramp(PAL.heather, clamp(0.2 + (248 - y) / 50 + (x < W / 2 ? 0.1 : -0.05) + (r() - 0.5) * 0.3, 0, 1))); c.beginPath(); c.ellipse(x, y, 1.6, 2.2, 0, 0, 6.283); c.fill(); } } },
    reeds: { w: 120, worldH: 50, paint: function* (c, r, W) {
      const P = [hex('#2e3320'), hex('#4f5631'), hex('#757a48'), hex('#9a9a64'), hex('#c0b886')];
      yield* tuft(c, r, W / 2, 250, 40, 230, 70, P, { w: 1.4 });
      for (let i = 0; i < 6; i++) { const x = W / 2 + (r() - 0.5) * 50, h = 160 + r() * 70, bend = (x - W / 2) * 0.4; c.strokeStyle = css(P[2]); c.lineWidth = 1.3; c.beginPath(); c.moveTo(x, 250); c.quadraticCurveTo(x + bend * 0.3, 250 - h * 0.5, x + bend, 250 - h); c.stroke(); c.fillStyle = css(hex('#4b3522')); c.beginPath(); c.ellipse(x + bend, 250 - h + 10, 3, 11, bend * 0.004, 0, 6.283); c.fill(); c.fillStyle = css(hex('#7a5a3c'), 1, 0.7); c.beginPath(); c.ellipse(x + bend - 1, 250 - h + 7, 1.2, 7, 0, 0, 6.283); c.fill(); } } },
    fern: { w: 180, top: 150, worldH: 30, paint: function* (c, r, W) {
      const P = PAL.ash;
      for (let f = 0; f < 11; f++) { const a = -Math.PI / 2 + (f / 10 - 0.5) * 2.7 + (r() - 0.5) * 0.2, len = 70 + r() * 40, gl = clamp(0.55 - Math.cos(a) * 0.3, 0.1, 1);
        for (let k = 0.05; k < 1; k += 0.045) { const x = W / 2 + Math.cos(a) * len * k, y = 248 + Math.sin(a) * len * k + len * 0.5 * k * k, lw = 14 * (1 - k) + 2;
          for (const s of [-1, 1]) { c.fillStyle = css(ramp(P, clamp(gl + s * 0.1 + (r() - 0.5) * 0.2, 0, 1))); c.beginPath(); c.ellipse(x + Math.cos(a + s * 1.3) * lw * 0.5, y + Math.sin(a + s * 1.3) * lw * 0.5 + 1, lw * 0.5, 1.6, a + s * 1.3, 0, 6.283); c.fill(); } }
        if ((f & 3) === 3) yield; } } },
    grass_tuft: { w: 120, top: 124, worldH: 18, paint: function* (c, r, W) { yield* tuft(c, r, W / 2, 250, 46, 120, 60, PAL.shrub, { w: 2 }); } },
    grass_tall: { w: 140, top: 44, worldH: 34, paint: function* (c, r, W) { yield* tuft(c, r, W / 2, 250, 60, 200, 80, [hex('#2a3518'), hex('#46562a'), hex('#6c7a3c'), hex('#959a58'), hex('#bdb67c')], { w: 1.6, seed: 1 }); } },
    flowers_red: { w: 140, top: 150, worldH: 20, paint: function* (c, r, W) { yield* flowers(c, r, W, 250, '#9c3530', PAL.shrub); } },
    flowers_yellow: { w: 140, top: 150, worldH: 20, paint: function* (c, r, W) { yield* flowers(c, r, W, 250, '#c9a43e', PAL.shrub); } },
    flowers_blue: { w: 140, top: 150, worldH: 20, paint: function* (c, r, W) { yield* flowers(c, r, W, 250, '#5d6fa0', PAL.shrub); } },
    flowers_white: { w: 140, top: 150, worldH: 20, paint: function* (c, r, W) { yield* flowers(c, r, W, 250, '#ddd8c8', PAL.shrub); } },
    vines: { w: 140, top: 30, worldH: 60, paint: function* (c, r, W) {
      for (let s = 0; s < 7; s++) { let x = W / 2 + (s - 3) * 14 + (r() - 0.5) * 8, y = 250; const P = PAL.oak; c.strokeStyle = css(BARK.brown[0], 1.2); c.lineWidth = 1.4; c.beginPath(); c.moveTo(x, y);
        const L = []; for (let k = 0; k < 40; k++) { x += (r() - 0.5) * 6; y -= 5 + r() * 2; c.lineTo(x, y); L.push([x, y]); } c.stroke();
        for (const [lx, ly] of L) for (let q = 0; q < 2; q++) { const a = r() * 6.28; c.fillStyle = css(ramp(P, clamp(0.35 + (lx < W / 2 ? 0.15 : 0) + (r() - 0.5) * 0.45, 0, 1))); c.beginPath(); c.ellipse(lx + Math.cos(a) * 4, ly + Math.sin(a) * 3, 3.6, 2.4, a, 0, 6.283); c.fill(); }
        yield; } } },
    cactus_scrub: { w: 160, top: 150, worldH: 50, paint: function* (c, r, W) {
      const tips = [];
      for (let i = 0; i < 5; i++) yield* branchy(c, r, W / 2 + (r() - 0.5) * 30, 250, -1.57 + (r() - 0.5) * 1.6, 26, 2.2, 3, BARK.dead, tips);
      for (const [x, y] of tips) cluster(c, r, x, y, 6, PAL.olive, clamp(0.6 - (x - W / 2) / 80, 0.1, 1), { dens: 0.35, leaf: 1.4 });
      const G = [hex('#2e3a28'), hex('#4b5c3e'), hex('#6f805c'), hex('#97a47e')];   // a paddle cactus in front
      const pad = (x, y, rx, ry, a) => { c.fillStyle = css(G[1]); c.beginPath(); c.ellipse(x, y, rx, ry, a, 0, 6.283); c.fill(); c.fillStyle = css(G[2], 1, 0.8); c.beginPath(); c.ellipse(x - rx * 0.25, y - ry * 0.2, rx * 0.55, ry * 0.65, a, 0, 6.283); c.fill(); c.fillStyle = css(G[3], 1, 0.7); for (let k = 0; k < 8; k++) c.fillRect(x + (r() - 0.5) * rx * 1.4, y + (r() - 0.5) * ry * 1.4, 1, 1); };
      pad(W / 2 + 10, 228, 11, 18, 0.1); pad(W / 2 - 2, 206, 9, 14, -0.5); pad(W / 2 + 24, 208, 8, 13, 0.6); } },
    mushroom: { w: 120, top: 180, worldH: 12, paint: function* (c, r, W) {
      const caps = ['#6b3b26', '#8a4a2e', '#7a5a3a'];
      const M = [[W / 2 - 18, 1], [W / 2 + 8, 1.35], [W / 2 + 28, 0.8], [W / 2 - 36, 0.7]];
      for (const [x, s] of M) { const h = 46 * s, cw = 26 * s, cap = hex(caps[(r() * 3) | 0]);
        c.fillStyle = css(hex('#d8cdb4')); c.beginPath(); c.moveTo(x - 5 * s, 250); c.quadraticCurveTo(x - 3 * s, 250 - h * 0.6, x - 3 * s, 250 - h); c.lineTo(x + 4 * s, 250 - h); c.quadraticCurveTo(x + 4 * s, 250 - h * 0.6, x + 6 * s, 250); c.fill();
        c.fillStyle = css(hex('#9a8f78'), 1, 0.6); c.fillRect(x + 1 * s, 250 - h, 3 * s, h);
        c.fillStyle = css(cap, 0.75); c.beginPath(); c.ellipse(x, 250 - h, cw, cw * 0.42, 0, Math.PI, 0); c.fill();
        c.fillStyle = css(cap); c.beginPath(); c.ellipse(x, 250 - h - 1, cw, cw * 0.55, 0, Math.PI, 0); c.fill();
        c.fillStyle = css(cap, 1.45, 0.75); c.beginPath(); c.ellipse(x - cw * 0.35, 250 - h - cw * 0.3, cw * 0.4, cw * 0.15, -0.2, 0, 6.283); c.fill();
        c.fillStyle = 'rgba(230,220,200,0.6)'; for (let k = 0; k < 5; k++) { c.beginPath(); c.arc(x + (r() - 0.5) * cw * 1.3, 250 - h - r() * cw * 0.4, 1.4 * s, 0, 6.283); c.fill(); } }
      yield* tuft(c, r, W / 2, 250, 14, 24, 100, PAL.shrub); } },
    stump: { w: 140, top: 180, worldH: 25, paint: function* (c, r, W) {
      const B = BARK.brown, x = W / 2, top = 196, rw = 34;
      [[-1, 0.6], [1, 0.5], [-0.5, 0.8], [0.6, 0.7]].forEach(q => limb(c, x + q[0] * rw * 0.6, 238, x + q[0] * rw * 1.5, 250, 7 * q[1], 2, B, 4));
      c.fillStyle = css(B[0]); c.beginPath(); c.moveTo(x - rw, top); c.lineTo(x - rw - 4, 246); c.quadraticCurveTo(x, 254, x + rw + 4, 246); c.lineTo(x + rw, top); c.fill();
      c.fillStyle = css(B[1], 0.8, 0.8); c.beginPath(); c.moveTo(x - rw, top); c.lineTo(x - rw - 3, 244); c.lineTo(x - rw + 10, 247); c.lineTo(x - rw + 9, top + 4); c.fill();
      c.strokeStyle = css(B[0], 0.6, 0.6); c.lineWidth = 1; for (let i = 0; i < 12; i++) { const xx = x - rw + r() * rw * 2; c.beginPath(); c.moveTo(xx, top + 6); c.lineTo(xx + (r() - 0.5) * 3, 246); c.stroke(); }
      c.fillStyle = css(hex('#a08a66')); c.beginPath(); c.ellipse(x, top, rw, 10, 0, 0, 6.283); c.fill();
      c.strokeStyle = css(hex('#6f5a3e'), 1, 0.7); for (let k = 1; k < 6; k++) { c.beginPath(); c.ellipse(x + 1, top, rw * k / 6.2, 10 * k / 6.2, 0, 0, 6.283); c.stroke(); }
      c.strokeStyle = css(hex('#4a3a28')); c.beginPath(); c.moveTo(x + 2, top); c.lineTo(x + rw * 0.7, top + 5); c.stroke();
      yield* tuft(c, r, x, 252, 12, 26, 100, PAL.shrub); } },
  };
  const KINDS = Object.keys(KIND);

  const BIO = {
    north: [['pine', 4], ['fir', 3], ['spruce_snow', 2], ['birch', 1], ['weirwood', 0.15], ['shrub', 1.5], ['fern', 1.5], ['grass_tuft', 3], ['stump', 0.5], ['heather', 1]],
    farnorth: [['spruce_snow', 4], ['pine_snow', 3], ['fir', 1], ['dead_tree', 1], ['weirwood', 0.15], ['grass_tuft', 1], ['shrub', 0.5]],
    wall: [['spruce_snow', 4], ['pine_snow', 2], ['dead_tree', 1], ['grass_tuft', 0.5]],
    beyond: [['spruce_snow', 4], ['pine_snow', 3], ['weirwood', 0.6], ['dead_tree', 1.2], ['grass_tuft', 0.5]],
    winter: [['spruce_snow', 2], ['dead_tree', 2], ['pine_snow', 1]],
    riverlands: [['willow', 3], ['oak', 2], ['ash', 2], ['reeds', 3], ['grass_tall', 3], ['flowers_blue', 1], ['flowers_white', 1], ['shrub', 1.5], ['fern', 1], ['stump', 0.5], ['mushroom', 0.5]],
    vale: [['fir', 3], ['pine', 2], ['birch', 2], ['ash', 1], ['heather', 2], ['gorse', 1], ['grass_tuft', 2], ['flowers_white', 1], ['shrub', 1]],
    crownlands: [['oak', 3], ['ash', 2], ['apple', 1], ['shrub', 2], ['grass_tall', 2], ['flowers_yellow', 1], ['flowers_red', 1], ['fern', 1], ['stump', 0.5], ['vines', 0.4]],
    westerlands: [['pine', 3], ['oak', 2], ['ash', 1], ['gorse', 2], ['heather', 1], ['shrub', 1.5], ['grass_tuft', 2], ['flowers_yellow', 0.8], ['stump', 0.4]],
    westcoast: [['oak_windbent', 3], ['pine', 1], ['gorse', 2], ['heather', 2], ['grass_tall', 2], ['grass_tuft', 2], ['shrub', 1]],
    reach: [['oak', 2], ['apple', 2], ['olive', 1], ['cypress', 1], ['shrub', 1.5], ['grass_tall', 2], ['flowers_red', 1.5], ['flowers_yellow', 1.5], ['flowers_white', 1], ['flowers_blue', 0.8], ['vines', 0.6]],
    stormlands: [['oak_windbent', 3], ['oak', 2], ['ash', 1], ['fir', 1], ['fern', 2], ['grass_tall', 2], ['shrub', 1.5], ['mushroom', 0.6], ['stump', 0.6], ['dead_tree', 0.4]],
    dorne: [['palm', 2], ['olive', 2], ['cypress', 1], ['cactus_scrub', 3], ['dead_tree', 0.6], ['shrub', 0.6], ['grass_tuft', 0.8]],
    ironislands: [['oak_windbent', 1], ['dead_tree', 1], ['heather', 2], ['gorse', 1.5], ['grass_tuft', 2], ['stump', 0.5]],
    dragonstone: [['dead_tree', 2], ['pine', 1], ['gorse', 1], ['heather', 1], ['grass_tuft', 1], ['shrub', 0.6]],
  };
  const BIO_ALIAS = { snow: 'north', desert: 'dorne', storm: 'stormlands', mountain: 'westerlands', sea: 'ironislands', ash: 'dragonstone', city: 'crownlands', coast: 'westcoast', river: 'riverlands', forest: 'crownlands', far: 'farnorth', ice: 'winter' };

  /* ---------- the job pump ---------- */
  const jobs = new Map(), stats = { ms: 0, items: {}, frames: 0, maxSlice: 0, size: 0, plantH: 0, low: false }; T.stats = stats;
  function job(key, mk) { let j = jobs.get(key); if (!j) { j = { key, mk, it: null, done: false, res: null }; jobs.set(key, j); } return j; }
  function run(j, end) {
    if (j.done) return true;
    const t0 = now();
    try { if (!j.it) j.it = j.mk(); let r; do { r = j.it.next(); } while (!r.done && now() < end); if (r.done) { j.done = true; j.res = r.value; j.it = null; } }
    catch (e) { j.done = true; j.it = null; j.res = null; j.err = e; try { console.error('[tex] ' + j.key, e); if (R.err) R.err('tex ' + j.key + ': ' + (e && e.message || e)); } catch (e2) {} }
    const dt = now() - t0; stats.ms += dt; stats.items[j.key] = (stats.items[j.key] || 0) + dt;
    return j.done;
  }
  const make = j => { run(j, Infinity); return j.res; };

  function texJob(name, S) { return job('t:' + name + '@' + S, () => TEX[name](S, prng(hs('tex:' + name)))); }
  function plantJob(kind, v) {
    return job('p:' + kind + '#' + v, () => (function* () {
      const K = KIND[kind], Hp = plantH(), top = K.top || 0, sc = Hp / (256 - top), w = Math.round(K.w * sc), c = mkCanvas(w, Hp), ctx = c.getContext('2d');
      ctx.setTransform(sc, 0, 0, sc, 0, -top * sc); yield* K.paint(ctx, prng(hs('plant:' + kind + ':' + v)), K.w, 256); yield;
      const d = ctx.getImageData(0, 0, w, Hp).data; let x0 = w, y0 = Hp, x1 = -1, y1 = -1;
      for (let y = 0; y < Hp; y++) for (let x = 0; x < w; x++) if (d[(y * w + x) * 4 + 3] > 8) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      if (x1 < 0) { x0 = 0; y0 = 0; x1 = w - 1; y1 = Hp - 1; }
      x0 = Math.max(0, x0 - 2); y0 = Math.max(0, y0 - 2); x1 = Math.min(w - 1, x1 + 2); y1 = Math.min(Hp - 1, y1 + 2);
      const cw = x1 - x0 + 1, ch = y1 - y0 + 1, out = mkCanvas(cw, ch); out.getContext('2d').drawImage(c, x0, y0, cw, ch, 0, 0, cw, ch);
      const ax = K.w / 2 * sc - x0, ay = Math.min(ch, (250 - top) * sc - y0), upp = K.worldH / Math.max(1, ay);
      return { canvas: out, w: cw, h: ch, ax, ay, worldH: Math.round(ch * upp * 10) / 10, kind, variant: v };
    })());
  }

  let queue = null, readyRes, pumping = false, rafSeen = 0;
  T.ready = new Promise(r => { readyRes = r; });
  function common() {
    if (queue) return; const S = baseSize(); stats.size = S; stats.plantH = plantH(); stats.low = low();
    queue = NAMES.map(n => texJob(n, S)).concat(KINDS.map(k => plantJob(k, 0)));
  }
  function pump() {
    pumping = false; common(); stats.frames++;
    const t0 = now(), end = t0 + SLICE;
    while (queue.length && now() < end) { if (run(queue[0], end)) queue.shift(); }
    stats.maxSlice = Math.max(stats.maxSlice, now() - t0);
    if (queue.length) schedule(); else if (readyRes) { readyRes(T); readyRes = null; }
  }
  function schedule() {
    if (pumping) return; pumping = true; let fired = false;
    const go = () => { if (fired) return; fired = true; pump(); };
    if (window.requestAnimationFrame) requestAnimationFrame(() => { rafSeen = now(); go(); });
    setTimeout(go, now() - rafSeen < 500 ? 120 : 40);   // a hidden / throttled tab still finishes
  }
  T.start = () => { common(); if (queue.length) schedule(); else if (readyRes) { readyRes(T); readyRes = null; } return T.ready; };
  if (document.readyState === 'complete') setTimeout(T.start, 400); else window.addEventListener('load', () => setTimeout(T.start, 400));

  /* ---------- the API ---------- */
  const warned = {};
  const known = name => { if (TEX[name]) return true; if (!warned[name]) { warned[name] = 1; try { console.warn('[tex] unknown texture ' + name); } catch (e) {} } return false; };
  const sizeOf = o => { const s = o && (typeof o === 'number' ? o : o.size); return s ? Math.max(16, s | 0) : baseSize(); };
  function painted(name, S) { if (!known(name)) return null; return make(texJob(name, S)); }
  T.names = () => NAMES.slice();
  T.kinds = () => KINDS.slice();
  T.canvas = (name, size) => { const p = painted(name, sizeOf(size)); return p ? p.canvas : null; };
  T.height = (name, o) => { const p = painted(name, sizeOf(o)); return p ? { data: p.H, size: p.S } : null; };
  const avgs = {};
  T.avg = (name, o) => {
    const S = sizeOf(o), k = name + '@' + S; if (avgs[k]) return avgs[k]; const c = T.canvas(name, S); if (!c) return null;
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, m = [0, 0, 0]; let n = 0;
    for (let i = 0; i < d.length; i += 4 * 7) { m[0] += d[i]; m[1] += d[i + 1]; m[2] += d[i + 2]; n++; }
    return (avgs[k] = '#' + m.map(v => Math.round(v / n).toString(16).padStart(2, '0')).join(''));
  };
  function three() { return window.THREE || null; }
  function maxAniso() { try { const r = R.render3d && R.render3d.renderer; return Math.min(4, r && r.capabilities ? r.capabilities.getMaxAnisotropy() || 4 : 4); } catch (e) { return 4; } }
  function setup(t, TH, srgb) {
    t.wrapS = t.wrapT = TH.RepeatWrapping; t.generateMipmaps = true; t.minFilter = TH.LinearMipmapLinearFilter; t.magFilter = TH.LinearFilter; t.anisotropy = maxAniso();
    if (srgb) { if (TH.SRGBColorSpace) t.colorSpace = TH.SRGBColorSpace; else if (TH.sRGBEncoding) t.encoding = TH.sRGBEncoding; }
    else if (TH.NoColorSpace != null && 'colorSpace' in t) t.colorSpace = TH.NoColorSpace;
    t.needsUpdate = true; return t;
  }
  const texs = new Map();
  T.get = (name, o) => {
    const TH = three(); if (!TH || !known(name)) return null;
    const S = sizeOf(o), k = 'c:' + name + '@' + S; let t = texs.get(k); if (t) return t;
    const c = T.canvas(name, S); if (!c) return null;
    t = setup(new TH.CanvasTexture(c), TH, true); t.name = 'tex:' + name; texs.set(k, t); return t;
  };
  T.normalCanvas = (name, o) => {
    const p = painted(name, sizeOf(o)); if (!p) return null; if (p.nc) return p.nc;
    const S = p.S, H = p.H, c = mkCanvas(S, S), x = c.getContext('2d'), id = x.createImageData(S, S), d = id.data, k = p.hk * S / 512 / 65535 * 6;
    for (let y = 0; y < S; y++) for (let xx = 0; xx < S; xx++) {
      const i = y * S + xx, l = H[y * S + (xx + S - 1) % S], r = H[y * S + (xx + 1) % S], u = H[((y + S - 1) % S) * S + xx], dn = H[((y + 1) % S) * S + xx];
      let nx = (l - r) * k, ny = (dn - u) * k, nz = 1; const m = 1 / Math.sqrt(nx * nx + ny * ny + 1); nx *= m; ny *= m; nz *= m;
      d[i * 4] = (nx * 0.5 + 0.5) * 255; d[i * 4 + 1] = (ny * 0.5 + 0.5) * 255; d[i * 4 + 2] = (nz * 0.5 + 0.5) * 255; d[i * 4 + 3] = 255;
    }
    x.putImageData(id, 0, 0); return (p.nc = c);
  };
  T.normal = (name, o) => {
    const TH = three(); if (!TH || !known(name)) return null;
    const S = sizeOf(o), k = 'n:' + name + '@' + S; let t = texs.get(k); if (t) return t;
    const c = T.normalCanvas(name, S); if (!c) return null;
    t = setup(new TH.CanvasTexture(c), TH, false); t.name = 'normal:' + name; texs.set(k, t); return t;
  };
  const variant = seed => { const s = Math.abs(Math.floor(+seed || 0)); return s % 3; };
  T.tree = (kind, seed = 0) => {
    if (!KIND[kind]) { if (!warned['k:' + kind]) { warned['k:' + kind] = 1; try { console.warn('[tex] unknown plant ' + kind); } catch (e) {} } return null; }
    return make(plantJob(kind, variant(seed)));
  };
  T.treeTex = (kind, seed = 0) => {
    const TH = three(), p = T.tree(kind, seed); if (!TH || !p) return null;
    if (p.tex) return p.tex;
    // un-premultiplied pixels, flipped (v = 0 at the feet), the colour of the nearest leaf bled into the clear pixels
    const w = p.w, h = p.h, src = p.canvas.getContext('2d').getImageData(0, 0, w, h).data, out = new Uint8Array(w * h * 4);
    const col = new Uint8ClampedArray(src), has = new Uint8Array(w * h); for (let i = 0; i < w * h; i++) has[i] = src[i * 4 + 3] > 0 ? 1 : 0;
    for (let pass = 0; pass < 4; pass++) {
      const nh = has.slice();
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = y * w + x; if (has[i]) continue; let r = 0, g = 0, b = 0, n = 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= w || Y >= h) continue; const q = Y * w + X; if (has[q]) { r += col[q * 4]; g += col[q * 4 + 1]; b += col[q * 4 + 2]; n++; } }
        if (n) { col[i * 4] = r / n; col[i * 4 + 1] = g / n; col[i * 4 + 2] = b / n; nh[i] = 1; }
      }
      has.set(nh);
    }
    for (let y = 0; y < h; y++) { const sy = h - 1 - y; for (let x = 0; x < w; x++) { const a = (y * w + x) * 4, b = (sy * w + x) * 4; out[a] = col[b]; out[a + 1] = col[b + 1]; out[a + 2] = col[b + 2]; out[a + 3] = src[b + 3]; } }
    const t = new TH.DataTexture(out, w, h, TH.RGBAFormat, TH.UnsignedByteType);
    t.flipY = false; t.premultiplyAlpha = false; t.wrapS = t.wrapT = TH.ClampToEdgeWrapping; t.generateMipmaps = true; t.minFilter = TH.LinearMipmapLinearFilter; t.magFilter = TH.LinearFilter;
    t.anisotropy = maxAniso(); if (TH.SRGBColorSpace) t.colorSpace = TH.SRGBColorSpace; else if (TH.sRGBEncoding) t.encoding = TH.sRGBEncoding;
    t.name = 'plant:' + kind + '#' + p.variant; t.needsUpdate = true; p.tex = t; return t;
  };
  T.biomePlants = biome => { const b = String(biome || '').toLowerCase(), L = BIO[b] || BIO[BIO_ALIAS[b]] || BIO.crownlands; return L.map(e => e.slice()); };
  T.makeAll = () => { common(); const t0 = now(); while (queue.length) { make(queue[0]); queue.shift(); } if (readyRes) { readyRes(T); readyRes = null; } return now() - t0; };
  T._hs = hs; T._prng = prng;
})();
