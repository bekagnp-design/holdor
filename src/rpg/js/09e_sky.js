/* HOLDOR RPG — 09e_sky.js (G12): the sky and the atmosphere of the 3D world (three.js, R.render3d). Display only.
   Four meshes, one draw call each, all camera-relative (they live "at infinity" and never parallax):
   - dome:   a sphere drawn LAST among the opaques at the far depth (depthWrite off, early-z: the shader runs only on sky pixels).
             Gradient by R.ambience (blue noon zenith → pale horizon, warm orange/pink toward the sun at dawn/dusk, deep navy
             night), a soft sun disc + glow along R.ambience.sunDir, the moon with its phase, twinkling stars at night, two moving
             fbm cloud sheets (coverage from R.ambience.cloud.k, lit by the sun colour), weather haze (grey rain, white snow, warm
             Dorne heat). Below the horizon it is exactly the fog colour (read from scene.fog every frame), so the fogged terrain
             and the clipped world edge melt into it.
   - ring:   two strips of distant hazy ridges around the camera just inside the far plane (the near one darker, the far one
             paler), their profile read from the terrain heights beyond the fog (R.render3d.groundY; flat over the sea), the base
             in the fog colour: the edge of the world never shows.
   - aurora: an additive curtain beyond the Wall at night (R.ambience.auroraK), to the north, green at its lower edge, violet
             above, waving, with vertical rays. R.sky.aurora (= R.sky.aurora3d) is true while it draws: 62_ambience then skips its
             2D bands. The mesh is R.sky.auroraMesh.
   - shafts: a fan of soft additive light shafts toward a low sun (dawn / dusk, clear weather), 6 quads. OFF by default
             (R.sky.shaftsOn = true turns them on): on software GL they cost ~15 % of a frame, more than they add.
   The dome writes its depth at the far plane (z = 0.99999 w), so it is never clipped whatever camera.far is (G1 moves it every frame
   with the fog: far × 1.06); the ring (0.93 × far) and the aurora (0.7 × far) read camera.far every frame.
   R.sky = { on, ready, why, dome, ring, aurora (bool), auroraMesh, shafts, shaftsOn, uniforms, stats {ms, attach, profile}, aurora3d, setOn(bool),
             colors() → {zen, hor, fog} (display 0–1), attach(render3d) }.  System 'sky' (order 895, before the renderer's 900).
   Without THREE / WebGL / R.render3d it does nothing. */
(function () {
  const S = R.sky = R.sky || {};
  S.on = S.on !== false; S.shaftsOn = S.shaftsOn === true; S.ready = false; S.aurora = S.aurora3d = false; S.stats = { ms: 0, attach: 0, profile: 0 };
  const T = window.THREE;
  if (!T) { S.why = 'no THREE'; return; }
  const clamp = (v, a, b) => v < a ? a : v > b ? b : v, lerp = (a, b, k) => a + (b - a) * k, DEG = Math.PI / 180;
  const mix3 = (a, b, k) => [lerp(a[0], b[0], k), lerp(a[1], b[1], k), lerp(a[2], b[2], k)];
  const V3 = (x, y, z) => new T.Vector3(x, y, z);
  const hexRGB = h => { const m = /^#?([0-9a-f]{6})$/i.exec(String(h || '')); if (!m) return null; const n = parseInt(m[1], 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; };

  /* ---------- shared uniforms ---------- */
  const U = S.uniforms = {
    uZen: { value: V3(.22, .42, .76) }, uHor: { value: V3(.64, .74, .86) }, uFog: { value: V3(.35, .44, .58) },
    uSunDir: { value: V3(0, .88, .47) }, uSunCol: { value: V3(1, .95, .86) }, uWarm: { value: V3(1, .55, .3) }, uWarmK: { value: 0 },
    uNight: { value: 0 }, uMoonDir: { value: V3(0, .4, -.9) }, uMoon: { value: V3(0, 1, 0) }, uStars: { value: 0 }, uTime: { value: 0 },
    uHaze: { value: 0 }, uCloud: { value: new T.Vector4(.5, 0, 0, 0) }, uCloudLit: { value: V3(1, 1, 1) }, uCloudShade: { value: V3(.6, .65, .72) },
    uWind: { value: new T.Vector2(0, 0) }, uRr: { value: 2800 }, uRidge: { value: V3(.3, .36, .46) }, uRingA: { value: 1 },
    uCut: { value: -.2 }, uAur: { value: 0 }, uAurAz: { value: 0 }, uRa: { value: 1500 }, uAurB: { value: -.16 }, uAurT: { value: .05 }, uShaft: { value: 0 }, uShaftCol: { value: V3(1, .8, .55) }
  };
  const NOISE = 'float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }\n' +
    'float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); float a = h21(i), b = h21(i + vec2(1.0, 0.0)), c = h21(i + vec2(0.0, 1.0)), d = h21(i + vec2(1.0, 1.0)); return mix(mix(a, b, f.x), mix(c, d, f.x), f.y); }\n' +
    'float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += a * vn(p); p = p * 2.03 + 17.1; a *= 0.5; } return s; }\n';

  /* ---------- the dome ---------- */
  // the lower part of the sphere is folded onto uCut (just below where the terrain's far edge can show): those rows rasterise nothing,
  // so at the game's camera the dome covers only the top band of the screen even where the GPU has no early depth test
  const DOME_VS = 'uniform float uCut; varying vec3 vDir;\nvoid main(){ vec3 q = position; if (q.y < uCut) { q = vec3(normalize(q.xz) * sqrt(max(1.0 - uCut * uCut, 0.0)), uCut).xzy; }\n' +
    ' vDir = q; vec4 p = projectionMatrix * viewMatrix * vec4(cameraPosition + q * 1000.0, 1.0); gl_Position = vec4(p.xy, p.w * 0.99999, p.w); }';
  const DOME_FS = 'uniform vec3 uZen, uHor, uFog, uSunDir, uSunCol, uWarm, uMoonDir, uMoon, uCloudLit, uCloudShade; uniform float uWarmK, uNight, uStars, uTime, uHaze; uniform vec4 uCloud; uniform vec2 uWind;\n' +
    'varying vec3 vDir;\n' + NOISE +
    'void main(){ vec3 d = normalize(vDir); float h = d.y, up = clamp(h, 0.0, 1.0), mu = dot(d, uSunDir), m = max(mu, 0.0);\n' +
    ' vec3 col = mix(uHor, uZen, pow(up, 0.42));\n' +
    // the warm band of dawn / dusk on the sun side, low over the horizon, pink above it
    ' vec2 dh = normalize(d.xz + vec2(1e-5)), sh = normalize(uSunDir.xz + vec2(1e-5)); float side = pow(clamp(dot(dh, sh) * 0.5 + 0.5, 0.0, 1.0), 2.2);\n' +
    ' col = mix(col, uWarm, uWarmK * side * (1.0 - smoothstep(0.0, 0.42, up)));\n' +
    ' col = mix(col, vec3(0.86, 0.52, 0.62), uWarmK * 0.35 * side * smoothstep(0.08, 0.3, up) * (1.0 - smoothstep(0.3, 0.7, up)));\n' +
    // stars (night, above the horizon)
    ' if (uStars > 0.01 && h > 0.0) { vec3 sp = d * 95.0; vec3 ci = floor(sp); vec3 cf = fract(sp) - 0.5; float r = fract(sin(dot(ci, vec3(12.9898, 78.233, 37.719))) * 43758.5453);\n' +
    '  float sd = length(cf - (vec3(fract(r * 13.1), fract(r * 7.3), fract(r * 3.7)) - 0.5) * 0.5); float st = step(0.955, r) * (smoothstep(0.13, 0.0, sd) + 0.25 * smoothstep(0.3, 0.0, sd));\n' +
    '  st *= (0.55 + 0.45 * sin(uTime * (1.3 + r * 3.0) + r * 60.0)) * (0.5 + 0.5 * fract(r * 91.7)); col += vec3(0.9, 0.93, 1.0) * st * uStars * smoothstep(0.02, 0.22, h); }\n' +
    // the moon: a disc with its phase + a halo
    ' float mm = dot(d, uMoonDir);\n' +
    ' if (uNight > 0.01) { col += vec3(0.5, 0.58, 0.8) * (pow(max(mm, 0.0), 300.0) * 0.35 + pow(max(mm, 0.0), 40.0) * 0.06) * uNight * uMoon.y;\n' +
    '  if (mm > 0.99) { vec3 rt = normalize(cross(uMoonDir, vec3(0.0, 1.0, 0.0))); vec3 uv = cross(rt, uMoonDir); vec2 l = vec2(dot(d, rt), dot(d, uv)) / 0.024; float rr = length(l);\n' +
    '   float disk = smoothstep(1.0, 0.9, rr), lit = smoothstep(0.94, 1.06, length(l - vec2(uMoon.x, 0.0)));\n' +
    '   col = mix(col, vec3(0.92, 0.94, 1.0) * (0.8 + 0.2 * vn(l * 2.5 + 3.0)), disk * mix(0.05, 1.0, lit) * uNight); } }\n' +
    // the sun: glow + disc (dimmed by haze, gone at night)
    // two cloud sheets: a big soft low one and a thin fast high one, lit toward the sun
    ' if (h > 0.0 && uCloud.x > 0.01) { vec2 q = d.xz / (h + 0.14);\n' +
    '  float n1 = fbm(q * 1.25 + uWind), n2 = fbm(q * 3.2 - uWind * 1.7 + 7.0), cov = uCloud.x, fade = smoothstep(0.0, 0.16, h);\n' +
    '  float a2 = smoothstep(1.02 - cov * 0.8, 1.32 - cov * 0.8, n2) * 0.55 * fade, a1 = smoothstep(0.98 - cov, 1.3 - cov, n1) * fade;\n' +
    '  vec3 lit = mix(uCloudShade, uCloudLit, 0.6 + 0.4 * m);\n' +
    '  col = mix(col, lit * (0.9 + 0.1 * n1), a2);\n' +
    '  col = mix(col, mix(uCloudShade, lit, smoothstep(0.35, 0.95, n1 + 0.25 * m)), a1 * (0.75 + 0.25 * cov)); }\n' +
    // haze toward the horizon; below it the fog colour, so the fogged terrain melts in
    ' col = mix(col, mix(uHor, uFog, 0.35), uHaze * 0.55 * (1.0 - smoothstep(0.0, 0.6, up)));\n' +
    ' float day = 1.0 - uNight; col += uSunCol * (pow(m, 8.0) * 0.14 + pow(m, 60.0) * 0.3) * day * (1.0 - uHaze * 0.35);\n' +
    ' col = mix(col, vec3(1.0, 0.97, 0.9), smoothstep(0.9993, 0.99965, mu) * day * (1.0 - uHaze * 0.6) * smoothstep(-0.01, 0.02, h));\n' +
    ' float hz = smoothstep(-0.04, 0.2 + 0.15 * uHaze, h); col = mix(uFog, col, hz * hz * (3.0 - 2.0 * hz) * 0.35 + hz * 0.65);\n' +
    ' col += (h21(gl_FragCoord.xy) - 0.5) / 160.0;\n' +
    ' gl_FragColor = vec4(col, 1.0); }';

  /* ---------- the ridge ring: N columns × 2 strips, (cos θ, tan elevation, sin θ) per vertex, updated from the terrain ---------- */
  const RN = 180;
  const RING_VS = 'attribute float aK; attribute float aTop; uniform float uRr; varying float vK; varying float vTop;\n' +
    'void main(){ float r = uRr * (aK > 0.5 ? 1.0 : 0.9); vK = aK; vTop = aTop; vec3 w = cameraPosition + vec3(position.x * r, position.y * r, position.z * r); gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0); }';
  const RING_FS = 'uniform vec3 uFog, uRidge, uSunCol, uSunDir; uniform float uRingA, uNight; varying float vK; varying float vTop;\n' +
    'float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }\n' +
    'void main(){ vec3 ridge = mix(uRidge, uFog, vK * 0.5); float k = uRingA * pow(clamp(vTop, 0.0, 1.0), 1.6); gl_FragColor = vec4(mix(uFog, ridge, k) + (h21(gl_FragCoord.xy) - 0.5) / 160.0, 1.0); }';
  let ringPos = null, ringTop = null, ringBot = null, ringCur = null;

  /* ---------- the aurora curtain (north, ±75°) ---------- */
  const AN = 64;
  const AUR_VS = 'attribute float aU; attribute float aV; uniform float uRa, uAurB, uAurT, uTime, uAurAz; varying float vU; varying float vV;\n' +
    'void main(){ vU = aU; vV = aV; float th = uAurAz + (aU - 0.5) * 2.6 + 0.18 * sin(aU * 7.0 + uTime * 0.11) + 0.06 * sin(aU * 19.0 - uTime * 0.23);\n' +
    ' float r = uRa * (1.0 + 0.1 * sin(aU * 11.0 + uTime * 0.17));\n' +
    ' vec3 dir = vec3(sin(th), 0.0, -cos(th)); float e = mix(uAurB, uAurT, aV) + 0.012 * sin(aU * 13.0 + uTime * 0.3) * aV;\n' +
    ' vec3 w = cameraPosition + dir * r + vec3(0.0, e * r, 0.0); gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0); }';
  const AUR_FS = 'uniform float uAur, uTime; varying float vU; varying float vV;\n' + NOISE +
    'void main(){ float rays = 0.45 + 0.55 * vn(vec2(vU * 70.0 + uTime * 0.35, uTime * 0.05)); rays *= 0.6 + 0.4 * vn(vec2(vU * 23.0 - uTime * 0.2, 3.0));\n' +
    ' float body = smoothstep(0.0, 0.12, vV) * pow(1.0 - vV, 1.3) * (0.6 + 0.4 * fbm(vec2(vU * 5.0 + uTime * 0.05, vV * 2.0 - uTime * 0.03)));\n' +
    ' float edge = smoothstep(0.0, 0.18, vU) * smoothstep(1.0, 0.82, vU);\n' +
    ' vec3 col = mix(vec3(0.25, 1.0, 0.6), vec3(0.62, 0.36, 1.0), smoothstep(0.25, 0.85, vV)); col = mix(col, vec3(0.3, 0.9, 0.85), 0.3 * vn(vec2(vU * 9.0, uTime * 0.07)));\n' +
    ' gl_FragColor = vec4(col * body * rays * edge * uAur, 1.0); }';

  /* ---------- light shafts toward a low sun ---------- */
  const SHN = 6;
  const SH_VS = 'attribute float aS; attribute vec2 aQ; uniform vec3 uSunDir; uniform float uRa, uTime; varying vec2 vQ; varying float vS;\n' +
    'void main(){ vQ = aQ; vS = aS; vec3 f = normalize(vec3(uSunDir.x, 0.0, uSunDir.z) + vec3(1e-4, 0.0, 0.0)); vec3 rt = vec3(-f.z, 0.0, f.x);\n' +
    ' float spread = (aS - 0.5) * 1.1 + 0.05 * sin(uTime * 0.07 + aS * 9.0); vec3 dir = normalize(f + rt * spread);\n' +
    ' float wid = 0.035 + 0.03 * fract(aS * 7.31); vec3 side = normalize(vec3(-dir.z, 0.0, dir.x));\n' +
    ' float dist = mix(0.18, 1.0, aQ.y) * uRa; vec3 w = cameraPosition + dir * dist + side * (aQ.x - 0.5) * wid * dist * 2.0 + vec3(0.0, mix(-0.12, 0.25, aQ.y) * dist, 0.0);\n' +
    ' gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0); }';
  const SH_FS = 'uniform float uShaft, uTime; uniform vec3 uShaftCol; varying vec2 vQ; varying float vS;\n' +
    'void main(){ float a = (1.0 - abs(vQ.x - 0.5) * 2.0); a = a * a * smoothstep(0.0, 0.35, vQ.y) * smoothstep(1.0, 0.6, vQ.y);\n' +
    ' a *= 0.6 + 0.4 * sin(uTime * 0.4 + vS * 17.0); gl_FragColor = vec4(uShaftCol * a * uShaft, 1.0); }';

  let G = null, scene = null, dome = null, ring = null, aur = null, shafts = null, root = null;
  function mat(vs, fs, o) { return new T.ShaderMaterial(Object.assign({ uniforms: U, vertexShader: vs, fragmentShader: fs, fog: false }, o)); }
  function build() {
    root = new T.Group(); root.name = 'sky';
    const dg = new T.SphereGeometry(1, 48, 20, 0, Math.PI * 2, 0, 120 * DEG);   // the zenith down to 30° below the horizon (no bottom pole)
    dome = new T.Mesh(dg, mat(DOME_VS, DOME_FS, { side: T.BackSide, depthWrite: false, depthTest: true }));
    dome.name = 'skyDome'; dome.frustumCulled = false; dome.renderOrder = 9999;
    // ring
    const nv = (RN + 1) * 4; ringPos = new Float32Array(nv * 3); const aK = new Float32Array(nv), aTop = new Float32Array(nv), idx = [];
    ringTop = new Float32Array((RN + 1) * 2); ringBot = new Float32Array(RN + 1); ringCur = new Float32Array((RN + 1) * 2); ringCur.fill(-.06); ringBot.fill(-.1);
    for (let s = 0; s < 2; s++) for (let i = 0; i <= RN; i++) { const th = i / RN * Math.PI * 2, base = (s * (RN + 1) + i) * 2;
      for (let v = 0; v < 2; v++) { const k = base + v; ringPos[k * 3] = Math.sin(th); ringPos[k * 3 + 2] = -Math.cos(th); ringPos[k * 3 + 1] = v ? -.05 : -.1; aK[k] = s ? 1 : 0; aTop[k] = v; }
      if (i < RN) { const a = base, b = base + 1, c = base + 2, d = base + 3; idx.push(a, c, b, b, c, d); } }
    const rg = new T.BufferGeometry(); rg.setAttribute('position', new T.BufferAttribute(ringPos, 3).setUsage(T.DynamicDrawUsage)); rg.setAttribute('aK', new T.BufferAttribute(aK, 1)); rg.setAttribute('aTop', new T.BufferAttribute(aTop, 1)); rg.setIndex(idx);
    ring = new T.Mesh(rg, mat(RING_VS, RING_FS, { side: T.DoubleSide })); ring.name = 'skyRing'; ring.frustumCulled = false; ring.renderOrder = 9990;
    // aurora
    const ap = new Float32Array((AN + 1) * 2 * 3), au = new Float32Array((AN + 1) * 2), av = new Float32Array((AN + 1) * 2), ai = [];
    for (let i = 0; i <= AN; i++) for (let v = 0; v < 2; v++) { const k = i * 2 + v; au[k] = i / AN; av[k] = v; if (v && i < AN) { const a = i * 2, b = a + 1, c = a + 2, d = a + 3; ai.push(a, c, b, b, c, d); } }
    const ag = new T.BufferGeometry(); ag.setAttribute('position', new T.BufferAttribute(ap, 3)); ag.setAttribute('aU', new T.BufferAttribute(au, 1)); ag.setAttribute('aV', new T.BufferAttribute(av, 1)); ag.setIndex(ai);
    aur = new T.Mesh(ag, mat(AUR_VS, AUR_FS, { side: T.DoubleSide, transparent: true, depthWrite: false, blending: T.AdditiveBlending })); aur.name = 'skyAurora'; aur.frustumCulled = false; aur.renderOrder = 10; aur.visible = false;
    // shafts
    const sp = new Float32Array(SHN * 4 * 3), ss = new Float32Array(SHN * 4), sq = new Float32Array(SHN * 4 * 2), si = [];
    for (let i = 0; i < SHN; i++) { for (let v = 0; v < 4; v++) { const k = i * 4 + v; ss[k] = (i + .5) / SHN + .03 * Math.sin(i * 3.1); sq[k * 2] = v & 1; sq[k * 2 + 1] = v >> 1; } const a = i * 4; si.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    const sg = new T.BufferGeometry(); sg.setAttribute('position', new T.BufferAttribute(sp, 3)); sg.setAttribute('aS', new T.BufferAttribute(ss, 1)); sg.setAttribute('aQ', new T.BufferAttribute(sq, 2)); sg.setIndex(si);
    shafts = new T.Mesh(sg, mat(SH_VS, SH_FS, { side: T.DoubleSide, transparent: true, depthWrite: false, depthTest: true, blending: T.AdditiveBlending })); shafts.name = 'skyShafts'; shafts.frustumCulled = false; shafts.renderOrder = 11; shafts.visible = false;
    root.add(dome, ring, aur, shafts);
    S.dome = dome; S.ring = ring; S.auroraMesh = aur; S.shafts = shafts; S.root = root;
  }
  S.attach = g => {
    try {
      if (!g || !g.scene || !g.camera) return false;
      if (typeof g.setFog !== 'function' || !g.uniforms) { S.why = 'not the 3D renderer (no setFog / uniforms)'; return false; }   // a test's stand-in scene: leave it alone
      if (G === g && scene === g.scene && root && root.parent === scene) return true;
      if (!root) build();
      if (root.parent) root.parent.remove(root);
      G = g; scene = g.scene; scene.add(root); S.ready = true; S.stats.attach++; profT = 0;
      if (!scene.__skyHook) { scene.__skyHook = true; const prev = scene.onBeforeRender;
        scene.onBeforeRender = function () { if (typeof prev === 'function') { try { prev.apply(this, arguments); } catch (e) { } } try { if (S.on) fogFixNow(); } catch (e) { } }; }
      return true;
    } catch (e) { S.why = 'attach: ' + (e && e.message); console.warn('sky: attach', e); return false; }
  };
  S.setOn = v => { S.on = !!v; if (root) root.visible = S.on; };

  /* ---------- the fog colour ----------
     The terrain's ShaderMaterial writes its colours raw (no linear → sRGB at the end), but its fogCol is copied from scene.fog.color,
     which three's colour management keeps LINEAR: the terrain's haze shows far darker than the hex A34 asked for (#9fb0c8 shows as
     ≈ #586f93) while the built-in materials (props, trees) fade to the real hex. S.fogFix (default on) re-encodes the terrain's fogCol
     to sRGB right before each render whenever it still equals the linear scene fog (i.e. nobody fixed it upstream); the dome and the
     ring then use exactly the colour the terrain fades to. */
  S.fogFix = S.fogFix !== false;
  const _fc = new T.Color();
  function fogNow() {
    const tu = G && G.uniforms && G.uniforms.fogCol && G.uniforms.fogCol.value;
    if (scene && scene.fog) { _fc.copy(scene.fog.color); if (S.fogFix) _fc.convertLinearToSRGB(); else if (tu) _fc.copy(tu); }
    else if (tu) _fc.copy(tu); else _fc.setRGB(.62, .69, .78);
    return [_fc.r, _fc.g, _fc.b];
  }
  function fogFixNow() {
    const tu = G && G.uniforms && G.uniforms.fogCol && G.uniforms.fogCol.value; if (!S.fogFix || !tu || !scene || !scene.fog) return;
    const f = scene.fog.color; if (Math.abs(tu.r - f.r) + Math.abs(tu.g - f.g) + Math.abs(tu.b - f.b) < 1e-6) tu.copy(f).convertLinearToSRGB();
    const c = fogNow(); U.uFog.value.set(c[0], c[1], c[2]);
  }

  /* ---------- the colours ---------- */
  const DAY_ZEN = [.26, .5, .86], DAY_HOR = [.74, .83, .93], NIGHT_ZEN = [.012, .022, .06], NIGHT_HOR = [.05, .08, .17], DUSK_ZEN = [.24, .27, .5], DUSK_HOR = [.98, .62, .4];
  const WX = { rain: { c: [.42, .46, .52], k: .78, haze: .85 }, snow: { c: [.84, .88, .94], k: .62, haze: .75 }, heat: { c: [.93, .82, .64], k: .38, haze: .55 }, spray: { c: [.7, .78, .84], k: .25, haze: .3 }, sun: { c: [.18, .4, .8], k: .15, haze: 0 } };
  S.colors = () => {
    const A = R.ambience || {}, k = A.nightK || 0, warm = Math.max(A.dawnK || 0, A.duskK || 0) * (1 - k), W = A.weather || 'clear';
    let zen = mix3(DAY_ZEN, NIGHT_ZEN, k), hor = mix3(DAY_HOR, NIGHT_HOR, k);
    zen = mix3(zen, DUSK_ZEN, warm * .55); hor = mix3(hor, DUSK_HOR, warm * .35);
    const w = WX[W]; let haze = 0;
    if (w) { const c = mix3(w.c, mix3(w.c, NIGHT_HOR, .85), k); zen = mix3(zen, c, w.k * (1 - .4 * k)); hor = mix3(hor, c, w.k); haze = w.haze; }
    const f = fogNow();
    return { zen, hor, fog: f, warm, haze, k, W };
  };

  /* ---------- the ridge profile: terrain heights beyond the fog, between the ground line and the top of the view ---------- */
  let profT = 0, profX = 1e9, profZ = 1e9, profE = 0;
  function profile() {
    const cam = G.camera, cx = cam.position.x, cz = cam.position.z, cy = cam.position.y, Rr = U.uRr.value, gy = G.groundY, W = R.W || 7200, H = R.H || 12288;
    const topE = (cam.fov / 2) * DEG - (R.cam && R.cam.pitch || 35 * DEG);       // the elevation of the top screen row
    const t0 = performance.now();
    for (let i = 0; i <= RN; i++) {
      const th = i / RN * Math.PI * 2, dx = Math.sin(th), dz = -Math.cos(th);
      let land = 0, hiH = 0, n = 0;
      for (let j = 0; j < 5; j++) { const d = Rr * (1.05 + j * .55), x = cx + dx * d, z = cz + dz * d; n++;
        if (x < 0 || z < 0 || x > W || z > H) continue; const h = gy(x, z); if (h > 4) { land++; if (h > hiH) hiH = h; } }
      const bx = clamp(cx + dx * Rr, 0, W), bz = clamp(cz + dz * Rr, 0, H), inW = cx + dx * Rr >= 0 && cz + dz * Rr >= 0 && cx + dx * Rr <= W && cz + dz * Rr <= H;
      const gB = inW ? gy(bx, bz) : 0, eB = Math.atan2(gB - cy, Rr) - 1.2 * DEG;     // the ground line at the ring (the ring hides below it)
      const span = clamp(topE - eB, 2 * DEG, 6 * DEG), lf = land / n;
      const nz = .5 + .3 * Math.sin(th * 5 + 1.3) * Math.sin(th * 2 - .7) + .12 * Math.sin(th * 13 + 2.1) + .05 * Math.sin(th * 31 + .4);
      const fNear = lf * (.1 + .2 * clamp(hiH / 220, 0, 1) + .12 * nz), fFar = lf * (.2 + .3 * clamp(hiH / 200, 0, 1) + .14 * (1 - nz)) + (1 - lf) * .03;
      ringBot[i] = Math.tan(eB - 1.5 * DEG); ringTop[i] = Math.tan(eB + span * fNear + .2 * DEG); ringTop[RN + 1 + i] = Math.tan(eB + span * Math.max(fFar, fNear * .7) + .4 * DEG);
    }
    profX = cx; profZ = cz; profE = topE; S.stats.profile = +(performance.now() - t0).toFixed(3);
  }
  function applyProfile(k) {
    for (let s = 0; s < 2; s++) for (let i = 0; i <= RN; i++) { const c = s * (RN + 1) + i; ringCur[c] = lerp(ringCur[c], ringTop[c], k);
      // the near strip's top must not hide the far strip completely: the far one is drawn behind (larger radius)
      ringPos[(c * 2) * 3 + 1] = ringBot[i]; ringPos[(c * 2 + 1) * 3 + 1] = Math.max(ringBot[i] + .002, ringCur[c]); }
    ring.geometry.attributes.position.needsUpdate = true;
  }

  /* ---------- per frame ---------- */
  let t = 0, inited = false, aurAz = 0, aurSnap = true; let skipG = null;
  function update(dt) {
    const G3 = R.render3d; if (!G3 || !G3.scene) return;
    if (!S.ready || G3 !== G || G3.scene !== scene || !root || root.parent !== scene) { if (G3 === skipG || !S.attach(G3)) { skipG = G3; return; } }
    const t0 = performance.now();
    root.visible = S.on; if (!S.on) { S.aurora = S.aurora3d = false; return; }
    t += dt || 1 / 60; const A = R.ambience || {}, cam = G.camera, c = S.colors();
    U.uTime.value = t;
    U.uZen.value.set(c.zen[0], c.zen[1], c.zen[2]); U.uHor.value.set(c.hor[0], c.hor[1], c.hor[2]); U.uFog.value.set(c.fog[0], c.fog[1], c.fog[2]);
    U.uNight.value = c.k; U.uWarmK.value = c.warm * (1 - c.haze * .6); U.uHaze.value = c.haze;
    const sd = A.sunDir || { x: 0, y: .88, z: .47 }, night = c.k > .5;
    // A.sunDir is the moon at night (its azimuth flips): the sun below the horizon then, the moon raised for the dome
    if (!night) U.uSunDir.value.set(sd.x, sd.y, sd.z).normalize(); else U.uSunDir.value.set(-sd.x, -Math.abs(sd.y) - .2, -sd.z).normalize();
    const md = night ? [sd.x, Math.max(sd.y, .2), sd.z] : [-sd.x, .35, -sd.z]; U.uMoonDir.value.set(md[0], md[1], md[2]).normalize();
    const mp = A.moon ? A.moon.phase || 0 : 0; U.uMoon.value.set((mp < .5 ? -1 : 1) * 2.1 * Math.sin(Math.PI * mp), A.moon ? .4 + .6 * (A.moon.lit || 0) : 1, 0);
    U.uStars.value = clamp((c.k - .25) / .6, 0, 1) * (1 - c.haze * .9);
    const sc = hexRGB(A.gl && A.gl.sun) || [1, .95, .86]; U.uSunCol.value.set(sc[0], sc[1], sc[2]);
    U.uWarm.value.set(1, lerp(.5, .62, A.dawnK || 0), lerp(.28, .4, A.dawnK || 0));
    // clouds: coverage by the weather, lit by the sun by day, by the moon at night
    const ck = clamp(A.cloud && A.cloud.k != null ? A.cloud.k : .5, 0, 1), W = c.W, rainy = W === 'rain' ? 1 : 0;
    U.uCloud.value.x = clamp(ck * (W === 'clear' ? .75 : 1) * (rainy ? 1.15 : 1), 0, 1.1);
    const litD = mix3([1, .98, .94], sc, .5), litN = [.2, .23, .32], lit = mix3(mix3(litD, [.62, .65, .7], rainy * .8), litN, c.k);
    const shade = mix3(mix3(c.hor, [.5, .54, .6], .5), litN, c.k * .9).map((v, i) => v * (rainy ? .62 : .82) + (rainy ? 0 : c.warm * [.12, .04, .02][i]));
    U.uCloudLit.value.set(lit[0] + c.warm * .12, lit[1] + c.warm * .02, lit[2]); U.uCloudShade.value.set(shade[0], shade[1], shade[2]);
    const ws = (rainy ? 2.2 : W === 'snow' ? 1.4 : 1) * (dt || 1 / 60); U.uWind.value.x += .0035 * ws; U.uWind.value.y += .0021 * ws;
    // the ring: just inside the far plane; its profile every 0.4 s (or after a jump), eased in
    U.uRr.value = cam.far * .93;
    const camH = Math.max(20, cam.position.y - G.groundY(clamp(cam.position.x, 0, R.W), clamp(cam.position.z, 0, R.H)));
    U.uCut.value = Math.sin(-Math.atan2(camH + 60, cam.far * .8) - 3 * DEG);
    profT -= dt || 1 / 60; const pitchE = (cam.fov / 2) * DEG - (R.cam && R.cam.pitch || 0);
    if (profT <= 0 || Math.hypot(cam.position.x - profX, cam.position.z - profZ) > 600 || Math.abs(pitchE - profE) > 2 * DEG) { profT = .4; profile(); applyProfile(inited ? .35 : 1); inited = true; }
    else applyProfile(.08);
    const rd = mix3([.8, .85, .93], [.55, .62, .78], c.k); U.uRidge.value.set(c.fog[0] * rd[0], c.fog[1] * rd[1], c.fog[2] * rd[2] + .01);
    U.uRingA.value = clamp(1 - c.haze * .5, .35, 1);
    // aurora beyond the Wall at night: in front of the ring, its lower edge on the ground line, the top above the view
    const ak = clamp(A.auroraK || 0, 0, 1); aur.visible = ak > .02; S.aurora = S.aurora3d = aur.visible; U.uAur.value = ak * .85;
    if (aur.visible) { const Ra = cam.far * .7, gB = G.groundY(clamp(cam.position.x, 0, R.W), clamp(cam.position.z - Ra, 0, R.H)); U.uRa.value = Ra;
      U.uAurB.value = Math.tan(Math.atan2(gB - cam.position.y, Ra) - 1.5 * DEG); U.uAurT.value = Math.tan(clamp(pitchE + 10 * DEG, 2 * DEG, 40 * DEG));
      // the curtain's centre eases toward the view's azimuth (≈ 25 s), so beyond the Wall it hangs wherever one looks, without sticking to the camera
      const yaw = R.cam && isFinite(R.cam.yaw) ? R.cam.yaw : 0; let dA = yaw - aurAz; dA = Math.atan2(Math.sin(dA), Math.cos(dA)); aurAz += dA * (aurSnap ? 1 : clamp((dt || 1 / 60) / 25, 0, 1)); aurSnap = false; U.uAurAz.value = aurAz; }
    else aurSnap = true;
    // shafts: a low sun in clear / sunny weather
    const el = A.sun ? A.sun.el || 0 : .5, low = clamp(1 - (el / DEG - 6) / 22, 0, 1) * (el > 1 * DEG ? 1 : 0), clearK = W === 'clear' || W === 'sun' ? 1 : W === 'spray' ? .4 : 0;
    U.uShaft.value = .1 * low * clearK * (1 - c.k); shafts.visible = S.shaftsOn && U.uShaft.value > .004;
    if (shafts.visible) { U.uShaftCol.value.set(sc[0], sc[1] * .86, sc[2] * .7); U.uRa.value = aur.visible ? U.uRa.value : cam.far * .7; }
    S.stats.ms = +(performance.now() - t0).toFixed(3);
  }
  R.addSys('sky', { order: 895, update });
  if (R.bus && R.bus.on) R.bus.on('render3d', g => { S.attach(g || R.render3d); });
})();
