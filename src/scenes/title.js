// Shot 5 (8-10s): the drop. Title lockup, stamp, handwritten note, then sepia freeze + TO BE CONTINUED.
import { tw, E, inv, lerp, clamp, impulse, spring, hash, hash2, stepT, TAU } from '../lib/util.js';
import { F, C, font, fitSize, drawGlyphs, maskedText, scribbleLoop, markerStroke, strokePartial, menacing, scramble } from '../lib/draw.js';
import { T } from '../timeline.js';

const SPARKS = Array.from({ length: 200 }, (_, i) => {
  const a = hash(i * 3 + 1) * TAU, v = 500 + Math.pow(hash(i * 5 + 2), 2) * 2600;
  return { vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.7, k: 2.5 + hash(i * 7) * 3, red: hash(i * 11) < 0.55, w: 1.5 + hash(i * 13) * 3.5, life: 0.5 + hash(i * 17) * 0.7 };
});

function tbcArrow(ctx, x, y, w, h) {
  const hd = h * 0.95;
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(hd, -h * 0.62);
  ctx.lineTo(hd, -h * 0.34);
  ctx.lineTo(w, -h * 0.34);
  ctx.lineTo(w - h * 0.22, 0);
  ctx.lineTo(w, h * 0.34);
  ctx.lineTo(hd, h * 0.34);
  ctx.lineTo(hd, h * 0.62);
  ctx.closePath();
  ctx.fillStyle = '#2e2612'; ctx.fill();
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#efe3bf'; ctx.lineWidth = 4; ctx.stroke();
  ctx.save();
  ctx.transform(1, 0, -0.2, 1, 0, 0);
  font(ctx, F.cond, 900, h * 0.54, 3);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineWidth = 6; ctx.strokeStyle = '#1b160a';
  const cx = hd + (w - h * 0.22 - hd) / 2;
  ctx.strokeText('TO BE CONTINUED', cx, 3);
  ctx.fillStyle = '#f3e7c4'; ctx.fillText('TO BE CONTINUED', cx, 3);
  ctx.restore();
  ctx.restore();
}

export const title = {
  t0: T.drop, t1: T.end + 1,
  cam(t) {
    const te = Math.min(t, T.freeze);
    return { zoom: 1 + 0.04 * E.outCubic(clamp((te - T.drop) / 1.4)), c: [960, 540], rot: 0 };
  },
  bg(t, bg) {
    const te = Math.min(t, T.freeze);
    bg.uTime = te;
    bg.uStorm = 0.95; bg.uIso = 0.3; bg.uGridAmt = 0.25;
    bg.uFlash = 1.0 * impulse(te, T.drop, 24);
    bg.uSpeed = 0.9 * impulse(te, T.drop, 3.0);
    bg.uSpeedSeed = stepT(te, 24);
    bg.uLit = 0.75 * impulse(te, T.drop, 3.5) + (te >= T.stamp ? 0.35 * impulse(te, T.stamp, 7) : 0);
    bg.uLitPos = [960, 260];
  },
  hud: () => ({ alpha: 0.7, ticker: false, top: false }),
  draw(ctx, t) {
    const te = Math.min(t, T.freeze);
    const lt = te - T.drop;
    // sparks
    SPARKS.forEach(s => {
      if (lt > s.life) return;
      const f = (1 - Math.exp(-s.k * lt)) / s.k;
      const x = 960 + s.vx * f, y = 520 + s.vy * f;
      const sp = Math.exp(-s.k * lt);
      const al = 1 - lt / s.life;
      ctx.strokeStyle = s.red ? `rgba(255,42,30,${al})` : `rgba(255,248,235,${al})`;
      ctx.lineWidth = s.w * al;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - s.vx * sp * 0.03, y - s.vy * sp * 0.03); ctx.stroke();
    });
    // lockup metrics
    const s2 = fitSize(ctx, 'НЕЙРОСЕТИ', F.display, 900, 1480, 215);
    font(ctx, F.display, 900, s2, 0);
    const w2 = ctx.measureText('НЕЙРОСЕТИ').width;
    const xL = 960 - w2 / 2, xR = 960 + w2 / 2;
    ctx.textBaseline = 'alphabetic';
    // НЕЙРОСЕТИ: glyphs burst from depth
    drawGlyphs(ctx, 'НЕЙРОСЕТИ', 960, 590, 'center', (i, n) => {
      const gt = lt - Math.abs(i - (n - 1) / 2) * 0.028;
      const e = E.outExpo(clamp(gt / 0.38));
      return { s: lerp(2.6, 1, e), dy: (1 - e) * -60, a: clamp(gt / 0.05), fill: C.paper };
    });
    // ГАЙД НА
    font(ctx, F.display, 900, 116, 0);
    ctx.fillStyle = C.paper; ctx.textAlign = 'left';
    maskedText(ctx, 'ГАЙД НА', xL + 4, 372, tw(te, T.drop + 0.1, 0.4, E.outExpo), { h: 125 });
    // v1.1 slam
    const vt = te - T.ver;
    if (vt >= 0) {
      const e = E.outBack(clamp(vt / 0.22), 1.4);
      const s = lerp(3.4, 1, e);
      font(ctx, F.display, 900, 176, 0);
      const vw = ctx.measureText('v1.1').width;
      const vx = xR - vw / 2, vy = 330;
      ctx.save();
      ctx.translate(vx, vy); ctx.rotate(lerp(-0.7, -0.08, e)); ctx.scale(s, s);
      ctx.globalAlpha = clamp(vt / 0.04);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = C.red; ctx.fillText('v1.1', 0, 8);
      ctx.restore();
      const loop = scribbleLoop(31, vx, vy + 4, vw * 0.66, 118, 1.35, 0.07);
      markerStroke(ctx, loop, 0, tw(te, T.scribble[0], T.scribble[1] - T.scribble[0], E.inOutCubic), 9, C.paper);
    }
    // subtitle decode
    const st = te - T.subtitle;
    if (st >= 0) {
      font(ctx, F.cond, 800, 62, 9);
      ctx.fillStyle = C.paper; ctx.textAlign = 'center';
      const sub = 'ПОРА РЕШАТЬ ПРОБЛЕМЫ ПО-КРУПНОМУ';
      ctx.fillText(scramble(sub, clamp(st / 0.42), 3, te), 960, 700);
      const sw = ctx.measureText(sub).width;
      const rl = E.outExpo(clamp(st / 0.5));
      ctx.fillStyle = C.red;
      ctx.fillRect(960 - sw / 2 - 30 - 150 * rl, 678, 150 * rl, 4);
      ctx.fillRect(960 + sw / 2 + 30, 678, 150 * rl, 4);
    }
    // stamp
    const sp = te - T.stamp;
    if (sp >= 0) {
      const e = E.inQuad(clamp(sp / 0.09));
      const s = lerp(1.9, 1, e);
      ctx.save();
      ctx.translate(1440, 862); ctx.rotate(-0.13); ctx.scale(s, s);
      ctx.globalAlpha = clamp(sp / 0.03);
      const w = 480, h = 118;
      ctx.strokeStyle = C.red; ctx.lineWidth = 7; ctx.strokeRect(-w / 2, -h / 2, w, h);
      ctx.lineWidth = 2.5; ctx.strokeRect(-w / 2 + 12, -h / 2 + 12, w - 24, h - 24);
      font(ctx, F.cond, 900, 76, 5);
      ctx.fillStyle = C.red; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('В РАЗРАБОТКЕ', 0, 4);
      // rubber texture
      ctx.globalCompositeOperation = 'destination-out';
      for (let i = 0; i < 220; i++) {
        const px = (hash(i * 3) - 0.5) * w, py = (hash(i * 5 + 1) - 0.5) * h, r = 0.8 + hash(i * 7) * 3.2;
        ctx.globalAlpha = 0.5 + hash(i * 9) * 0.5;
        ctx.fillRect(px, py, r * 2.2, r);
      }
      ctx.restore();
      ctx.textBaseline = 'alphabetic';
    }
    // handwritten note + arrow
    const nt = te - T.note;
    if (nt >= 0) {
      font(ctx, F.hand, 700, 70, 0);
      ctx.save();
      ctx.translate(640, 836); ctx.rotate(-0.05);
      const txt = '70 лайков = релиз';
      const tw1 = ctx.measureText(txt).width;
      ctx.beginPath(); ctx.rect(-10, -80, (tw1 + 20) * E.outCubic(clamp(nt / 0.28)), 120); ctx.clip();
      ctx.fillStyle = C.red; ctx.textAlign = 'left';
      ctx.fillText(txt, 0, 0);
      ctx.restore();
      const arrow = [];
      for (let i = 0; i <= 30; i++) { const u = i / 30; arrow.push([lerp(1085, 1196, u), 812 - Math.sin(u * Math.PI) * 34 + u * 34]); }
      const ap = tw(te, T.note + 0.18, 0.18, E.outCubic);
      markerStroke(ctx, arrow, 0, ap, 7);
      if (ap >= 1) {
        markerStroke(ctx, [[1170, 826], [1198, 848], [1164, 864]], 0, tw(te, T.note + 0.36, 0.06, E.linear), 7);
      }
    }
    // menacing framing
    [[112, 236, 86, -0.1], [92, 400, 72, 0.08], [128, 590, 108, -0.05], [1842, 178, 72, 0.08], [1832, 560, 92, -0.08], [1790, 690, 112, 0.04]].forEach(([x, y, s, r], i) => {
      const gt = lt - 0.35 - (i % 3) * 0.08 - (i >= 3 ? 0.04 : 0);
      if (gt < 0) return;
      const pop = 1 + 0.5 * Math.exp(-gt * 12) * Math.cos(gt * 28);
      menacing(ctx, x, y + Math.sin((te + i) * 5) * 4, s * pop, clamp(gt / 0.08), r);
    });
    // footer
    const fp = tw(te, T.drop + 0.9, 0.4, E.outExpo);
    font(ctx, F.mono, 600, 20, 4);
    ctx.globalAlpha = fp;
    ctx.fillStyle = C.red; ctx.fillRect(80, 1000, 12, 12);
    ctx.fillStyle = 'rgba(241,238,232,0.8)'; ctx.textAlign = 'left';
    ctx.fillText('WEATHER REPORT', 104, 1012);
    ctx.textAlign = 'right';
    ctx.fillText('СКОРО В КАНАЛЕ', 1840, 1012);
    ctx.globalAlpha = 1;
    // TO BE CONTINUED (real time, after freeze)
    const at = t - T.tbc;
    if (at >= 0) {
      const e = E.outExpo(clamp(at / 0.26));
      tbcArrow(ctx, 84 + (1 - e) * 1900, 928, 860, 124);
    }
  },
};
