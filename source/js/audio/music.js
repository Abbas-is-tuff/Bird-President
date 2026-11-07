// Adaptive generative soundtrack (Web Audio API, no audio files).
// A small "orchestra" — string pad, brass, piano arpeggios, bass, timpani, snare and bells — plays
// chord progressions composed on the fly. The mood follows the game: a stately anthem on the menu,
// calm governance, an upbeat campaign march, and a dark tension score during wars and crises.

const MOODS = {
  menu: { tempo: 70, root: 50, scale: 'major', prog: [[0, 'M'], [7, 'M'], [9, 'm'], [5, 'M'], [0, 'M'], [5, 'M'], [7, 'M'], [7, 'M']], pad: 'brass', arp: 0.35, perc: 'timpani', melody: 0.9, bass: 'half' },
  calm: { tempo: 64, root: 53, scale: 'major', prog: [[0, 'M7'], [9, 'm7'], [2, 'm7'], [7, 'M'], [0, 'M7'], [4, 'm7'], [5, 'M7'], [7, 'sus']], pad: 'strings', arp: 1, perc: null, melody: 0.45, bass: 'whole' },
  campaign: { tempo: 104, root: 55, scale: 'major', prog: [[0, 'M'], [5, 'M'], [9, 'm'], [7, 'M']], pad: 'brass', arp: 0.8, perc: 'march', melody: 0.75, bass: 'march' },
  tension: { tempo: 84, root: 50, scale: 'minor', prog: [[0, 'm'], [8, 'M'], [3, 'M'], [10, 'M'], [0, 'm'], [8, 'M'], [5, 'm'], [7, 'M']], pad: 'strings', arp: 0.5, perc: 'war', melody: 0.5, bass: 'pulse' },
};
const SCALES = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10] };
const CHORDS = { M: [0, 4, 7], m: [0, 3, 7], M7: [0, 4, 7, 11], m7: [0, 3, 7, 10], sus: [0, 5, 7] };
const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

export class Music {
  constructor() { this.ctx = null; this.mood = 'menu'; this.next = 'menu'; this.volume = 0.6; this.enabled = true; this.bar = 0; this.beat = 0; this.nextTime = 0; this.timer = null; this.motif = null; }

  // Must be called from a user gesture (browsers block audio until then).
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      const c = this.ctx = new AC();
      this.master = c.createGain(); this.master.gain.value = 0;
      const comp = c.createDynamicsCompressor(); comp.threshold.value = -18; comp.ratio.value = 3;
      this.master.connect(comp); comp.connect(c.destination);
      this.reverb = c.createConvolver(); this.reverb.buffer = this.impulse(3.2);
      this.wet = c.createGain(); this.wet.gain.value = 0.38; this.reverb.connect(this.wet); this.wet.connect(this.master);
      this.dry = c.createGain(); this.dry.gain.value = 0.8; this.dry.connect(this.master);
      this.noise = this.noiseBuffer();
      this.nextTime = c.currentTime + 0.1;
      this.timer = setInterval(() => this.schedule(), 90);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    this.applyVolume();
  }
  setEnabled(on) { this.enabled = on; this.applyVolume(); }
  setVolume(v) { this.volume = v; this.applyVolume(); }
  applyVolume() { if (!this.ctx) return; const t = this.ctx.currentTime; this.master.gain.cancelScheduledValues(t); this.master.gain.setTargetAtTime(this.enabled ? this.volume * 0.55 : 0, t, 0.4); }
  setMood(m) { if (MOODS[m]) this.next = m; }

  impulse(sec) {
    const c = this.ctx, len = Math.floor(c.sampleRate * sec), buf = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = buf.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    return buf;
  }
  noiseBuffer() { const c = this.ctx, b = c.createBuffer(1, c.sampleRate, c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; }
  out(node, wet = 0.5) { const g = this.ctx.createGain(); g.gain.value = 1; node.connect(this.dry); const s = this.ctx.createGain(); s.gain.value = wet; node.connect(s); s.connect(this.reverb); }

  // ---------- instruments ----------
  strings(freqs, t, dur, vol = 0.05) {
    const c = this.ctx, f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1400; f.Q.value = 0.4;
    const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + dur * 0.35); g.gain.setValueAtTime(vol, t + dur * 0.7); g.gain.linearRampToValueAtTime(0, t + dur + 0.8);
    f.connect(g); this.out(g, 0.7);
    for (const fr of freqs) for (const det of [-7, 6]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = fr; o.detune.value = det; const lfo = c.createOscillator(), lg = c.createGain(); lfo.frequency.value = 4.6 + Math.random(); lg.gain.value = 4; lfo.connect(lg); lg.connect(o.detune); o.connect(f); o.start(t); o.stop(t + dur + 1); lfo.start(t); lfo.stop(t + dur + 1); }
  }
  brass(freqs, t, dur, vol = 0.045) {
    const c = this.ctx, f = c.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 1.2;
    f.frequency.setValueAtTime(300, t); f.frequency.linearRampToValueAtTime(1900, t + 0.18); f.frequency.exponentialRampToValueAtTime(900, t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.12); g.gain.setTargetAtTime(vol * 0.75, t + 0.2, 0.3); g.gain.linearRampToValueAtTime(0, t + dur + 0.5);
    f.connect(g); this.out(g, 0.55);
    for (const fr of freqs) for (const det of [-5, 5]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = fr; o.detune.value = det; o.connect(f); o.start(t); o.stop(t + dur + 0.6); }
  }
  piano(fr, t, vol = 0.07, len = 1.6) {
    const c = this.ctx, g = c.createGain(), f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2600;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(vol * 0.25, t + 0.4); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    f.connect(g); this.out(g, 0.45);
    for (const [mul, a, type] of [[1, 1, 'triangle'], [2, 0.35, 'sine'], [3, 0.12, 'sine']]) { const o = c.createOscillator(), og = c.createGain(); o.type = type; o.frequency.value = fr * mul; og.gain.value = a; o.connect(og); og.connect(f); o.start(t); o.stop(t + len + 0.05); }
  }
  bass(fr, t, dur, vol = 0.12) {
    const c = this.ctx, o = c.createOscillator(), o2 = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter();
    o.type = 'sine'; o2.type = 'triangle'; o.frequency.value = fr; o2.frequency.value = fr; f.type = 'lowpass'; f.frequency.value = 500;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(vol * 0.5, t + dur * 0.6); g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(f); o2.connect(f); f.connect(g); this.out(g, 0.15); o.start(t); o2.start(t); o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
  }
  timpani(fr, t, vol = 0.22) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(fr * 1.5, t); o.frequency.exponentialRampToValueAtTime(fr, t + 0.08);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
    o.connect(g); this.out(g, 0.6); o.start(t); o.stop(t + 1.5);
    this.noiseHit(t, 0.05, 300, 0.12);
  }
  noiseHit(t, vol, freq, len, type = 'lowpass') {
    const c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    s.buffer = this.noise; f.type = type; f.frequency.value = freq; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    s.connect(f); f.connect(g); this.out(g, 0.35); s.start(t, Math.random() * 0.5); s.stop(t + len + 0.02);
  }
  snare(t, vol = 0.07) { this.noiseHit(t, vol, 1800, 0.16, 'bandpass'); }
  bell(fr, t, vol = 0.05) {
    const c = this.ctx;
    for (const [mul, a, d] of [[1, 1, 2.5], [2.76, 0.4, 1.4], [5.4, 0.2, 0.7]]) { const o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.value = fr * mul; g.gain.setValueAtTime(vol * a, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(g); this.out(g, 0.7); o.start(t); o.stop(t + d + 0.05); }
  }

  // ---------- composition ----------
  makeMotif(M) {
    // a 4-note motif in scale degrees, reused with variations so melodies feel composed rather than random
    const sc = SCALES[M.scale], m = [];
    let d = [0, 2, 4][Math.floor(Math.random() * 3)];
    for (let i = 0; i < 4; i++) { m.push(d); d += [-1, 1, 1, 2, -2][Math.floor(Math.random() * 5)]; d = Math.max(-2, Math.min(7, d)); }
    return m;
  }
  schedule() {
    const c = this.ctx; if (!c || c.state !== 'running') return;
    while (this.nextTime < c.currentTime + 0.4) { this.playBeat(this.nextTime); const M = MOODS[this.mood]; this.nextTime += 60 / M.tempo; }
  }
  playBeat(t) {
    if (this.beat === 0 && this.next !== this.mood) { this.mood = this.next; this.bar = 0; this.motif = null; }
    const M = MOODS[this.mood], spb = 60 / M.tempo, sc = SCALES[M.scale];
    const [deg, q] = M.prog[this.bar % M.prog.length];
    const root = M.root + deg, chord = CHORDS[q].map((i) => root + i);
    if (!this.motif || (this.bar % 8 === 0 && this.beat === 0)) this.motif = this.makeMotif(M);
    const b = this.beat;
    // pad on the downbeat, lasting the bar
    if (b === 0) { const f = chord.map((n) => hz(n + 12)); M.pad === 'brass' ? this.brass(f, t, spb * 3.8) : this.strings(f, t, spb * 4); }
    // bass
    if (M.bass === 'whole' && b === 0) this.bass(hz(root - 12), t, spb * 3.8);
    if (M.bass === 'half' && (b === 0 || b === 2)) this.bass(hz(root - 12), t, spb * 1.9);
    if (M.bass === 'march') this.bass(hz(root - 12 + (b % 2 ? 7 : 0)), t, spb * 0.9, 0.1);
    if (M.bass === 'pulse') for (let k = 0; k < 2; k++) this.bass(hz(root - 12), t + k * spb / 2, spb * 0.45, 0.09);
    // piano arpeggio in 8ths
    if (Math.random() < M.arp) {
      for (let k = 0; k < 2; k++) {
        const idx = (b * 2 + k) % (chord.length + 1);
        const n = idx < chord.length ? chord[idx] + 12 : chord[0] + 24;
        if (Math.random() < 0.85) this.piano(hz(n), t + k * spb / 2 + (Math.random() - 0.5) * 0.01, 0.045 + Math.random() * 0.02);
      }
    }
    // melody: motif across bars 2 and 4 of each phrase, answered by a variation
    const phraseBar = this.bar % 4;
    if ((phraseBar === 1 || phraseBar === 3) && Math.random() < M.melody + 0.3 && b < this.motif.length) {
      let d = this.motif[b] + (phraseBar === 3 ? (b === 3 ? -this.motif[b] : 1) : 0); // answer resolves to the tonic
      const oct = Math.floor(d / 7), n = M.root + 24 + sc[((d % 7) + 7) % 7] + oct * 12;
      if (M.pad === 'brass' && this.mood !== 'calm') this.brass([hz(n)], t, spb * 0.9, 0.035); else this.piano(hz(n), t, 0.08, 2.2);
    }
    // percussion
    if (M.perc === 'timpani' && b === 0 && this.bar % 2 === 0) this.timpani(hz(M.root - 12), t);
    if (M.perc === 'march') { this.snare(t + spb / 2, 0.05); if (b === 3) { this.snare(t + spb * 0.75, 0.04); } if (b === 0) this.timpani(hz(root - 12), t, 0.12); }
    if (M.perc === 'war') { if (b === 0 || b === 2) this.timpani(hz(M.root - 12), t, b === 0 ? 0.22 : 0.12); if (b === 3) this.snare(t + spb / 2, 0.04); }
    if (this.mood === 'calm' && b === 0 && this.bar % 8 === 7) this.bell(hz(M.root + 24), t, 0.03);
    this.beat = (this.beat + 1) % 4; if (this.beat === 0) this.bar++;
  }

  // ---------- one-shot cues ----------
  sting(kind) {
    if (!this.ctx || !this.enabled || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime + 0.05;
    if (kind === 'win') [0, 4, 7, 12].forEach((i, k) => this.brass([hz(62 + i), hz(50 + i)], t + k * 0.22, k === 3 ? 2.2 : 0.3, 0.06));
    if (kind === 'lose') [0, -2, -5, -9].forEach((i, k) => this.strings([hz(62 + i), hz(55 + i)], t + k * 0.45, 0.8, 0.05));
    if (kind === 'event') { this.timpani(hz(38), t, 0.2); this.bell(hz(74), t + 0.05, 0.04); }
    if (kind === 'war') { this.timpani(hz(33), t, 0.3); this.timpani(hz(33), t + 0.35, 0.22); this.brass([hz(50), hz(53), hz(57)], t + 0.1, 1.6, 0.05); }
    if (kind === 'law') { this.bell(hz(79), t, 0.04); this.bell(hz(86), t + 0.12, 0.035); }
  }
}

export const music = new Music();
