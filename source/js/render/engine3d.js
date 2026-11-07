// Renderer, post-processing, view switching, picking and the shared time-of-day clock.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export class Engine3D {
  constructor(canvas, settings) {
    this.canvas = canvas;
    this.settings = settings;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.views = {}; this.active = null; this.clock = new THREE.Clock(); this.t = 0;
    this.env = { hour: 16.5, locked: false, sun: new THREE.Vector3(), daylight: 1, night: 0 };
    this.raycaster = new THREE.Raycaster(); this.pointer = new THREE.Vector2();
    this.onPick = () => {}; this.onHover = () => {};
    this.composer = new EffectComposer(this.renderer);
    this.renderPass = new RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera());
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.35, 0.6, 0.85);
    this.composer.addPass(this.renderPass); this.composer.addPass(this.bloom); this.composer.addPass(new OutputPass());
    this.applySettings(settings);
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.bindPointer();
  }

  applySettings(s) {
    this.settings = s;
    const pr = Math.min(window.devicePixelRatio || 1, s.quality === 'high' ? 2 : s.quality === 'medium' ? 1.5 : 1);
    this.renderer.setPixelRatio(pr);
    this.renderer.shadowMap.enabled = s.shadows;
    this.env.locked = s.lockTime;
    if (s.lockTime) this.env.hour = s.lockHour ?? 16.5;
    this.resize();
    for (const v of Object.values(this.views)) v.applySettings?.(s);
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.bloom.setSize(w / 2, h / 2);
    for (const v of Object.values(this.views)) { if (v.camera) { v.camera.aspect = w / h; v.camera.updateProjectionMatrix(); } v.resize?.(w, h); }
  }

  register(name, view) { if (view.controls) view.controls.enabled = false; this.views[name] = view; view.camera.aspect = window.innerWidth / window.innerHeight; view.camera.updateProjectionMatrix(); }
  show(name) {
    if (this.active === name) return;
    const prev = this.views[this.active]; prev?.deactivate?.();
    this.active = name; const v = this.views[name];
    v?.activate?.();
    this.renderPass.scene = v.scene; this.renderPass.camera = v.camera;
  }
  get view() { return this.views[this.active]; }

  bindPointer() {
    let down = null;
    const toNdc = (e) => { const r = this.canvas.getBoundingClientRect(); this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); };
    this.canvas.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
    this.canvas.addEventListener('pointerup', (e) => {
      if (!down) return; const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y); const dt = performance.now() - down.t; down = null;
      if (moved > 8 || dt > 600) return;
      toNdc(e); const hit = this.pick(); if (hit) this.onPick(hit, e);
    });
    this.canvas.addEventListener('pointermove', (e) => { if (e.pointerType !== 'mouse' || down) return; toNdc(e); const hit = this.pick(true); this.onHover(hit, e); });
  }
  pick(hover = false) {
    const v = this.view; if (!v || !v.pick) return null;
    this.raycaster.setFromCamera(this.pointer, v.camera);
    return v.pick(this.raycaster, hover);
  }

  updateTime(dt) {
    const e = this.env;
    if (!e.locked) e.hour = (e.hour + dt * (24 / 300)) % 24; // full day every 5 minutes of real time
    const ang = (e.hour - 6) / 12 * Math.PI; // 6h sunrise, 18h sunset
    const elev = Math.sin(ang);
    e.sun.set(Math.cos(ang) * 0.8, elev, -0.45 + Math.cos(ang) * 0.1).normalize();
    e.daylight = THREE.MathUtils.smoothstep(elev, -0.08, 0.25);
    e.night = 1 - THREE.MathUtils.smoothstep(elev, -0.15, 0.05);
    e.golden = Math.max(0, 1 - Math.abs(elev - 0.12) * 5) * (elev > -0.05 ? 1 : 0);
  }

  frame(S) {
    const dt = Math.min(0.05, this.clock.getDelta()); this.t += dt;
    this.updateTime(dt);
    const v = this.view; if (!v) return;
    v.update?.(dt, this.t, S, this.env);
    if (this.settings.bloom) { this.bloom.strength = v.bloomStrength ?? 0.35; this.composer.render(); }
    else this.renderer.render(v.scene, v.camera);
  }
}
