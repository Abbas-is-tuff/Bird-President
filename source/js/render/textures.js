// Procedural textures drawn on canvases: no external image assets are needed.
import * as THREE from 'three';
import { makeRng } from '../sim/util.js';

const cache = new Map();
function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function tex(c, { repeat = [1, 1], srgb = true, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]);
  t.anisotropy = aniso; if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true; return t;
}

// Height canvas -> tangent-space normal map
export function normalFrom(src, strength = 2) {
  const w = src.width, h = src.height;
  const sd = src.getContext('2d').getImageData(0, 0, w, h).data;
  const out = canvas(w, h), ctx = out.getContext('2d'), od = ctx.createImageData(w, h);
  const H = (x, y) => sd[(((y + h) % h) * w + ((x + w) % w)) * 4] / 255;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (H(x + 1, y) - H(x - 1, y)) * strength, dy = (H(x, y + 1) - H(x, y - 1)) * strength;
    const l = Math.hypot(dx, dy, 1), i = (y * w + x) * 4;
    od.data[i] = (-dx / l * 0.5 + 0.5) * 255; od.data[i + 1] = (-dy / l * 0.5 + 0.5) * 255; od.data[i + 2] = (1 / l * 0.5 + 0.5) * 255; od.data[i + 3] = 255;
  }
  ctx.putImageData(od, 0, 0);
  return out;
}

// Overlapping feather scales: grayscale detail map (multiplied with vertex colours) + normal map.
export function featherTextures(scale = 1) {
  const key = 'feather' + scale;
  if (cache.has(key)) return cache.get(key);
  const S = 512, c = canvas(S, S), g = c.getContext('2d'), rnd = makeRng(7);
  g.fillStyle = '#c8c8c8'; g.fillRect(0, 0, S, S);
  const rowH = 16, fw = 22;
  for (let row = -1; row < S / rowH + 2; row++) {
    for (let col = -1; col < S / fw + 2; col++) {
      const x = col * fw + (row % 2) * fw / 2 + (rnd() - 0.5) * 4, y = row * rowH + (rnd() - 0.5) * 3;
      const grd = g.createRadialGradient(x, y - 4, 1, x, y + 4, fw * 0.9);
      const b = 200 + rnd() * 40;
      grd.addColorStop(0, `rgb(${b},${b},${b})`); grd.addColorStop(0.75, `rgb(${b - 35},${b - 35},${b - 35})`); grd.addColorStop(1, `rgb(${b - 80},${b - 80},${b - 80})`);
      g.fillStyle = grd;
      g.beginPath(); g.ellipse(x, y, fw * 0.62, rowH * 1.05, 0, 0, Math.PI); g.lineTo(x - fw * 0.62, y - 6); g.closePath(); g.fill();
      // rachis + barbs
      g.strokeStyle = `rgba(255,255,255,0.18)`; g.lineWidth = 1;
      g.beginPath(); g.moveTo(x, y - 4); g.lineTo(x, y + rowH * 0.9); g.stroke();
      g.strokeStyle = 'rgba(0,0,0,0.07)';
      for (let k = -6; k <= 6; k += 2) { g.beginPath(); g.moveTo(x, y + 2 + Math.abs(k)); g.lineTo(x + k * 1.6, y + rowH * 0.9); g.stroke(); }
    }
  }
  const map = tex(c, { srgb: true, repeat: [scale, scale] });
  const nrm = tex(normalFrom(c, 3), { srgb: false, repeat: [scale, scale] });
  const out = { map, normalMap: nrm };
  cache.set(key, out); return out;
}

// Long flight feathers for wings & tail
export function flightFeatherTextures() {
  if (cache.has('flight')) return cache.get('flight');
  const W = 256, H = 512, c = canvas(W, H), g = c.getContext('2d'), rnd = makeRng(11);
  g.fillStyle = '#bdbdbd'; g.fillRect(0, 0, W, H);
  const n = 7;
  for (let i = 0; i < n; i++) {
    const x = (i + 0.5) / n * W;
    const grd = g.createLinearGradient(x - 20, 0, x + 20, 0);
    grd.addColorStop(0, '#8a8a8a'); grd.addColorStop(0.5, '#e4e4e4'); grd.addColorStop(1, '#8a8a8a');
    g.fillStyle = grd; g.fillRect(x - W / n / 2, 0, W / n, H);
    g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke();
    g.strokeStyle = 'rgba(0,0,0,0.08)'; g.lineWidth = 1;
    for (let y = 0; y < H; y += 5) { g.beginPath(); g.moveTo(x, y); g.lineTo(x - 14, y + 10 + rnd() * 3); g.moveTo(x, y); g.lineTo(x + 14, y + 10 + rnd() * 3); g.stroke(); }
  }
  const out = { map: tex(c), normalMap: tex(normalFrom(c, 2.5), { srgb: false }) };
  cache.set('flight', out); return out;
}

export function woodTexture(kind = 'desk') {
  const key = 'wood' + kind; if (cache.has(key)) return cache.get(key);
  const W = 512, H = 512, c = canvas(W, H), g = c.getContext('2d'), rnd = makeRng(kind.length * 31);
  const base = kind === 'floor' ? [122, 78, 44] : kind === 'panel' ? [92, 60, 38] : [70, 38, 22];
  g.fillStyle = `rgb(${base})`; g.fillRect(0, 0, W, H);
  if (kind === 'floor') {
    // herringbone parquet
    const pw = 32, pl = 128;
    for (let y = -pl; y < H + pl; y += pw) for (let x = -pl; x < W + pl; x += pl) {
      for (let k = 0; k < 2; k++) {
        g.save(); g.translate(x + (k ? pw : 0) + (y / pw % 2) * pl / 2, y); g.rotate(k ? Math.PI / 4 : -Math.PI / 4);
        const t = 0.8 + rnd() * 0.35; g.fillStyle = `rgb(${base[0] * t},${base[1] * t},${base[2] * t})`; g.fillRect(0, 0, pl * 0.7, pw * 0.7);
        g.strokeStyle = 'rgba(0,0,0,0.25)'; g.strokeRect(0, 0, pl * 0.7, pw * 0.7); g.restore();
      }
    }
  }
  // grain
  for (let i = 0; i < 260; i++) {
    const y = rnd() * H, a = 0.03 + rnd() * 0.08;
    g.strokeStyle = rnd() > 0.5 ? `rgba(0,0,0,${a})` : `rgba(255,220,180,${a * 0.6})`; g.lineWidth = 0.5 + rnd() * 2;
    g.beginPath(); g.moveTo(0, y);
    for (let x = 0; x <= W; x += 16) g.lineTo(x, y + Math.sin(x / 40 + i) * 3 + Math.sin(x / 9) * 0.6);
    g.stroke();
  }
  if (kind === 'panel') { // raised panels
    g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 6; g.strokeRect(40, 40, W - 80, H - 80);
    g.strokeStyle = 'rgba(255,220,170,0.15)'; g.lineWidth = 3; g.strokeRect(48, 48, W - 96, H - 96);
  }
  const out = { map: tex(c), normalMap: tex(normalFrom(c, kind === 'floor' ? 1.5 : 1), { srgb: false }), rough: null };
  cache.set(key, out); return out;
}

export function wallTexture() {
  if (cache.has('wall')) return cache.get('wall');
  const W = 512, H = 512, c = canvas(W, H), g = c.getContext('2d'), rnd = makeRng(3);
  g.fillStyle = '#e9e1cf'; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 6000; i++) { const v = 220 + rnd() * 25; g.fillStyle = `rgba(${v},${v - 6},${v - 18},0.25)`; g.fillRect(rnd() * W, rnd() * H, 2, 2); }
  // damask-like subtle pattern
  g.strokeStyle = 'rgba(170,150,110,0.16)'; g.lineWidth = 2;
  for (let y = 0; y < H; y += 64) for (let x = 0; x < W; x += 64) { g.beginPath(); g.ellipse(x + 32, y + 32, 14, 22, 0, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.moveTo(x + 32, y + 4); g.lineTo(x + 32, y + 60); g.stroke(); }
  const out = { map: tex(c, { repeat: [3, 1.2] }), normalMap: tex(normalFrom(c, 0.6), { srgb: false, repeat: [3, 1.2] }) };
  cache.set('wall', out); return out;
}

export function carpetTexture(countryName) {
  const S = 1024, c = canvas(S, S), g = c.getContext('2d'), rnd = makeRng(5);
  g.fillStyle = '#123a5c'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 40000; i++) { const v = rnd() * 30; g.fillStyle = `rgba(${10 + v},${45 + v},${80 + v},0.5)`; g.fillRect(rnd() * S, rnd() * S, 2, 2); }
  const cx = S / 2;
  g.strokeStyle = '#d9b45a'; g.lineWidth = 14; g.beginPath(); g.arc(cx, cx, S * 0.47, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 4; g.beginPath(); g.arc(cx, cx, S * 0.44, 0, Math.PI * 2); g.stroke();
  drawSeal(g, cx, cx, S * 0.3, countryName, '#d9b45a', '#123a5c');
  return tex(c);
}

// National seal: rings, stars, text and a stylised wing emblem (original design).
export function drawSeal(g, x, y, r, name, gold = '#d9b45a', bg = '#0f2d4a') {
  g.save();
  g.fillStyle = bg; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  g.strokeStyle = gold; g.lineWidth = r * 0.03; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.arc(x, y, r * 0.72, 0, Math.PI * 2); g.stroke();
  g.fillStyle = gold; g.font = `600 ${r * 0.13}px "IBM Plex Sans", Arial`; g.textAlign = 'center'; g.textBaseline = 'middle';
  const txt = (name || 'REPUBLIC OF AVIANIA').toUpperCase() + ' • SEAL OF THE PRESIDENT • ';
  for (let i = 0; i < txt.length; i++) { const a = -Math.PI / 2 + (i / txt.length) * Math.PI * 2; g.save(); g.translate(x + Math.cos(a) * r * 0.86, y + Math.sin(a) * r * 0.86); g.rotate(a + Math.PI / 2); g.fillText(txt[i], 0, 0); g.restore(); }
  // wings
  for (const s of [-1, 1]) {
    g.beginPath(); g.moveTo(x, y + r * 0.1);
    for (let k = 0; k < 5; k++) { const ang = -0.2 - k * 0.22; g.quadraticCurveTo(x + s * r * (0.25 + k * 0.08), y - r * (0.05 + k * 0.06), x + s * r * 0.6 * Math.cos(ang) * (1 - k * 0.12), y + r * 0.6 * Math.sin(ang) * (1 - k * 0.1) - r * 0.05); }
    g.lineTo(x + s * r * 0.08, y + r * 0.25); g.closePath(); g.fill();
  }
  // shield
  g.beginPath(); g.moveTo(x - r * 0.14, y - r * 0.12); g.lineTo(x + r * 0.14, y - r * 0.12); g.lineTo(x + r * 0.14, y + r * 0.1); g.quadraticCurveTo(x, y + r * 0.32, x - r * 0.14, y + r * 0.1); g.closePath(); g.fill();
  g.fillStyle = bg; g.fillRect(x - r * 0.1, y - r * 0.08, r * 0.2, r * 0.04);
  for (let k = 0; k < 5; k++) { const a = -Math.PI / 2 + (k - 2) * 0.32; star(g, x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.05, gold); }
  g.restore();
}
function star(g, x, y, r, col) { g.fillStyle = col; g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.closePath(); g.fill(); }

export function flagCanvas(colors, emblem = true, w = 300, h = 200) {
  const c = canvas(w, h), g = c.getContext('2d');
  g.fillStyle = colors[0]; g.fillRect(0, 0, w, h);
  g.fillStyle = colors[1]; g.fillRect(0, h * 0.36, w, h * 0.28);
  g.fillStyle = colors[2]; g.fillRect(0, h * 0.44, w, h * 0.12);
  if (emblem) { g.fillStyle = colors[2]; g.beginPath(); g.arc(w * 0.22, h * 0.5, h * 0.2, 0, Math.PI * 2); g.fill(); g.fillStyle = colors[1]; g.beginPath(); g.arc(w * 0.22, h * 0.5, h * 0.14, 0, Math.PI * 2); g.fill();
    g.fillStyle = colors[0]; g.beginPath(); g.moveTo(w * 0.22 - h * 0.1, h * 0.52); g.quadraticCurveTo(w * 0.22, h * 0.32, w * 0.22 + h * 0.1, h * 0.52); g.quadraticCurveTo(w * 0.22, h * 0.45, w * 0.22 - h * 0.1, h * 0.52); g.fill(); }
  return c;
}
export function flagTexture(colors) { return tex(flagCanvas(colors, true, 512, 340), { repeat: [1, 1] }); }

export function booksTexture() {
  if (cache.has('books')) return cache.get('books');
  const W = 512, H = 512, c = canvas(W, H), g = c.getContext('2d'), rnd = makeRng(9);
  g.fillStyle = '#2b1a10'; g.fillRect(0, 0, W, H);
  const cols = ['#5b1a1a', '#1d3b5a', '#2c4a2a', '#6b4a1a', '#3a2a4a', '#1a1a1a', '#7a6a4a', '#4a1a2a'];
  for (let shelf = 0; shelf < 4; shelf++) {
    let x = 4; const y0 = shelf * 128 + 10, hMax = 108;
    while (x < W - 8) {
      const bw = 10 + rnd() * 16, bh = hMax * (0.7 + rnd() * 0.3);
      g.fillStyle = cols[Math.floor(rnd() * cols.length)]; g.fillRect(x, y0 + hMax - bh, bw, bh);
      g.fillStyle = 'rgba(217,180,90,0.7)'; g.fillRect(x + 2, y0 + hMax - bh + 10, bw - 4, 3); g.fillRect(x + 2, y0 + hMax - 16, bw - 4, 2);
      g.fillStyle = 'rgba(255,255,255,0.06)'; g.fillRect(x, y0 + hMax - bh, 2, bh);
      x += bw + 1;
    }
    g.fillStyle = '#3d2615'; g.fillRect(0, y0 + hMax, W, 10);
  }
  const out = tex(c); cache.set('books', out); return out;
}

// Building facade: windows grid. Returns {map, emissive} so night lights can be per-window.
export function facadeTextures(kind, seed) {
  const key = 'facade' + kind + seed; if (cache.has(key)) return cache.get(key);
  const W = 256, H = 512, c = canvas(W, H), e = canvas(W, H), g = c.getContext('2d'), ge = e.getContext('2d'), rnd = makeRng(seed);
  const wall = kind === 'glass' ? '#4a5866' : kind === 'stone' ? '#c9bfae' : '#a8a39a';
  g.fillStyle = wall; g.fillRect(0, 0, W, H); ge.fillStyle = '#000'; ge.fillRect(0, 0, W, H);
  const cols = kind === 'glass' ? 8 : 5, rows = kind === 'glass' ? 24 : 12;
  const cw = W / cols, rh = H / rows;
  for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) {
    const x = k * cw, y = r * rh;
    const pad = kind === 'glass' ? 1.5 : cw * 0.22;
    const grd = g.createLinearGradient(x, y, x + cw, y + rh);
    grd.addColorStop(0, kind === 'glass' ? '#6d8aa3' : '#33404d'); grd.addColorStop(1, kind === 'glass' ? '#2c3c4c' : '#1a2129');
    g.fillStyle = grd; g.fillRect(x + pad, y + pad * (kind === 'glass' ? 1 : 0.8), cw - pad * 2, rh - pad * (kind === 'glass' ? 2 : 1.6));
    if (rnd() < 0.42) { const w = 0.6 + rnd() * 0.4; ge.fillStyle = `rgb(${255 * w},${210 * w},${140 * w})`; ge.fillRect(x + pad, y + pad, cw - pad * 2, rh - pad * 2); }
    if (kind === 'stone') { g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(x, y + rh - 3, cw, 3); }
  }
  const out = { map: tex(c), emissive: tex(e), normalMap: tex(normalFrom(c, 1.2), { srgb: false }) };
  cache.set(key, out); return out;
}

export function asphaltTexture() {
  if (cache.has('asphalt')) return cache.get('asphalt');
  const S = 256, c = canvas(S, S), g = c.getContext('2d'), rnd = makeRng(4);
  g.fillStyle = '#2d2f33'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 9000; i++) { const v = 30 + rnd() * 40; g.fillStyle = `rgb(${v},${v},${v + 3})`; g.fillRect(rnd() * S, rnd() * S, 1.5, 1.5); }
  const out = { map: tex(c, { repeat: [40, 40] }), normalMap: tex(normalFrom(c, 1.2), { srgb: false, repeat: [40, 40] }) };
  cache.set('asphalt', out); return out;
}

export function waterNormal() {
  if (cache.has('water')) return cache.get('water');
  const S = 256, c = canvas(S, S), g = c.getContext('2d'), rnd = makeRng(8);
  g.fillStyle = '#808080'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 260; i++) { const x = rnd() * S, y = rnd() * S, r = 4 + rnd() * 22; const grd = g.createRadialGradient(x, y, 0, x, y, r); grd.addColorStop(0, `rgba(255,255,255,${0.1 + rnd() * 0.15})`); grd.addColorStop(1, 'rgba(128,128,128,0)'); g.fillStyle = grd; g.fillRect(x - r, y - r, r * 2, r * 2); }
  const t = tex(normalFrom(c, 4), { srgb: false, repeat: [8, 8] });
  cache.set('water', t); return t;
}

export function fabricNormal() {
  if (cache.has('fabric')) return cache.get('fabric');
  const S = 128, c = canvas(S, S), g = c.getContext('2d');
  for (let y = 0; y < S; y++) { const v = 128 + Math.sin(y / S * Math.PI * 2 * 6) * 100; g.fillStyle = `rgb(${v},${v},${v})`; g.fillRect(0, y, S, 1); }
  const t = tex(normalFrom(c, 2), { srgb: false, repeat: [1, 1] }); cache.set('fabric', t); return t;
}

export function leatherTexture(color = '#5a1414') {
  const key = 'leather' + color; if (cache.has(key)) return cache.get(key);
  const S = 256, c = canvas(S, S), g = c.getContext('2d'), rnd = makeRng(12);
  g.fillStyle = color; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(0,0,0,${rnd() * 0.15})`; g.beginPath(); g.arc(rnd() * S, rnd() * S, rnd() * 2.2, 0, Math.PI * 2); g.fill(); }
  const out = { map: tex(c, { repeat: [2, 2] }), normalMap: tex(normalFrom(c, 1.5), { srgb: false, repeat: [2, 2] }) };
  cache.set(key, out); return out;
}

export function marbleTexture() {
  if (cache.has('marble')) return cache.get('marble');
  const S = 512, c = canvas(S, S), g = c.getContext('2d'), rnd = makeRng(21);
  g.fillStyle = '#e8e4dc'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 40; i++) { g.strokeStyle = `rgba(120,110,100,${0.05 + rnd() * 0.12})`; g.lineWidth = 0.5 + rnd() * 2.5; g.beginPath(); let x = rnd() * S, y = rnd() * S; g.moveTo(x, y); for (let k = 0; k < 20; k++) { x += (rnd() - 0.3) * 40; y += (rnd() - 0.5) * 40; g.lineTo(x, y); } g.stroke(); }
  const out = tex(c); cache.set('marble', out); return out;
}

// Dynamic canvas screens (TV & computer). Caller redraws then sets needsUpdate.
export function screenCanvas(w, h) { const c = canvas(w, h); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return { canvas: c, ctx: c.getContext('2d'), texture: t }; }
