// The capital city: procedural blocks, buildings, palace, river, traffic, pedestrians, sky, weather.
// The city reacts to the simulation: traffic follows employment, lit windows follow the economy,
// protesters gather at the palace, and the weather follows the sim's weather state.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { facadeTextures, asphaltTexture, marbleTexture, waterNormal, flagTexture } from './textures.js';
import { makeRng } from '../sim/util.js';

const N = 9, BLOCK = 36, ROAD = 12, PITCH = BLOCK + ROAD, HALF = (N * PITCH) / 2;
const RIVER_ROW = 6;
const blockCenter = (i) => -HALF + ROAD / 2 + i * PITCH + BLOCK / 2 + ROAD / 2;
const roadCoord = (i) => -HALF + i * PITCH + ROAD / 2;

export function createCity(renderer, S0) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.5, 4000);
  camera.position.set(140, 110, 190);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 8, 0); controls.enableDamping = true; controls.maxPolarAngle = 1.45; controls.minDistance = 25; controls.maxDistance = 520;
  const rnd = makeRng(99);
  const pmrem = new THREE.PMREMGenerator(renderer);

  // ---------- Sky ----------
  const sky = new Sky(); sky.scale.setScalar(10000); scene.add(sky);
  const su = sky.material.uniforms; su.turbidity.value = 6; su.rayleigh.value = 1.6; su.mieCoefficient.value = 0.004; su.mieDirectionalG.value = 0.82;
  const starsG = new THREE.BufferGeometry(); const sp = [];
  for (let i = 0; i < 1500; i++) { const th = rnd() * Math.PI * 2, ph = Math.acos(rnd() * 0.9 + 0.1); sp.push(Math.sin(ph) * Math.cos(th) * 3000, Math.cos(ph) * 3000, Math.sin(ph) * Math.sin(th) * 3000); }
  starsG.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
  const stars = new THREE.Points(starsG, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, fog: false }));
  scene.add(stars);
  const skyScene = new THREE.Scene(); const sky2 = new Sky(); sky2.scale.setScalar(10000); skyScene.add(sky2);
  let envRT = null, lastSunY = 99;

  scene.fog = new THREE.FogExp2(0xb8c6d4, 0.0016);

  // ---------- Lights ----------
  const hemi = new THREE.HemisphereLight(0xcfe3ff, 0x4a4030, 0.6); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 2.5); scene.add(sun, sun.target);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera; sc.left = -260; sc.right = 260; sc.top = 260; sc.bottom = -260; sc.near = 10; sc.far = 1200; sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.5;
  const moon = new THREE.DirectionalLight(0x8fa8ff, 0.0); moon.position.set(-200, 300, 100); scene.add(moon);

  // ---------- Ground, roads, sidewalks ----------
  const asphalt = asphaltTexture();
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000), new THREE.MeshStandardMaterial({ color: 0x5f6b4e, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.y = -0.4; ground.receiveShadow = true; scene.add(ground);
  const roadPlane = new THREE.Mesh(new THREE.PlaneGeometry(N * PITCH + ROAD, N * PITCH + ROAD), new THREE.MeshStandardMaterial({ map: asphalt.map, normalMap: asphalt.normalMap, roughness: 0.85, color: 0xaaaaaa }));
  roadPlane.rotation.x = -Math.PI / 2; roadPlane.position.y = -0.02; roadPlane.receiveShadow = true; scene.add(roadPlane);

  // lane markings (instanced dashes)
  const dashG = new THREE.PlaneGeometry(0.35, 3); dashG.rotateX(-Math.PI / 2);
  const dashCount = (N + 1) * 2 * Math.floor((N * PITCH) / 8);
  const dashes = new THREE.InstancedMesh(dashG, new THREE.MeshStandardMaterial({ color: 0xe9e4d4, roughness: 0.7 }), dashCount);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v3 = new THREE.Vector3(), s3 = new THREE.Vector3(1, 1, 1);
  let di = 0;
  for (let r = 0; r <= N; r++) for (let k = 0; k < Math.floor((N * PITCH) / 8); k++) {
    const p = -HALF + k * 8 + 4;
    m4.compose(v3.set(roadCoord(r), 0.01, p), q.identity(), s3); dashes.setMatrixAt(di++, m4);
    m4.compose(v3.set(p, 0.01, roadCoord(r)), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2), s3); dashes.setMatrixAt(di++, m4);
  }
  dashes.count = di; scene.add(dashes);

  const sidewalkMat = new THREE.MeshStandardMaterial({ color: 0xb9b5ab, roughness: 0.9 });
  const grassMat = new THREE.MeshStandardMaterial({ color: 0x4f7a3a, roughness: 1 });
  const sidewalks = new THREE.InstancedMesh(new THREE.BoxGeometry(BLOCK, 0.35, BLOCK), sidewalkMat, N * N);
  sidewalks.receiveShadow = true;
  let swi = 0;
  const parks = new Set(['1,2', '7,1', '2,7', '6,4']);
  const center = Math.floor(N / 2);
  const lots = [];
  for (let bx = 0; bx < N; bx++) for (let bz = 0; bz < N; bz++) {
    if (bz === RIVER_ROW) continue;
    const cx = blockCenter(bx) - ROAD / 2, cz = blockCenter(bz) - ROAD / 2;
    m4.compose(v3.set(cx, 0.17, cz), q.identity(), s3); sidewalks.setMatrixAt(swi++, m4);
    if (bx === center && bz === center) continue; // palace
    if (bx === center && bz === center + 1) continue; // plaza
    if (parks.has(`${bx},${bz}`)) { const gr = new THREE.Mesh(new THREE.BoxGeometry(BLOCK - 3, 0.4, BLOCK - 3), grassMat); gr.position.set(cx, 0.2, cz); gr.receiveShadow = true; scene.add(gr); lots.push({ park: true, cx, cz }); continue; }
    const dist = Math.hypot(bx - 6.2, bz - 2.2); // business district north-east of the palace
    const nearPalace = Math.hypot(bx - center, bz - center) < 1.6;
    const sub = rnd() < 0.5 ? 2 : 3;
    const lot = (BLOCK - 4) / sub;
    for (let i = 0; i < sub; i++) for (let j = 0; j < sub; j++) {
      const x = cx - (BLOCK - 4) / 2 + lot * (i + 0.5), z = cz - (BLOCK - 4) / 2 + lot * (j + 0.5);
      const downtown = Math.max(0, 1 - dist / 4.5);
      const h = nearPalace ? 7 + rnd() * 9 : 8 + rnd() * 14 + downtown * downtown * (30 + rnd() * 90) * (rnd() < 0.75 ? 1 : 0.3);
      lots.push({ x, z, w: lot * (0.7 + rnd() * 0.22), d: lot * (0.7 + rnd() * 0.22), h });
    }
  }
  sidewalks.count = swi; scene.add(sidewalks);

  // ---------- Buildings (instanced, per-instance facade UV scaling) ----------
  const kinds = { stone: [], brick: [], glass: [] };
  for (const L of lots) { if (L.park) continue; const k = L.h > 42 ? 'glass' : L.h > 20 ? (rnd() < 0.5 ? 'stone' : 'brick') : rnd() < 0.6 ? 'brick' : 'stone'; kinds[k].push(L); }
  const buildingMats = [];
  const buildingCols = { stone: [0xe8e0d0, 0xd8cfbf, 0xf0ead8], brick: [0xb07a62, 0xa86b55, 0xc49a7a, 0x9a8d80], glass: [0x6f8ea8, 0x5c7a94, 0x7f98ab] };
  for (const [kind, list] of Object.entries(kinds)) {
    if (!list.length) continue;
    const tx = facadeTextures(kind === 'brick' ? 'concrete' : kind, kind.length * 13);
    const mat = new THREE.MeshPhysicalMaterial({
      map: tx.map, normalMap: tx.normalMap, emissive: 0xffffff, emissiveMap: tx.emissive, emissiveIntensity: 0,
      roughness: kind === 'glass' ? 0.16 : 0.8, metalness: kind === 'glass' ? 0.5 : 0, envMapIntensity: kind === 'glass' ? 0.45 : 0.3, clearcoat: kind === 'glass' ? 0.6 : 0,
    });
    const floor = kind === 'glass' ? new THREE.Vector2(16, 72) : new THREE.Vector2(15, 42);
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uFloor = { value: floor };
      sh.vertexShader = 'attribute vec3 aSize;\nuniform vec2 uFloor;\n' + sh.vertexShader.replace('#include <uv_vertex>', `#include <uv_vertex>
        vec2 bs = abs(normal.x) > 0.5 ? aSize.zy : (abs(normal.z) > 0.5 ? aSize.xy : vec2(0.0));
        vec2 buv = uv * bs / uFloor;
        #ifdef USE_MAP
          vMapUv = buv;
        #endif
        #ifdef USE_EMISSIVEMAP
          vEmissiveMapUv = buv + vec2(aSize.x * 0.137, aSize.z * 0.071);
        #endif
        #ifdef USE_NORMALMAP
          vNormalMapUv = buv;
        #endif`);
    };
    buildingMats.push(mat);
    const geo = new THREE.BoxGeometry(1, 1, 1); geo.translate(0, 0.5, 0);
    const im = new THREE.InstancedMesh(geo, mat, list.length);
    const sizes = new Float32Array(list.length * 3);
    list.forEach((L, i) => {
      m4.compose(v3.set(L.x, 0.35, L.z), q.identity(), new THREE.Vector3(L.w, L.h, L.d)); im.setMatrixAt(i, m4);
      sizes.set([L.w, L.h, L.d], i * 3);
      im.setColorAt(i, new THREE.Color(buildingCols[kind][Math.floor(rnd() * buildingCols[kind].length)]));
    });
    geo.setAttribute('aSize', new THREE.InstancedBufferAttribute(sizes, 3));
    im.castShadow = true; im.receiveShadow = true; scene.add(im);
    // rooftop details
    const roofG = new THREE.BoxGeometry(1, 1, 1); const roofs = new THREE.InstancedMesh(roofG, new THREE.MeshStandardMaterial({ color: 0x6d6f73, roughness: 0.8 }), list.length);
    list.forEach((L, i) => { m4.compose(v3.set(L.x + (rnd() - 0.5) * L.w * 0.3, 0.35 + L.h + 1, L.z + (rnd() - 0.5) * L.d * 0.3), q.identity(), new THREE.Vector3(L.w * 0.3, 2, L.d * 0.3)); roofs.setMatrixAt(i, m4); });
    roofs.castShadow = true; scene.add(roofs);
  }

  // ---------- Palace ----------
  const marble = marbleTexture(); marble.repeat.set(4, 2);
  const palaceMat = new THREE.MeshPhysicalMaterial({ map: marble, roughness: 0.45, clearcoat: 0.3, color: 0xf4f1ea });
  const palace = new THREE.Group(); const pcx = blockCenter(center) - ROAD / 2, pcz = blockCenter(center) - ROAD / 2; palace.position.set(pcx, 0.35, pcz); palace.scale.setScalar(1.15); scene.add(palace);
  const pbox = (w, h, d, x, y, z, mat = palaceMat) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; palace.add(m); return m; };
  pbox(30, 1.2, 20, 0, 0.6, 0); pbox(28, 10, 14, 0, 6.2, -1); pbox(10, 12, 18, 0, 7.2, 0);
  for (const s of [-1, 1]) pbox(6, 8, 16, s * 13, 5.2, 0);
  const colG = new THREE.CylinderGeometry(0.45, 0.5, 8.5, 16);
  const cols = new THREE.InstancedMesh(colG, palaceMat, 10);
  for (let i = 0; i < 10; i++) { m4.compose(v3.set(-9 + i * 2, 5.45, 7.4), q.identity(), s3); cols.setMatrixAt(i, m4); }
  cols.castShadow = true; palace.add(cols);
  const ped = new THREE.Shape(); ped.moveTo(-10.5, 0); ped.lineTo(10.5, 0); ped.lineTo(0, 3.2); ped.closePath();
  const pedM = new THREE.Mesh(new THREE.ExtrudeGeometry(ped, { depth: 2.2, bevelEnabled: false }), palaceMat); pedM.position.set(0, 9.7, 6.3); pedM.castShadow = true; palace.add(pedM);
  pbox(21.5, 0.6, 2.4, 0, 9.9, 7.4);
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(4.6, 4.6, 3.5, 32), palaceMat); drum.position.set(0, 14.9, -1); drum.castShadow = true; palace.add(drum);
  const domeMat = new THREE.MeshPhysicalMaterial({ color: 0x7fa89a, metalness: 0.7, roughness: 0.35, clearcoat: 0.5 });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(4.6, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), domeMat); dome.position.set(0, 16.6, -1); dome.castShadow = true; palace.add(dome);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 6, 8), new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.8, roughness: 0.3 })); pole.position.set(0, 24, -1); palace.add(pole);
  const flagG = new THREE.PlaneGeometry(3.4, 2.2, 20, 8); const flag = new THREE.Mesh(flagG, new THREE.MeshStandardMaterial({ map: flagTexture(S0.countries[0].flag), side: THREE.DoubleSide, roughness: 0.8 })); flag.position.set(1.75, 25.6, -1); palace.add(flag);
  const flagBase = flagG.attributes.position.array.slice();
  // windows on palace
  const pwG = new THREE.PlaneGeometry(1.1, 2.2); const pwMat = new THREE.MeshStandardMaterial({ color: 0x2a3a4a, emissive: 0xffd9a0, emissiveIntensity: 0, roughness: 0.2, metalness: 0.4 });
  const pw = new THREE.InstancedMesh(pwG, pwMat, 40); let pwi = 0;
  for (let row = 0; row < 2; row++) for (let k = 0; k < 10; k++) for (const s of [-1, 1]) { if (pwi >= 40) break; m4.compose(v3.set(s * (5.5 + k * 0.85 > 13 ? 13 + (k - 9) : 5.5 + k * 0.85), 4 + row * 3.6, 6.02), q.identity(), s3); pw.setMatrixAt(pwi++, m4); }
  pw.count = pwi; palace.add(pw);
  // plaza + fountain
  const plaza = new THREE.Mesh(new THREE.BoxGeometry(BLOCK, 0.4, BLOCK), new THREE.MeshPhysicalMaterial({ map: marble, roughness: 0.35, clearcoat: 0.4, color: 0xe0dccf }));
  plaza.position.set(pcx, 0.2, pcz + PITCH); plaza.receiveShadow = true; scene.add(plaza);
  const fountainRim = new THREE.Mesh(new THREE.TorusGeometry(5, 0.5, 12, 48), palaceMat); fountainRim.rotation.x = Math.PI / 2; fountainRim.position.set(pcx, 0.8, pcz + PITCH); scene.add(fountainRim);
  const waterMat = new THREE.MeshPhysicalMaterial({ color: 0x1b4a63, roughness: 0.06, metalness: 0.1, normalMap: waterNormal(), normalScale: new THREE.Vector2(0.4, 0.4), envMapIntensity: 0.35, clearcoat: 0.6 });
  const fw = new THREE.Mesh(new THREE.CircleGeometry(5, 40), waterMat); fw.rotation.x = -Math.PI / 2; fw.position.set(pcx, 0.75, pcz + PITCH); scene.add(fw);

  // ---------- River & bridges ----------
  const rz = blockCenter(RIVER_ROW) - ROAD / 2;
  const river = new THREE.Mesh(new THREE.PlaneGeometry(6000, BLOCK + 4, 1, 1), waterMat); river.rotation.x = -Math.PI / 2; river.position.set(0, -0.15, rz); river.receiveShadow = true; scene.add(river);
  const bank = new THREE.MeshStandardMaterial({ color: 0x8f877a, roughness: 0.95 });
  for (const s of [-1, 1]) { const b = new THREE.Mesh(new THREE.BoxGeometry(6000, 1.2, 1.5), bank); b.position.set(0, 0, rz + s * (BLOCK / 2 + 2.4)); scene.add(b); }
  roadPlane.geometry = new THREE.PlaneGeometry(N * PITCH + ROAD, N * PITCH + ROAD); // keep; bridges cover river
  const bridgeMat = new THREE.MeshStandardMaterial({ color: 0x9a948a, roughness: 0.8 });
  for (let r = 0; r <= N; r++) { const br = new THREE.Mesh(new THREE.BoxGeometry(ROAD, 0.8, BLOCK + 6), bridgeMat); br.position.set(roadCoord(r), 0.0, rz); br.castShadow = br.receiveShadow = true; scene.add(br); for (const s of [-1, 1]) { const rl = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.2, BLOCK + 6), bridgeMat); rl.position.set(roadCoord(r) + s * (ROAD / 2 - 0.2), 0.9, rz); scene.add(rl); } }
  // hide the road plane over the river with a water-coloured strip edge (roads continue as bridges)
  const riverCut = new THREE.Mesh(new THREE.PlaneGeometry(N * PITCH + ROAD + 2, BLOCK + 3), waterMat); riverCut.rotation.x = -Math.PI / 2; riverCut.position.set(0, -0.01, rz); scene.add(riverCut);
  for (let r = 0; r <= N; r++) { const deck = new THREE.Mesh(new THREE.PlaneGeometry(ROAD - 0.8, BLOCK + 6), roadPlane.material); deck.rotation.x = -Math.PI / 2; deck.position.set(roadCoord(r), 0.42, rz); deck.receiveShadow = true; scene.add(deck); }

  // ---------- Trees & street lights ----------
  const treeSpots = [];
  for (const L of lots) if (L.park) for (let k = 0; k < 28; k++) treeSpots.push([L.cx + (rnd() - 0.5) * (BLOCK - 6), L.cz + (rnd() - 0.5) * (BLOCK - 6)]);
  for (let k = 0; k < 160; k++) { const r = Math.floor(rnd() * (N + 1)); const p = -HALF + rnd() * N * PITCH; if (Math.abs(p - rz) < BLOCK / 2 + 4) continue; treeSpots.push(rnd() < 0.5 ? [roadCoord(r) + ROAD / 2 + 1.5, p] : [p, roadCoord(r) + ROAD / 2 + 1.5]); }
  const crownG = new THREE.IcosahedronGeometry(2.6, 1), trunkG = new THREE.CylinderGeometry(0.25, 0.35, 3, 6);
  const crowns = new THREE.InstancedMesh(crownG, new THREE.MeshStandardMaterial({ color: 0x3f6a30, roughness: 0.9, flatShading: true }), treeSpots.length);
  const trunks = new THREE.InstancedMesh(trunkG, new THREE.MeshStandardMaterial({ color: 0x5a4030, roughness: 1 }), treeSpots.length);
  treeSpots.forEach(([x, z], i) => { const s = 0.8 + rnd() * 0.6; m4.compose(v3.set(x, 1.6, z), q.identity(), new THREE.Vector3(1, s, 1)); trunks.setMatrixAt(i, m4); m4.compose(v3.set(x, 3.6 + s * 1.5, z), q.setFromEuler(new THREE.Euler(rnd(), rnd(), rnd())), new THREE.Vector3(s, s * 1.15, s)); crowns.setMatrixAt(i, m4); crowns.setColorAt(i, new THREE.Color().setHSL(0.25 + rnd() * 0.08, 0.45, 0.28 + rnd() * 0.12)); });
  crowns.castShadow = trunks.castShadow = true; scene.add(crowns, trunks);
  const lampSpots = [];
  for (let r = 0; r <= N; r++) for (let k = 0; k < N * 2; k++) { const p = -HALF + k * PITCH / 2 + 6; if (Math.abs(p - rz) < BLOCK / 2 + 3) continue; lampSpots.push([roadCoord(r) - ROAD / 2 + 0.6, p], [p, roadCoord(r) - ROAD / 2 + 0.6]); }
  const poles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.15, 7, 6), new THREE.MeshStandardMaterial({ color: 0x2b2e33, metalness: 0.6, roughness: 0.5 }), lampSpots.length);
  const bulbMat = new THREE.MeshStandardMaterial({ color: 0xfff1c9, emissive: 0xffc97a, emissiveIntensity: 0 });
  const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.4, 8, 6), bulbMat, lampSpots.length);
  lampSpots.forEach(([x, z], i) => { m4.compose(v3.set(x, 3.5, z), q.identity(), s3); poles.setMatrixAt(i, m4); m4.compose(v3.set(x, 7.1, z), q.identity(), s3); bulbs.setMatrixAt(i, m4); });
  scene.add(poles, bulbs);
  // pools of light on the ground at night (cheap fake lights)
  const glowTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,200,120,0.9)'); gr.addColorStop(1, 'rgba(255,200,120,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  const poolMat = new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const poolG = new THREE.PlaneGeometry(14, 14); poolG.rotateX(-Math.PI / 2);
  const pools = new THREE.InstancedMesh(poolG, poolMat, lampSpots.length);
  lampSpots.forEach(([x, z], i) => { m4.compose(v3.set(x, 0.4, z), q.identity(), s3); pools.setMatrixAt(i, m4); });
  scene.add(pools);

  // ---------- Traffic ----------
  const carBody = new THREE.BoxGeometry(2, 0.9, 4.2); carBody.translate(0, 0.75, 0);
  const cabin = new THREE.BoxGeometry(1.8, 0.75, 2.2); cabin.translate(0, 1.55, -0.2);
  const carG = mergeGeometries([carBody, cabin]);
  const MAXCARS = 340;
  const cars = new THREE.InstancedMesh(carG, new THREE.MeshPhysicalMaterial({ roughness: 0.3, metalness: 0.6, clearcoat: 1, clearcoatRoughness: 0.1, envMapIntensity: 0.5 }), MAXCARS);
  cars.castShadow = true;
  const carState = [];
  const carCols = [0xf2f2f2, 0x1a1a1a, 0x8a8f96, 0x9b1b1b, 0x1f3f6b, 0xc9c2b0, 0x2e4a3a, 0x3a3a40];
  for (let i = 0; i < MAXCARS; i++) {
    const vert = rnd() < 0.5, road = Math.floor(rnd() * (N + 1)), dir = rnd() < 0.5 ? 1 : -1;
    carState.push({ vert, base: roadCoord(road) + dir * 2.8, dir, p: -HALF + rnd() * N * PITCH, speed: 9 + rnd() * 9 });
    cars.setColorAt(i, new THREE.Color(carCols[Math.floor(rnd() * carCols.length)]));
  }
  scene.add(cars);
  const lightPos = new Float32Array(MAXCARS * 2 * 3), lightCol = new Float32Array(MAXCARS * 2 * 3);
  for (let i = 0; i < MAXCARS; i++) { lightCol.set([1, 0.92, 0.7], i * 6); lightCol.set([1, 0.1, 0.05], i * 6 + 3); }
  const lightsG = new THREE.BufferGeometry(); lightsG.setAttribute('position', new THREE.BufferAttribute(lightPos, 3)); lightsG.setAttribute('color', new THREE.BufferAttribute(lightCol, 3));
  const carLights = new THREE.Points(lightsG, new THREE.PointsMaterial({ size: 1.1, vertexColors: true, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(carLights);

  // ---------- Pedestrians (tiny birds) ----------
  const pb = new THREE.SphereGeometry(0.45, 10, 8); pb.scale(1, 1.25, 1.05); pb.translate(0, 0.7, 0);
  const ph = new THREE.SphereGeometry(0.3, 10, 8); ph.translate(0, 1.45, 0.12);
  const pk = new THREE.ConeGeometry(0.1, 0.25, 6); pk.rotateX(Math.PI / 2); pk.translate(0, 1.4, 0.45);
  const pedG = mergeGeometries([pb.toNonIndexed(), ph.toNonIndexed(), pk.toNonIndexed()]);
  const MAXPED = 420;
  const peds = new THREE.InstancedMesh(pedG, new THREE.MeshStandardMaterial({ roughness: 0.8 }), MAXPED);
  peds.castShadow = true;
  const pedCols = [0x3f9b3a, 0xf4f1e8, 0xf6d21c, 0x9aa1a8, 0x22252b, 0x4f7fcf, 0xb5653a, 0xc9262b, 0x8a6b4a, 0xe0703a];
  const pedState = [];
  const blocksWalk = lots.filter((l) => !l.park).length ? [] : [];
  for (let bx = 0; bx < N; bx++) for (let bz = 0; bz < N; bz++) if (bz !== RIVER_ROW) blocksWalk.push([blockCenter(bx) - ROAD / 2, blockCenter(bz) - ROAD / 2]);
  for (let i = 0; i < MAXPED; i++) {
    const [cx, cz] = blocksWalk[Math.floor(rnd() * blocksWalk.length)];
    pedState.push({ cx, cz, s: rnd() * 4, speed: (0.012 + rnd() * 0.012) * (rnd() < 0.5 ? 1 : -1), off: BLOCK / 2 - 1.2 + rnd() * 0.8, protest: rnd() < 0.55, px: pcx + (rnd() - 0.5) * 30, pz: pcz + PITCH + (rnd() - 0.5) * 26, cur: new THREE.Vector3(), init: false });
    peds.setColorAt(i, new THREE.Color(pedCols[Math.floor(rnd() * pedCols.length)]));
  }
  scene.add(peds);
  // protest banners
  const bannerG = new THREE.Group(); scene.add(bannerG); bannerG.visible = false;
  for (let i = 0; i < 18; i++) { const p = new THREE.Mesh(new THREE.PlaneGeometry(3, 1.2), new THREE.MeshStandardMaterial({ color: i % 2 ? 0xc0392b : 0xf2f2f2, side: THREE.DoubleSide })); p.position.set(pcx + (rnd() - 0.5) * 26, 3.4, pcz + PITCH + (rnd() - 0.5) * 22); p.rotation.y = rnd() * 0.6 - 0.3; const st = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 3, 4), poles.material); st.position.set(p.position.x, 1.6, p.position.z); bannerG.add(p, st); }

  // ---------- Weather ----------
  const RAIN = 5000;
  const rainPos = new Float32Array(RAIN * 6);
  for (let i = 0; i < RAIN; i++) { const x = (rnd() - 0.5) * 400, y = rnd() * 200, z = (rnd() - 0.5) * 400; rainPos.set([x, y, z, x, y - 2.2, z], i * 6); }
  const rainG = new THREE.BufferGeometry(); rainG.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const rain = new THREE.LineSegments(rainG, new THREE.LineBasicMaterial({ color: 0xaab7c4, transparent: true, opacity: 0.45 })); rain.visible = false; scene.add(rain);
  const snowPos = new Float32Array(RAIN * 3); for (let i = 0; i < RAIN; i++) snowPos.set([(rnd() - 0.5) * 400, rnd() * 200, (rnd() - 0.5) * 400], i * 3);
  const snowG = new THREE.BufferGeometry(); snowG.setAttribute('position', new THREE.BufferAttribute(snowPos, 3));
  const snow = new THREE.Points(snowG, new THREE.PointsMaterial({ color: 0xffffff, size: 0.9, transparent: true, opacity: 0.9, depthWrite: false })); snow.visible = false; scene.add(snow);
  let flash = 0, weatherMix = 0;

  // Tame image-based lighting on matte surfaces; keep reflections on glass, water and paint.
  const shiny = new Set([waterMat, cars.material, domeMat, ...buildingMats.filter((m) => m.metalness > 0.3)]);
  scene.traverse((o) => { if (o.material && !Array.isArray(o.material) && o.material.envMapIntensity !== undefined && !shiny.has(o.material)) o.material.envMapIntensity = 0.28; });
  for (const m of buildingMats) if (m.metalness <= 0.3) m.envMapIntensity = 0.3;

  const view = {
    scene, camera, controls, bloomStrength: 0.45,
    activate() { controls.enabled = true; }, deactivate() { controls.enabled = false; },
    applySettings(s) {
      const sz = s.quality === 'low' ? 1024 : 2048; sun.shadow.mapSize.set(sz, sz); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; }
      view.carLimit = s.quality === 'low' ? 140 : s.quality === 'medium' ? 240 : MAXCARS; view.pedLimit = s.quality === 'low' ? 160 : s.quality === 'medium' ? 280 : MAXPED;
    },
    carLimit: MAXCARS, pedLimit: MAXPED,
    pick(ray) { const hit = ray.intersectObject(palace, true)[0]; return hit ? { action: 'office', label: 'Presidential Palace' } : null; },
    update(dt, t, S, env) {
      controls.update();
      // --- sky & sun ---
      const sunDir = env.sun;
      su.sunPosition.value.copy(sunDir);
      sky2.material.uniforms.sunPosition.value.copy(sunDir);
      const w = S ? S.weather : { kind: 'clear', intensity: 0 };
      const wet = w.kind === 'rain' || w.kind === 'storm' || w.kind === 'snow';
      const cloudy = w.kind === 'cloudy' ? 0.5 : wet ? 0.9 : w.kind === 'smoke' ? 0.7 : 0;
      weatherMix += (cloudy - weatherMix) * Math.min(1, dt * 0.8);
      su.turbidity.value = 4 + weatherMix * 14; su.rayleigh.value = 1.2 + weatherMix * 2.5 + env.golden * 1.2;
      sky2.material.uniforms.turbidity.value = su.turbidity.value; sky2.material.uniforms.rayleigh.value = su.rayleigh.value;
      sun.position.copy(sunDir).multiplyScalar(500); sun.target.position.set(0, 0, 0);
      const day = env.daylight * (1 - weatherMix * 0.65);
      sun.intensity = 3.6 * day; sun.color.setHSL(0.08 + env.daylight * 0.05, 0.7 - env.daylight * 0.3, 0.55 + env.daylight * 0.3);
      hemi.intensity = 0.1 + env.daylight * 0.35;
      moon.intensity = env.night * 0.35;
      stars.material.opacity = env.night * (1 - weatherMix);
      const fogC = new THREE.Color().setHSL(0.58, 0.35 - weatherMix * 0.25, 0.05 + env.daylight * (0.42 - weatherMix * 0.1));
      scene.fog.color.copy(fogC); scene.fog.density = 0.00045 + weatherMix * 0.0024 + (w.kind === 'smoke' ? 0.002 : 0);
      if (Math.abs(sunDir.y - lastSunY) > 0.03 || !envRT) { lastSunY = sunDir.y; envRT?.dispose(); envRT = pmrem.fromScene(skyScene, 0, 1, 5000); scene.environment = envRT.texture; }
      renderer.toneMappingExposure = 0.5 + env.daylight * 0.32;
      // --- night lighting ---
      const econ = S ? S.countries[0].econ : null;
      const lit = econ ? Math.max(0.25, Math.min(1, 1 - (econ.unemployment - 4) / 20)) : 0.8;
      for (const m of buildingMats) m.emissiveIntensity = env.night * 1.6 * lit;
      bulbMat.emissiveIntensity = env.night * 4; poolMat.opacity = env.night * 0.55; pwMat.emissiveIntensity = env.night * 1.5;
      carLights.material.opacity = env.night;
      // --- traffic ---
      const empl = econ ? Math.max(0.3, 1 - econ.unemployment / 25) : 0.9;
      const ncars = Math.floor(view.carLimit * empl * (wet ? 0.8 : 1));
      cars.count = ncars;
      const minP = -HALF, span = N * PITCH;
      for (let i = 0; i < ncars; i++) {
        const c = carState[i];
        c.p += c.dir * c.speed * dt * (wet ? 0.7 : 1);
        if (c.p > minP + span) c.p -= span; if (c.p < minP) c.p += span;
        const x = c.vert ? c.base : c.p, z = c.vert ? c.p : c.base;
        const yaw = c.vert ? (c.dir > 0 ? 0 : Math.PI) : (c.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
        const onBridge = Math.abs(z - rz) < BLOCK / 2 + 3 && c.vert ? 0.42 : 0;
        m4.compose(v3.set(x, onBridge, z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), s3); cars.setMatrixAt(i, m4);
        const fx = Math.sin(yaw) * 2.2, fz = Math.cos(yaw) * 2.2;
        lightPos.set([x + fx, 0.9 + onBridge, z + fz, x - fx, 0.9 + onBridge, z - fz], i * 6);
      }
      for (let i = ncars; i < MAXCARS; i++) lightPos.set([0, -50, 0, 0, -50, 0], i * 6);
      cars.instanceMatrix.needsUpdate = true; lightsG.attributes.position.needsUpdate = true;
      // --- pedestrians ---
      const protest = !!(S && S.pol.protest);
      bannerG.visible = !!protest;
      const nped = Math.floor(view.pedLimit * (wet ? 0.45 : 1) * (env.night > 0.6 ? 0.4 : 1) + (protest ? 120 : 0));
      peds.count = Math.min(MAXPED, nped);
      for (let i = 0; i < peds.count; i++) {
        const p = pedState[i];
        let tx, tz, yaw;
        if (protest && p.protest) { tx = p.px; tz = p.pz; yaw = Math.PI; }
        else {
          p.s = (p.s + p.speed * dt * 6 + 4) % 4;
          const side = Math.floor(p.s), f = p.s - side, o = p.off;
          const pts = [[-o, -o], [o, -o], [o, o], [-o, o], [-o, -o]];
          tx = p.cx + pts[side][0] + (pts[side + 1][0] - pts[side][0]) * f; tz = p.cz + pts[side][1] + (pts[side + 1][1] - pts[side][1]) * f;
          yaw = Math.atan2(pts[side + 1][0] - pts[side][0], pts[side + 1][1] - pts[side][1]) * Math.sign(p.speed);
        }
        if (!p.init) { p.cur.set(tx, 0, tz); p.init = true; }
        const k = protest && p.protest ? Math.min(1, dt * 0.6) : 1;
        p.cur.x += (tx - p.cur.x) * k; p.cur.z += (tz - p.cur.z) * k;
        const bob = Math.abs(Math.sin(t * 8 + i)) * 0.15 + (protest && p.protest ? Math.abs(Math.sin(t * 5 + i * 3)) * 0.4 : 0);
        m4.compose(v3.set(p.cur.x, 0.35 + bob, p.cur.z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw), s3); peds.setMatrixAt(i, m4);
      }
      peds.instanceMatrix.needsUpdate = true;
      // --- weather particles follow the camera target ---
      rain.visible = w.kind === 'rain' || w.kind === 'storm'; snow.visible = w.kind === 'snow';
      const ct = controls.target;
      if (rain.visible) { rain.position.set(ct.x, 0, ct.z); const a = rainG.attributes.position.array; const fall = dt * 140; for (let i = 0; i < RAIN; i++) { const j = i * 6; a[j + 1] -= fall; a[j + 4] -= fall; if (a[j + 4] < 0) { a[j + 1] += 200; a[j + 4] += 200; } } rainG.attributes.position.needsUpdate = true; rain.material.opacity = 0.25 + w.intensity * 0.35; }
      if (snow.visible) { snow.position.set(ct.x, 0, ct.z); const a = snowG.attributes.position.array; for (let i = 0; i < RAIN; i++) { a[i * 3 + 1] -= dt * 8; a[i * 3] += Math.sin(t + i) * dt * 0.8; if (a[i * 3 + 1] < 0) a[i * 3 + 1] += 200; } snowG.attributes.position.needsUpdate = true; }
      if (w.kind === 'storm') { if (flash <= 0 && Math.random() < dt * 0.25) flash = 0.18; }
      if (flash > 0) { flash -= dt; hemi.intensity += 3 * Math.max(0, flash) / 0.18; }
      // water & flag animation
      waterMat.normalMap.offset.set(t * 0.01, t * 0.017);
      const fp = flagG.attributes.position; for (let i = 0; i < fp.count; i++) { const x = flagBase[i * 3] + 1.7; fp.setZ(i, Math.sin(x * 2 + t * 4) * 0.18 * x / 3.4); } fp.needsUpdate = true;
    },
  };
  view.applySettings({ quality: 'medium' });
  return view;
}
