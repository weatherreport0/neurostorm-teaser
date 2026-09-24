// Sound design / score. F minor, 120 BPM. Every cue is locked to timeline.js events.
import { Synth, midi } from './audio/synth.js';
import { T, BLIPS, RUSH_TIMES } from './timeline.js';
import { DURATION } from './lib/util.js';

const F1 = midi(29), Ab1 = midi(32), C2 = midi(36), Db2 = midi(37), Eb2 = midi(39);
const CH = { Fm: [53, 56, 60], Db: [49, 53, 56], Eb: [51, 55, 58], C: [48, 52, 55] };

function score(s) {
  // ---------------- BAR 1: emergency broadcast (0-2s)
  // drone bed
  {
    const a = s.ctx.createGain(); const lp = s.filter('lowpass', 220, 2);
    a.connect(lp); lp.connect(s.out(0.5, { rev: 0.2 }));
    [29, 36, 41].forEach((n, i) => { const o = s.osc('sawtooth', midi(n), 0, 2.05, a); o.detune.value = i * 5 - 5; });
    a.gain.setValueAtTime(0.0001, 0); a.gain.exponentialRampToValueAtTime(0.12, 1.2); a.gain.linearRampToValueAtTime(0.0001, 2.0);
    lp.frequency.setValueAtTime(160, 0); lp.frequency.exponentialRampToValueAtTime(900, 1.95);
  }
  s.swell(0, 0.6, 0.12, { hp: 6000 }); // tape hiss intro
  s.blip(0.02, 1000, 0.14, 0.12, 'sine');           // broadcast tone
  s.blip(T.tag, 1760, 0.1, 0.05, 'square');          // warning tag
  s.blip(T.tag + 0.06, 1320, 0.08, 0.05, 'square');
  BLIPS.forEach((b, i) => s.ping(b.t, [1318.5, 1568, 1174.7, 1760][i % 4], 0.13, Math.cos(b.ang) * 0.6));
  T.head.forEach((h, i) => { s.kick(h, 0.35, { f0: 90, f1: 40, d: 0.3 }); s.whoosh(h - 0.08, 0.2, 0.18, { f0: 800, f1: 3000, pan0: -0.5, pan1: 0.2 }); });
  s.clicks(T.typing[0], T.typing[1], 30, 0.1);
  s.kick(1.0, 0.55, { f0: 110, f1: 38, d: 0.35 });   // heartbeat
  s.kick(1.25, 0.35, { f0: 110, f1: 38, d: 0.3 });
  s.kick(1.5, 0.6, { f0: 110, f1: 38, d: 0.35 });
  s.kick(1.75, 0.4, { f0: 110, f1: 38, d: 0.3 });
  s.rumble(T.menace1, T.storm, 0.5, 13);            // ゴゴゴ
  s.swell(1.35, T.storm, 0.32, { hp: 3000 });        // reverse cymbal
  s.whoosh(T.whip[0], T.whip[1] - T.whip[0], 0.5, { f0: 300, f1: 6000, pan0: 0, pan1: 0, peak: 0.95 });
  s.riser(1.5, T.storm, 0.18);

  // ---------------- BAR 2: НЕЙРОШТОРМ + categories (2-4s)
  s.impact(T.storm, 1.0);
  s.braam(T.storm, 1.1, 0.4);
  s.thunder(T.storm + 0.02, 0.7, 1.9);
  s.sub808(T.storm, F1, 0.5, 0.9);
  s.thunder(T.bolt2, 0.45, 1.0);
  s.snare(T.bolt2, 0.4, { rev: 0.4 });
  const prog = [CH.Fm, CH.Fm, CH.Db, CH.Db, CH.Eb, CH.C];
  const bass = [F1, F1, Db2, Db2, Eb2, C2];
  T.cats.forEach((c, i) => {
    if (i % 2 === 0) s.kick(c, 0.95); else s.clap(c, 0.7);
    s.stab(c, prog[i].map(n => n + 12), 0.34, 0.2);
    s.sub808(c, bass[i], 0.24, 0.75);
    s.whoosh(c - 0.1, 0.12, 0.12, { f0: 1500, f1: 6000 });
    s.pad(c, c + 0.25, prog[i], 0.4, { att: 0.01, rel: 0.05 });
  });
  s.clicks(T.cats[0], T.cats[0] + 0.12, 60, 0.14);           // ТЕКСТЫ typing
  s.marker(T.cats[1] + 0.02, T.cats[1] + 0.18, 0.2);        // КАРТИНКИ scribble
  s.blip(T.cats[1] + 0.005, 5200, 0.12, 0.02, 'square');    // shutter
  { // ВИДЕО projector whirr
    const a = s.ctx.createGain(); const bp = s.filter('bandpass', 1600, 1.2);
    a.connect(bp); bp.connect(s.out(0.18)); s.noise(T.cats[2], 0.25, a);
    for (let t = T.cats[2]; t < T.cats[3]; t += 1 / 24) { a.gain.setValueAtTime(1, t); a.gain.setValueAtTime(0.2, t + 0.02); }
    a.gain.setValueAtTime(0.0001, T.cats[3]);
  }
  s.clicks(T.cats[4], T.cats[4] + 0.2, 45, 0.16);           // КОД keys
  s.glitch(T.cats[5] + 0.05, T.cats[5] + 0.16, 0.06);        // АГЕНТЫ chatter
  for (let t = T.cats[0]; t < T.stand - 0.01; t += 0.125) s.hat(t, [0.2, 0.08, 0.13, 0.08][Math.round((t - T.cats[0]) / 0.125) % 4], false, 0.25);
  s.glitch(T.glitchOut, T.stand, 0.13);

  // ---------------- BAR 3: stand card (4-6s)
  s.kick(T.stand, 1.0); s.impact(T.stand, 0.45);
  s.thunder(T.strikes[0], 0.6, 1.5); s.thunder(T.strikes[1], 0.5, 1.2);
  s.metal(T.stand, 0.18, 0.8);
  [[4.0, F1, 0.7], [4.75, Ab1, 0.22], [5.0, F1, 0.45], [5.5, Eb2, 0.45]].forEach(([t, f, d]) => s.sub808(t, f, d, 0.7));
  [4.75, 5.0, 5.625].forEach(t => s.kick(t, 0.85));
  [4.5, 5.5].forEach(t => { s.clap(t, 0.75); s.snare(t, 0.3); });
  for (let t = 4.0; t < 5.75; t += 0.125) s.hat(t, [0.18, 0.07, 0.12, 0.07][Math.round((t - 4) / 0.125) % 4], false, -0.2);
  for (let t = 5.75; t < 6.0 - 0.01; t += 1 / 24) s.hat(t, 0.1, false, 0.3);   // trap roll
  { // rain bed
    const a = s.ctx.createGain(); const hp = s.filter('highpass', 2500); const lp = s.filter('lowpass', 9000);
    a.connect(hp); hp.connect(lp); lp.connect(s.out(0.12)); s.noise(4.0, 2.0, a);
    a.gain.setValueAtTime(0.0001, 4.0); a.gain.exponentialRampToValueAtTime(1, 4.3); a.gain.setValueAtTime(1, 5.8); a.gain.exponentialRampToValueAtTime(0.0001, 6.0);
  }
  for (let i = 0; i < 16; i++) s.blip(T.standName + 0.02 + i * 0.022, 3000 + (i % 3) * 400, 0.05, 0.015, 'square');
  for (let i = 0; i < 6; i++) s.blip(T.hexStart + i * 0.06, midi(72 + [0, 3, 7, 10, 12, 15][i]), 0.12, 0.08, 'triangle');
  s.stab(T.hexStart, CH.Fm.map(n => n + 24), 0.12, 0.3, { cutoff: 5000 });
  s.rumble(4.2, 5.95, 0.22, 11);
  s.arp(4.5, 5.95, [65, 72, 68, 77, 72, 80, 68, 75], 0.125, 0.26);
  s.pad(4.0, 5.0, [53, 56, 60, 65], 0.5); s.pad(5.0, 5.98, [49, 53, 56, 61], 0.5);

  // ---------------- BAR 4: survival instructions + ЛАЙК rush (6-8s)
  const ctaCh = [CH.Fm, CH.Db, CH.Eb], ctaB = [F1, Db2, Eb2];
  T.cta.forEach((c, i) => {
    s.kick(c, 1.0); s.clap(c, 0.6); s.stab(c, ctaCh[i].map(n => n + 12), 0.36, 0.22);
    s.sub808(c, ctaB[i], 0.24, 0.85);
    s.whoosh(c - 0.14, 0.16, 0.2, { f0: 600, f1: 5000, pan0: i === 1 ? 0.7 : -0.7, pan1: 0 });
  });
  s.stab(6.75, CH.C.map(n => n + 12), 0.28, 0.2);
  s.pad(6.0, 6.25, [53, 56, 60], 0.55, { att: 0.02 }); s.pad(6.25, 6.5, [49, 53, 56], 0.55, { att: 0.02 }); s.pad(6.5, 6.75, [51, 55, 58], 0.55, { att: 0.02 }); s.pad(6.75, 7.0, [48, 52, 55], 0.6, { att: 0.02 });
  s.kick(6.75, 0.8);
  s.marker(6.08, 6.28, 0.18); s.marker(6.6, 6.88, 0.18);
  for (let t = 6.0; t < 7.0; t += 0.125) s.hat(t, [0.18, 0.07, 0.12, 0.07][Math.round((t - 6) / 0.125) % 4], false, 0.2);
  for (let i = 0; i < 10; i++) s.blip(6.66 + i * 0.03, 1200 + (i % 4) * 600, 0.05, 0.02, 'sine');   // modem-ish connecting
  // rush: punches on every ЛАЙК, accelerating
  RUSH_TIMES.forEach((t, i) => {
    s.kick(t, 0.55, { f0: 180, f1: 70, d: 0.12 });
    s.snare(t, 0.35 + 0.35 * (i / RUSH_TIMES.length), { tone: 220 + i * 6, d: 0.1, rev: 0.15 });
  });
  for (let n = 1; n <= 70; n++) { // counter ticks follow the eased count (inQuad)
    const tn = T.rush + 0.02 + Math.sqrt(n / 70) * (T.gap - 0.06 - T.rush - 0.02);
    s.blip(tn, 2600 + n * 12, 0.035, 0.012, 'square');
  }
  s.riser(T.rush, T.gap, 0.45);
  s.rumble(T.rush, T.gap, 0.3, 16);
  s.glitch(T.gap - 0.2, T.gap, 0.08);

  // ---------------- BAR 5: DROP (8-10s)
  s.impact(T.drop, 1.15);
  s.braam(T.drop, 1.35, 0.6);
  s.sub808(T.drop, F1, 0.72, 1.0);
  s.thunder(T.drop, 0.6, 1.6);
  s.impact(T.ver, 0.45);
  s.stab(T.ver, CH.Fm.map(n => n + 24), 0.22, 0.25, { cutoff: 6000 });
  s.marker(T.scribble[0], T.scribble[1], 0.16);
  s.glitch(T.subtitle, T.subtitle + 0.4, 0.035);
  s.stamp(T.stamp, 1.0);
  s.sub808(T.stamp, F1, 0.45, 0.5);
  s.pad(T.drop + 0.6, T.freeze, [53, 56, 60, 65], 0.45, { cutoff: 1800, att: 0.3 });
  s.marker(T.note, T.note + 0.28, 0.14);
  s.marker(T.note + 0.18, T.note + 0.36, 0.12);
  [8.75, 9.25].forEach(t => s.kick(t, 0.9));
  s.sub808(8.75, C2, 0.24, 0.8); s.sub808(9.25, Ab1, 0.24, 0.8);
  for (let t = T.drop + 0.25; t < T.freeze - 0.01; t += 0.125) s.hat(t, [0.16, 0.07, 0.11, 0.07][Math.round((t - T.drop) / 0.125) % 4], t % 0.5 < 0.01, 0.15);
  s.rumble(T.drop + 0.3, T.freeze, 0.2, 13);
  // phonk cowbell hook over the drop (16ths grid)
  [[0, 77], [0.25, 80], [0.375, 77], [0.5, 84], [0.75, 82], [0.875, 80], [1.0, 77], [1.25, 75], [1.375, 77]].forEach(([o, n]) => s.cowbell(T.drop + o, n, 0.5));
  // freeze -> tape stop + TO BE CONTINUED
  s.tapeStop(T.freeze, 0.45, 0.6);
  s.scratch(T.freeze, 0.3);
  s.whoosh(T.tbc - 0.02, 0.25, 0.28, { f0: 2500, f1: 500, pan0: 0.8, pan1: -0.4, peak: 0.3 });
  [[9.56, 41], [9.66, 41], [9.74, 44], [9.82, 48], [9.9, 51]].forEach(([t, n], i) => s.pluck(t, midi(n + 12), 0.5, 0.42, -0.1 + i * 0.05));
}

function encodeWav(buf) {
  const ch = buf.numberOfChannels, len = buf.length, SR = buf.sampleRate;
  const data = [...Array(ch)].map((_, c) => buf.getChannelData(c));
  let peak = 0;
  for (const d of data) for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(d[i]));
  const gain = peak > 0 ? 0.89 / peak : 1;
  const fade = Math.floor(SR * 0.08);
  const out = new DataView(new ArrayBuffer(44 + len * ch * 2));
  const str = (o, s) => [...s].forEach((c, i) => out.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF'); out.setUint32(4, 36 + len * ch * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
  out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, ch, true); out.setUint32(24, SR, true);
  out.setUint32(28, SR * ch * 2, true); out.setUint16(32, ch * 2, true); out.setUint16(34, 16, true);
  str(36, 'data'); out.setUint32(40, len * ch * 2, true);
  let o = 44;
  for (let i = 0; i < len; i++) {
    const f = i > len - fade ? (len - i) / fade : 1;
    for (let c = 0; c < ch; c++) {
      const v = Math.max(-1, Math.min(1, data[c][i] * gain * f));
      out.setInt16(o, v < 0 ? v * 0x8000 : v * 0x7fff, true); o += 2;
    }
  }
  return { bytes: out.buffer, peak };
}

export async function renderAudio() {
  const SR = 48000;
  const ctx = new OfflineAudioContext(2, SR * DURATION, SR);
  const s = new Synth(ctx, 777);
  score(s);
  const buf = await ctx.startRendering();
  const { bytes, peak } = encodeWav(buf);
  await fetch('/log', { method: 'POST', body: `audio peak before normalize: ${peak.toFixed(3)}` });
  return bytes;
}
