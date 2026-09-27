// Road generator for the 50 stages. Runs inside the game page so it uses the game's own denseRoute / pickSlots / inWater.
// usage: node gen_layouts.js [stagesJson] [outJson] [tries]
const { chromium } = require('playwright');
const fs = require('fs');
const SPEC = process.argv[2] || __dirname + '/stages.json';
const OUT = process.argv[3] || __dirname + '/layouts.json';
const TRIES = +(process.argv[4] || 60);
const ONLY = process.env.ONLY ? process.env.ONLY.split(',').map(Number) : null;
(async () => {
  const stages = JSON.parse(fs.readFileSync(SPEC, 'utf8'));
  const prev = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(('file://' + require('path').resolve(__dirname, '../..', process.env.HOLDOR_HTML || 'beta/index.html')));
  await page.waitForFunction(() => window.HOLDOR, { timeout: 15000 });
  const out = Object.assign({}, prev);
  for (let i = 0; i < stages.length; i++) {
    const id = i + 1; if (ONLY && !ONLY.includes(id)) continue;
    const st = stages[i];
    const res = await page.evaluate(([st, id, TRIES]) => {
      const {denseRoute,pickSlots,waterFeat,seaEdge,riverY,inWater,posAt,BIOMES,mulberry32,hash32,dist,W,GX,GATE_Y}=window.HOLDOR_GEN;
      const rng = mulberry32(hash32('lay' + id + '/' + st.n));
      const R = (a, b) => a + rng() * (b - a), RI = (a, b) => Math.floor(R(a, b + 1)), pick = a => a[Math.floor(rng() * a.length)];
      const seaW = st.sea ? 40 : 0;
      const XMIN = 38 + (st.sea === 'L' ? seaW + 44 : 0), XMAX = W - 38 - (st.sea === 'R' ? seaW + 44 : 0);
      const target = (st.lay === 'one' ? 1120 + 11 * id : st.lay === 'triple' ? 760 + 5 * id : 900 + 7 * id);
      const Y0 = 70, Y1 = GATE_Y - 110;
      // ---------- generators (raw 390×700 coordinates) ----------
      function snake(xmin, xmax, gx, rows, top, bot) { // bend style: horizontal runs
        const P = [];let x = R(xmin, xmax);if (rng() < 0.5) x = rng() < 0.5 ? xmin + R(0, 30) : xmax - R(0, 30);P.push([x, -30]);
        const n = rows;for (let k = 0; k < n; k++) { const y = top + (bot - top) * k / (n - 1) + R(-12, 12);P.push([x, y]);
          let nx;if (k === n - 1) nx = gx;else { let g = 0;do { nx = rng() < 0.7 ? (x < (xmin + xmax) / 2 ? R(xmax - 50, xmax) : R(xmin, xmin + 50)) : R(xmin, xmax); } while (Math.abs(nx - x) < 110 && g++ < 30); }
          if (Math.abs(nx - x) > 2) { P.push([nx, y]);x = nx; } }
        return P; }
      function curvy(xmin, xmax, gx, n, top, bot) { // curve style: alternating sides
        const P = [];let side = rng() < 0.5 ? -1 : 1;const mid = (xmin + xmax) / 2, half = (xmax - xmin) / 2;
        P.push([mid + side * R(0.2, 0.9) * half, -30]);
        for (let k = 0; k < n; k++) { side = -side;const y = top + (bot - top) * k / (n - 1) + R(-14, 14);const amp = R(0.55, 1.0);P.push([k === n - 1 ? gx + R(-24, 24) : mid + side * amp * half, y]); }
        return P; }
      function zig(xmin, xmax, gx, top, bot) { // vertical zig-zag inside a band (twins / triples)
        const P = [[R(xmin, xmax), -30]];let side = rng() < 0.5 ? 0 : 1;let y = top;
        while (y < bot - 40) { P.push([side ? xmax - R(0, 12) : xmin + R(0, 12), y]);side = 1 - side;y += R(92, 125); }
        P.push([gx + R(-10, 10), bot + R(0, 20)]);return P; }
      function riverFix(P) { if (st.river == null) return P;const ry = st.river, out = [P[0]];
        for (let k = 1; k < P.length; k++) { const a = out[out.length - 1], b = P[k];
          if (a[1] < ry - 30 && b[1] > ry + 30) { const t = (ry - a[1]) / (b[1] - a[1]), xc = a[0] + (b[0] - a[0]) * t;out.push([xc, ry - 40], [xc, ry + 40]); }
          out.push(b); }
        return out.filter((p, i) => i === 0 || !(Math.abs(p[1] - ry) < 44 && Math.abs(p[1] - ry) > 0 && !(out[i - 1] && Math.abs(out[i - 1][0] - p[0]) < 1) && !(out[i + 1] && Math.abs(out[i + 1][0] - p[0]) < 1))); }
      function mk(style) {
        const L = st.lay;
        if (L === 'one') { const s = style || (id % 2 ? 'bend' : 'curve');
          return { style: s, gates: [GX], routes: [riverFix(s === 'bend' ? snake(XMIN, XMAX, GX, RI(4, 6), Y0 + R(-10, 30), Y1 + R(-20, 30)) : curvy(XMIN, XMAX, GX, RI(4, 6), Y0 + R(0, 40), Y1 + R(0, 30)))] }; }
        if (L === 'merge') { // two entries → one road (shared tail after M)
          const my = R(260, 380), mx = GX + R(-50, 50), p0 = [mx + R(-8, 8), my - 34];
          const tail = [];const nt = RI(2, 3);let side = rng() < 0.5 ? -1 : 1;for (let k = 1; k <= nt; k++) { side = -side;tail.push([k === nt ? GX + R(-20, 20) : GX + side * R(60, 120), my + (Y1 + 20 - my) * k / nt + R(-10, 10)]); }
          const arm = (sx) => { const P = [[sx, -30]];const n = RI(2, 3);let x = sx;for (let k = 1; k <= n; k++) { const y = Y0 + (my - 60 - Y0) * (k - 1) / Math.max(1, n - 1) + R(-10, 10);x = k % 2 ? (sx < GX ? R(XMIN, XMIN + 70) : R(XMAX - 70, XMAX)) : R(Math.min(sx, GX), Math.max(sx, GX));P.push([x, y]); }return P.concat([p0, [mx, my]], tail); };
          return { style: 'curve', gates: [GX], routes: [riverFix(arm(R(XMIN, XMIN + 60))), riverFix(arm(R(XMAX - 60, XMAX)))] }; }
        if (L === 'fork') { // one entry → two gates (shared head until S)
          const sy = R(250, 360), sx = GX + R(-40, 40), g = [GX - 78, GX + 78];
          const head = [[R(XMIN + 20, XMAX - 20), -30]];const nh = RI(2, 3);for (let k = 1; k <= nh; k++) head.push([k % 2 ? R(XMIN, XMIN + 80) : R(XMAX - 80, XMAX), Y0 + (sy - 70 - Y0) * (k - 1) / Math.max(1, nh - 1) + R(-10, 10)]);
          head.push([sx, sy]);const q = [sx + R(-6, 6), sy + 30];
          const br = (gx, sd) => { const P = head.concat([q]);const n = RI(1, 2);for (let k = 1; k <= n; k++) P.push([sd < 0 ? R(XMIN, gx + 10) : R(gx - 10, XMAX), sy + 30 + (Y1 + 20 - sy - 30) * k / (n + 1) + R(-10, 10)]);P.push([gx + R(-10, 10), Y1 + R(0, 30)]);return P; };
          return { style: 'curve', gates: g, routes: [riverFix(br(g[0], -1)), riverFix(br(g[1], 1))] }; }
        if (L === 'twin') { const g = [GX - 80, GX + 80];const band = [[XMIN, GX - 30], [GX + 30, XMAX]];
          return { style: 'curve', gates: g, routes: band.map((b, j) => riverFix(zig(b[0], b[1], g[j], Y0 + R(0, 40), Y1 + R(0, 20)))) }; }
        if (L === 'triple') { const g = [78, 195, 312];const band = [[Math.max(XMIN - 6, 30), 120], [158, 232], [270, Math.min(XMAX + 6, W - 30)]];
          return { style: 'curve', gates: g, routes: band.map((b, j) => riverFix(zig(b[0], b[1], g[j], Y0 + R(0, 40), Y1 + R(0, 20)))) }; }
      }
      // ---------- validation ----------
      function evaluate(lay) {
        const o = { routes: lay.routes, gates: lay.gates, raw: true, style: lay.style, sea: st.sea, seaW: seaW || undefined, river: st.river, seed: hash32('L' + id), biome: st.biome };
        const rngM = mulberry32(o.seed);const gates = o.gates.map((gx, i) => ({ x: gx, y: GATE_Y, i }));
        const routes = o.routes.map((rp, i) => { const g = gates[Math.min(i, gates.length - 1)];const pts = denseRoute(rp, g, o.style, 1);const segs = [];let total = 0;for (let k = 0; k < pts.length - 1; k++) { const a = pts[k], b = pts[k + 1];const len = Math.hypot(b.x - a.x, b.y - a.y);if (len < 1e-6) continue;segs.push({ a, b, len, start: total });total += len; }return { pts, segs, total, gate: g.i, i }; });
        const map = { routes, gates, segs: [].concat(...routes.map(r => r.segs)), pts: routes[0].pts, total: routes[0].total, B: BIOMES[st.biome] };
        map.feat = waterFeat(o, rngM);
        const S = routes.map(r => { const a = [];for (let d = 0; d <= r.total; d += 8) { const p = posAt(map, d, r.i);a.push({ x: p.x, y: p.y, d }); }return a; });
        // bounds and water
        for (let j = 0; j < S.length; j++) for (let k = 0; k < S[j].length; k++) { const p = S[j][k];if (p.y < 0) continue;if (p.x < 22 || p.x > W - 22) return null;
          if (map.feat.sea) { const e = seaEdge(map.feat, p.y);if (map.feat.sea.side === 'L' ? p.x < e + 30 : p.x > W - e - 30) return null; }
          if (map.feat.river && Math.abs(p.y - riverY(map.feat, p.x)) < 22) { const q = S[j][Math.min(S[j].length - 1, k + 1)], q0 = S[j][Math.max(0, k - 1)];const dy = Math.abs(q.y - q0.y), dl = Math.hypot(q.x - q0.x, q.y - q0.y) || 1;if (dy / dl < 0.8) return null; } }
        // self separation
        for (const A of S) for (let a = 0; a < A.length; a++) for (let b = a + 1; b < A.length; b++) { if (A[b].d - A[a].d < 110) continue;if (A[a].y < -10 && A[b].y < -10) continue;if (dist(A[a].x, A[a].y, A[b].x, A[b].y) < 62) return null; }
        // cross separation: only a shared head (fork) or a shared tail (merge) may touch; any other contact or crossing is rejected
        const same = (p, q) => Math.abs(p.x - q.x) < 1.5 && Math.abs(p.y - q.y) < 1.5;
        for (let j = 0; j < S.length; j++) for (let k = j + 1; k < S.length; k++) { const A = S[j], Bq = S[k];
          const rA = routes[j], rB = routes[k];
          let pre = 0;while (pre < A.length && pre < Bq.length && same(A[pre], Bq[pre])) pre++;
          let suf = 0;for (;; suf++) { const dA = rA.total - suf * 8, dB = rB.total - suf * 8;if (dA < 0 || dB < 0) break;const pa = posAt(map, dA, j), pb = posAt(map, dB, k);if (!same(pa, pb)) break; }
          const preD = pre * 8, sufA = rA.total - suf * 8, sufB = rB.total - suf * 8;
          const join = [];if (pre > 0) join.push(A[pre - 1]);if (suf > 0) join.push(posAt(map, sufA, j));
          for (const p of A) { if (p.y < 0 || p.d < preD || p.d > sufA) continue;
            for (const q of Bq) { if (q.y < 0 || q.d < preD || q.d > sufB) continue;const d = dist(p.x, p.y, q.x, q.y);
              if (d < 60 && !join.some(J => dist(J.x, J.y, p.x, p.y) < 75 && dist(J.x, J.y, q.x, q.y) < 75)) return null; } } }
        const len = routes.reduce((a, r) => a + r.total, 0), main = Math.max(...routes.map(r => r.total));
        const want = Math.max(12, Math.min(18, Math.round(len / (routes.length > 1 ? 125 : 98))));
        const slots = pickSlots(map, mulberry32(7), want);
        if (slots.length < 12) return null;
        // turns: total absolute heading change (interest)
        let turn = 0;for (const r of routes) { let pa = null;for (let d = 10; d < r.total - 10; d += 10) { const p = posAt(map, d, r.i), q = posAt(map, d + 5, r.i);const a = Math.atan2(q.y - p.y, q.x - p.x);if (pa != null) { let da = Math.abs(a - pa);if (da > Math.PI) da = 2 * Math.PI - da;turn += da; }pa = a; } }
        const tl = st.lay === 'one' ? main : main;const dev = Math.abs(tl - target) / target;
        if (dev > 0.3) return null;
        return { score: -dev * 2 + slots.length * 0.04 + Math.min(turn, 16) * 0.03, len: Math.round(len), main: Math.round(main), slots: slots.length, turn: Math.round(turn * 10) / 10 };
      }
      let best = null, tried = 0, valid = 0;
      for (let t = 0; t < TRIES * 8 && valid < TRIES; t++) { tried++;const lay = mk(st.lay === 'one' && t > TRIES * 5 && !best ? (id % 2 ? 'curve' : 'bend') : null);const r = lay && evaluate(lay);if (!r) continue;valid++;if (!best || r.score > best.r.score) best = { lay, r }; }
      if (!best) return { id, fail: true, tried };
      const rnd = P => P.map(p => [Math.round(p[0]), Math.round(p[1])]);
      return { id, style: best.lay.style, gates: best.lay.gates.map(Math.round), routes: best.lay.routes.map(rnd), stats: best.r, tried, valid };
    }, [st, id, TRIES]);
    if (res.fail) console.log('FAIL', id, st.n, res.tried); else { out[id] = res; console.log(id, st.n.padEnd(28), st.lay.padEnd(6), res.style, JSON.stringify(res.stats), 'valid', res.valid, '/', res.tried); }
  }
  fs.writeFileSync(OUT, JSON.stringify(out));
  if (errors.length) console.log('ERR', errors);
  await browser.close();
})();
