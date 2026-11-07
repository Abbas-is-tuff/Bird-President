// Renders studio portraits of every bird once at start-up (used throughout the UI).
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { makeBird, lookFor } from './bird.js';

const cache = {};
export function renderPortraits(chars) {
  const size = 256;
  const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  r.setSize(size, size, false); r.setPixelRatio(1);
  r.toneMapping = THREE.ACESFilmicToneMapping; r.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(r); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  const key = new THREE.DirectionalLight(0xfff1dc, 2.6); key.position.set(2, 3, 3); scene.add(key);
  const rim = new THREE.DirectionalLight(0x9cc4ff, 1.6); rim.position.set(-3, 2, -2); scene.add(rim);
  scene.add(new THREE.AmbientLight(0xffffff, 0.25));
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 20); cam.position.set(0.9, 1.15, 2.4); cam.lookAt(0, 0.82, 0);
  for (const ch of chars) {
    const look = ch.look;
    if (cache[look]) continue;
    const b = makeBird(ch); b.rotation.y = 0.35; scene.add(b);
    b.userData.bird.update(0, 0);
    r.render(scene, cam);
    cache[look] = r.domElement.toDataURL('image/png');
    scene.remove(b);
    b.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
  }
  r.dispose(); r.forceContextLoss?.();
  return cache;
}
export const portrait = (ch) => (ch && cache[ch.look]) || '';
export { lookFor };
