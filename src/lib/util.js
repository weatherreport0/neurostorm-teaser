// Math, easing, deterministic randomness.
export const W = 1920, H = 1080, FPS = 60, DURATION = 10;
export const BPM = 120, BEAT = 60 / BPM; // 0.5s

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const inv = (a, b, x) => clamp((x - a) / (b - a));
export const smooth = (a, b, x) => { const t = inv(a, b, x); return t * t * (3 - 2 * t); };
export const TAU = Math.PI * 2;

export const E = {
  linear: t => t,
  inQuad: t => t * t,
  outQuad: t => 1 - (1 - t) * (1 - t),
  inCubic: t => t * t * t,
  outCubic: t => 1 - Math.pow(1 - t, 3),
  inOutCubic: t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  outQuart: t => 1 - Math.pow(1 - t, 4),
  inQuart: t => t * t * t * t,
  outQuint: t => 1 - Math.pow(1 - t, 5),
  inOutQuint: t => (t < 0.5 ? 16 * t ** 5 : 1 - Math.pow(-2 * t + 2, 5) / 2),
  inExpo: t => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10)),
  outExpo: t => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  inOutExpo: t => (t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2),
  outBack: (t, s = 1.70158) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2),
  inBack: (t, s = 1.70158) => (s + 1) * t * t * t - s * t * t,
  outCirc: t => Math.sqrt(1 - Math.pow(t - 1, 2)),
};

// Eased 0..1 progress over [t0, t0+dur]
export const tw = (t, t0, dur, ease = E.outExpo) => ease(clamp((t - t0) / dur));

// Damped spring response from 0 to 1 (analytic), t in seconds.
export function spring(t, freq = 6, damp = 0.35) {
  if (t <= 0) return 0;
  const w = TAU * freq, z = damp;
  if (z >= 1) return 1 - Math.exp(-w * t) * (1 + w * t);
  const wd = w * Math.sqrt(1 - z * z);
  return 1 - Math.exp(-z * w * t) * (Math.cos(wd * t) + (z * w / wd) * Math.sin(wd * t));
}

// Deterministic hash-based random
export function hash(n) {
  n = (n | 0) ^ 0x9e3779b9;
  n = Math.imul(n ^ (n >>> 16), 0x85ebca6b);
  n = Math.imul(n ^ (n >>> 13), 0xc2b2ae35);
  n ^= n >>> 16;
  return (n >>> 0) / 4294967296;
}
export const hash2 = (a, b) => hash(Math.imul(a | 0, 73856093) ^ Math.imul(b | 0, 19349663));
export const hash3 = (a, b, c) => hash(Math.imul(a | 0, 73856093) ^ Math.imul(b | 0, 19349663) ^ Math.imul(c | 0, 83492791));

export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 1D value noise (smooth), deterministic
export function noise1(x, seed = 0) {
  const i = Math.floor(x), f = x - i;
  const u = f * f * (3 - 2 * f);
  return lerp(hash2(i, seed), hash2(i + 1, seed), u) * 2 - 1;
}
export function fbm1(x, seed = 0, oct = 3) {
  let a = 0.5, s = 0;
  for (let i = 0; i < oct; i++) { s += a * noise1(x, seed + i * 17); x *= 2.03; a *= 0.5; }
  return s;
}

// Camera shake: returns [dx, dy, rot] for amplitude amp (px) at time t
export function shake(t, amp, seed = 1, freq = 18) {
  return [fbm1(t * freq, seed) * amp, fbm1(t * freq, seed + 50) * amp, fbm1(t * freq * 0.7, seed + 99) * amp * 0.0009];
}

// Impulse envelope: instant attack at t0, exponential decay
export const impulse = (t, t0, decay = 8) => (t < t0 ? 0 : Math.exp(-(t - t0) * decay));

// Frame-quantized time (for "stepped"/held animation like glitches)
export const stepT = (t, fps = 12) => Math.floor(t * fps) / fps;
