// Instrument library on top of an OfflineAudioContext. Everything is seeded/deterministic.
import { rng } from '../lib/util.js';

export const midi = n => 440 * Math.pow(2, (n - 69) / 12);

export function softClip(k = 2, n = 2048) {
  const c = new Float32Array(n);
  for (let i = 0; i < n; i++) { const x = (i / (n - 1)) * 2 - 1; c[i] = Math.tanh(k * x) / Math.tanh(k); }
  return c;
}

export class Synth {
  constructor(ctx, seed = 1) {
    this.ctx = ctx;
    this.R = rng(seed);
    const SR = ctx.sampleRate;
    // shared noise buffers (stereo, decorrelated)
    const len = Math.ceil(SR * 12);
    this.white = ctx.createBuffer(2, len, SR);
    this.brown = ctx.createBuffer(2, len, SR);
    for (let ch = 0; ch < 2; ch++) {
      const w = this.white.getChannelData(ch), b = this.brown.getChannelData(ch);
      let last = 0;
      for (let i = 0; i < len; i++) {
        const v = this.R() * 2 - 1;
        w[i] = v;
        last = (last + 0.02 * v) / 1.02;
        b[i] = last * 3.5;
      }
    }
    // master: bus -> compressor -> soft clip -> out
    this.bus = ctx.createGain(); this.bus.gain.value = 0.8;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 32; hp.Q.value = 0.8;
    const ls = ctx.createBiquadFilter(); ls.type = 'lowshelf'; ls.frequency.value = 100; ls.gain.value = -5;
    const pr = ctx.createBiquadFilter(); pr.type = 'peaking'; pr.frequency.value = 3200; pr.Q.value = 0.8; pr.gain.value = 3;
    const air = ctx.createBiquadFilter(); air.type = 'highshelf'; air.frequency.value = 9000; air.gain.value = 3;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.knee.value = 10; comp.ratio.value = 3.5; comp.attack.value = 0.004; comp.release.value = 0.14;
    const clip = ctx.createWaveShaper(); clip.curve = softClip(1.6); clip.oversample = '4x';
    this.bus.connect(hp); hp.connect(ls); ls.connect(pr); pr.connect(air); air.connect(comp); comp.connect(clip); clip.connect(ctx.destination);
    // reverb
    this.rev = ctx.createConvolver();
    this.rev.buffer = this.impulse(2.4, 2.6);
    const rg = ctx.createGain(); rg.gain.value = 0.55;
    this.rev.connect(rg); rg.connect(this.bus);
    // slapback delay for pings
    this.dly = ctx.createDelay(1); this.dly.delayTime.value = 0.145;
    const fb = ctx.createGain(); fb.gain.value = 0.32;
    const dlp = ctx.createBiquadFilter(); dlp.type = 'lowpass'; dlp.frequency.value = 3500;
    this.dly.connect(dlp); dlp.connect(fb); fb.connect(this.dly); dlp.connect(this.bus);
    this.clipCurve = softClip(3);
  }

  impulse(dur, decay) {
    const ctx = this.ctx, SR = ctx.sampleRate, n = Math.ceil(SR * dur);
    const b = ctx.createBuffer(2, n, SR);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      for (let i = 0; i < n; i++) d[i] = (this.R() * 2 - 1) * Math.pow(1 - i / n, decay) * (i < SR * 0.01 ? i / (SR * 0.01) : 1);
    }
    return b;
  }

  // output node: gain -> (pan) -> bus (+ reverb/delay sends)
  out(g = 1, { pan = 0, rev = 0, dly = 0 } = {}) {
    const ctx = this.ctx;
    const gn = ctx.createGain(); gn.gain.value = g;
    let node = gn;
    if (pan) { const p = ctx.createStereoPanner(); p.pan.value = pan; gn.connect(p); node = p; }
    node.connect(this.bus);
    if (rev) { const s = ctx.createGain(); s.gain.value = rev; node.connect(s); s.connect(this.rev); }
    if (dly) { const s = ctx.createGain(); s.gain.value = dly; node.connect(s); s.connect(this.dly); }
    return gn;
  }

  env(param, t, a, d, peak = 1, hold = 0) {
    param.setValueAtTime(0.0001, t);
    param.exponentialRampToValueAtTime(peak, t + Math.max(a, 0.001));
    if (hold) param.setValueAtTime(peak, t + a + hold);
    param.exponentialRampToValueAtTime(0.0001, t + a + hold + d);
  }

  noise(t, dur, dest, { brown = false } = {}) {
    const s = this.ctx.createBufferSource();
    s.buffer = brown ? this.brown : this.white;
    s.connect(dest);
    s.start(t, this.R() * 8, dur + 0.05);
    return s;
  }

  filter(type, f, q = 0.7) {
    const b = this.ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; return b;
  }

  shaper(k = 3) { const w = this.ctx.createWaveShaper(); w.curve = softClip(k); w.oversample = '2x'; return w; }

  osc(type, f, t, dur, dest) {
    const o = this.ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t);
    o.connect(dest); o.start(t); o.stop(t + dur + 0.05);
    return o;
  }

  // ---------- drums
  kick(t, g = 1, { f0 = 180, f1 = 50, d = 0.3 } = {}) {
    const a = this.ctx.createGain();
    const sh = this.shaper(2.2);
    a.connect(sh); sh.connect(this.out(g));
    const o = this.osc('sine', f0, t, d, a);
    o.frequency.exponentialRampToValueAtTime(f1, t + 0.085);
    this.env(a.gain, t, 0.002, d, 1);
    const c = this.ctx.createGain(); const hp = this.filter('highpass', 2500);
    c.connect(hp); hp.connect(this.out(g * 0.6));
    this.noise(t, 0.02, c); this.env(c.gain, t, 0.001, 0.012, 1);
  }

  snare(t, g = 1, { tone = 190, d = 0.2, rev = 0.25 } = {}) {
    const n = this.ctx.createGain(); const bp = this.filter('bandpass', 1900, 0.6); const hp = this.filter('highpass', 350);
    n.connect(bp); bp.connect(hp); hp.connect(this.out(g, { rev }));
    this.noise(t, d + 0.05, n); this.env(n.gain, t, 0.001, d, 1);
    const b = this.ctx.createGain(); b.connect(this.out(g * 0.6));
    const o = this.osc('triangle', tone, t, 0.12, b); o.frequency.exponentialRampToValueAtTime(tone * 0.75, t + 0.08);
    this.env(b.gain, t, 0.001, 0.09, 1);
  }

  clap(t, g = 1, rev = 0.3) {
    const n = this.ctx.createGain(); const bp = this.filter('bandpass', 1300, 1.1); const hp = this.filter('highpass', 600);
    n.connect(bp); bp.connect(hp); hp.connect(this.out(g * 1.5, { rev }));
    this.noise(t, 0.35, n);
    n.gain.setValueAtTime(0.0001, t);
    [0, 0.011, 0.022].forEach(o => { n.gain.setValueAtTime(1, t + o); n.gain.exponentialRampToValueAtTime(0.08, t + o + 0.009); });
    n.gain.setValueAtTime(0.9, t + 0.031);
    n.gain.exponentialRampToValueAtTime(0.0001, t + 0.23);
  }

  hat(t, g = 0.2, open = false, pan = 0) {
    const n = this.ctx.createGain(); const hp = this.filter('highpass', open ? 6500 : 8000); const pk = this.filter('peaking', 10000, 1); pk.gain.value = 6;
    n.connect(hp); hp.connect(pk); pk.connect(this.out(g * 1.6, { pan }));
    this.noise(t, open ? 0.3 : 0.06, n); this.env(n.gain, t, 0.001, open ? 0.22 : 0.035, 1);
  }

  // ---------- bass & tones
  sub808(t, f, dur, g = 1) {
    const a = this.ctx.createGain(); const sh = this.shaper(4.5); const lp = this.filter('lowpass', 1600);
    a.connect(sh); sh.connect(lp); lp.connect(this.out(g * 0.55));
    const o = this.osc('sine', f * 2.2, t, dur, a);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.035);
    a.gain.setValueAtTime(0.0001, t);
    a.gain.exponentialRampToValueAtTime(0.9, t + 0.004);
    a.gain.setValueAtTime(0.9, t + dur * 0.35);
    a.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }

  stab(t, notes, g = 0.25, d = 0.2, { rev = 0.3, cutoff = 4200 } = {}) {
    const a = this.ctx.createGain(); const lp = this.filter('lowpass', cutoff, 3);
    lp.frequency.setValueAtTime(cutoff, t); lp.frequency.exponentialRampToValueAtTime(500, t + d);
    a.connect(lp); lp.connect(this.out(g * 1.8, { rev }));
    notes.forEach((n, i) => {
      ['sawtooth', 'square'].forEach((type, k) => {
        const o = this.osc(type, midi(n) * (k ? 1.004 : 0.997), t, d + 0.05, a);
        o.detune.value = (i - 1) * 3;
      });
    });
    this.env(a.gain, t, 0.003, d, 0.35);
  }

  braam(t, dur, g = 0.5) {
    const a = this.ctx.createGain(); const lp = this.filter('lowpass', 150, 5); const sh = this.shaper(2.5);
    lp.frequency.setValueAtTime(200, t); lp.frequency.exponentialRampToValueAtTime(3200, t + 0.07); lp.frequency.exponentialRampToValueAtTime(600, t + dur);
    a.connect(lp); lp.connect(sh); sh.connect(this.out(g, { rev: 0.45 }));
    [41, 48, 53, 56, 60].forEach(n => [-9, 0, 9].forEach(c => {
      const o = this.osc('sawtooth', midi(n), t, dur + 0.1, a); o.detune.value = c;
    }));
    a.gain.setValueAtTime(0.0001, t); a.gain.exponentialRampToValueAtTime(0.16, t + 0.03);
    a.gain.setValueAtTime(0.16, t + dur * 0.4); a.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }

  metal(t, g = 0.3, d = 0.9) {
    const a = this.ctx.createGain(); a.connect(this.out(g, { rev: 0.5 }));
    [183, 287, 394, 541, 733].forEach((f, i) => this.osc('sine', f, t, d, a));
    this.env(a.gain, t, 0.002, d, 0.4);
  }

  // ---------- fx
  impact(t, g = 1) {
    const a = this.ctx.createGain(); const sh = this.shaper(2.5);
    a.connect(sh); sh.connect(this.out(g * 0.6));
    const o = this.osc('sine', 120, t, 1.6, a); o.frequency.exponentialRampToValueAtTime(27, t + 1.1);
    this.env(a.gain, t, 0.003, 1.5, 1);
    const n = this.ctx.createGain(); const lp = this.filter('lowpass', 12000, 0.8);
    lp.frequency.setValueAtTime(12000, t); lp.frequency.exponentialRampToValueAtTime(260, t + 1.2);
    n.connect(lp); lp.connect(this.out(g * 0.8, { rev: 0.6 }));
    this.noise(t, 1.6, n); this.env(n.gain, t, 0.002, 1.4, 1);
    this.kick(t, g * 0.9, { f0: 200, f1: 40, d: 0.6 });
    this.metal(t, g * 0.22, 1.0);
  }

  whoosh(t, dur, g = 0.4, { f0 = 400, f1 = 4000, pan0 = -0.7, pan1 = 0.7, peak = 0.7 } = {}) {
    const n = this.ctx.createGain(); const bp = this.filter('bandpass', f0, 1.3);
    bp.frequency.setValueAtTime(f0, t); bp.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const p = this.ctx.createStereoPanner(); p.pan.setValueAtTime(pan0, t); p.pan.linearRampToValueAtTime(pan1, t + dur);
    n.connect(bp); bp.connect(p); p.connect(this.out(g, { rev: 0.2 }));
    this.noise(t, dur, n);
    n.gain.setValueAtTime(0.0001, t); n.gain.exponentialRampToValueAtTime(1, t + dur * peak); n.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }

  swell(t0, t1, g = 0.4, { hp = 3500, brown = false } = {}) {
    const n = this.ctx.createGain(); const f = this.filter('highpass', hp);
    n.connect(f); f.connect(this.out(g, { rev: 0.2 }));
    this.noise(t0, t1 - t0, n, { brown });
    n.gain.setValueAtTime(0.0001, t0); n.gain.exponentialRampToValueAtTime(1, t1 - 0.005); n.gain.linearRampToValueAtTime(0.0001, t1);
  }

  riser(t0, t1, g = 0.3) {
    const a = this.ctx.createGain(); const lp = this.filter('lowpass', 400, 2);
    lp.frequency.setValueAtTime(400, t0); lp.frequency.exponentialRampToValueAtTime(7000, t1);
    a.connect(lp); lp.connect(this.out(g, { rev: 0.25 }));
    [53, 60, 65, 72].forEach((n, i) => {
      const o = this.osc('sawtooth', midi(n), t0, t1 - t0, a); o.frequency.exponentialRampToValueAtTime(midi(n) * 4, t1); o.detune.value = i * 4 - 6;
    });
    a.gain.setValueAtTime(0.0001, t0); a.gain.exponentialRampToValueAtTime(0.18, t1 - 0.01); a.gain.linearRampToValueAtTime(0.0001, t1);
    const n = this.ctx.createGain(); const hp = this.filter('highpass', 300);
    hp.frequency.setValueAtTime(300, t0); hp.frequency.exponentialRampToValueAtTime(9000, t1);
    n.connect(hp); hp.connect(this.out(g * 0.9));
    this.noise(t0, t1 - t0, n);
    n.gain.setValueAtTime(0.0001, t0); n.gain.exponentialRampToValueAtTime(0.9, t1 - 0.01); n.gain.linearRampToValueAtTime(0.0001, t1);
  }

  ping(t, f = 1320, g = 0.18, pan = 0) {
    const a = this.ctx.createGain(); a.connect(this.out(g * 1.5, { pan, rev: 0.3, dly: 0.6 }));
    this.osc('sine', f, t, 0.4, a); this.osc('sine', f * 2.01, t, 0.15, a);
    this.env(a.gain, t, 0.002, 0.32, 1);
  }

  blip(t, f = 2400, g = 0.08, d = 0.03, type = 'square', pan = 0) {
    const a = this.ctx.createGain(); const lp = this.filter('lowpass', 6000);
    a.connect(lp); lp.connect(this.out(g, { pan }));
    this.osc(type, f, t, d, a); this.env(a.gain, t, 0.001, d, 1);
  }

  clicks(t0, t1, rate = 28, g = 0.12) {
    let t = t0;
    while (t < t1) {
      const a = this.ctx.createGain(); const bp = this.filter('bandpass', 2500 + this.R() * 2500, 2);
      a.connect(bp); bp.connect(this.out(g * (0.5 + this.R() * 0.5), { pan: this.R() * 0.6 - 0.3 }));
      this.noise(t, 0.01, a); this.env(a.gain, t, 0.0005, 0.006, 1);
      t += (0.4 + this.R() * 1.2) / rate;
    }
  }

  rumble(t0, t1, g = 0.5, rate = 13) {
    const a = this.ctx.createGain(); const lp = this.filter('lowpass', 380, 1.2); const hp2 = this.filter('highpass', 55);
    a.connect(hp2); hp2.connect(lp); lp.connect(this.out(g * 0.6));
    this.noise(t0, t1 - t0, a, { brown: true });
    const growl = this.ctx.createGain(); const glp = this.filter('lowpass', 420, 2); const sh = this.shaper(2);
    growl.connect(glp); glp.connect(sh); sh.connect(a);
    this.osc('sawtooth', midi(41), t0, t1 - t0, growl); this.osc('sawtooth', midi(41) * 1.012, t0, t1 - t0, growl);
    growl.gain.value = 0.5; glp.frequency.value = 900;
    a.gain.setValueAtTime(0.0001, t0); a.gain.exponentialRampToValueAtTime(0.7, t0 + 0.25);
    a.gain.setValueAtTime(0.7, t1 - 0.15); a.gain.exponentialRampToValueAtTime(0.0001, t1);
    const lfo = this.ctx.createOscillator(); lfo.frequency.value = rate;
    const depth = this.ctx.createGain(); depth.gain.value = 0.45;
    lfo.connect(depth); depth.connect(a.gain); lfo.start(t0); lfo.stop(t1);
  }

  thunder(t, g = 0.6, dur = 1.8) {
    const c = this.ctx.createGain(); const hp = this.filter('highpass', 1200);
    c.connect(hp); hp.connect(this.out(g * 0.8, { rev: 0.4 }));
    this.noise(t, 0.12, c); this.env(c.gain, t, 0.001, 0.09, 1);
    const r = this.ctx.createGain(); const lp = this.filter('lowpass', 320, 0.9);
    r.connect(lp); lp.connect(this.out(g * 0.9, { rev: 0.35 }));
    this.noise(t, dur, r, { brown: true });
    r.gain.setValueAtTime(0.0001, t);
    let tt = t + 0.03, lvl = 1;
    r.gain.exponentialRampToValueAtTime(1, tt);
    while (tt < t + dur - 0.1) { tt += 0.05 + this.R() * 0.08; lvl *= 0.86; r.gain.linearRampToValueAtTime(lvl * (0.5 + this.R() * 0.5) + 0.0002, tt); }
    r.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }

  glitch(t0, t1, g = 0.2) {
    const step = 1 / 60;
    for (let t = t0; t < t1; t += step) {
      const r = this.R();
      if (r < 0.45) this.blip(t, 150 + Math.pow(this.R(), 2) * 4500, g, step * (1 + Math.floor(this.R() * 2)), 'square', this.R() * 1.4 - 0.7);
      else if (r < 0.8) {
        const a = this.ctx.createGain(); const bp = this.filter('bandpass', 400 + this.R() * 6000, 3);
        a.connect(bp); bp.connect(this.out(g * 1.8, { pan: this.R() * 1.4 - 0.7 }));
        this.noise(t, step, a); a.gain.setValueAtTime(1, t); a.gain.setValueAtTime(0, t + step * 0.9);
      }
    }
  }

  marker(t0, t1, g = 0.15) {
    const a = this.ctx.createGain(); const bp = this.filter('bandpass', 3200, 4);
    a.connect(bp); bp.connect(this.out(g, { pan: 0.2 }));
    this.noise(t0, t1 - t0, a);
    a.gain.setValueAtTime(0.0001, t0);
    for (let t = t0; t < t1; t += 0.012) {
      a.gain.linearRampToValueAtTime(0.25 + this.R() * 0.75, t + 0.006);
      bp.frequency.setValueAtTime(2400 + this.R() * 2200, t);
    }
    a.gain.linearRampToValueAtTime(0.0001, t1 + 0.01);
  }

  stamp(t, g = 0.8) {
    this.kick(t, g, { f0: 140, f1: 55, d: 0.22 });
    const n = this.ctx.createGain(); const lp = this.filter('lowpass', 1600);
    n.connect(lp); lp.connect(this.out(g * 0.8, { rev: 0.3 }));
    this.noise(t, 0.12, n); this.env(n.gain, t, 0.001, 0.09, 1);
    this.clap(t + 0.004, g * 0.35, 0.2);
  }

  tapeStop(t, dur = 0.5, g = 0.5) {
    const a = this.ctx.createGain(); const lp = this.filter('lowpass', 2500, 1.5); const sh = this.shaper(2);
    lp.frequency.setValueAtTime(2500, t); lp.frequency.exponentialRampToValueAtTime(120, t + dur);
    a.connect(lp); lp.connect(sh); sh.connect(this.out(g));
    [29, 41, 48, 53].forEach(n => {
      const o = this.osc('sawtooth', midi(n), t, dur, a); o.frequency.exponentialRampToValueAtTime(midi(n) * 0.18, t + dur);
    });
    a.gain.setValueAtTime(0.22, t); a.gain.linearRampToValueAtTime(0.0001, t + dur);
  }

  scratch(t, g = 0.35) {
    const n = this.ctx.createGain(); const bp = this.filter('bandpass', 3000, 2.5);
    bp.frequency.setValueAtTime(3200, t); bp.frequency.exponentialRampToValueAtTime(500, t + 0.13);
    n.connect(bp); bp.connect(this.out(g));
    this.noise(t, 0.15, n); this.env(n.gain, t, 0.005, 0.12, 1);
  }

  cowbell(t, n, g = 0.2, d = 0.16) {
    const f = midi(n);
    const a = this.ctx.createGain(); const bp = this.filter('bandpass', f * 1.6, 1.4); const sh = this.shaper(1.8);
    a.connect(sh); sh.connect(bp); bp.connect(this.out(g, { rev: 0.18, dly: 0.12 }));
    this.osc('square', f, t, d, a); this.osc('square', f * 1.48, t, d, a);
    a.gain.setValueAtTime(0.0001, t); a.gain.exponentialRampToValueAtTime(0.5, t + 0.002);
    a.gain.exponentialRampToValueAtTime(0.12, t + 0.03); a.gain.exponentialRampToValueAtTime(0.0001, t + d);
  }

  pad(t0, t1, notes, g = 0.2, { cutoff = 1500, att = 0.12, rel = 0.18 } = {}) {
    const a = this.ctx.createGain(); const lp = this.filter('lowpass', cutoff, 0.9);
    a.connect(lp); lp.connect(this.out(g, { rev: 0.35 }));
    notes.forEach(n => [-12, 0, 11].forEach(c => { const o = this.osc('sawtooth', midi(n), t0, t1 - t0 + rel, a); o.detune.value = c; }));
    a.gain.setValueAtTime(0.0001, t0); a.gain.exponentialRampToValueAtTime(0.12, t0 + att);
    a.gain.setValueAtTime(0.12, t1); a.gain.exponentialRampToValueAtTime(0.0001, t1 + rel);
  }

  arp(t0, t1, notes, step = 0.125, g = 0.08) {
    let i = 0;
    for (let t = t0; t < t1 - 1e-6; t += step, i++) {
      const a = this.ctx.createGain(); const lp = this.filter('lowpass', 2600 + 1400 * Math.sin(i * 0.7), 2);
      a.connect(lp); lp.connect(this.out(g, { pan: i % 2 ? 0.35 : -0.35, dly: 0.25, rev: 0.2 }));
      this.osc('square', midi(notes[i % notes.length]), t, step, a);
      this.env(a.gain, t, 0.002, step * 0.9, 0.5);
    }
  }

  pluck(t, f, dur = 0.6, g = 0.4, pan = 0) {
    const SR = this.ctx.sampleRate, N = Math.max(2, Math.round(SR / f)), len = Math.ceil(SR * dur);
    const buf = this.ctx.createBuffer(1, len, SR), out = buf.getChannelData(0);
    const line = new Float32Array(N);
    for (let i = 0; i < N; i++) line[i] = this.R() * 2 - 1;
    let idx = 0;
    for (let i = 0; i < len; i++) {
      const a = line[idx], b = line[(idx + 1) % N];
      out[i] = a;
      line[idx] = 0.997 * 0.5 * (a + b);
      idx = (idx + 1) % N;
    }
    const s = this.ctx.createBufferSource(); s.buffer = buf;
    const sh = this.shaper(2.4); const lp = this.filter('lowpass', 3800);
    s.connect(sh); sh.connect(lp); lp.connect(this.out(g, { pan, rev: 0.25 }));
    s.start(t);
  }
}
