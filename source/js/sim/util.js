// Shared helpers: math, RNG, formatting, dates. Pure — no DOM.
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const sum = (arr) => arr.reduce((a, b) => a + b, 0);
export const avg = (arr) => (arr.length ? sum(arr) / arr.length : 0);

// ---- Seeded RNG stored inside the game state so saves are reproducible ----
export function rand(S) {
  S.rng = (S.rng + 0x6D2B79F5) >>> 0;
  let t = S.rng;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export const randRange = (S, a, b) => a + rand(S) * (b - a);
export const randInt = (S, a, b) => Math.floor(randRange(S, a, b + 1));
export const chance = (S, p) => rand(S) < p;
export const pick = (S, arr) => arr[Math.floor(rand(S) * arr.length)];
export function gauss(S) {
  const u = Math.max(1e-9, rand(S)), v = rand(S);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
export function weightedPick(S, items, wfn) {
  const ws = items.map(wfn);
  const tot = sum(ws);
  if (tot <= 0) return null;
  let r = rand(S) * tot;
  for (let i = 0; i < items.length; i++) { r -= ws[i]; if (r <= 0) return items[i]; }
  return items[items.length - 1];
}
// Standalone RNG (map generation, rendering) – not saved.
export function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- Calendar ----
const EPOCH = Date.UTC(2027, 0, 1);
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const dayDate = (day) => new Date(EPOCH + day * 86400000);
export function fmtDate(day, long = false) {
  const d = dayDate(day);
  return long
    ? `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`
    : `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}
export const monthLabel = (day) => { const d = dayDate(day); return `${MONTHS[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(2)}`; };
export const isMonthStart = (day) => dayDate(day).getUTCDate() === 1;
export const yearOf = (day) => dayDate(day).getUTCFullYear();
export const monthOf = (day) => dayDate(day).getUTCMonth();

// ---- Formatting ----
export function fmtMoney(b) {
  const a = Math.abs(b), s = b < 0 ? '−' : '';
  if (a >= 1000) return `${s}℗${(a / 1000).toFixed(2)}T`;
  if (a >= 1) return `${s}℗${a.toFixed(1)}B`;
  return `${s}℗${(a * 1000).toFixed(0)}M`;
}
export const pct = (v, d = 1) => `${v.toFixed(d)}%`;
export const signed = (v, d = 1) => `${v >= 0 ? '+' : ''}${v.toFixed(d)}`;
export const fmtPop = (m) => (m >= 1 ? `${m.toFixed(1)}M` : `${(m * 1000).toFixed(0)}K`);
