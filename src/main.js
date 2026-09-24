// Orchestrator: shot selection, motion-blur subframes, global FX envelopes, render modes.
import { W, H, FPS, DURATION, clamp, inv, E, impulse, shake } from './lib/util.js';
import { Pipeline } from './gl.js';
import { T } from './timeline.js';
import { drawHud } from './scenes/hud.js';
import { radar } from './scenes/radar.js';
import { storm, cats } from './scenes/storm.js';
import { stand } from './scenes/stand.js';
import { cta, rush, gap } from './scenes/cta.js';
import { title } from './scenes/title.js';

const SHOTS = [radar, storm, cats, stand, cta, rush, gap, title];
const shotAt = t => SHOTS.find(s => t >= s.t0 && t < s.t1) || SHOTS[SHOTS.length - 1];

const HITS = [
  [T.storm, 36, 6], [T.bolt2, 18, 9], ...T.cats.map(c => [c, 9, 14]), [T.stand, 20, 6], [T.strikes[1], 16, 7],
  ...T.cta.map(c => [c, 13, 10]), [T.drop, 44, 4.2], [T.ver, 18, 9], [T.stamp, 16, 11],
];

function globalShake(t) {
  let amp = 0;
  for (const [t0, a, d] of HITS) amp += a * impulse(t, t0, d);
  if (t >= T.rush && t < T.gap) amp += 3 + 18 * inv(T.rush, T.gap, t);
  if (t >= T.freeze) amp = 0;
  const [dx, dy, r] = shake(t, amp, 7, 21);
  return { uShake: [dx, dy], uShakeRot: r };
}

const win = (t, a, b) => (t >= a && t < b ? 1 : 0);

function postFx(t, frame) {
  const f = Math.round(t * FPS);
  const u = { uFrame: frame, uCA: 0.0016, uGrain: 0.032, uVig: 0.5, uBloomAmt: 0.85, uContrast: 0.12, uScan: 0 };
  u.uCA += 0.014 * impulse(t, T.storm, 7) + 0.007 * impulse(t, T.bolt2, 10) + 0.016 * impulse(t, T.drop, 4.5) + 0.006 * impulse(t, T.ver, 10);
  T.cats.forEach(c => { u.uCA += 0.005 * impulse(t, c, 16); });
  T.cta.forEach(c => { u.uCA += 0.004 * impulse(t, c, 12); });
  u.uCA += 0.01 * inv(T.rush, T.gap, t) * win(t, T.rush, T.gap);
  let g = 0;
  g = Math.max(g, 0.5 * win(t, T.whip[1] - 0.05, T.whip[1]));
  g = Math.max(g, 1.0 * win(t, T.glitchOut, T.stand + 0.05));
  g = Math.max(g, 0.7 * E.inQuad(inv(T.gap - 0.3, T.gap, t)) * win(t, T.rush, T.gap));
  g = Math.max(g, 0.45 * win(t, T.drop, T.drop + 0.07));
  g = Math.max(g, 0.35 * win(t, T.freeze - 0.02, T.freeze + 0.03));
  u.uGlitch = g;
  u.uGlitchSeed = Math.floor(f / 2) * 1.618;
  const fr = x => f >= Math.round(x * FPS) && f < Math.round(x * FPS) + 1;
  const fr2 = (x, n) => f >= Math.round(x * FPS) && f < Math.round(x * FPS) + n;
  u.uDuo = fr2(T.storm + 0.02, 2) || fr2(T.drop + 0.04, 2) ? 1 : 0;
  u.uInvert = fr(T.bolt2) || fr(T.ver) ? 1 : 0;
  if (t >= T.drop) {
    const k = clamp((t - T.drop) / 0.75);
    u.uShockR = 1.7 * E.outCubic(k);
    u.uShockAmt = 0.045 * (1 - k);
    u.uShockC = [0.5, 0.48];
  }
  u.uBloomAmt += 0.4 * impulse(t, T.drop, 5) + 0.25 * impulse(t, T.storm, 7);
  if (t < T.storm) u.uScan = 0.05;
  if (t >= T.freeze) {
    const s = clamp((t - T.freeze) / 0.05);
    u.uSepia = s; u.uContrast = 0.12 + 0.25 * s; u.uGrain = 0.032 + 0.028 * s; u.uVig = 0.5 + 0.25 * s;
    u.uGlitch = t < T.freeze + 0.03 ? u.uGlitch : 0;
  }
  return { uniforms: u, bloomThresh: 0.7 };
}

const BG_DEFAULTS = () => ({
  uBase: [0.024, 0.024, 0.026], uIso: 0, uStorm: 0, uRadar: 0, uLit: 0, uFlash: 0, uSpeed: 0, uGridAmt: 0,
  uRadarC: [960, 540], uRadarR: 300, uSweep: 0, uLitPos: [960, 300], uLitCol: [1.0, 0.3, 0.22], uSpeedSeed: 0,
  uZoom: 1, uRot: 0, uCamC: [960, 540],
});

export class Renderer {
  constructor(canvas) {
    this.pipe = new Pipeline(canvas);
    this.content = document.createElement('canvas');
    this.content.width = W; this.content.height = H;
    this.ctx = this.content.getContext('2d');
    this.pixels = new Uint8Array(W * H * 4);
  }
  drawSub(t) {
    const ctx = this.ctx;
    const shot = shotAt(t);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    const bg = BG_DEFAULTS();
    bg.uTime = t;
    shot.bg(t, bg);
    const cam = shot.cam(t);
    bg.uZoom = cam.zoom; bg.uRot = cam.rot; bg.uCamC = cam.c;
    Object.assign(bg, globalShake(t));
    ctx.save();
    ctx.translate(W / 2, H / 2); ctx.rotate(cam.rot); ctx.scale(cam.zoom, cam.zoom); ctx.translate(-cam.c[0], -cam.c[1]);
    shot.draw(ctx, t);
    ctx.restore();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    drawHud(ctx, t, shot.hud(t));
    return bg;
  }
  renderFrame(frame, sub = 8, shutter = 0.5) {
    const t = frame / FPS;
    this.pipe.beginFrame();
    for (let k = 0; k < sub; k++) {
      const tk = t + (sub > 1 ? (k / sub) * shutter / FPS : 0);
      const bg = this.drawSub(tk);
      this.pipe.addSubframe(this.content, bg, 1 / sub);
    }
    this.pipe.finishFrame(postFx(t, frame));
  }
}

async function loadFonts() {
  const specs = ['900 100px "Unbounded"', '900 100px "Sofia Sans Extra Condensed"', '800 100px "Sofia Sans Extra Condensed"',
    '500 100px "JetBrains Mono"', '600 100px "JetBrains Mono"', '700 100px "JetBrains Mono"', '800 100px "JetBrains Mono"',
    '700 100px "Caveat"', '400 100px "Dela Gothic One"'];
  const sample = 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдеёжзийклмнопрстуфхцчшщъыьэюя ABCXYZabcxyz0123456789.:/*«»—–-!?「」ゴドスタンド⚠▲';
  await Promise.all(specs.map(s => document.fonts.load(s, sample)));
  await document.fonts.ready;
}

async function post(path, body) { await fetch(path, { method: 'POST', body }); }

async function main() {
  const q = new URLSearchParams(location.search);
  const mode = q.get('mode') || 'preview';
  await loadFonts();
  const canvas = document.getElementById('out');
  const r = new Renderer(canvas);
  window.__renderer = r;
  const sub = +(q.get('sub') || 8);
  try {
    if (mode === 'stills') {
      const spec = q.get('frames') || 'every=30';
      let frames = [];
      if (spec.startsWith('every=')) { const n = +spec.slice(6); for (let f = 0; f < FPS * DURATION; f += n) frames.push(f); }
      else frames = spec.split(',').map(Number);
      for (const f of frames) {
        r.renderFrame(f, sub);
        const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
        await post(`/still?name=f${String(f).padStart(4, '0')}`, blob);
      }
      await post('/done', `stills ${frames.length}`);
    } else if (mode === 'video' || mode === 'audio') {
      const { renderAudio } = await import('./audio.js');
      const wav = await renderAudio();
      await post('/audio', new Blob([wav]));
      if (mode === 'video') {
        const N = FPS * DURATION;
        const t0 = performance.now();
        for (let f = 0; f < N; f++) {
          r.renderFrame(f, sub);
          r.pipe.readPixels(r.pixels);
          await post('/frame', new Blob([r.pixels]));
          if (f % 8 === 7 && window.gc) window.gc();
        }
        await post('/log', `render ${((performance.now() - t0) / 1000).toFixed(1)}s`);
      }
      await post('/done', mode);
    } else {
      // realtime preview (no motion blur) + audio
      let audioStart = null;
      const loop = now => {
        if (audioStart == null) audioStart = now;
        const t = ((now - audioStart) / 1000) % DURATION;
        r.renderFrame(Math.floor(t * FPS), 1);
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    }
  } catch (e) {
    console.error(e.stack || e);
    await post('/done', 'error: ' + (e.stack || e));
  }
}

main().catch(async e => { console.error(e.stack || e); await post('/done', 'error: ' + (e.stack || e)); });
