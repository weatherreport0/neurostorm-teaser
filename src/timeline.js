// Shared timing: every visual event here also drives the sound design (audio.js).
// 120 BPM -> beat = 0.5s, bar = 2s. 10s = 5 bars.
import { TAU } from './lib/util.js';

export const T = {
  radar: 0.0,
  tag: 0.12,
  head: [0.30, 0.52, 0.72],
  typing: [0.95, 1.55],
  menace1: 1.0,
  whip: [1.62, 2.0],
  storm: 2.0,
  bolt2: 2.22,
  cats: [2.5, 2.75, 3.0, 3.25, 3.5, 3.75],
  glitchOut: 3.92,
  stand: 4.0,
  strikes: [4.0, 5.0],
  standName: 4.08,
  hexStart: 4.42,
  cta: [6.0, 6.25, 6.5],
  rush: 7.0,
  gap: 7.8333,
  drop: 8.0,
  ver: 8.25,
  scribble: [8.375, 8.7],
  subtitle: 8.5,
  stamp: 9.0,
  note: 9.125,
  freeze: 9.5,
  tbc: 9.53,
  end: 10.0,
};

// Radar sweep: starts at 12 o'clock, clockwise (canvas coords), one turn per 1.15s
export const SWEEP = { t0: 0.15, a0: -Math.PI / 2, w: TAU / 1.15 };
export const sweepAngle = t => SWEEP.a0 + (t - SWEEP.t0) * SWEEP.w;

export const RADAR = { cx: 1392, cy: 505, R: 330 };

export const BLIPS = [
  { name: 'CHATGPT', sub: 'текст', ang: -1.2, rad: 0.62 },
  { name: 'CLAUDE', sub: 'код', ang: -0.42, rad: 0.84 },
  { name: 'GEMINI', sub: 'всё сразу', ang: 0.35, rad: 0.45 },
  { name: 'MIDJOURNEY', sub: 'картинки', ang: 0.92, rad: 0.76 },
  { name: 'SUNO', sub: 'музыка', ang: 1.5, rad: 0.33 },
  { name: 'KLING', sub: 'видео', ang: 2.08, rad: 0.8 },
  { name: 'DEEPSEEK', sub: 'бесплатно', ang: 2.72, rad: 0.55 },
  { name: 'SORA', sub: 'видео', ang: 3.3, rad: 0.72 },
  { name: 'FLUX', sub: 'картинки', ang: 3.92, rad: 0.42 },
  { name: 'ELEVENLABS', sub: 'голос', ang: 4.52, rad: 0.86 },
].map(b => {
  const d = (((b.ang - SWEEP.a0) % TAU) + TAU) % TAU;
  return { ...b, t: SWEEP.t0 + d / SWEEP.w };
});

// Like-rush barrage (ORA ORA -> ЛАЙК ЛАЙК): accelerating spawn times
export const RUSH_N = 30;
export const RUSH_TIMES = Array.from({ length: RUSH_N }, (_, k) => T.rush + 0.04 + 0.74 * Math.pow(k / (RUSH_N - 1), 0.72));
