// 3D world map: generated terrain coloured by country, borders, capitals, disputes and war fronts.
// Map modes recolour the terrain from live simulation data. Tapping a country opens diplomacy.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { waterNormal } from './textures.js';
import { COUNTRIES } from '../sim/data.js';
import { milPower } from '../sim/military.js';
import { hasTreaty, warBetween } from '../sim/diplomacy.js';

const CELL = 2;

export function createWorldMap(renderer, world, labelsEl) {
  const { W, H, elev, land } = world;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x07101c);
  scene.fog = new THREE.Fog(0x07101c, 380, 900);
  const camera = new THREE.PerspectiveCamera(45, 1, 1, 3000);
  camera.position.set(0, 250, 190);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0, 10); controls.enableDamping = true; controls.screenSpacePanning = false;
  controls.minDistance = 60; controls.maxDistance = 480; controls.maxPolarAngle = 1.2; controls.minPolarAngle = 0.15;
  controls.mouseButtons = { LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
  controls.touches = { ONE: THREE.TOUCH.PAN, TWO: THREE.TOUCH.DOLLY_ROTATE };
  const pmrem = new THREE.PMREMGenerator(renderer);

  const hemi = new THREE.HemisphereLight(0xdfe9ff, 0x1a2230, 0.8); scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff2e0, 2.2); sun.position.set(-160, 260, 120); scene.add(sun);
  sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -230, right: 230, top: 160, bottom: -160, near: 10, far: 800 }); sun.shadow.bias = -0.0005;

  const toWorld = (x, y) => [(x - W / 2) * CELL, (y - H / 2) * CELL];
  const heightAt = (i) => (land[i] ? 0.6 + Math.max(0, elev[i]) * 26 + Math.max(0, elev[i] - 0.45) * 30 : -1.5 + Math.min(0, elev[i]) * 18);

  // Terrain
  const geo = new THREE.PlaneGeometry(W * CELL, H * CELL, W - 1, H - 1); geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; pos.setY(i, heightAt(i)); }
  geo.computeVertexNormals();
  const colors = new Float32Array(W * H * 3); geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const terrain = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0, flatShading: false }));
  terrain.receiveShadow = true; terrain.castShadow = true; scene.add(terrain);

  // Ocean
  const ocean = new THREE.Mesh(new THREE.PlaneGeometry(W * CELL * 3, H * CELL * 3), new THREE.MeshPhysicalMaterial({ color: 0x0d3554, roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.86, normalMap: waterNormal(), normalScale: new THREE.Vector2(0.25, 0.25), clearcoat: 0.6 }));
  ocean.rotation.x = -Math.PI / 2; ocean.position.y = 0.0; scene.add(ocean);
  const seabed = new THREE.Mesh(new THREE.PlaneGeometry(W * CELL * 3, H * CELL * 3), new THREE.MeshStandardMaterial({ color: 0x0a2236, roughness: 1 })); seabed.rotation.x = -Math.PI / 2; seabed.position.y = -6; scene.add(seabed);

  // Clouds
  const cloudTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); for (let k = 0; k < 14; k++) { const x = 30 + Math.random() * 68, y = 40 + Math.random() * 48, r = 18 + Math.random() * 26; const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128); } return new THREE.CanvasTexture(c); })();
  const clouds = [];
  for (let k = 0; k < 12; k++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(60, 40), new THREE.MeshBasicMaterial({ map: cloudTex, transparent: true, opacity: 0.28, depthWrite: false })); m.rotation.x = -Math.PI / 2; m.position.set((Math.random() - 0.5) * 520, 48 + Math.random() * 14, (Math.random() - 0.5) * 300); m.rotation.z = Math.random() * 6; scene.add(m); clouds.push(m); }

  // Borders
  const borderMat = new THREE.LineBasicMaterial({ color: 0xf4f1e6, transparent: true, opacity: 0.85 });
  const warMat = new THREE.LineBasicMaterial({ color: 0xff3b3b, transparent: true, opacity: 1 });
  const disputeMat = new THREE.LineBasicMaterial({ color: 0xffb020, transparent: true, opacity: 0.9 });
  let borderLines = null, warLines = null, disputeLines = null;

  // Capitals
  const capitals = COUNTRIES.map((c, i) => {
    const [sx, sy] = world.seeds[i]; const [wx, wz] = toWorld(sx, sy); const hi = heightAt(Math.round(sy) * W + Math.round(sx));
    const g = new THREE.Group(); g.position.set(wx, hi, wz);
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 5, 12), new THREE.MeshStandardMaterial({ color: 0xd9b45a, metalness: 0.8, roughness: 0.3, emissive: 0x5a4010 })); pin.position.y = 2.5; g.add(pin);
    const top = new THREE.Mesh(new THREE.SphereGeometry(1.4, 16, 10), new THREE.MeshStandardMaterial({ color: 0xffe08a, emissive: 0xd9b45a, emissiveIntensity: 0.6, metalness: 0.4, roughness: 0.3 })); top.position.y = 5.5; g.add(top);
    const ring = new THREE.Mesh(new THREE.RingGeometry(3, 3.6, 40), new THREE.MeshBasicMaterial({ color: i === 0 ? 0x5fd1ff : 0xd9b45a, transparent: true, opacity: 0.7, side: THREE.DoubleSide })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.4; g.add(ring);
    scene.add(g);
    const label = document.createElement('div'); label.className = 'map-label' + (i === 0 ? ' me' : ''); labelsEl.appendChild(label);
    return { g, ring, label, pos: new THREE.Vector3(wx, hi + 8, wz) };
  });

  let ownerNow = new Int8Array(world.owner);
  let mode = 'political', sig = '', S_ = null;
  const tmpC = new THREE.Color(), terrainC = new THREE.Color();

  function computeOwners(S) {
    ownerNow = new Int8Array(world.owner);
    for (const d of S.disputes) { if (d.holder == null) continue; const wd = world.disputes.find((x) => x.id === d.id); if (wd) for (const i of wd.cells) ownerNow[i] = d.holder; }
  }
  function countryColor(S, o) {
    const c = S.countries[o];
    if (mode === 'political') return tmpC.set(c.color);
    if (mode === 'relations') { if (o === 0) return tmpC.set('#5fd1ff'); const r = S.rel[0][o]; return r >= 0 ? tmpC.setRGB(0.25 - r / 600, 0.35 + r / 220, 0.3) : tmpC.setRGB(0.4 - r / 180, 0.25 + r / 500, 0.22 + r / 600); }
    if (mode === 'alliances') { const blocs = ['#3b82f6', '#dc2626', '#16a34a', '#f59e0b', '#7c3aed']; const al = S.treaties.filter((t) => t.type === 'alliance' && (t.a === o || t.b === o)).map((t) => Math.min(t.a, t.b)); return tmpC.set(al.length ? blocs[Math.min(...al) % blocs.length] : '#6b7280'); }
    if (mode === 'economy') { const g = S.countries[o].econ.growth; return tmpC.setHSL(Math.max(0, Math.min(0.33, (g + 2) / 15)), 0.65, 0.42); }
    if (mode === 'military') { const pw = S.countries.map(milPower), mx = Math.max(...pw); return tmpC.setHSL(0.0, 0.7, 0.18 + 0.45 * (pw[o] / mx)); }
    return tmpC.set(c.color);
  }
  function recolor(S) {
    computeOwners(S);
    const dispCells = new Set(); world.disputes.forEach((wd) => { const d = S.disputes.find((x) => x.id === wd.id); if (d && !d.resolved) wd.cells.forEach((i) => dispCells.add(i)); });
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x, e = elev[i];
      if (!land[i]) { terrainC.setRGB(0.05, 0.15, 0.24); colors.set([terrainC.r, terrainC.g, terrainC.b], i * 3); continue; }
      // natural terrain shade: lowlands green, highlands brown/grey, peaks snow
      if (e > 0.78) terrainC.setRGB(0.92, 0.93, 0.95); else if (e > 0.5) terrainC.setRGB(0.48, 0.42, 0.36); else if (e < 0.04) terrainC.setRGB(0.78, 0.72, 0.55); else terrainC.setRGB(0.32, 0.46, 0.26);
      const o = ownerNow[i];
      const cc = o >= 0 ? countryColor(S, o) : tmpC.setRGB(0.5, 0.5, 0.5);
      const k = mode === 'terrain' ? 0 : 0.62;
      let r = terrainC.r * (1 - k) + cc.r * k, g = terrainC.g * (1 - k) + cc.g * k, b = terrainC.b * (1 - k) + cc.b * k;
      if (dispCells.has(i) && ((x + y) % 4 < 2)) { r = r * 0.6 + 0.4; g = g * 0.6 + 0.28; b *= 0.6; }
      colors.set([r, g, b], i * 3);
    }
    geo.attributes.color.needsUpdate = true;
    // borders
    const segs = [], wsegs = [], dsegs = [];
    const lift = 0.7;
    for (let y = 0; y < H - 1; y++) for (let x = 0; x < W - 1; x++) {
      const i = y * W + x;
      for (const [j, horiz] of [[i + 1, true], [i + W, false]]) {
        const a = ownerNow[i], b = ownerNow[j];
        if (a < 0 || b < 0 || a === b) continue;
        const hh = Math.max(heightAt(i), heightAt(j)) + lift;
        const [cx, cz] = toWorld(horiz ? x + 0.5 : x, horiz ? y : y + 0.5);
        const seg = horiz ? [cx, hh, cz - CELL / 2, cx, hh, cz + CELL / 2] : [cx - CELL / 2, hh, cz, cx + CELL / 2, hh, cz];
        segs.push(...seg);
        if (warBetween(S, a, b)) wsegs.push(seg[0], seg[1] + 0.4, seg[2], seg[3], seg[4] + 0.4, seg[5]);
      }
    }
    // dispute outlines
    for (const wd of world.disputes) {
      const d = S.disputes.find((x) => x.id === wd.id); if (!d || d.resolved) continue;
      const set = new Set(wd.cells);
      for (const i of wd.cells) { const x = i % W, y = (i / W) | 0; for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const j = (y + dy) * W + x + dx; if (set.has(j)) continue; const hh = heightAt(i) + 1.0; const [cx, cz] = toWorld(x + dx / 2, y + dy / 2); if (dx) dsegs.push(cx, hh, cz - 1, cx, hh, cz + 1); else dsegs.push(cx - 1, hh, cz, cx + 1, hh, cz); } }
    }
    for (const [ref, arr, mat] of [['b', segs, borderMat], ['w', wsegs, warMat], ['d', dsegs, disputeMat]]) {
      const old = ref === 'b' ? borderLines : ref === 'w' ? warLines : disputeLines;
      if (old) { scene.remove(old); old.geometry.dispose(); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
      const l = new THREE.LineSegments(g, mat); scene.add(l);
      if (ref === 'b') borderLines = l; else if (ref === 'w') warLines = l; else disputeLines = l;
    }
  }

  const v = new THREE.Vector3();
  const view = {
    scene, camera, controls, bloomStrength: 0.3,
    setMode(m) { mode = m; sig = ''; },
    get mode() { return mode; },
    activate() { controls.enabled = true; labelsEl.style.display = 'block'; }, deactivate() { controls.enabled = false; labelsEl.style.display = 'none'; },
    focus(idx) { const c = capitals[idx]; controls.target.set(c.pos.x, 0, c.pos.z); },
    pick(ray) {
      const hit = ray.intersectObject(terrain)[0]; if (!hit) return null;
      const x = Math.round(hit.point.x / CELL + W / 2), y = Math.round(hit.point.z / CELL + H / 2);
      if (x < 0 || y < 0 || x >= W || y >= H) return null;
      const o = ownerNow[y * W + x]; if (o < 0 || !land[y * W + x]) return null;
      return { action: 'country:' + o, label: S_ ? S_.countries[o].name : '' };
    },
    applySettings(s) { const sz = s.quality === 'low' ? 1024 : 2048; sun.shadow.mapSize.set(sz, sz); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } },
    update(dt, t, S, env) {
      S_ = S; controls.update();
      if (!scene.environment) scene.environment = pmrem.fromScene(new THREE.Scene(), 0).texture;
      const s2 = mode + '|' + S.disputes.map((d) => d.holder + ':' + d.resolved).join() + '|' + S.wars.map((w) => w.a + '-' + w.b).join() + '|' + (mode === 'political' || mode === 'terrain' ? '' : Math.floor(S.day / 30));
      if (s2 !== sig) { sig = s2; recolor(S); }
      warMat.opacity = 0.5 + Math.sin(t * 6) * 0.5;
      disputeMat.opacity = 0.55 + Math.sin(t * 2.5) * 0.35;
      ocean.material.normalMap.offset.set(t * 0.004, t * 0.006);
      for (const c of clouds) { c.position.x += dt * 3; if (c.position.x > 280) c.position.x = -280; }
      const w = window.innerWidth, h = window.innerHeight;
      capitals.forEach((c, i) => {
        const C = S.countries[i];
        c.ring.scale.setScalar(1 + Math.sin(t * 2 + i) * 0.12);
        v.copy(c.pos).project(camera);
        const visible = v.z < 1 && v.x > -1.1 && v.x < 1.1 && v.y > -1.1 && v.y < 1.1;
        c.label.style.display = visible ? 'block' : 'none';
        if (!visible) return;
        c.label.style.transform = `translate(${(v.x * 0.5 + 0.5) * w}px, ${(-v.y * 0.5 + 0.5) * h}px) translate(-50%, -100%)`;
        const war = S.wars.some((x) => x.a === i || x.b === i);
        const html = `<b>${C.short}</b><span>${C.capital}${war ? ' · <i class="war">AT WAR</i>' : ''}</span>`;
        if (c.label._h !== html) { c.label.innerHTML = html; c.label._h = html; }
      });
    },
  };
  return view;
}
