// Deterministic world generation: elevation grid + country ownership + disputed regions.
// Pure function of the seed, so the map is regenerated on load instead of being saved.
import { makeRng } from './util.js';
import { COUNTRIES } from './data.js';

export const MAP_W = 200, MAP_H = 124;

function makeNoise(seed) {
  const rnd = makeRng(seed);
  const p = new Uint8Array(512);
  const perm = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
  for (let i = 0; i < 512; i++) p[i] = perm[i & 255];
  const grad = (h, x, y) => { const g = h & 7; const u = g < 4 ? x : y, v = g < 4 ? y : x; return ((g & 1) ? -u : u) + ((g & 2) ? -2 * v : 2 * v); };
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  function n2(x, y) {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
    x -= Math.floor(x); y -= Math.floor(y);
    const u = fade(x), v = fade(y);
    const a = p[X] + Y, b = p[X + 1] + Y;
    const l1 = grad(p[a], x, y) + u * (grad(p[b], x - 1, y) - grad(p[a], x, y));
    const l2 = grad(p[a + 1], x, y - 1) + u * (grad(p[b + 1], x - 1, y - 1) - grad(p[a + 1], x, y - 1));
    return (l1 + v * (l2 - l1)) * 0.25;
  }
  return (x, y, oct = 5) => { let s = 0, a = 1, f = 1, n = 0; for (let i = 0; i < oct; i++) { s += a * n2(x * f, y * f); n += a; a *= 0.5; f *= 2; } return s / n; };
}

export function generateWorld(seed = 1337) {
  const W = MAP_W, H = MAP_H, N = W * H;
  const fbm = makeNoise(seed), fbm2 = makeNoise(seed + 77);
  const elev = new Float32Array(N);
  const seeds = COUNTRIES.map((c) => [c.pos[0] * W, c.pos[1] * H]);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const nx = x / W, ny = y / H;
    let e = fbm(nx * 4.2, ny * 4.2) * 0.9 + fbm2(nx * 11, ny * 11, 3) * 0.25;
    // main continent mass
    const dx = (nx - 0.52) / 0.42, dy = (ny - 0.5) / 0.4;
    e += 0.48 - Math.pow(dx * dx + dy * dy, 1.3) * 0.62;
    // guarantee land around each capital
    COUNTRIES.forEach((c, i) => {
      const sx = seeds[i][0] / W, sy = seeds[i][1] / H;
      const d2 = ((nx - sx) ** 2 + (ny - sy) ** 2) / (c.island ? 0.004 : 0.012);
      e += Math.exp(-d2) * (c.island ? 0.55 : 0.32);
    });
    if (COUNTRIES.find((c) => c.island)) {
      const isl = COUNTRIES.find((c) => c.island).pos;
      const d = Math.hypot(nx - isl[0], ny - isl[1]);
      if (d > 0.06 && d < 0.13) e -= 0.35 * Math.sin(((d - 0.06) / 0.07) * Math.PI); // ocean moat around island
    }
    const edge = Math.min(nx, 1 - nx, ny, 1 - ny);
    if (edge < 0.08) e -= (0.08 - edge) * 6;
    elev[y * W + x] = e;
  }
  const SEA = 0.0;
  const land = new Uint8Array(N);
  for (let i = 0; i < N; i++) land[i] = elev[i] > SEA ? 1 : 0;

  // Multi-source Dijkstra for organic borders.
  const owner = new Int8Array(N).fill(-1);
  const cost = new Float32Array(N).fill(Infinity);
  const heap = [];
  const push = (c, i, o) => { heap.push([c, i, o]); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
  COUNTRIES.forEach((c, o) => { const i = Math.round(seeds[o][1]) * W + Math.round(seeds[o][0]); land[i] = 1; cost[i] = 0; push(0, i, o); });
  while (heap.length) {
    const [cst, i, o] = pop();
    if (cst > cost[i] || owner[i] !== -1) { if (owner[i] !== -1) continue; }
    owner[i] = o;
    const x = i % W, y = (i / W) | 0;
    const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const [ax, ay] of nb) {
      const nx = x + ax, ny = y + ay;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const j = ny * W + nx;
      if (!land[j] || owner[j] !== -1) continue;
      const rough = 1 + Math.abs(fbm2(nx / 9, ny / 9, 2)) * 3 + Math.max(0, elev[j] - 0.35) * 6;
      const nc = cst + rough / COUNTRIES[o].size;
      if (nc < cost[j]) { cost[j] = nc; push(nc, j, o); }
    }
  }
  // Disputed regions along specific borders
  const disputeDefs = [
    { id: 'featherridge', name: 'Feather Ridge', a: 0, b: 1 },
    { id: 'talonpass', name: 'Talon Pass', a: 3, b: 4 },
    { id: 'coralshoals', name: 'Reedwater Delta', a: 2, b: 7 },
  ];
  const disputes = disputeDefs.map((d) => {
    const border = [];
    for (let i = 0; i < N; i++) {
      if (owner[i] !== d.a) continue;
      const x = i % W, y = (i / W) | 0;
      for (const [ax, ay] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const j = (y + ay) * W + (x + ax);
        if (owner[j] === d.b) { border.push(i); break; }
      }
    }
    if (!border.length) return { ...d, cells: [], center: [0, 0] };
    const mid = border[Math.floor(border.length / 2)];
    const mx = mid % W, my = (mid / W) | 0;
    const cells = [];
    for (let i = 0; i < N; i++) {
      if (owner[i] !== d.a && owner[i] !== d.b) continue;
      const x = i % W, y = (i / W) | 0;
      if (Math.hypot(x - mx, y - my) < 7.5) cells.push(i);
    }
    return { ...d, cells, center: [mx, my], originalOwner: cells.map((i) => owner[i]) };
  });
  return { W, H, elev, land, owner, disputes, seeds };
}
