// The Presidential Office: an interactive 3D room. Objects are clickable and open government systems.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { woodTexture, wallTexture, carpetTexture, booksTexture, leatherTexture, marbleTexture, flagTexture, screenCanvas, fabricNormal, drawSeal } from './textures.js';
import { makeBird } from './bird.js';
import { fmtDate, pct } from '../sim/util.js';
import { outletName } from '../sim/news.js';

const W = 14, D = 12, H = 4.6;

export function createOffice(renderer, S0) {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.05, 80);
  camera.position.set(0, 2.3, 5.6);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 1.2, -2.6); controls.enableDamping = true; controls.dampingFactor = 0.08;
  controls.minDistance = 1.2; controls.maxDistance = 9; controls.maxPolarAngle = Math.PI * 0.53; controls.enablePan = true;
  controls.screenSpacePanning = true;
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.background = new THREE.Color(0x0b0f16);

  const clickables = [];
  const clickable = (obj, action, label) => { obj.traverse((o) => { if (o.isMesh) { o.userData.action = action; o.userData.label = label; clickables.push(o); } }); };
  const std = (opts) => new THREE.MeshStandardMaterial(opts);
  const phys = (opts) => new THREE.MeshPhysicalMaterial(opts);
  const box = (w, h, d, mat, x = 0, y = 0, z = 0, parent = scene) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m; };
  const rbox = (w, h, d, r, mat, x = 0, y = 0, z = 0, parent = scene) => { const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 4, r), mat); m.position.set(x, y, z); m.castShadow = m.receiveShadow = true; parent.add(m); return m; };

  // ---------- Room shell ----------
  const floorT = woodTexture('floor');
  floorT.map.repeat.set(5, 4); floorT.normalMap.repeat.set(5, 4);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), phys({ map: floorT.map, normalMap: floorT.normalMap, roughness: 0.38, clearcoat: 0.5, clearcoatRoughness: 0.2, envMapIntensity: 0.6 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const carpet = new THREE.Mesh(new THREE.CircleGeometry(3.6, 64), std({ map: carpetTexture(S0.countries[0].name), roughness: 0.95, normalMap: fabricNormal(), normalScale: new THREE.Vector2(0.2, 0.2) }));
  carpet.rotation.x = -Math.PI / 2; carpet.position.set(0, 0.012, 1.0); carpet.scale.set(1.25, 1, 1); carpet.receiveShadow = true; scene.add(carpet);

  const wallT = wallTexture(); const panelT = woodTexture('panel');
  const wallMat = std({ map: wallT.map, normalMap: wallT.normalMap, roughness: 0.85, envMapIntensity: 0.4 });
  const wainMat = phys({ map: panelT.map, normalMap: panelT.normalMap, roughness: 0.45, clearcoat: 0.3, envMapIntensity: 0.6 });
  const trimMat = std({ color: 0xf3eee2, roughness: 0.5 });
  // side walls
  for (const s of [-1, 1]) {
    box(0.2, H, D, wallMat, s * W / 2, H / 2, 0);
    box(0.06, 1.1, D, wainMat, s * (W / 2 - 0.12), 0.55, 0);
    box(0.08, 0.08, D, trimMat, s * (W / 2 - 0.14), 1.12, 0);
  }
  box(W, H, 0.2, wallMat, 0, H / 2, D / 2); box(W, 1.1, 0.06, wainMat, 0, 0.55, D / 2 - 0.12);
  // back wall with 3 window openings (so sunlight streams in)
  const winX = [-3.2, 0, 3.2], winW = 1.7, winB = 0.9, winT = 3.7;
  const bz = -D / 2;
  box(W, winB, 0.25, wallMat, 0, winB / 2, bz); box(W, H - winT, 0.25, wallMat, 0, winT + (H - winT) / 2, bz);
  let x0 = -W / 2;
  for (const wx of [...winX, W / 2 + winW / 2]) { const x1 = wx - winW / 2; if (x1 > x0) box(x1 - x0, winT - winB, 0.25, wallMat, (x0 + x1) / 2, (winB + winT) / 2, bz); x0 = wx + winW / 2; }
  box(W, 0.9, 0.06, wainMat, 0, 0.45, bz + 0.15);
  // crown moulding & ceiling
  for (const s of [-1, 1]) box(0.25, 0.22, D, trimMat, s * (W / 2 - 0.2), H - 0.11, 0);
  box(W, 0.22, 0.25, trimMat, 0, H - 0.11, bz + 0.2); box(W, 0.22, 0.25, trimMat, 0, H - 0.11, D / 2 - 0.2);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), std({ color: 0xf4f0e6, roughness: 0.9 })); ceil.rotation.x = Math.PI / 2; ceil.position.y = H; scene.add(ceil);
  const medallion = new THREE.Mesh(new THREE.CircleGeometry(1.4, 48), std({ color: 0xfbf7ec, roughness: 0.6 })); medallion.rotation.x = Math.PI / 2; medallion.position.set(0, H - 0.01, 0.5); scene.add(medallion);

  // Windows: mullions, glass and the view outside
  const glass = phys({ color: 0xffffff, transparent: true, opacity: 0.08, roughness: 0.02, metalness: 0, envMapIntensity: 1.2 });
  const frameMat = std({ color: 0xf6f2e8, roughness: 0.4 });
  for (const wx of winX) {
    const gl = new THREE.Mesh(new THREE.PlaneGeometry(winW, winT - winB), glass); gl.position.set(wx, (winB + winT) / 2, bz + 0.02); scene.add(gl);
    box(winW + 0.16, 0.1, 0.32, frameMat, wx, winB, bz); box(winW + 0.16, 0.1, 0.32, frameMat, wx, winT, bz);
    for (const k of [-0.5, 0, 0.5]) box(0.05, winT - winB, 0.06, frameMat, wx + k * winW, (winB + winT) / 2, bz + 0.03).castShadow = true;
    for (const k of [0.25, 0.5, 0.75]) box(winW, 0.04, 0.06, frameMat, wx, winB + (winT - winB) * k, bz + 0.03).castShadow = true;
    // curtains
    for (const s of [-1, 1]) {
      const cg = new THREE.PlaneGeometry(0.55, H - 0.4, 24, 1); const p = cg.attributes.position;
      for (let i = 0; i < p.count; i++) p.setZ(i, Math.sin(p.getX(i) * 34) * 0.05);
      cg.computeVertexNormals();
      const cu = new THREE.Mesh(cg, std({ color: 0x7a1d24, roughness: 0.75, side: THREE.DoubleSide }));
      cu.position.set(wx + s * (winW / 2 + 0.22), (H - 0.4) / 2 + 0.1, bz + 0.25); cu.castShadow = true; scene.add(cu);
    }
  }
  // outside view: sky gradient + city skyline (canvas), updated with time of day
  const outside = screenCanvas(2048, 512);
  const outsideMat = new THREE.MeshBasicMaterial({ map: outside.texture, toneMapped: false });
  const outPlane = new THREE.Mesh(new THREE.PlaneGeometry(30, 7.5), outsideMat); outPlane.position.set(0, 2.6, bz - 4); scene.add(outPlane);
  const skyline = []; { let x = 0; let seed = 3; const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647); while (x < 2048) { const w = 30 + r() * 70, h = 60 + r() * 200 * (1 - Math.abs(x - 1024) / 1400); skyline.push([x, w, h, r()]); x += w + 4; } }
  function drawOutside(env) {
    const g = outside.ctx, w = 2048, h = 512;
    const day = env.daylight, gold = env.golden || 0;
    const top = new THREE.Color().setHSL(0.6, 0.55, 0.08 + day * 0.42), bot = new THREE.Color().setHSL(0.08 + day * 0.48, 0.6, 0.12 + day * 0.5 + gold * 0.15);
    const grd = g.createLinearGradient(0, 0, 0, h); grd.addColorStop(0, '#' + top.getHexString()); grd.addColorStop(0.8, '#' + bot.getHexString()); g.fillStyle = grd; g.fillRect(0, 0, w, h);
    for (const [x, bw, bh, r] of skyline) {
      const v = Math.floor(20 + day * 70); g.fillStyle = `rgb(${v},${v + 6},${v + 16})`; g.fillRect(x, h - bh, bw, bh);
      if (env.night > 0.3) { g.fillStyle = `rgba(255,214,140,${env.night * 0.9})`; for (let yy = h - bh + 8; yy < h - 6; yy += 12) for (let xx = x + 4; xx < x + bw - 4; xx += 9) if (((xx * 7 + yy * 13 + Math.floor(r * 100)) % 5) < 2) g.fillRect(xx, yy, 4, 5); }
    }
    outside.texture.needsUpdate = true;
  }

  // ---------- Lighting ----------
  const hemi = new THREE.HemisphereLight(0xfff2dd, 0x3a2a1c, 0.35); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff0d8, 2.4);
  sun.position.set(4, 6, -14); sun.target.position.set(0, 0, 1); scene.add(sun, sun.target);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.camera.left = -9; sun.shadow.camera.right = 9; sun.shadow.camera.top = 9; sun.shadow.camera.bottom = -9; sun.shadow.camera.near = 1; sun.shadow.camera.far = 40; sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.02;
  const lamps = [];
  for (const [lx, lz] of [[-3.5, -1], [3.5, -1], [-3.5, 3], [3.5, 3]]) {
    const l = new THREE.PointLight(0xffd6a0, 6, 9, 2); l.position.set(lx, H - 0.3, lz); scene.add(l); lamps.push(l);
    const fx = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.25, 0.08, 24), std({ color: 0xfff2d6, emissive: 0xffd9a0, emissiveIntensity: 1.5 })); fx.position.set(lx, H - 0.05, lz); scene.add(fx); lamps.push(fx);
  }

  // ---------- Desk ----------
  const deskT = woodTexture('desk');
  const deskMat = phys({ map: deskT.map, normalMap: deskT.normalMap, roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.12, envMapIntensity: 0.8 });
  const brass = phys({ color: 0xc9a44a, metalness: 1, roughness: 0.25 });
  const desk = new THREE.Group(); desk.position.set(0, 0, -3); scene.add(desk);
  rbox(2.85, 0.09, 1.35, 0.035, deskMat, 0, 0.82, 0, desk);
  const leather = leatherTexture('#1d3a2c');
  box(1.4, 0.005, 0.7, std({ map: leather.map, normalMap: leather.normalMap, roughness: 0.6 }), 0, 0.865, 0.1, desk);
  for (const s of [-1, 1]) {
    box(0.85, 0.78, 1.15, deskMat, s * 0.95, 0.39, 0, desk);
    for (let k = 0; k < 3; k++) { box(0.7, 0.2, 0.02, deskMat, s * 0.95, 0.15 + k * 0.24, -0.585, desk); box(0.14, 0.025, 0.03, brass, s * 0.95, 0.15 + k * 0.24, -0.6, desk); }
  }
  // front panel with seal
  const sealC = document.createElement('canvas'); sealC.width = sealC.height = 512; drawSeal(sealC.getContext('2d'), 256, 256, 240, S0.countries[0].name, '#d9b45a', '#3a1e10');
  const sealTex = new THREE.CanvasTexture(sealC); sealTex.colorSpace = THREE.SRGBColorSpace;
  box(1.1, 0.7, 0.05, deskMat, 0, 0.42, 0.6, desk);
  const sealM = new THREE.Mesh(new THREE.CircleGeometry(0.28, 48), phys({ map: sealTex, roughness: 0.35, metalness: 0.3, clearcoat: 0.6 })); sealM.position.set(0, 0.44, 0.63); desk.add(sealM);

  // Computer monitor (faces the President)
  const monitorScreen = screenCanvas(640, 400);
  const monitor = new THREE.Group(); monitor.position.set(-0.75, 0.86, -0.25); monitor.rotation.y = Math.PI + 0.35; desk.add(monitor);
  const darkMetal = phys({ color: 0x1b1e23, metalness: 0.6, roughness: 0.35 });
  box(0.86, 0.54, 0.035, darkMetal, 0, 0.42, 0, monitor);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.5), new THREE.MeshStandardMaterial({ map: monitorScreen.texture, emissive: 0xffffff, emissiveMap: monitorScreen.texture, emissiveIntensity: 0.9, roughness: 0.2 }));
  scr.position.set(0, 0.42, 0.019); monitor.add(scr);
  box(0.06, 0.18, 0.06, darkMetal, 0, 0.1, -0.03, monitor); box(0.3, 0.015, 0.2, darkMetal, 0, 0.01, -0.03, monitor);
  const kb = box(0.5, 0.02, 0.16, darkMetal, 0.05, 0.875, -0.05, desk); kb.rotation.y = 0.35;
  clickable(monitor, 'computer', 'Government computer'); clickable(kb, 'computer', 'Government computer');

  // Documents (inbox)
  const docs = new THREE.Group(); docs.position.set(0.55, 0.87, 0.05); desk.add(docs);
  const folderCols = [0x8c1c13, 0x1f3f6b, 0xd9b45a, 0x2e5e3a];
  for (let i = 0; i < 5; i++) { const f = box(0.36, 0.018, 0.48, std({ color: folderCols[i % 4], roughness: 0.7 }), (i % 2) * 0.02, i * 0.02, i * 0.01, docs); f.rotation.y = (i - 2) * 0.05; }
  const paper = box(0.3, 0.005, 0.42, std({ color: 0xf8f6ef, roughness: 0.9 }), 0.0, 0.105, 0.0, docs);
  const badge = new THREE.Mesh(new THREE.SphereGeometry(0.035, 16, 10), std({ color: 0xe05d5d, emissive: 0xe05d5d, emissiveIntensity: 1.2 })); badge.position.set(0.17, 0.13, -0.2); docs.add(badge);
  clickable(docs, 'inbox', 'Documents & reports');

  // Phone (diplomatic line)
  const phone = new THREE.Group(); phone.position.set(1.1, 0.86, -0.25); desk.add(phone);
  box(0.22, 0.06, 0.18, phys({ color: 0x8f1d1d, roughness: 0.3, clearcoat: 1 }), 0, 0.03, 0, phone);
  const handset = box(0.24, 0.05, 0.06, phys({ color: 0x8f1d1d, roughness: 0.3, clearcoat: 1 }), 0, 0.08, 0, phone); handset.rotation.y = 0.1;
  clickable(phone, 'diplomacy', 'Secure line to foreign leaders');

  // Banker's lamp
  const lampG = new THREE.Group(); lampG.position.set(-1.15, 0.86, 0.15); desk.add(lampG);
  box(0.04, 0.3, 0.04, brass, 0, 0.15, 0, lampG);
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.12, 0.12, 24, 1, true, 0, Math.PI), phys({ color: 0x0f5a32, roughness: 0.15, transmission: 0.2, side: THREE.DoubleSide, emissive: 0x0f5a32, emissiveIntensity: 0.3 }));
  shade.rotation.z = Math.PI / 2; shade.rotation.y = Math.PI / 2; shade.position.y = 0.33; lampG.add(shade);
  const deskLight = new THREE.PointLight(0xffd8a0, 2.5, 3, 2); deskLight.position.set(-1.15, 1.12, -2.85); scene.add(deskLight);
  // nameplate + pen set
  box(0.36, 0.06, 0.04, brass, 0.2, 0.89, 0.55, desk);

  // Chair & President
  const chair = new THREE.Group(); chair.position.set(0, 0, -4.15); scene.add(chair);
  const chairL = leatherTexture('#3b0f12');
  const chairMat = phys({ map: chairL.map, normalMap: chairL.normalMap, roughness: 0.45, clearcoat: 0.3 });
  rbox(0.75, 0.14, 0.7, 0.06, chairMat, 0, 0.55, 0, chair); rbox(0.75, 1.05, 0.16, 0.07, chairMat, 0, 1.12, -0.3, chair);
  for (const s of [-1, 1]) box(0.1, 0.25, 0.6, chairMat, s * 0.37, 0.7, 0, chair);
  box(0.06, 0.5, 0.06, darkMetal, 0, 0.27, 0, chair);
  const perch = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.7, 16), deskMat); perch.rotation.z = Math.PI / 2; perch.position.set(0, 1.0, 0.05); chair.add(perch);
  let presBird = null;
  function setPresident(ch) {
    if (presBird) chair.remove(presBird);
    presBird = makeBird(ch, { scale: 0.62 }); presBird.position.set(0, 1.02, 0.08); chair.add(presBird);
    clickable(presBird, 'president', 'The President');
  }

  // Flags behind the desk
  const flagMeshes = [];
  for (const [fx, cols] of [[-2.1, S0.countries[0].flag], [2.1, ['#0f5e8c', '#ffffff', '#d9b45a']]]) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 3.1, 12), brass); pole.position.set(fx, 1.55, -5.4); pole.castShadow = true; scene.add(pole);
    const finial = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), brass); finial.position.set(fx, 3.15, -5.4); scene.add(finial);
    const fg = new THREE.PlaneGeometry(1.2, 0.8, 30, 10); const fm = new THREE.Mesh(fg, std({ map: flagTexture(cols), roughness: 0.8, side: THREE.DoubleSide, normalMap: fabricNormal() }));
    fm.position.set(fx + (fx < 0 ? 0.6 : -0.6), 2.55, -5.4); fm.castShadow = true; scene.add(fm); flagMeshes.push({ fm, base: fg.attributes.position.array.slice(), dir: fx < 0 ? 1 : -1 });
  }

  // Bookshelves (left wall)
  const books = booksTexture();
  for (const z of [-3.6, -1.2]) {
    const sh = new THREE.Group(); sh.position.set(-W / 2 + 0.3, 0, z); scene.add(sh);
    box(0.45, 3.0, 2.0, wainMat, 0, 1.5, 0, sh);
    const front = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 2.7), std({ map: books, roughness: 0.8 })); front.position.set(0.23, 1.5, 0); front.rotation.y = Math.PI / 2; sh.add(front);
  }
  // Door (left wall front)
  const door = new THREE.Group(); door.position.set(-W / 2 + 0.12, 0, 3.4); scene.add(door);
  box(0.08, 2.7, 1.3, wainMat, 0, 1.35, 0, door); box(0.12, 2.85, 1.5, trimMat, -0.02, 1.42, 0, door).scale.set(1, 1, 1);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 8), brass); knob.position.set(0.08, 1.2, 0.45); door.add(knob);
  clickable(door, 'cabinet', 'Cabinet Room — meet ministers');

  // TV (right wall)
  const tvScreen = screenCanvas(768, 432);
  const tv = new THREE.Group(); tv.position.set(W / 2 - 0.12, 2.15, -0.6); tv.rotation.y = -Math.PI / 2; scene.add(tv);
  box(1.95, 1.12, 0.06, darkMetal, 0, 0, 0, tv);
  const tvm = new THREE.Mesh(new THREE.PlaneGeometry(1.86, 1.04), new THREE.MeshStandardMaterial({ map: tvScreen.texture, emissive: 0xffffff, emissiveMap: tvScreen.texture, emissiveIntensity: 0.85, roughness: 0.15 }));
  tvm.position.z = 0.032; tv.add(tvm);
  clickable(tv, 'news', 'News broadcast');
  // Credenza under TV
  box(0.5, 0.8, 2.4, deskMat, W / 2 - 0.35, 0.4, -0.6);

  // Lectern (press & speeches)
  const lectern = new THREE.Group(); lectern.position.set(4.6, 0, 3.6); lectern.rotation.y = -0.6; scene.add(lectern);
  const lg = new THREE.CylinderGeometry(0.32, 0.4, 1.15, 6); const lm = new THREE.Mesh(lg, deskMat); lm.position.y = 0.58; lm.castShadow = true; lectern.add(lm);
  const ltop = box(0.75, 0.05, 0.5, deskMat, 0, 1.2, 0, lectern); ltop.rotation.x = -0.25;
  const lseal = new THREE.Mesh(new THREE.CircleGeometry(0.18, 32), phys({ map: sealTex, metalness: 0.3, roughness: 0.4 })); lseal.position.set(0, 0.75, 0.36); lectern.add(lseal);
  const mic = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.35, 6), darkMetal); mic.position.set(0, 1.38, 0.1); mic.rotation.x = 0.5; lectern.add(mic);
  clickable(lectern, 'press', 'Press briefing lectern');

  // Globe
  const globeG = new THREE.Group(); globeG.position.set(-4.8, 0, 1.4); scene.add(globeG);
  const gc = document.createElement('canvas'); gc.width = 512; gc.height = 256;
  const globeTex = new THREE.CanvasTexture(gc); globeTex.colorSpace = THREE.SRGBColorSpace;
  const globe = new THREE.Mesh(new THREE.SphereGeometry(0.42, 48, 32), phys({ map: globeTex, roughness: 0.35, clearcoat: 0.6 })); globe.position.y = 1.25; globe.rotation.z = 0.4; globeG.add(globe);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.47, 0.015, 8, 48), brass); ring.position.y = 1.25; ring.rotation.y = Math.PI / 2; ring.rotation.z = 0.4; globeG.add(ring);
  box(0.05, 0.8, 0.05, deskMat, 0, 0.42, 0, globeG); box(0.5, 0.04, 0.5, deskMat, 0, 0.02, 0, globeG);
  clickable(globeG, 'world', 'World map');
  function paintGlobe(world) {
    const g = gc.getContext('2d'); g.fillStyle = '#1b4f7a'; g.fillRect(0, 0, 512, 256);
    const cs = world.countryColors;
    for (let y = 0; y < world.H; y++) for (let x = 0; x < world.W; x++) { const i = y * world.W + x; if (!world.land[i]) continue; const o = world.owner[i]; g.fillStyle = o >= 0 ? cs[o] : '#8a7a5a'; g.fillRect(x / world.W * 512, 40 + y / world.H * 176, 3, 2); }
    globeTex.needsUpdate = true;
  }

  // Sofas & coffee table
  const sofaMat = std({ color: 0xe8dcc4, roughness: 0.9, normalMap: fabricNormal(), normalScale: new THREE.Vector2(0.3, 0.3) });
  for (const s of [-1, 1]) {
    const so = new THREE.Group(); so.position.set(s * 1.8, 0, 1.2); so.rotation.y = -s * Math.PI / 2; scene.add(so);
    rbox(2.3, 0.28, 0.9, 0.08, sofaMat, 0, 0.2, 0, so);
    for (const k of [-0.55, 0.55]) rbox(1.08, 0.2, 0.78, 0.09, sofaMat, k, 0.43, 0.04, so);
    rbox(2.3, 0.62, 0.24, 0.1, sofaMat, 0, 0.62, -0.36, so);
    for (const k of [-1, 1]) rbox(0.24, 0.5, 0.9, 0.1, sofaMat, k * 1.13, 0.47, 0, so);
    for (const k of [-0.5, 0.5]) { const pil = rbox(0.42, 0.4, 0.12, 0.06, std({ color: 0x1f3f6b, roughness: 0.85 }), k * 1.6, 0.68, -0.22, so); pil.rotation.x = -0.2; }
  }
  const table = rbox(1.3, 0.06, 0.7, 0.02, phys({ map: marbleTexture(), roughness: 0.15, clearcoat: 1 }), 0, 0.45, 1.2);
  box(1.1, 0.42, 0.5, deskMat, 0, 0.21, 1.2);
  // fruit bowl of seeds (a nod to the residents)
  const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.16, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), brass); bowl.position.set(0, 0.64, 1.2); bowl.rotation.x = Math.PI; scene.add(bowl);

  // Ministers (shown during cabinet meetings)
  const meetingGroup = new THREE.Group(); scene.add(meetingGroup);
  const meetingSpots = [[-1.6, 0.58, 0.6], [-1.6, 0.58, 1.8], [1.6, 0.58, 0.6], [1.6, 0.58, 1.8], [-0.7, 0, 2.6], [0.7, 0, 2.6], [-2.8, 0, 2.6], [2.8, 0, 2.6], [0, 0, 3.2]];
  let meetingKey = '';
  function setMeeting(S, on) {
    const ids = on ? Object.entries(S.pol.cabinet).filter(([, id]) => id).map(([pos, id]) => id) : [];
    const key = ids.join(',');
    if (key === meetingKey) return; meetingKey = key;
    while (meetingGroup.children.length) meetingGroup.remove(meetingGroup.children[0]);
    ids.forEach((id, i) => {
      const b = makeBird(S.chars[id], { scale: 0.5 }); const [x, y, z] = meetingSpots[i % meetingSpots.length];
      b.position.set(x, y, z); b.lookAt(0, y, 1.2); b.rotation.x = 0; meetingGroup.add(b);
      clickable(b, 'minister:' + id, S.chars[id].name);
    });
  }

  // ---------- Dynamic screens ----------
  let lastScreen = 0, tickerX = 0, lastNews = '', tvAcc = 0;
  function drawMonitor(S) {
    const g = monitorScreen.ctx, w = 640, h = 400, e = S.countries[0].econ;
    g.fillStyle = '#0b1424'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#132238'; g.fillRect(0, 0, w, 46);
    g.fillStyle = '#d9b45a'; g.font = '600 20px "IBM Plex Sans", Arial'; g.fillText('GOVNET  •  Executive Information System', 18, 30);
    g.fillStyle = '#8b97a8'; g.font = '16px "IBM Plex Mono", monospace'; g.fillText(fmtDate(S.day), w - 150, 30);
    const tiles = [['Approval', pct(S.pol.approval, 0), S.pol.approval >= 50], ['GDP growth', pct(e.growth), e.growth > 0], ['Inflation', pct(e.inflation), e.inflation < 4], ['Unemployment', pct(e.unemployment), e.unemployment < 7], ['Debt/GDP', pct(e.debt / e.gdp * 100, 0), e.debt / e.gdp < 0.9], ['Capital', S.pol.capital.toFixed(0), S.pol.capital > 30]];
    tiles.forEach(([k, v, ok], i) => { const x = 18 + (i % 3) * 205, y = 62 + Math.floor(i / 3) * 92; g.fillStyle = '#111d31'; g.fillRect(x, y, 192, 80); g.fillStyle = '#8b97a8'; g.font = '15px "IBM Plex Sans", Arial'; g.fillText(k.toUpperCase(), x + 12, y + 24); g.fillStyle = ok ? '#4fd1a0' : '#ff8080'; g.font = '600 32px "IBM Plex Mono", monospace'; g.fillText(v, x + 12, y + 62); });
    const hist = S.history.slice(-36);
    g.strokeStyle = '#4c8dd6'; g.lineWidth = 3; g.beginPath();
    hist.forEach((p, i) => { const x = 18 + i / Math.max(1, hist.length - 1) * 600, y = 380 - (p.approval - 20) / 60 * 150; i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke();
    g.fillStyle = '#8b97a8'; g.font = '13px "IBM Plex Sans", Arial'; g.fillText('Approval — last 36 months', 22, 246);
    monitorScreen.texture.needsUpdate = true;
  }
  function drawTV(S, dt) {
    const g = tvScreen.ctx, w = 768, h = 432;
    const top = S.news[0];
    const grd = g.createLinearGradient(0, 0, w, h); grd.addColorStop(0, '#0d2a4a'); grd.addColorStop(1, '#081626'); g.fillStyle = grd; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,255,255,0.05)'; for (let i = 0; i < 12; i++) g.fillRect(0, i * 36, w, 1);
    g.fillStyle = '#b3121f'; g.fillRect(0, 300, 210, 44); g.fillStyle = '#fff'; g.font = '700 24px "IBM Plex Sans", Arial'; g.fillText('BREAKING', 22, 331);
    g.fillStyle = 'rgba(255,255,255,0.95)'; g.fillRect(210, 300, w - 210, 44);
    g.fillStyle = '#0b1424'; g.font = '600 22px "IBM Plex Sans", Arial';
    const head = top ? top.headline : 'Welcome to ANN'; g.fillText(head.length > 52 ? head.slice(0, 50) + '…' : head, 226, 330);
    g.fillStyle = '#0b1424'; g.fillRect(0, 344, w, 40);
    const tick = S.news.slice(0, 8).map((n) => n.headline).join('   •   ');
    tickerX -= dt * 90; g.font = '18px "IBM Plex Sans", Arial'; const tw = g.measureText(tick).width + 80; if (tickerX < -tw) tickerX = 0;
    g.fillStyle = '#d9b45a'; g.fillText(tick, 20 + tickerX, 370); g.fillText(tick, 20 + tickerX + tw, 370);
    g.fillStyle = '#fff'; g.font = '700 54px "Source Serif 4", Georgia, serif'; g.fillText('ANN', 30, 90);
    g.font = '18px "IBM Plex Sans", Arial'; g.fillStyle = '#9fb3c8'; g.fillText('AVIAN NEWS NETWORK  •  LIVE', 34, 120);
    if (top) { g.fillStyle = '#cfd8e3'; g.font = '20px "IBM Plex Sans", Arial'; wrap(g, top.body, 34, 180, 700, 28, 3); g.fillStyle = '#7f8ea3'; g.font = '16px "IBM Plex Sans", Arial'; g.fillText(outletName(top.outlet) + ' • ' + fmtDate(top.day), 34, 280); }
    g.fillStyle = '#b3121f'; g.beginPath(); g.arc(w - 40, 40, 9, 0, Math.PI * 2); g.fill(); g.fillStyle = '#fff'; g.font = '600 16px "IBM Plex Sans"'; g.fillText('LIVE', w - 90, 46);
    tvScreen.texture.needsUpdate = true;
  }
  function wrap(g, text, x, y, mw, lh, maxLines) { const words = text.split(' '); let line = '', n = 0; for (const w of words) { const t = line + w + ' '; if (g.measureText(t).width > mw && line) { g.fillText(line, x, y); y += lh; line = w + ' '; if (++n >= maxLines) return; } else line = t; } g.fillText(line, x, y); }

  // ---------- Camera presets ----------
  const presets = {
    overview: { pos: [0, 2.3, 5.6], target: [0, 1.2, -2.6] },
    desk: { pos: [0, 1.62, -3.85], target: [0, 0.95, -2.2] },
    meeting: { pos: [0, 3.2, 5.4], target: [0, 0.6, 1.4] },
    tv: { pos: [2.6, 2.0, -0.6], target: [7, 2.1, -0.6] },
    lectern: { pos: [1.4, 1.7, 0.4], target: [4.6, 1.3, 3.6] },
  };
  let tween = null;
  function goTo(name) { const p = presets[name]; if (!p) return; tween = { from: camera.position.clone(), to: new THREE.Vector3(...p.pos), tf: controls.target.clone(), tt: new THREE.Vector3(...p.target), t: 0 }; }

  let world = null, meeting = false;
  const view = {
    scene, camera, controls, bloomStrength: 0.25,
    setWorld(wd) { world = wd; paintGlobe(wd); },
    setPresident,
    goTo,
    setMeeting(S, on) { meeting = on; setMeeting(S, on); if (on) goTo('meeting'); },
    get meeting() { return meeting; },
    activate() { controls.enabled = true; }, deactivate() { controls.enabled = false; },
    applySettings(s) { sun.shadow.mapSize.set(s.quality === 'low' ? 1024 : 2048, s.quality === 'low' ? 1024 : 2048); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } },
    pick(ray) { const hit = ray.intersectObjects(clickables, false)[0]; return hit ? { action: hit.object.userData.action, label: hit.object.userData.label } : null; },
    update(dt, t, S, env) {
      if (tween) { tween.t = Math.min(1, tween.t + dt * 1.4); const k = tween.t * tween.t * (3 - 2 * tween.t); camera.position.lerpVectors(tween.from, tween.to, k); controls.target.lerpVectors(tween.tf, tween.tt, k); if (tween.t >= 1) tween = null; }
      controls.update();
      // sun through the windows
      const s = env.sun;
      sun.position.set(s.x * 10, Math.max(0.5, s.y * 12), -14 + s.z * 2);
      sun.intensity = 3.2 * env.daylight;
      sun.color.setHSL(0.09 + env.daylight * 0.04, 0.6, 0.6 + env.daylight * 0.25);
      const lampOn = 0.35 + env.night * 0.9;
      lamps.forEach((l) => { if (l.isLight) l.intensity = 5 * lampOn; else l.material.emissiveIntensity = lampOn * 1.6; });
      hemi.intensity = 0.25 + env.daylight * 0.35;
      deskLight.intensity = 1.5 + env.night * 2.5;
      for (const f of flagMeshes) { const p = f.fm.geometry.attributes.position; for (let i = 0; i < p.count; i++) { const x = f.base[i * 3]; const off = (x * f.dir + 0.6); p.setZ(i, Math.sin(off * 5 + t * 1.6) * 0.04 * off); } p.needsUpdate = true; f.fm.geometry.computeVertexNormals(); }
      globe.rotation.y += dt * 0.15;
      if (presBird) presBird.userData.bird.update(t, dt);
      meetingGroup.children.forEach((b, i) => { b.userData.bird.update(t, dt); b.userData.bird.setTalking(Math.floor(t / 2.5) % meetingGroup.children.length === i); });
      badge.visible = S && (S.pending.length + S.proposals.length + S.pol.bills.filter((b) => b.stage === 'desk').length) > 0;
      if (badge.visible) badge.scale.setScalar(1 + Math.sin(t * 5) * 0.15);
      if (S) {
        lastScreen -= dt;
        if (lastScreen <= 0) { lastScreen = 1; drawMonitor(S); drawOutside(env); }
        tvAcc += dt; if (tvAcc > 0.066) { drawTV(S, tvAcc); tvAcc = 0; }
      }
    },
  };
  return view;
}
