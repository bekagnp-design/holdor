/* HOLDOR RPG — water (A44): the sea, the rivers and the lakes of Westeros, read from the map art and drawn in the 3D world.
   The art (R.assets.map, 1200×2048) is not blue at sea: the sea is the dark olive wash (≈ 85/91/66), rivers are thin
   blue-purple lines (the Trident), lakes dark blue (the God's Eye). The mask is built once at 1/4 art resolution
   (300×512 cells of 24 world units): dark-olive cells flood-filled from the borders = sea (the red region lines and the
   light labels / ships inside the sea are bridged and closed), blue cells outside the sea = rivers (thin) or lakes (fat,
   holes filled). Rivers get a flow direction (the local principal axis, signed toward the sea).
   API (R.water):
     ready (bool), build(img?) → cells|null      builds the mask from an Image/canvas (default R.assets.map); emits 'water'
     isWater(x,y) → bool                          depth(x,y) → 0 land, 0.5 river, 1 sea / lake      kindAt(x,y) → 'sea'|'lake'|'river'|null
     flowAt(x,y) → {x,y} unit vector | null       the river's flow at a river cell
     shorePoints(x,y,r) → [{x,y,nx,ny,kind}]      shoreline cell centres within r, (nx,ny) pointing to the land (for A46's wet sand + gulls)
     shoreDist(x,y) → cells to the nearest shore  (signed: + in water, − on land, ±6 max)
     level (sea level, 0), CS (24), w, h, kind (Uint8Array: 0 land 1 river 2 lake 3 sea), cells {sea,lake,river}
     debugCanvas(k) → canvas of the mask at k px per cell
   3D (when R.render3d exists / 'render3d' fires, THREE present): one sea plane 4800×4800 (120² segments) at level + 2 that
   follows the camera in 1200-unit steps, a custom ShaderMaterial (two sine waves 3–6 units, storm-driven; colour by the
   shore field; sun glint from R.render3d.uniforms.sunDir / R.ambience.sunDir; alpha .85; foam from the shore field and the
   terrain band 0.3–6 above sea level; fog from the scene) and one merged mesh for rivers + lakes at the terrain height
   (R.render3d.groundY) with the same shader (lighter, scrolling along the flow, banks cut by noise). 2 draw calls.
   uniforms: R.water.uniforms (uTime, uAmp, uSpeed, uStorm, uNight, uSun, uCamPos …); setStorm(k) overrides the weather. */
(function () {
  const Wt = R.water = R.water || {};
  const CS = 24, PLANE = 4800, SNAP = 1200, SEG = 120, RAMP = 6;
  Wt.CS = CS; Wt.level = 0; Wt.ready = false; Wt.w = 0; Wt.h = 0; Wt.kind = null; Wt.cells = { sea: 0, lake: 0, river: 0 };
  Wt.stats = { buildMs: 0, drawCalls: 0 };
  let w = 0, h = 0, N = 0, kind = null, shore = null, flowX = null, flowY = null, shoreList = [], buckets = null, BK = 10, bw = 0, bh = 0;
  const KIND = [null, 'river', 'lake', 'sea'], DEPTH = [0, 0.5, 1, 1];
  const cellOf = (x, y) => { if (!kind || !(x >= 0) || !(y >= 0)) return -1; const cx = (x / CS) | 0, cy = (y / CS) | 0; return cx < w && cy < h ? cy * w + cx : -1; };

  /* ================= the mask ================= */
  function pixels(img) {
    img = img || (R.assets && (R.assets.img ? R.assets.img('map') : R.assets.map)) || null;
    if (!img) return null;
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height; if (!iw || !ih || img.complete === false) return null;
    const c = document.createElement('canvas'); c.width = iw; c.height = ih; const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0); let d; try { d = g.getImageData(0, 0, iw, ih).data; } catch (e) { return null; }
    return { d, iw, ih };
  }
  Wt.build = img => {
    const t0 = performance.now(); let P = null;
    try { P = pixels(img); } catch (e) { P = null; }
    if (!P) return null;
    const { d, iw, ih } = P; const S = iw / 300;                         // art px per cell (4 for the 1200-px art)
    w = Math.round(iw / S); h = Math.round(ih / S); N = w * h;
    const seaC = new Uint8Array(N), blueC = new Uint8Array(N), redC = new Uint8Array(N);
    for (let y = 0; y < ih; y++) { const by = Math.min(h - 1, (y / S) | 0) * w; for (let x = 0; x < iw; x++) { const i = (y * iw + x) * 4, r = d[i], g = d[i + 1], b = d[i + 2], lum = r * 3 + g * 6 + b, k = by + Math.min(w - 1, (x / S) | 0);
      if ((b > r + 16 && b > g + 4) || (b > r + 8 && b > g + 2 && lum < 1000)) blueC[k]++;                // blue-purple lines, dark blue lakes
      else if (lum < 1250 && g >= r - 8 && g - b >= 10 && b * 20 >= r * 7) seaC[k]++;                   // the dark olive sea wash
      else if (lum < 1500 && r > g + 15 && r > b + 25) redC[k]++; } }                                  // the red-brown region lines
    const seaCell = new Uint8Array(N), blue = new Uint8Array(N), sea = new Uint8Array(N);
    for (let k = 0; k < N; k++) { seaCell[k] = seaC[k] >= 5 || (seaC[k] >= 1 && seaC[k] + redC[k] >= 10) ? 1 : 0; blue[k] = blueC[k] >= 2 && ((k / w) | 0) >= 12 ? 1 : 0; }
    // 1. the sea: 8-connected flood fill from the borders through dark cells
    const st = []; const seed = k => { if (seaCell[k] && !sea[k]) { sea[k] = 1; st.push(k); } };
    for (let x = 0; x < w; x++) { seed(x); seed((h - 1) * w + x); } for (let y = 0; y < h; y++) { seed(y * w); seed(y * w + w - 1); }
    while (st.length) { const k = st.pop(), x = k % w, y = (k / w) | 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const X = x + dx, Y = y + dy; if ((dx || dy) && X >= 0 && Y >= 0 && X < w && Y < h) seed(Y * w + X); } }
    // 2. holes in the sea (ships, labels, pieces cut off by the lines): enclosed non-sea components, small or mostly dark → sea
    const lab = new Int32Array(N).fill(-1); const sizes = [], touch = [], dark = [];
    for (let k0 = 0; k0 < N; k0++) { if (sea[k0] || lab[k0] >= 0) continue; const id = sizes.length; let n = 0, tb = false, dk = 0; const q = [k0]; lab[k0] = id;
      while (q.length) { const k = q.pop(); n++; if (seaC[k] >= 3) dk++; const x = k % w, y = (k / w) | 0; if (x === 0 || y === 0 || x === w - 1 || y === h - 1) tb = true;
        if (x > 0 && !sea[k - 1] && lab[k - 1] < 0) { lab[k - 1] = id; q.push(k - 1); } if (x < w - 1 && !sea[k + 1] && lab[k + 1] < 0) { lab[k + 1] = id; q.push(k + 1); }
        if (y > 0 && !sea[k - w] && lab[k - w] < 0) { lab[k - w] = id; q.push(k - w); } if (y < h - 1 && !sea[k + w] && lab[k + w] < 0) { lab[k + w] = id; q.push(k + w); } }
      sizes.push(n); touch.push(tb); dark.push(dk); }
    for (let k = 0; k < N; k++) { const l = lab[k]; if (!sea[k] && !touch[l] && (sizes[l] < 40 || dark[l] >= sizes[l] * 0.6)) sea[k] = 1; }
    // 3. rivers and lakes: blue cells outside the sea, 8-connected components; fat + compact = lake (holes filled), else river
    kind = new Uint8Array(N); for (let k = 0; k < N; k++) kind[k] = sea[k] ? 3 : 0;
    const lab2 = new Int32Array(N).fill(-1);
    for (let k0 = 0; k0 < N; k0++) { if (!blue[k0] || sea[k0] || lab2[k0] >= 0) continue; const id = k0; const cells = []; const q = [k0]; lab2[k0] = id; let x0 = w, x1 = 0, y0 = h, y1 = 0;
      while (q.length) { const k = q.pop(); cells.push(k); const x = k % w, y = (k / w) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= w || Y >= h) continue; const m = Y * w + X; if (!blue[m] || sea[m] || lab2[m] >= 0) continue; lab2[m] = id; q.push(m); } }
      if (cells.length < 3) continue;
      let fat = 0; for (const k of cells) { const x = k % w, y = (k / w) | 0; if (x < 1 || y < 1 || x >= w - 1 || y >= h - 1) continue; let ok = true; for (let dy = -1; dy <= 1 && ok; dy++) for (let dx = -1; dx <= 1; dx++) if (!blue[(y + dy) * w + x + dx]) { ok = false; break; } if (ok) fat++; }
      const lake = cells.length >= 20 && fat >= 4 && cells.length >= 0.3 * (x1 - x0 + 1) * (y1 - y0 + 1);
      for (const k of cells) kind[k] = lake ? 2 : 1;
      if (lake) { // fill the holes: cells of the bbox not reachable from the bbox border without crossing the lake
        const bx = x1 - x0 + 3, byh = y1 - y0 + 3, vis = new Uint8Array(bx * byh), qq = [];
        const push = (i, j) => { if (i < 0 || j < 0 || i >= bx || j >= byh || vis[j * bx + i]) return; const X = x0 - 1 + i, Y = y0 - 1 + j; if (X >= 0 && Y >= 0 && X < w && Y < h && kind[Y * w + X] === 2) return; vis[j * bx + i] = 1; qq.push(i, j); };
        for (let i = 0; i < bx; i++) { push(i, 0); push(i, byh - 1); } for (let j = 0; j < byh; j++) { push(0, j); push(bx - 1, j); }
        while (qq.length) { const j = qq.pop(), i = qq.pop(); push(i - 1, j); push(i + 1, j); push(i, j - 1); push(i, j + 1); }
        for (let j = 1; j < byh - 1; j++) for (let i = 1; i < bx - 1; i++) if (!vis[j * bx + i]) { const k = (y0 - 1 + j) * w + x0 - 1 + i; if (kind[k] !== 3) kind[k] = 2; } } }
    // 4. the shore field: signed distance in cells to the sea/lake shoreline (+ in water, − on land; rivers count as land), capped at RAMP
    shore = new Int8Array(N); const dq = new Int32Array(N); let qh = 0, qt = 0; const dist = new Int16Array(N).fill(-1);
    const isW = k => kind[k] >= 2;
    for (let k = 0; k < N; k++) { const x = k % w, y = (k / w) | 0, wk = isW(k); let edge = false;
      if (x > 0 && isW(k - 1) !== wk) edge = true; else if (x < w - 1 && isW(k + 1) !== wk) edge = true; else if (y > 0 && isW(k - w) !== wk) edge = true; else if (y < h - 1 && isW(k + w) !== wk) edge = true;
      if (edge) { dist[k] = 1; dq[qt++] = k; } }
    while (qh < qt) { const k = dq[qh++], x = k % w, y = (k / w) | 0, dd = dist[k]; if (dd >= RAMP) continue;
      if (x > 0 && dist[k - 1] < 0) { dist[k - 1] = dd + 1; dq[qt++] = k - 1; } if (x < w - 1 && dist[k + 1] < 0) { dist[k + 1] = dd + 1; dq[qt++] = k + 1; }
      if (y > 0 && dist[k - w] < 0) { dist[k - w] = dd + 1; dq[qt++] = k - w; } if (y < h - 1 && dist[k + w] < 0) { dist[k + w] = dd + 1; dq[qt++] = k + w; } }
    for (let k = 0; k < N; k++) { const dd = dist[k] < 0 ? RAMP : Math.min(RAMP, dist[k]); shore[k] = isW(k) ? dd : -dd; }
    // 5. the shoreline list (water cells with a land 4-neighbour) with the normal toward the land, in 240-unit buckets
    shoreList = []; bw = Math.ceil(w / BK); bh = Math.ceil(h / BK); buckets = new Array(bw * bh);
    for (let k = 0; k < N; k++) { if (!isW(k)) continue; const x = k % w, y = (k / w) | 0; let nx = 0, ny = 0;
      if (x > 0 && !isW(k - 1)) nx -= 1; if (x < w - 1 && !isW(k + 1)) nx += 1; if (y > 0 && !isW(k - w)) ny -= 1; if (y < h - 1 && !isW(k + w)) ny += 1;
      if (!nx && !ny) continue; const L = Math.hypot(nx, ny); const p = { x: (x + .5) * CS, y: (y + .5) * CS, nx: nx / L, ny: ny / L, kind: KIND[kind[k]] };
      shoreList.push(p); const b = ((y / BK) | 0) * bw + ((x / BK) | 0); (buckets[b] = buckets[b] || []).push(p); }
    // 6. river flow: the principal axis of the river cells in a 7×7 window, signed toward the sea (BFS through river cells from the sea)
    flowX = new Int8Array(N); flowY = new Int8Array(N); const ds = new Int16Array(N).fill(-1); qh = qt = 0;
    for (let k = 0; k < N; k++) if (kind[k] === 3) { ds[k] = 0; dq[qt++] = k; }
    while (qh < qt) { const k = dq[qh++], x = k % w, y = (k / w) | 0, dd = ds[k];
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= w || Y >= h) continue; const m = Y * w + X; if (kind[m] === 1 && ds[m] < 0) { ds[m] = dd + 1; dq[qt++] = m; } } }
    for (let k = 0; k < N; k++) { if (kind[k] !== 1) continue; const x = k % w, y = (k / w) | 0; let n = 0, mx = 0, my = 0;
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= w || Y >= h || kind[Y * w + X] !== 1) continue; n++; mx += dx; my += dy; }
      mx /= n; my /= n; let sxx = 0, syy = 0, sxy = 0;
      for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= w || Y >= h || kind[Y * w + X] !== 1) continue; sxx += (dx - mx) ** 2; syy += (dy - my) ** 2; sxy += (dx - mx) * (dy - my); }
      const th = 0.5 * Math.atan2(2 * sxy, sxx - syy); let fx = Math.cos(th), fy = Math.sin(th);      // the major axis
      let gx = 0, gy = 0; const d0 = ds[k];                                                              // the sign: toward smaller distance to the sea
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= w || Y >= h) continue; const m = Y * w + X; if (kind[m] !== 1 || ds[m] < 0 || d0 < 0) continue; const dd = ds[m] - d0; gx += dx * dd; gy += dy * dd; }
      if (gx * fx + gy * fy > 0) { fx = -fx; fy = -fy; }
      flowX[k] = Math.round(fx * 127); flowY[k] = Math.round(fy * 127); }
    let ns = 0, nl = 0, nr = 0; for (let k = 0; k < N; k++) { const q = kind[k]; if (q === 3) ns++; else if (q === 2) nl++; else if (q === 1) nr++; }
    Wt.w = w; Wt.h = h; Wt.kind = kind; Wt.shore = shore; Wt.cells = { sea: ns, lake: nl, river: nr }; Wt.ready = true; Wt.stats.buildMs = performance.now() - t0;
    infoDirty = true; riversDirty = true;
    R.bus.emit('water', Wt);
    return Wt.cells;
  };
  Wt.kindAt = (x, y) => { const k = cellOf(x, y); return k < 0 ? null : KIND[kind[k]]; };
  Wt.depth = (x, y) => { const k = cellOf(x, y); return k < 0 ? 0 : DEPTH[kind[k]]; };
  Wt.isWater = (x, y) => Wt.depth(x, y) > 0;
  Wt.shoreDist = (x, y) => { const k = cellOf(x, y); return k < 0 ? -RAMP : shore[k]; };
  Wt.flowAt = (x, y) => { const k = cellOf(x, y); if (k < 0 || kind[k] !== 1) return null; return { x: flowX[k] / 127, y: flowY[k] / 127 }; };
  Wt.shorePoints = (x, y, r) => { const out = []; if (!buckets) return out; r = r || 240; const r2 = r * r;
    const b0x = Math.max(0, ((x - r) / CS / BK) | 0), b1x = Math.min(bw - 1, ((x + r) / CS / BK) | 0), b0y = Math.max(0, ((y - r) / CS / BK) | 0), b1y = Math.min(bh - 1, ((y + r) / CS / BK) | 0);
    for (let j = b0y; j <= b1y; j++) for (let i = b0x; i <= b1x; i++) { const B = buckets[j * bw + i]; if (!B) continue; for (const p of B) if ((p.x - x) ** 2 + (p.y - y) ** 2 <= r2) { out.push(p); if (out.length >= 400) return out; } }
    return out; };
  Wt.debugCanvas = k => { k = k || 1; const c = document.createElement('canvas'); if (!kind) return c; c.width = w * k; c.height = h * k; const g = c.getContext('2d'); const id = g.createImageData(c.width, c.height), q = id.data;
    const COL = [[0, 0, 0, 0], [70, 200, 255, 255], [255, 60, 200, 255], [20, 70, 110, 255]];
    for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) { const col = COL[kind[((y / k) | 0) * w + ((x / k) | 0)]]; const i = (y * c.width + x) * 4; q[i] = col[0]; q[i + 1] = col[1]; q[i + 2] = col[2]; q[i + 3] = col[3]; }
    g.putImageData(id, 0, 0); return c; };

  /* ================= 3D ================= */
  const T = window.THREE; let R3 = null, sea = null, rivers = null, matSea = null, matRiv = null, info = null, noise = null, infoDirty = true, riversDirty = true, lastHm = null, U = null;
  const DEF_SUN = { x: .4, y: .8, z: .45 };
  const VS = [
    'uniform float uTime, uAmp, uSpeed, uRiver; attribute vec2 aFlow; attribute float aAcross, aDepth;',
    'varying vec3 vW, vN; varying vec2 vFlow; varying float vAcross, vDepth;',
    '#include <fog_pars_vertex>',
    'void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); float amp = uAmp * (1.0 - uRiver);',
    ' float p1 = wp.x * 0.021 + wp.z * 0.013 + uTime * uSpeed * 1.3; float p2 = wp.x * -0.009 + wp.z * 0.027 + uTime * uSpeed * 0.9;',
    ' wp.y += amp * (0.6 * sin(p1) + 0.4 * sin(p2)); float c1 = cos(p1), c2 = cos(p2);',
    ' vN = normalize(vec3(-amp * (0.6 * c1 * 0.021 - 0.4 * c2 * 0.009), 1.0, -amp * (0.6 * c1 * 0.013 + 0.4 * c2 * 0.027)));',
    ' vW = wp.xyz; vFlow = aFlow; vAcross = aAcross; vDepth = aDepth; vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;',
    '#include <fog_vertex>', '}'].join('\n');
  const FS = [
    'uniform sampler2D uInfo, uNoise; uniform float uTime, uRiver, uAlpha, uNight, uLevel, uHScale, uHasMask, uSpeed; uniform vec3 uSun, uCamPos, uDeep, uShallow, uFoam; uniform vec2 uWorld, uOrigin;',
    'varying vec3 vW, vN; varying vec2 vFlow; varying float vAcross, vDepth;',
    '#include <fog_pars_fragment>',
    'void main(){',
    ' vec4 info = texture2D(uInfo, vW.xz / uWorld); float g = mix(0.8, info.g, uHasMask); float hgt = info.r * uHScale;',
    ' vec2 dir = mix(vec2(0.6, 0.4), vFlow, uRiver); float sp = mix(6.0, 30.0, uRiver) * uSpeed * uTime / 150.0;',
    ' vec2 nuv = (vW.xz - uOrigin) / 150.0;',
    ' vec3 n1 = texture2D(uNoise, nuv + dir * sp).rgb; vec3 n2 = texture2D(uNoise, nuv * 2.5 - dir * sp * 0.6 + vec2(0.37, 0.11)).rgb;',
    ' float rip = n1.r * 0.6 + n2.g * 0.4;',
    ' vec3 N = normalize(vN + vec3((n1.r - 0.5) * 0.5, 0.0, (n2.g - 0.5) * 0.5) * mix(1.0, 0.6, uRiver));',
    ' float camD = length(uCamPos - vW); float near = mix(1.0 - smoothstep(200.0, 900.0, camD), 1.0 - smoothstep(0.5, 0.85, g), uHasMask);',
    ' vec3 col = mix(uDeep, uShallow, clamp(near * 0.85 + (rip - 0.5) * 0.25, 0.0, 1.0));',
    ' vec3 V = normalize(uCamPos - vW); vec3 Hh = normalize(uSun + V); float ndh = max(dot(N, Hh), 0.0);',
    ' float spec = pow(ndh, 140.0) * 1.1 + pow(ndh, 10.0) * 0.12; float fr = pow(1.0 - max(dot(N, V), 0.0), 3.0);',
    ' col = mix(col, vec3(0.46, 0.56, 0.66), fr * 0.35); col += spec * (1.0 - 0.75 * uNight) * vec3(1.0, 0.95, 0.85);',
    ' float roll = 0.55 + 0.45 * sin(uTime * 1.6 + g * 60.0);',
    ' float bandM = smoothstep(0.44, 0.5, g) * (1.0 - smoothstep(0.5, 0.63, g)) * roll;',
    ' float bandT = smoothstep(uLevel + 0.3, uLevel + 1.5, hgt) * (1.0 - smoothstep(uLevel + 4.0, uLevel + 6.0, hgt));',
    ' float fn = smoothstep(0.3, 0.75, n1.g * 0.6 + n2.r * 0.4 + 0.08); float foam = max(bandM, bandT) * fn * (1.0 - uRiver);',
    ' float edge = abs(vAcross) + (n2.r - 0.5) * 0.5; float riverFoam = smoothstep(0.6, 0.95, edge) * 0.3 * uRiver * step(vDepth, 0.75);',
    ' if (uRiver > 0.5) { if (vDepth < 0.75) { if (edge > 0.98) discard; } else if (g < 0.49) discard; }',
    ' foam = max(foam, riverFoam) + bandM * fn * 0.35 * uRiver * step(0.75, vDepth);',
    ' col = mix(col, uFoam, clamp(foam, 0.0, 1.0)); col *= 1.0 - 0.6 * uNight;',
    ' float a = mix(uAlpha * smoothstep(0.46, 0.54, g) + foam * 0.15, 1.0, uRiver);',
    ' gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));',
    '#include <fog_fragment>', '}'].join('\n');
  function makeNoise() {
    const S = 64, data = new Uint8Array(S * S * 4); const rnd = (i, j, s) => { const v = Math.sin(i * 12.9898 + j * 78.233 + s * 37.719) * 43758.5453; return v - Math.floor(v); };
    const val = (x, y, f, s) => { const X = x * f, Y = y * f, i = Math.floor(X), j = Math.floor(Y), u = X - i, v = Y - j, su = u * u * (3 - 2 * u), sv = v * v * (3 - 2 * v);
      const a = rnd(i % f, j % f, s), b = rnd((i + 1) % f, j % f, s), c = rnd(i % f, (j + 1) % f, s), d = rnd((i + 1) % f, (j + 1) % f, s); return (a * (1 - su) + b * su) * (1 - sv) + (c * (1 - su) + d * su) * sv; };
    for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) { const x = i / S, y = j / S, k = (j * S + i) * 4;
      data[k] = Math.round(255 * (0.5 * val(x, y, 4, 1) + 0.3 * val(x, y, 8, 2) + 0.2 * val(x, y, 16, 3)));
      data[k + 1] = Math.round(255 * (0.5 * val(x, y, 4, 5) + 0.3 * val(x, y, 8, 6) + 0.2 * val(x, y, 16, 7)));
      data[k + 2] = Math.round(255 * (0.6 * val(x, y, 8, 9) + 0.4 * val(x, y, 16, 10))); data[k + 3] = 255; }
    const t = new T.DataTexture(data, S, S, T.RGBAFormat); t.wrapS = t.wrapT = T.RepeatWrapping; t.magFilter = t.minFilter = T.LinearFilter; t.needsUpdate = true; return t;
  }
  const groundY = (x, y) => { const g = R3 && R3.groundY; if (!g) return Wt.level; try { const v = g(x, y); return isFinite(v) ? v : Wt.level; } catch (e) { return Wt.level; } };
  function buildInfo() {        // r: terrain height / 64, g: the shore field (.5 at the shoreline), b: kind, a: 1
    if (!kind) return; const data = info && info.image.width === w ? info.image.data : new Uint8Array(N * 4); const hasG = !!(R3 && R3.groundY);
    for (let k = 0; k < N; k++) { const x = (k % w + .5) * CS, y = (((k / w) | 0) + .5) * CS, i = k * 4;
      data[i] = hasG ? Math.max(0, Math.min(255, Math.round(groundY(x, y) / 64 * 255))) : 0;
      data[i + 1] = Math.max(0, Math.min(255, Math.round(128 + shore[k] / RAMP * 127))); data[i + 2] = kind[k] === 1 ? 128 : kind[k] >= 2 ? 255 : 0; data[i + 3] = 255; }
    if (info && info.image.width === w) info.needsUpdate = true;
    else { if (info) info.dispose(); info = new T.DataTexture(data, w, h, T.RGBAFormat); info.magFilter = info.minFilter = T.LinearFilter; info.wrapS = info.wrapT = T.ClampToEdgeWrapping; info.needsUpdate = true; U.uInfo.value = info; }
    U.uHasMask.value = 1; infoDirty = false;
  }
  function buildRivers() {      // one merged geometry: oriented quads for river cells (soft banks by aAcross), cell quads for lake cells (+ one ring)
    if (!kind) return; if (rivers) { R3.scene.remove(rivers); rivers.geometry.dispose(); rivers = null; }
    const pos = [], flow = [], across = [], depth = [], idx = []; let v = 0;
    const quad = (pts, fx, fy, ac, dp) => { for (let i = 0; i < 4; i++) { pos.push(pts[i][0], pts[i][1], pts[i][2]); flow.push(fx, fy); across.push(ac[i]); depth.push(dp); } idx.push(v, v + 2, v + 1, v, v + 3, v + 2); v += 4; };
    const lakeSet = new Uint8Array(N), lakeY = {}; const lakeId = new Int32Array(N).fill(-1);
    for (let k = 0; k < N; k++) { if (kind[k] !== 2) continue; const x = k % w, y = (k / w) | 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const X = x + dx, Y = y + dy; if (X >= 0 && Y >= 0 && X < w && Y < h && kind[Y * w + X] !== 3) lakeSet[Y * w + X] = 1; } }
    // lake surfaces: per connected lake, the 90th percentile of the ground height + 1.5 (flat)
    let nLakes = 0; for (let k0 = 0; k0 < N; k0++) { if (!lakeSet[k0] || lakeId[k0] >= 0) continue; const id = nLakes++, hs = [], q = [k0]; lakeId[k0] = id;
      while (q.length) { const k = q.pop(); if (kind[k] !== 2) hs.push(groundY((k % w + .5) * CS, (((k / w) | 0) + .5) * CS)); const x = k % w, y = (k / w) | 0;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= w || Y >= h) continue; const m = Y * w + X; if (lakeSet[m] && lakeId[m] < 0) { lakeId[m] = id; q.push(m); } } }
      hs.sort((a, b) => a - b); lakeY[id] = hs.length ? hs[Math.min(hs.length - 1, Math.floor(hs.length * 0.6))] - 1 : 2; }
    for (let k = 0; k < N; k++) {
      const x = k % w, y = (k / w) | 0, cx = (x + .5) * CS, cy = (y + .5) * CS;
      if (kind[k] === 1) { const fx = flowX[k] / 127, fy = flowY[k] / 127, L = CS * 1.15, Wd = CS * 0.62, px = -fy, py = fx; const P = [];
        for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) { const X = cx + fx * L * a + px * Wd * b, Y = cy + fy * L * a + py * Wd * b; P.push([X, groundY(X, Y) + 1.2, Y]); }
        quad(P, fx, fy, [-1, -1, 1, 1], 0.5); }
      else if (lakeSet[k]) { const ly = lakeY[lakeId[k]], x0 = x * CS, y0 = y * CS; quad([[x0, ly, y0], [x0 + CS, ly, y0], [x0 + CS, ly, y0 + CS], [x0, ly, y0 + CS]], 0, 0, [0, 0, 0, 0], 1); } }
    if (!v) { riversDirty = false; return; }
    const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); geo.setAttribute('aFlow', new T.Float32BufferAttribute(flow, 2));
    geo.setAttribute('aAcross', new T.Float32BufferAttribute(across, 1)); geo.setAttribute('aDepth', new T.Float32BufferAttribute(depth, 1)); geo.setIndex(idx); geo.computeBoundingSphere();
    rivers = new T.Mesh(geo, matRiv); rivers.name = 'water-rivers'; rivers.renderOrder = 5; rivers.frustumCulled = true; R3.scene.add(rivers); Wt.rivers = rivers; riversDirty = false;
  }
  /* the renderer's heightmap reads dark art as high ground, so the God's Eye and the river lines come out as ridges ("the dark blob
     near the Rills"). Carve them once per heightmap: lake vertices drop below the lake level, river vertices to just under their
     banks; the terrain tiles' Y (R.render3d.terrainTiles) and R.render3d.heightmap.data (what groundY reads) are lowered in place. */
  Wt.carved = 0;
  function carve() {
    const hm = R3 && R3.heightmap, H = hm && hm.data; if (!H || !kind || hm.waterCarved || !(hm.w > 2) || !(hm.h > 2) || H.length !== hm.w * hm.h) return false;
    const NX = hm.w, NY = hm.h, DX = R.W / (NX - 1), DZ = R.H / (NY - 1), M = NX * NY, wk = new Uint8Array(M), H0 = Float32Array.from(H);
    const ns = new Uint8Array(M);
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) { let q = 0, sc = 0;
      for (const oy of [-14, 0, 14]) for (const ox of [-14, 0, 14]) { const c = cellOf(Math.min(R.W - 1, Math.max(0, i * DX + ox)), Math.min(R.H - 1, Math.max(0, j * DZ + oy))); if (c < 0) continue; const v = kind[c]; if (v === 3) sc++; else if (v === 2) q = 2; else if (v === 1 && q !== 2) q = 1; }
      wk[j * NX + i] = sc ? 0 : q; ns[j * NX + i] = sc; }
    let n = 0;
    // the sea: the art's olive wash reads as a plateau in the renderer, so every vertex the mask calls sea goes under the sea plane
    // (level + 2), the shoreline vertices to the waterline, and the first land ring is eased down into a beach
    for (let k = 0; k < M; k++) { const sc = ns[k]; if (!sc) continue; const want = sc >= 9 ? Wt.level - 8 : Wt.level + 6 - sc * 1.4; if (want < H[k]) { H[k] = want; n++; } }
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) { const k = j * NX + i; if (ns[k]) continue; let near = false;
      for (let dj = -1; dj <= 1 && !near; dj++) for (let di = -1; di <= 1; di++) { const I = i + di, J = j + dj; if (I >= 0 && J >= 0 && I < NX && J < NY && ns[J * NX + I] >= 3) { near = true; break; } }
      if (near) { const want = 8 + (H0[k] - 8) * 0.45; if (want < H[k]) { H[k] = want; n++; } } }
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) { const k = j * NX + i, q = wk[k]; if (!q) continue; let sm = 0, c = 0;
      for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) { const I = i + di, J = j + dj; if (I < 0 || J < 0 || I >= NX || J >= NY) continue; const m = J * NX + I; if (!wk[m] && !ns[m] && H0[m] > 0.5) { sm += H0[m]; c++; } }
      const ref = c ? sm / c : H0[k]; const want = q === 2 ? ref - 9 : ref - 3; if (want < H[k]) { H[k] = Math.max(1, want); n++; } }
    const tiles = R3.terrainTiles || (R3.terrain && R3.terrain.children) || [];
    for (const m of tiles) { const g = m && m.geometry, pa = g && g.attributes && g.attributes.position; if (!pa) continue; let ch = false;
      for (let v = 0; v < pa.count; v++) { const i = Math.round(pa.getX(v) / DX), j = Math.round(pa.getZ(v) / DZ); if (i < 0 || j < 0 || i >= NX || j >= NY) continue; const y = H[j * NX + i]; if (Math.abs(pa.getY(v) - y) > 0.01) { pa.setY(v, y); ch = true; } }
      if (ch) { pa.needsUpdate = true; try { g.computeVertexNormals(); g.computeBoundingSphere(); } catch (e) {} } }
    hm.waterCarved = true; Wt.carved = n;
    // chunks of trees / reeds already placed on the old heights are rebuilt (R.nature, A46), props re-seated by the renderer's own rebuilds
    try { const Nt = R.nature; if (n && Nt && Nt.chunks && typeof Nt.build === 'function') for (const ch of Array.from(Nt.chunks.values())) if (ch && ch.cx != null) Nt.build(ch.cx, ch.cy, ch.lod); } catch (e) {}
    R.bus.emit('terrain', 'water');
    return true;
  }
  Wt.carve = () => { try { return carve(); } catch (e) { return false; } };
  function attach(r3) {
    r3 = r3 || R.render3d; if (!T || !r3 || !r3.scene || R3 === r3) return; R3 = r3;
    if (!U) {
      noise = makeNoise();
      U = T.UniformsUtils.merge([T.UniformsLib.fog, { uInfo: { value: null }, uNoise: { value: null }, uTime: { value: 0 }, uAmp: { value: 3 }, uSpeed: { value: 1 }, uStorm: { value: 0 }, uRiver: { value: 0 }, uAlpha: { value: 0.85 }, uNight: { value: 0 },
        uLevel: { value: Wt.level }, uHScale: { value: 64 }, uHasMask: { value: 0 }, uSun: { value: new T.Vector3(DEF_SUN.x, DEF_SUN.y, DEF_SUN.z).normalize() }, uCamPos: { value: new T.Vector3() },
        uDeep: { value: new T.Color(0.02, 0.13, 0.19) }, uShallow: { value: new T.Color(0.13, 0.42, 0.44) }, uFoam: { value: new T.Color(0.86, 0.92, 0.94) }, uWorld: { value: new T.Vector2(R.W || 7200, R.H || 12288) }, uOrigin: { value: new T.Vector2() } }]);
      U.uNoise.value = noise; U.uInfo.value = new T.DataTexture(new Uint8Array([0, 204, 255, 255]), 1, 1, T.RGBAFormat); U.uInfo.value.needsUpdate = true;
      Wt.uniforms = U;
      matSea = new T.ShaderMaterial({ uniforms: U, vertexShader: VS, fragmentShader: FS, transparent: true, depthWrite: false, fog: true, side: T.DoubleSide });
      // the rivers share every uniform object but uRiver / uOrigin / the colours
      const UR = Object.assign({}, U, { uRiver: { value: 1 }, uOrigin: { value: new T.Vector2() }, uDeep: { value: new T.Color(0.05, 0.19, 0.27) }, uShallow: { value: new T.Color(0.12, 0.31, 0.38) }, uAlpha: { value: 1 } });
      matRiv = new T.ShaderMaterial({ uniforms: UR, vertexShader: VS, fragmentShader: FS, transparent: false, fog: true, side: T.DoubleSide });
      Wt.matSea = matSea; Wt.matRiv = matRiv;
    }
    if (sea) { try { sea.parent && sea.parent.remove(sea); } catch (e) {} }
    const geo = new T.PlaneGeometry(PLANE, PLANE, SEG, SEG); geo.rotateX(-Math.PI / 2); const nv = geo.attributes.position.count;
    geo.setAttribute('aFlow', new T.Float32BufferAttribute(new Float32Array(nv * 2), 2)); geo.setAttribute('aAcross', new T.Float32BufferAttribute(new Float32Array(nv), 1)); geo.setAttribute('aDepth', new T.Float32BufferAttribute(new Float32Array(nv).fill(1), 1));
    sea = new T.Mesh(geo, matSea); sea.name = 'water-sea'; sea.renderOrder = 10; sea.frustumCulled = false; sea.position.y = Wt.level + 2; R3.scene.add(sea); Wt.sea = sea;
    infoDirty = true; riversDirty = true; lastHm = R3.heightmap || null; Wt.stats.drawCalls = 1;
    follow();
  }
  Wt.attach = attach;
  function follow() {
    if (!sea || !R3) return; const cam = R3.camera; const cx = cam ? cam.position.x : (R.cam.x || 0), cz = cam ? cam.position.z : (R.cam.y || 0);
    sea.position.x = Math.round(cx / SNAP) * SNAP; sea.position.z = Math.round(cz / SNAP) * SNAP; sea.position.y = Wt.level + 2; U.uOrigin.value.set(sea.position.x, sea.position.z);
    if (cam) U.uCamPos.value.copy(cam.position);
  }
  let storm = 0, stormSet = null;
  Wt.setStorm = k => { stormSet = k == null ? null : R.clamp(+k || 0, 0, 1); };
  R.bus.on('render3d', r3 => attach(r3));
  if (R.assets && R.assets.ready && R.assets.ready.then) R.assets.ready.then(() => { if (!Wt.ready) Wt.build(); }).catch(() => {});
  R.addSys('water', { order: 905,
    update(dt) {
      if (!Wt.ready && R.assets && R.assets.done && !Wt.triedAuto) { Wt.triedAuto = true; Wt.build(); }
      if (!R3 && R.render3d && R.render3d.scene) attach(R.render3d);
      if (!U) return;
      U.uTime.value += dt;
      const A = R.ambience || {}; const want = stormSet != null ? stormSet : (A.weather === 'rain' || A.weather === 'storm' ? 1 : A.weather === 'snow' ? 0.4 : 0);
      storm += (want - storm) * Math.min(1, dt * 0.8); U.uStorm.value = storm; U.uAmp.value = 3 + 3 * storm; U.uSpeed.value = 1 + 0.7 * storm;
      U.uNight.value = A.nightK != null ? A.nightK : (A.night ? 1 : 0); U.uLevel.value = Wt.level;
      const sd = (R3 && R3.uniforms && R3.uniforms.sunDir && R3.uniforms.sunDir.value) || (A.sunDir && A.sunDir.y > 0.05 ? A.sunDir : null) || DEF_SUN;
      U.uSun.value.set(sd.x, Math.max(0.08, sd.y), sd.z).normalize();
      if (R3) { if (R3.heightmap !== lastHm) { lastHm = R3.heightmap; infoDirty = true; riversDirty = true; } if (kind && R3.heightmap && !R3.heightmap.waterCarved && Wt.carve()) { infoDirty = true; riversDirty = true; } if (infoDirty && kind) buildInfo(); if (riversDirty && kind) { buildRivers(); Wt.stats.drawCalls = 1 + (rivers ? 1 : 0); } follow(); }
    } });
})();
