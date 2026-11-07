// UI helpers: icons, modal dialogs, toasts, charts, hemicycle, escaping.
export const $ = (s, r = document) => r.querySelector(s);
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const P = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${d}</svg>`;
export const ICONS = {
  office: P('<path d="M3 21h18M5 21V10l7-5 7 5v11M9 21v-6h6v6"/>'),
  city: P('<path d="M3 21h18M5 21V8h5v13M10 21V3h6v18M16 21v-9h4v9"/>'),
  world: P('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>'),
  government: P('<path d="M3 10h18L12 4 3 10zM5 10v8M9 10v8M15 10v8M19 10v8M3 21h18"/>'),
  economy: P('<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 6-7"/>'),
  laws: P('<path d="M12 3v18M5 7h14M5 7l-2 6h4l-2-6zM19 7l-2 6h4l-2-6zM8 21h8"/>'),
  politics: P('<path d="M4 20h16M6 20V9M18 20V9M12 20V5"/><circle cx="12" cy="4" r="1.5"/>'),
  people: P('<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.5a5 5 0 0 1 6 5"/>'),
  diplomacy: P('<path d="M8 12l3 3 5-6"/><path d="M2 12l4-4 4 2 4-2 4 2 4 4-4 4-4 2-4-2-4 2z"/>'),
  military: P('<path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z"/>'),
  news: P('<rect x="3" y="4" width="15" height="16" rx="2"/><path d="M18 8h3v10a2 2 0 0 1-2 2M7 8h7M7 12h7M7 16h4"/>'),
  inbox: P('<path d="M3 13l3-8h12l3 8v6H3z"/><path d="M3 13h5l1 3h6l1-3h5"/>'),
  menu: P('<path d="M4 6h16M4 12h16M4 18h16"/>'),
  close: P('<path d="M6 6l12 12M18 6L6 18"/>'),
  pause: P('<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>'),
  play: P('<path d="M7 4l12 8-12 8z"/>'),
  ff: P('<path d="M3 5l8 7-8 7zM12 5l8 7-8 7z"/>'),
  fff: P('<path d="M2 5l6 7-6 7zM9 5l6 7-6 7zM16 5l6 7-6 7z"/>'),
  ffff: P('<path d="M1 6l5 6-5 6zM7 6l5 6-5 6zM13 6l5 6-5 6zM19 6l4 6-4 6z"/>'),
  mic: P('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>'),
  music: P('<path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/>'),
  musicOff: P('<path d="M9 18V5l11-2v8"/><circle cx="6" cy="18" r="3"/><path d="M3 3l18 18"/>'),
  alert: P('<path d="M12 3l10 18H2z"/><path d="M12 10v4M12 17v.5"/>'),
};
export const SEAL_SVG = `<svg viewBox="0 0 64 64" fill="none"><circle cx="32" cy="32" r="30" stroke="#d9b45a" stroke-width="2"/><circle cx="32" cy="32" r="23" stroke="#d9b45a" stroke-width="1"/><path d="M32 36c-4-8-10-11-18-12 4 3 6 6 7 9-3-1-6-1-8 0 5 2 9 5 12 9 2-2 5-4 7-6zM32 36c4-8 10-11 18-12-4 3-6 6-7 9 3-1 6-1 8 0-5 2-9 5-12 9-2-2-5-4-7-6z" fill="#d9b45a"/><path d="M27 30h10v8c0 3-2.5 5-5 6-2.5-1-5-3-5-6z" fill="#d9b45a"/></svg>`;

// ---------- Modal ----------
let modalResolve = null;
export function modal({ kicker = '', title = '', body = '', options = [], html = '', dismiss = true, onRender }) {
  const root = $('#modal-root');
  root.innerHTML = `<div class="modal" role="dialog" aria-modal="true"><div class="modal-head">${kicker ? `<div class="kicker">${esc(kicker)}</div>` : ''}${title ? `<h2>${esc(title)}</h2>` : ''}</div><div class="modal-body">${body ? `<p>${esc(body)}</p>` : ''}${html}${options.map((o, i) => `<button class="opt" data-i="${i}"><b>${esc(o.label)}</b>${o.hint ? `<span>${esc(o.hint)}</span>` : ''}</button>`).join('')}${dismiss ? `<div style="margin-top:14px;text-align:right"><button class="btn" data-close>Close</button></div>` : ''}</div></div>`;
  root.classList.add('on');
  return new Promise((res) => {
    modalResolve = res;
    root.onclick = (e) => {
      const b = e.target.closest('.opt'); if (b) { closeModal(); res(options[+b.dataset.i].id); return; }
      if (e.target.closest('[data-close]') || (dismiss && e.target === root)) { closeModal(); res(null); }
    };
    onRender?.(root.querySelector('.modal'), (v) => { closeModal(); res(v); });
  });
}
export function closeModal() { const r = $('#modal-root'); r.classList.remove('on'); r.innerHTML = ''; r.onclick = null; }
export const modalOpen = () => $('#modal-root').classList.contains('on');
export async function confirmBox(title, body, yes = 'Confirm') { const r = await modal({ kicker: 'Confirm', title, body, options: [{ id: 'yes', label: yes }, { id: 'no', label: 'Cancel' }], dismiss: false }); return r === 'yes'; }

// ---------- Toasts ----------
export function toast(text, cat = '', tone = 0) {
  const el = document.createElement('div'); el.className = 'toast t' + (tone > 0 ? '1' : tone < 0 ? '-1' : '0');
  el.innerHTML = (cat ? `<div class="c">${esc(cat)}</div>` : '') + esc(text);
  const box = $('#toasts'); box.appendChild(el);
  while (box.children.length > 3) box.firstChild.remove();
  setTimeout(() => { el.style.transition = 'opacity .4s'; el.style.opacity = '0'; setTimeout(() => el.remove(), 400); }, 3800);
}

// ---------- Charts (canvas, 2px lines, recessive grid, hover tooltip) ----------
function setupCanvas(cv, h) {
  const dpr = Math.min(2, window.devicePixelRatio || 1); const w = cv.clientWidth || 300;
  cv.width = w * dpr; cv.height = h * dpr; cv.style.height = h + 'px';
  const g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); return { g, w, h };
}
export function sparkline(cv, values, color = '#4c8dd6') {
  if (!cv || values.length < 2) return;
  const { g, w, h } = setupCanvas(cv, 34);
  const mn = Math.min(...values), mx = Math.max(...values), rg = mx - mn || 1;
  g.strokeStyle = color; g.lineWidth = 2; g.lineJoin = 'round'; g.beginPath();
  values.forEach((v, i) => { const x = i / (values.length - 1) * (w - 2) + 1, y = h - 3 - (v - mn) / rg * (h - 6); i ? g.lineTo(x, y) : g.moveTo(x, y); });
  g.stroke();
}
// series: [{name, color, values}], labels: x labels
export function lineChart(wrap, { series, labels, height = 170, fmt = (v) => v.toFixed(1), yMin, yMax, refLine }) {
  wrap.classList.add('chart');
  wrap.innerHTML = `<canvas></canvas><div class="tip"></div>${series.length > 1 ? `<div class="legend">${series.map((s) => `<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join('')}</div>` : ''}`;
  const cv = wrap.querySelector('canvas'), tip = wrap.querySelector('.tip');
  const n = labels.length; if (n < 2) { cv.style.height = '20px'; return; }
  const all = series.flatMap((s) => s.values);
  let mn = yMin ?? Math.min(...all), mx = yMax ?? Math.max(...all); if (mx - mn < 1e-6) { mx += 1; mn -= 1; }
  const pad = (mx - mn) * 0.08; if (yMin == null) mn -= pad; if (yMax == null) mx += pad;
  const L = 36, R = 8, T = 8, B = 20;
  function draw(hi = -1) {
    const { g, w, h } = setupCanvas(cv, height);
    const X = (i) => L + i / (n - 1) * (w - L - R), Y = (v) => T + (1 - (v - mn) / (mx - mn)) * (h - T - B);
    g.font = '10.5px "IBM Plex Mono", monospace'; g.fillStyle = '#6f7c90'; g.strokeStyle = 'rgba(148,163,184,0.12)'; g.lineWidth = 1;
    for (let k = 0; k <= 3; k++) { const v = mn + (mx - mn) * k / 3, y = Y(v); g.beginPath(); g.moveTo(L, y); g.lineTo(w - R, y); g.stroke(); g.fillText(fmt(v), 2, y + 3); }
    const step = Math.max(1, Math.ceil(n / 5)); for (let i = 0; i < n; i += step) g.fillText(labels[i], Math.min(X(i) - 12, w - 46), h - 5);
    if (refLine != null && refLine > mn && refLine < mx) { g.setLineDash([4, 4]); g.strokeStyle = 'rgba(217,180,90,0.5)'; g.beginPath(); g.moveTo(L, Y(refLine)); g.lineTo(w - R, Y(refLine)); g.stroke(); g.setLineDash([]); }
    for (const s of series) { g.strokeStyle = s.color; g.lineWidth = 2; g.lineJoin = 'round'; g.beginPath(); s.values.forEach((v, i) => (i ? g.lineTo(X(i), Y(v)) : g.moveTo(X(i), Y(v)))); g.stroke(); }
    if (hi >= 0) { g.strokeStyle = 'rgba(230,234,241,0.35)'; g.beginPath(); g.moveTo(X(hi), T); g.lineTo(X(hi), h - B); g.stroke(); for (const s of series) { g.fillStyle = s.color; g.beginPath(); g.arc(X(hi), Y(s.values[hi]), 4, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#0e1829'; g.lineWidth = 2; g.stroke(); } }
    return { X, w };
  }
  let geo = draw();
  const move = (e) => {
    const r = cv.getBoundingClientRect(); const x = e.clientX - r.left;
    const i = Math.max(0, Math.min(n - 1, Math.round((x - L) / (r.width - L - R) * (n - 1))));
    geo = draw(i); tip.style.display = 'block'; tip.style.left = geo.X(i) + 'px'; tip.style.top = '14px';
    tip.innerHTML = `<b>${esc(labels[i])}</b><br>` + series.map((s) => `<span style="color:${s.color}">■</span> ${esc(s.name)}: ${fmt(s.values[i])}`).join('<br>');
  };
  cv.addEventListener('pointermove', move); cv.addEventListener('pointerdown', move);
  cv.addEventListener('pointerleave', () => { tip.style.display = 'none'; draw(); });
}

// Horizontal bar list (magnitude), labelled directly — no colour-only identity.
export function barList(items, { max, fmt = (v) => v.toFixed(0), color = '#4c8dd6' } = {}) {
  const mx = max ?? Math.max(...items.map((i) => i.value), 1);
  return items.map((it) => `<div style="margin:7px 0"><div class="row small"><span class="grow">${esc(it.label)}</span><span class="mono">${fmt(it.value)}</span></div><div class="bar"><i style="width:${Math.max(1, it.value / mx * 100)}%;background:${it.color || color}"></i></div></div>`).join('');
}

// Parliament hemicycle (SVG): seats coloured by party, labelled in legend with seat counts.
export function hemicycle(parties, total = 200) {
  const rows = 8, seats = []; let k = 0;
  const radii = Array.from({ length: rows }, (_, r) => 40 + r * 9);
  const perRow = radii.map((r) => Math.round(Math.PI * r / (radii.reduce((a, b) => a + b, 0) * Math.PI / total)));
  let diff = total - perRow.reduce((a, b) => a + b, 0); perRow[rows - 1] += diff;
  const pos = [];
  radii.forEach((r, ri) => { for (let i = 0; i < perRow[ri]; i++) { const a = Math.PI - (i + 0.5) / perRow[ri] * Math.PI; pos.push({ a, x: 120 + Math.cos(a) * r, y: 118 - Math.sin(a) * r }); } });
  pos.sort((p, q) => q.a - p.a);
  const colors = []; for (const p of parties) for (let i = 0; i < p.seats; i++) colors.push(p.color);
  const circles = pos.map((p, i) => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.4" fill="${colors[i] || '#2a3446'}"/>`).join('');
  return `<svg viewBox="0 0 240 126" style="width:100%;max-width:420px;display:block;margin:0 auto">${circles}<line x1="120" y1="20" x2="120" y2="122" stroke="rgba(217,180,90,0.45)" stroke-dasharray="2 3"/><text x="120" y="118" text-anchor="middle" font-size="9" fill="#8d99ab" font-family="IBM Plex Mono">101 for majority</text></svg>`;
}

export function flagDataURL(colors) {
  const c = document.createElement('canvas'); c.width = 60; c.height = 40; const g = c.getContext('2d');
  g.fillStyle = colors[0]; g.fillRect(0, 0, 60, 40); g.fillStyle = colors[1]; g.fillRect(0, 14, 60, 12); g.fillStyle = colors[2]; g.fillRect(0, 17.5, 60, 5);
  g.fillStyle = colors[2]; g.beginPath(); g.arc(14, 20, 7, 0, 7); g.fill(); g.fillStyle = colors[1]; g.beginPath(); g.arc(14, 20, 4.5, 0, 7); g.fill();
  return c.toDataURL();
}
