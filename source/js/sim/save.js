// Save / load. State is plain JSON. Slots live in localStorage (when available) and can also be
// exported as a portable text code and imported again on any device.
const KEY = 'birdpresident.save.';
export const SLOTS = ['auto', 'slot1', 'slot2', 'slot3'];

function store() { try { const t = '__bp'; localStorage.setItem(t, '1'); localStorage.removeItem(t); return localStorage; } catch { return null; } }
const mem = {}; // fallback when storage is blocked

export function serialize(S) { return JSON.stringify(S, (k, v) => (typeof v === 'number' && !Number.isInteger(v) ? Math.round(v * 1e5) / 1e5 : v)); }
export function deserialize(txt) {
  const S = JSON.parse(txt);
  if (!S || !S.countries || !S.pol || !S.citizens) throw new Error('Not a Bird President save.');
  S.pending = S.pending || []; S.toasts = [];
  return S;
}

export function saveSlot(S, slot) {
  const data = serialize(S);
  const meta = { day: S.day, name: S.chars[S.player.birdId].name, country: S.countries[0].short, phase: S.pol.phase, approval: S.pol.approval, savedAt: Date.now() };
  const st = store();
  try { if (st) { st.setItem(KEY + slot, data); st.setItem(KEY + slot + '.meta', JSON.stringify(meta)); } else { mem[slot] = data; mem[slot + '.meta'] = meta; } return true; } catch (e) { return false; }
}
export function loadSlot(slot) {
  const st = store();
  const data = st ? st.getItem(KEY + slot) : mem[slot];
  return data ? deserialize(data) : null;
}
export function slotMeta(slot) {
  const st = store();
  try { const m = st ? st.getItem(KEY + slot + '.meta') : mem[slot + '.meta']; return m ? (typeof m === 'string' ? JSON.parse(m) : m) : null; } catch { return null; }
}
export function deleteSlot(slot) { const st = store(); if (st) { st.removeItem(KEY + slot); st.removeItem(KEY + slot + '.meta'); } else { delete mem[slot]; delete mem[slot + '.meta']; } }
export const storageAvailable = () => !!store();

// Portable export: compact base64 of the JSON.
export function exportCode(S) {
  const bytes = new TextEncoder().encode(serialize(S));
  let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return 'BP1:' + btoa(bin);
}
export function importCode(code) {
  const raw = code.trim().replace(/^BP1:/, '');
  const bin = atob(raw);
  const bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return deserialize(new TextDecoder().decode(bytes));
}
