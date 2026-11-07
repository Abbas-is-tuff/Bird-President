// Procedural 3D birds. Each character's look (colours + species type) builds a distinct model with
// vertex-colour plumage zones multiplied by feather detail and normal maps, plus idle animation.
import * as THREE from 'three';
import { featherTextures, flightFeatherTextures } from './textures.js';
import { LOOKS, PALETTES } from '../sim/data.js';

export function lookFor(ch) {
  if (!ch) return LOOKS.abbas;
  if (LOOKS[ch.look]) return LOOKS[ch.look];
  if (ch.look && ch.look.startsWith('pal')) return PALETTES[+ch.look.slice(3)] || PALETTES[0];
  return LOOKS.abbas;
}

const col = (h) => new THREE.Color(h);

function zoneSphere(r, segW, segH, colorFn) {
  const g = new THREE.SphereGeometry(r, segW, segH);
  const pos = g.attributes.position, n = pos.count, colors = new Float32Array(n * 3), v = new THREE.Vector3();
  for (let i = 0; i < n; i++) {
    v.fromBufferAttribute(pos, i).divideScalar(r);
    const c = colorFn(v);
    colors[i * 3] = c.r * 1.18; colors[i * 3 + 1] = c.g * 1.18; colors[i * 3 + 2] = c.b * 1.18;
  }
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  return g;
}
const mix = (a, b, t) => a.clone().lerp(b, Math.max(0, Math.min(1, t)));
const smooth = (e0, e1, x) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

export function makeBird(lookOrChar, opts = {}) {
  const L = lookOrChar.type ? lookOrChar : lookFor(lookOrChar);
  const type = L.type;
  const g = new THREE.Group();
  const rig = new THREE.Group(); g.add(rig);
  const feather = featherTextures(3), flight = flightFeatherTextures();
  const glossy = type === 'corvid';
  const plumage = (tex, extra = {}) => new THREE.MeshPhysicalMaterial({
    vertexColors: true, map: tex.map, normalMap: tex.normalMap, normalScale: new THREE.Vector2(0.6, 0.6),
    roughness: glossy ? 0.42 : 0.82, metalness: 0, sheen: 0.7, sheenRoughness: 0.55, sheenColor: new THREE.Color(0xffffff),
    iridescence: glossy ? 0.55 : 0, iridescenceIOR: 1.6, ...extra,
  });
  const C = { body: col(L.body), back: col(L.back), belly: col(L.belly), face: col(L.face), fore: col(L.forehead), cheek: col(L.cheek), wing: col(L.wing), tip: col(L.wingTip), tail: col(L.tail), rump: col(L.rump) };
  const big = type === 'owl' ? 1.25 : type === 'dove' ? 0.95 : 1;
  const longTail = type === 'cockatiel' ? 0.72 : type === 'dove' ? 0.42 : type === 'corvid' ? 0.45 : type === 'macaw' ? 0.85 : 0.26;

  // Body
  const bodyG = zoneSphere(1, 40, 28, (v) => {
    let c = mix(C.back, C.belly, smooth(-0.3, 0.6, v.z));
    c = mix(c, C.body, smooth(0.2, 0.9, v.y) * 0.6);
    if (v.y < -0.35 && v.z < 0.1) c = mix(c, C.rump, smooth(-0.35, -0.75, v.y));
    return c;
  });
  const body = new THREE.Mesh(bodyG, plumage(feather));
  body.scale.set(0.36, 0.5, 0.38).multiplyScalar(big);
  body.position.set(0, 0.56, 0); body.rotation.x = -0.18;
  body.castShadow = true; body.receiveShadow = true; rig.add(body);

  // Head
  const headPivot = new THREE.Group(); headPivot.position.set(0, 0.98 * big, 0.06); rig.add(headPivot);
  const hr = type === 'owl' ? 0.33 : 0.27;
  const headG = zoneSphere(hr, 40, 28, (v) => {
    let c = C.body;
    if (type === 'corvid') return C.body;
    const faceAmt = smooth(0.0, 0.55, v.z) * (1 - smooth(0.55, 0.9, v.y));
    c = mix(C.back, C.body, smooth(-0.6, 0.2, v.z));
    c = mix(c, C.face, faceAmt);
    c = mix(c, C.fore, smooth(0.35, 0.8, v.y) * smooth(-0.1, 0.5, v.z));
    if (type === 'owl') c = mix(c, C.face, smooth(0.3, 0.8, v.z));
    return c;
  });
  const head = new THREE.Mesh(headG, plumage(feather));
  head.castShadow = true; headPivot.add(head);
  if (type === 'owl') head.scale.set(1.05, 0.95, 0.9);

  // Cheek patches (cockatiel) / face disc (owl)
  if (type === 'cockatiel' || type === 'greyparrot') {
    const cm = new THREE.MeshStandardMaterial({ color: C.cheek, roughness: 0.8 });
    for (const s of [-1, 1]) { const ck = new THREE.Mesh(new THREE.SphereGeometry(0.075, 18, 12), cm); ck.scale.set(0.45, 1, 1); ck.position.set(s * 0.235, -0.04, 0.1); headPivot.add(ck); }
  }

  // Eyes
  const eyeMat = new THREE.MeshPhysicalMaterial({ color: 0x0a0a0a, roughness: 0.05, clearcoat: 1, clearcoatRoughness: 0.02 });
  const eyes = [];
  const eyeR = type === 'owl' ? 0.07 : 0.042;
  for (const s of [-1, 1]) {
    const eg = new THREE.Group();
    eg.position.set(s * (type === 'owl' ? 0.12 : 0.2), 0.05, type === 'owl' ? 0.27 : 0.15);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(eyeR, 20, 14), eyeMat); eg.add(eye);
    if (type === 'owl') { const iris = new THREE.Mesh(new THREE.SphereGeometry(eyeR * 1.15, 20, 14), new THREE.MeshStandardMaterial({ color: 0xf0a500, roughness: 0.3 })); iris.position.z = -0.008; iris.scale.z = 0.6; eg.add(iris); eye.scale.setScalar(0.6); eye.position.z = 0.03; }
    if (L.eyeRing) { const ring = new THREE.Mesh(new THREE.TorusGeometry(eyeR * 1.25, eyeR * 0.35, 8, 24), new THREE.MeshStandardMaterial({ color: col(L.eyeRing), roughness: 0.7 })); ring.rotation.y = s * 1.2; eg.add(ring); }
    eg.lookAt(new THREE.Vector3(s * 1.5, 0.05, 1.2)); headPivot.add(eg); eyes.push(eg);
  }

  // Beak
  const beakMat = new THREE.MeshPhysicalMaterial({ color: col(L.beak), roughness: 0.35, clearcoat: 0.4 });
  const hooked = ['lovebird', 'cockatiel', 'greyparrot', 'macaw'].includes(type);
  if (hooked) {
    const upper = new THREE.Mesh(new THREE.SphereGeometry(0.11, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.62), beakMat);
    upper.scale.set(0.8, 1.15, 1.25); upper.rotation.x = 1.75; upper.position.set(0, -0.03, 0.235);
    const lower = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 10), beakMat); lower.scale.set(0.95, 0.7, 0.9); lower.position.set(0, -0.12, 0.2);
    headPivot.add(upper, lower);
  } else {
    const len = type === 'corvid' ? 0.26 : type === 'owl' ? 0.1 : 0.16;
    const beak = new THREE.Mesh(new THREE.ConeGeometry(type === 'corvid' ? 0.065 : 0.045, len, 16), beakMat);
    beak.rotation.x = Math.PI / 2 + (type === 'owl' ? 0.6 : 0.15); beak.position.set(0, type === 'owl' ? -0.04 : -0.03, hr * 0.92 + len * 0.4);
    headPivot.add(beak);
    if (type === 'dove') { const cere = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), new THREE.MeshStandardMaterial({ color: 0xf4ecec, roughness: 0.9 })); cere.position.set(0, 0.01, hr * 0.95); headPivot.add(cere); }
  }

  // Crest (cockatiel)
  if (type === 'cockatiel' || L.crest) {
    const cm = new THREE.MeshStandardMaterial({ color: col(L.crest || L.forehead), roughness: 0.75 });
    for (let i = 0; i < 6; i++) {
      const spread = (i - 2.5) * 0.025;
      const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(spread, 0.2, 0.1), new THREE.Vector3(spread, 0.42, 0.08 - i * 0.004), new THREE.Vector3(spread * 1.5, 0.58, -0.06), new THREE.Vector3(spread * 2, 0.66, -0.2 - i * 0.01)]);
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.016 - i * 0.0012, 6), cm); tube.castShadow = true; headPivot.add(tube);
    }
  }

  // Wings
  const wings = [];
  for (const s of [-1, 1]) {
    const wg = zoneSphere(1, 28, 20, (v) => mix(C.wing, C.tip, smooth(-0.1, -0.8, v.y)));
    const w = new THREE.Mesh(wg, plumage(flight, { side: THREE.DoubleSide }));
    w.scale.set(0.1, 0.44, 0.27).multiplyScalar(big);
    const pivot = new THREE.Group(); pivot.position.set(s * 0.31 * big, 0.78 * big, -0.04);
    w.position.set(0, -0.28 * big, -0.04); w.rotation.x = 0.28; w.castShadow = true;
    pivot.add(w); rig.add(pivot); wings.push({ pivot, s });
  }

  // Tail
  const tailPivot = new THREE.Group(); tailPivot.position.set(0, 0.24, -0.26); rig.add(tailPivot);
  const tailG = new THREE.BoxGeometry(0.2, 0.03, longTail, 1, 1, 6);
  const tp = tailG.attributes.position;
  for (let i = 0; i < tp.count; i++) { const z = tp.getZ(i) / longTail + 0.5; tp.setX(i, tp.getX(i) * (1 - z * (type === 'dove' ? -0.6 : 0.55))); }
  tailG.computeVertexNormals();
  const tailCols = new Float32Array(tp.count * 3);
  for (let i = 0; i < tp.count; i++) { const c = C.tail; tailCols.set([c.r * 1.15, c.g * 1.15, c.b * 1.15], i * 3); }
  tailG.setAttribute('color', new THREE.BufferAttribute(tailCols, 3));
  const tail = new THREE.Mesh(tailG, plumage(flight));
  tail.position.z = -longTail / 2; tail.castShadow = true;
  tailPivot.rotation.x = 0.9; tailPivot.add(tail);

  // Feet
  const footMat = new THREE.MeshStandardMaterial({ color: type === 'corvid' ? 0x1a1a1a : type === 'owl' ? 0x6b5a3a : 0x8f8f96, roughness: 0.6 });
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.18, 8), footMat); leg.position.set(s * 0.12, 0.12, 0.04); rig.add(leg);
    for (let k = -1; k <= 1; k++) { const toe = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.012, 0.13, 6), footMat); toe.rotation.x = Math.PI / 2; toe.rotation.y = k * 0.35; toe.position.set(s * 0.12 + k * 0.03, 0.03, 0.1); rig.add(toe); }
    const back = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.011, 0.1, 6), footMat); back.rotation.x = Math.PI / 2; back.position.set(s * 0.12, 0.03, -0.03); rig.add(back);
  }

  const scale = opts.scale ?? 1;
  g.scale.setScalar(scale);
  const phase = Math.random() * 10;
  let nextBlink = 1 + Math.random() * 3, blinkT = 0, lookTarget = 0, nextLook = 2, talking = false;
  const state = {
    update(t, dt) {
      const tt = t + phase;
      body.scale.x = 0.36 * big * (1 + Math.sin(tt * 2.2) * 0.012);
      rig.position.y = Math.sin(tt * 1.1) * 0.006;
      nextLook -= dt; if (nextLook < 0) { lookTarget = (Math.random() - 0.5) * 1.3; nextLook = 1.5 + Math.random() * 3.5; }
      headPivot.rotation.y += (lookTarget - headPivot.rotation.y) * Math.min(1, dt * 4);
      headPivot.rotation.z = Math.sin(tt * 0.7) * 0.06 + (talking ? Math.sin(tt * 9) * 0.05 : 0);
      headPivot.rotation.x = talking ? Math.sin(tt * 7) * 0.08 : Math.sin(tt * 0.5) * 0.04;
      nextBlink -= dt; if (nextBlink < 0) { blinkT = 0.14; nextBlink = 2 + Math.random() * 4; }
      if (blinkT > 0) blinkT -= dt;
      const ey = blinkT > 0 ? 0.15 : 1; for (const e of eyes) e.scale.y = ey;
      tailPivot.rotation.y = Math.sin(tt * 0.9) * 0.05;
      for (const w of wings) w.pivot.rotation.z = w.s * (0.02 + Math.max(0, Math.sin(tt * 0.31)) ** 12 * 0.35); // occasional ruffle
    },
    setTalking(v) { talking = v; },
  };
  g.userData.bird = state;
  return g;
}
