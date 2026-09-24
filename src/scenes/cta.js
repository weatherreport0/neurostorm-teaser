// Shot 4 (6-7s): survival instructions from the post. (7-7.83s): ЛАЙК-rush to 70. (7.83-8s): silence.
import { tw, E, inv, lerp, clamp, impulse, spring, hash, hash2, stepT, TAU, shake } from '../lib/util.js';
import { F, C, font, fitSize, drawGlyphs, scribbleLine, scribbleLoop, markerStroke, menacing, typed } from '../lib/draw.js';
import { T, RUSH_TIMES } from '../timeline.js';

const LINES = [
  { a: 'ПОДКЛЮЧАЙТЕ ', b: 'ВТОРЫЕ АККАУНТЫ', y: 430, from: -1 },
  { a: 'ПЕРЕСЫЛАЙТЕ ', b: 'ДРУЗЬЯМ', y: 612, from: 1 },
  { a: 'ГОТОВЬТЕ ', b: 'ВПНЫ', y: 794, from: 0 },
];
const X0 = 150;
let SIZE = 0;

export const cta = {
  t0: T.cta[0], t1: T.rush,
  cam(t) {
    const lt = t - T.cta[0];
    let z = 1 + lt * 0.035;
    T.cta.forEach(c => { z += 0.025 * impulse(t, c, 12) * (t >= c ? 1 : 0); });
    return { zoom: z, c: [960, 560], rot: 0 };
  },
  bg(t, bg) {
    bg.uStorm = 0.8; bg.uIso = 0.35;
    bg.uFlash = 0.5 * impulse(t, T.cta[0], 24);
    bg.uLit = 0.3 * impulse(t, T.cta[0], 6);
    bg.uLitPos = [960, 200];
  },
  hud: () => ({ alpha: 1, ticker: true }),
  draw(ctx, t) {
    const lt = t - T.cta[0];
    if (!SIZE) SIZE = fitSize(ctx, 'ПОДКЛЮЧАЙТЕ ВТОРЫЕ АККАУНТЫ', F.cond, 900, 1620, 190);
    font(ctx, F.mono, 700, 22, 4);
    ctx.textAlign = 'left';
    ctx.fillStyle = C.red; ctx.fillRect(X0, 190, 16, 16);
    ctx.fillStyle = C.paper;
    ctx.fillText(typed('ИНСТРУКЦИЯ ПО ВЫЖИВАНИЮ', tw(lt, 0.0, 0.3, E.linear)), X0 + 30, 206);
    LINES.forEach((L, i) => {
      const t0 = T.cta[i];
      const gt = t - t0;
      if (gt < 0) return;
      font(ctx, F.cond, 900, SIZE, 0);
      const wa = ctx.measureText(L.a).width;
      const full = L.a + L.b;
      const e = E.outExpo(clamp(gt / 0.3));
      const pop = L.from === 0 ? lerp(1.45, 1, e) : 1;
      ctx.save();
      ctx.translate(X0, L.y);
      ctx.scale(pop, pop);
      drawGlyphs(ctx, full, 0, 0, 'left', (k, n) => {
        const kt = gt - k * 0.008;
        const ek = E.outExpo(clamp(kt / 0.28));
        const glitch = (L.from === 0 && k >= L.a.length) ? (hash2(k, Math.floor(t * 20)) - 0.5) * 22 * (hash2(k + 9, Math.floor(t * 20)) > 0.7 ? 1 : 0) : 0;
        return { dx: L.from * (1 - ek) * 320 + glitch, a: clamp(kt / 0.04), fill: k >= L.a.length ? C.red : C.paper };
      });
      ctx.restore();
      font(ctx, F.mono, 700, 20, 2);
      ctx.fillStyle = C.red;
      ctx.fillText(`0${i + 1}`, X0 - 2, L.y - SIZE * 0.72 - 12);
      // marker accents
      if (i === 0) {
        font(ctx, F.cond, 900, SIZE, 0);
        const wb = ctx.measureText(L.b).width;
        const pts = scribbleLine(5, X0 + wa, L.y + 28, X0 + wa + wb, L.y + 22, true);
        markerStroke(ctx, pts, 0, tw(gt, 0.08, 0.2, E.outCubic), 11);
      }
      if (i === 2) {
        font(ctx, F.cond, 900, SIZE, 0);
        const wb = ctx.measureText(L.b).width;
        const loop = scribbleLoop(9, X0 + wa + wb / 2, L.y - SIZE * 0.34, wb * 0.66, SIZE * 0.55, 1.3, 0.06);
        markerStroke(ctx, loop, 0, tw(gt, 0.1, 0.28, E.inOutCubic), 10);
        font(ctx, F.mono, 600, 22, 1);
        ctx.fillStyle = 'rgba(241,238,232,0.8)';
        const dots = '.'.repeat(1 + Math.floor(t * 8) % 3);
        ctx.fillText(typed(`[ подключение${dots} ] NL · DE · FI · KZ`, tw(gt, 0.15, 0.25, E.linear)), X0 + wa + wb + 140, L.y - 40);
      }
    });
    // menacing column on the right
    [[1630, 640, 92, -0.1], [1738, 575, 116, 0.06], [1822, 700, 86, -0.04]].forEach(([x, y, s, r], i) => {
      const gt = lt - 0.3 - i * 0.09;
      if (gt < 0) return;
      const pop = 1 + 0.5 * Math.exp(-gt * 12) * Math.cos(gt * 28);
      menacing(ctx, x, y + Math.sin((t + i) * 5) * 5, s * pop, clamp(gt / 0.08), r);
    });
  },
};

// Like counter heart path
function heart(ctx, x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.3);
  ctx.bezierCurveTo(x - s * 0.1, y + s * 0.1, x - s * 0.5, y + s * 0.05, x - s * 0.5, y - s * 0.25);
  ctx.bezierCurveTo(x - s * 0.5, y - s * 0.55, x - s * 0.1, y - s * 0.6, x, y - s * 0.3);
  ctx.bezierCurveTo(x + s * 0.1, y - s * 0.6, x + s * 0.5, y - s * 0.55, x + s * 0.5, y - s * 0.25);
  ctx.bezierCurveTo(x + s * 0.5, y + s * 0.05, x + s * 0.1, y + s * 0.1, x, y + s * 0.3);
  ctx.closePath();
}

export const rush = {
  t0: T.rush, t1: T.gap,
  cam(t) {
    const k = inv(T.rush, T.gap, t);
    return { zoom: 1 + 0.12 * E.inCubic(k), c: [960, 540], rot: 0.02 * Math.sin(t * 40) * k };
  },
  bg(t, bg) {
    const k = inv(T.rush, T.gap, t);
    bg.uStorm = 0.6; bg.uSpeed = 0.35 + 0.65 * k; bg.uSpeedSeed = stepT(t, 30);
    bg.uBase = [0.02 + 0.05 * k, 0.012, 0.012];
    bg.uFlash = 0.25 * impulse(t, T.rush, 20);
  },
  hud: t => ({ alpha: 1, ticker: true }),
  draw(ctx, t) {
    // barrage of ЛАЙК!
    RUSH_TIMES.forEach((ts, i) => {
      const gt = t - ts;
      if (gt < 0) return;
      const x = 160 + hash(i * 3 + 1) * 1600, y = 170 + hash(i * 5 + 2) * 760;
      if (Math.abs(x - 960) < 360 && Math.abs(y - 520) < 200) return; // keep counter clear
      const s = (0.7 + hash(i * 7) * 0.9) * lerp(2.2, 1, E.outExpo(clamp(gt / 0.07)));
      const r = (hash(i * 11) - 0.5) * 0.7;
      ctx.save();
      ctx.translate(x, y); ctx.rotate(r); ctx.scale(s, s);
      font(ctx, F.jp, 400, 92, 0);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
      ctx.strokeStyle = C.paper; ctx.lineWidth = 16; ctx.strokeText('ЛАЙК!', 0, 0);
      ctx.strokeStyle = C.black; ctx.lineWidth = 7; ctx.strokeText('ЛАЙК!', 0, 0);
      ctx.fillStyle = i % 3 === 0 ? C.paper : C.red; ctx.fillText('ЛАЙК!', 0, 0);
      ctx.restore();
    });
    ctx.textBaseline = 'alphabetic';
    // counter
    const k = inv(T.rush + 0.02, T.gap - 0.06, t);
    const n = Math.min(70, Math.floor(E.inQuad(k) * 70 + 1e-6));
    const beat = impulse(t, RUSH_TIMES.reduce((a, b) => (b <= t ? b : a), 0), 18);
    ctx.save();
    ctx.translate(960, 520);
    ctx.scale(1 + 0.08 * beat, 1 + 0.08 * beat);
    ctx.fillStyle = n >= 70 ? C.red : C.paper;
    heart(ctx, -300, -80, 190);
    ctx.fill();
    font(ctx, F.display, 900, 250, 0);
    ctx.textAlign = 'left';
    ctx.fillStyle = n >= 70 ? C.red : C.paper;
    ctx.fillText(String(n).padStart(2, '0'), -170, 0);
    ctx.restore();
    font(ctx, F.mono, 700, 30, 4);
    ctx.textAlign = 'center';
    ctx.fillStyle = C.paper;
    ctx.fillText('/ 70 ЛАЙКОВ ДО РЕЛИЗА', 960, 610);
  },
};

export const gap = {
  t0: T.gap, t1: T.drop,
  cam: () => ({ zoom: 1, c: [960, 540], rot: 0 }),
  bg(t, bg) { bg.uBase = [0, 0, 0]; },
  hud: () => ({ alpha: 0 }),
  draw(ctx, t) {
    font(ctx, F.mono, 500, 30, 6);
    ctx.textAlign = 'center';
    ctx.fillStyle = C.paper;
    ctx.fillText(typed('пора.', tw(t, T.gap + 0.01, 0.09, E.linear)), 960, 552);
  },
};
