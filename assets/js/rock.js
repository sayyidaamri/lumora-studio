// A floating rock that grows moss as you scroll. Own geometry + shading, three.js r149 (global THREE).
(() => {

// --- compact 3D gradient noise (Perlin-style) ---
const P = new Uint8Array(512);
{ const p = [...Array(256).keys()]; let s = 7; for (let i = 255; i > 0; i--) { s = (s * 16807) % 2147483647; const j = s % (i + 1); [p[i], p[j]] = [p[j], p[i]]; } for (let i = 0; i < 512; i++) P[i] = p[i & 255]; }
const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const grad = (h, x, y, z) => { const u = h < 8 ? x : y, v = h < 4 ? y : h === 12 || h === 14 ? x : z; return ((h & 1) ? -u : u) + ((h & 2) ? -v : v); };
function noise(x, y, z) {
  const X = Math.floor(x) & 255, Y = Math.floor(y) & 255, Z = Math.floor(z) & 255;
  x -= Math.floor(x); y -= Math.floor(y); z -= Math.floor(z);
  const u = fade(x), v = fade(y), w = fade(z);
  const A = P[X] + Y, AA = P[A] + Z, AB = P[A + 1] + Z, B = P[X + 1] + Y, BA = P[B] + Z, BB = P[B + 1] + Z;
  const L = (a, b, t) => a + t * (b - a);
  return L(L(L(grad(P[AA] & 15, x, y, z), grad(P[BA] & 15, x - 1, y, z), u), L(grad(P[AB] & 15, x, y - 1, z), grad(P[BB] & 15, x - 1, y - 1, z), u), v),
    L(L(grad(P[AA + 1] & 15, x, y, z - 1), grad(P[BA + 1] & 15, x - 1, y, z - 1), u), L(grad(P[AB + 1] & 15, x, y - 1, z - 1), grad(P[BB + 1] & 15, x - 1, y - 1, z - 1), u), v), w);
}
const fbm = (x, y, z, o = 5) => { let a = 0, f = 1, amp = 0.5; for (let i = 0; i < o; i++) { a += amp * noise(x * f, y * f, z * f); f *= 2.03; amp *= 0.5; } return a; };
const ridge = (x, y, z) => { let a = 0, f = 1, amp = 0.5; for (let i = 0; i < 4; i++) { a += amp * (1 - Math.abs(noise(x * f, y * f, z * f))); f *= 2.1; amp *= 0.5; } return a; };

window.createRock = function createRock(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
  renderer.outputEncoding = THREE.sRGBEncoding;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  camera.position.set(0, 0.25, 6.4);

  // geometry: displaced, flattened icosphere
  const geo = new THREE.SphereGeometry(1, 220, 140);
  const pos = geo.attributes.position, N = pos.count;
  const base = new Float32Array(N * 3), normalsDir = new Float32Array(N * 3), mossMask = new Float32Array(N), tone = new Float32Array(N);
  const v = new THREE.Vector3();
  for (let i = 0; i < N; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    const n1 = fbm(v.x * 1.3 + 3, v.y * 1.3, v.z * 1.3, 3);
    const r = ridge(v.x * 2.6, v.y * 2.6, v.z * 2.6);
    const fine = fbm(v.x * 9, v.y * 9, v.z * 9, 3);
    const facet = Math.round(noise(v.x * 2.2, v.y * 2.2, v.z * 2.2) * 5) / 5;
    const rad = 1 + n1 * 0.5 + r * 0.32 + facet * 0.16 + fine * 0.06;
    base[i * 3] = v.x * rad * 1.32; base[i * 3 + 1] = v.y * rad * 0.78; base[i * 3 + 2] = v.z * rad * 1.05;
    normalsDir[i * 3] = v.x; normalsDir[i * 3 + 1] = v.y; normalsDir[i * 3 + 2] = v.z;
    mossMask[i] = 0.5 + 0.5 * fbm(v.x * 2.2 + 9, v.y * 2.2, v.z * 2.2, 4) * 1.6 + v.y * 0.35;
    tone[i] = Math.pow(Math.min(1, Math.max(0, 0.5 + 0.9 * fbm(v.x * 7, v.y * 7, v.z * 7, 5))), 1.6);
  }
  const colors = new Float32Array(N * 3);
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0.05, flatShading: true });
  const rock = new THREE.Mesh(geo, mat);
  const group = new THREE.Group(); group.add(rock); scene.add(group);

  // moss fuzz: points scattered over the surface
  const FZ = 60000;
  const fpos = new Float32Array(FZ * 3), fcol = new Float32Array(FZ * 3), fseed = new Float32Array(FZ), fidx = new Uint32Array(FZ), flen = new Float32Array(FZ);
  for (let k = 0; k < FZ; k++) { fidx[k] = (Math.random() * N) | 0; fseed[k] = Math.random(); flen[k] = 0.015 + Math.pow(Math.random(), 2) * 0.12; }
  const fgeo = new THREE.BufferGeometry();
  fgeo.setAttribute("position", new THREE.BufferAttribute(fpos, 3));
  fgeo.setAttribute("color", new THREE.BufferAttribute(fcol, 3));
  const fmat = new THREE.PointsMaterial({ size: 0.02, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: true, sizeAttenuation: true });
  const fuzz = new THREE.Points(fgeo, fmat); group.add(fuzz);

  scene.add(new THREE.AmbientLight(0xffffff, 0.08 / Math.PI));
  const key = new THREE.DirectionalLight(0xffffff, 4.2 / Math.PI); key.position.set(-2, 5, 2.5); scene.add(key);
  const rim = new THREE.DirectionalLight(0xbfe39a, 1.1 / Math.PI); rim.position.set(4, -1, -3); scene.add(rim);
  const fill = new THREE.DirectionalLight(0xffffff, 0.35 / Math.PI); fill.position.set(2, -3, 4); scene.add(fill);

  let moss = -1, active = false, progress = 0, t0 = performance.now();
  function applyMoss(m) {
    for (let i = 0; i < N; i++) {
      const g = Math.min(1, Math.max(0, (mossMask[i] - (1.15 - m * 1.35)) * 3.2));
      const tn = tone[i];
      const rr = 0.02 + tn * 0.24, gg = rr, bb = rr * 1.03;
      const mr = 0.03 + tn * 0.1, mg = 0.07 + tn * 0.22, mb = 0.01 + tn * 0.03;
      colors[i * 3] = rr + (mr - rr) * g; colors[i * 3 + 1] = gg + (mg - gg) * g; colors[i * 3 + 2] = bb + (mb - bb) * g;
      const lift = g * 0.05;
      pos.array[i * 3] = base[i * 3] + normalsDir[i * 3] * lift; pos.array[i * 3 + 1] = base[i * 3 + 1] + normalsDir[i * 3 + 1] * lift; pos.array[i * 3 + 2] = base[i * 3 + 2] + normalsDir[i * 3 + 2] * lift;
    }
    pos.needsUpdate = true; geo.attributes.color.needsUpdate = true;
    for (let k = 0; k < FZ; k++) {
      const i = fidx[k];
      const g = Math.min(1, Math.max(0, (mossMask[i] - (1.15 - m * 1.35)) * 3.2));
      const h = g > 0.05 ? flen[k] * g * (0.6 + fseed[k]) : -1;
      if (h < 0) { fpos[k * 3] = fpos[k * 3 + 1] = fpos[k * 3 + 2] = 0; fcol[k * 3] = fcol[k * 3 + 1] = fcol[k * 3 + 2] = 0; continue; }
      const jx = (fseed[k] - 0.5) * 0.03;
      fpos[k * 3] = base[i * 3] + normalsDir[i * 3] * (0.03 + h) + jx; fpos[k * 3 + 1] = base[i * 3 + 1] + normalsDir[i * 3 + 1] * (0.03 + h) + Math.abs(jx); fpos[k * 3 + 2] = base[i * 3 + 2] + normalsDir[i * 3 + 2] * (0.03 + h) - jx;
      const nx = normalsDir[i * 3], ny = normalsDir[i * 3 + 1], nz = normalsDir[i * 3 + 2];
      const lit = Math.max(0, -nx * 0.45 + ny * 0.75 + nz * 0.45);
      const tip = h / 0.13, b = (0.06 + lit * lit * 1.25) * (0.55 + tip * 0.7 + fseed[k] * 0.35);
      const flower = fseed[k] > 0.992;
      fcol[k * 3] = flower ? 0.8 : 0.2 * b; fcol[k * 3 + 1] = flower ? 0.72 : 0.5 * b; fcol[k * 3 + 2] = flower ? 0.85 : 0.06 * b;
    }
    fgeo.attributes.position.needsUpdate = true; fgeo.attributes.color.needsUpdate = true;
  }
  applyMoss(0); moss = 0;

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    const s = Math.min(1, w / h * 0.95); group.scale.setScalar(s);
  }
  resize(); addEventListener("resize", resize);

  function render(now) {
    if (active) {
      const t = (now - t0) / 1000;
      group.rotation.y = -0.5 + progress * 2.4 + t * 0.06;
      group.rotation.x = 0.35 - progress * 0.25 + Math.sin(t * 0.5) * 0.03;
      group.rotation.z = -0.18 + progress * 0.3;
      group.position.y = Math.sin(t * 0.8) * 0.04 + (progress < 0.6 ? 0.18 - progress * 0.3 : 0);
      const target = Math.min(1, Math.max(0, (progress - 0.28) / 0.32));
      if (Math.abs(target - moss) > 0.012) { moss += (target - moss) * 0.35; applyMoss(moss); }
      renderer.render(scene, camera);
    }
    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
  return { update(p) { progress = p; }, setActive(a) { active = a; } };
};
})();
