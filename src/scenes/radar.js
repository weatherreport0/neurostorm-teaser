// Shot 1 (0-2s): emergency weather broadcast, radar sweep picks up AI "storm cells".
import { tw, E, inv, lerp, clamp, TAU, hash2 } from '../lib/util.js';
import { F, C, font, fitSize, maskedText, menacing, typed } from '../lib/draw.js';
import { T, RADAR, BLIPS, sweepAngle } from '../timeline.js';

const { cx, cy, R } = RADAR;

export const radar = {
  t0: 0, t1: T.storm,
  cam(t) {
    const push = 1 + 0.045 * E.inOutCubic(inv(0, T.whip[0], t));
    const w = E.inExpo(inv(T.whip[0], T.whip[1], t));
    const k = E.inOutCubic(inv(T.whip[0] - 0.2, T.whip[1] - 0.05, t));
    return { zoom: push * (1 + w * 18), c: [lerp(960, cx, k), lerp(540, cy, k)], rot: w * 0.55 };
  },
  bg(t, bg) {
    bg.uStorm = 0.45;
    bg.uIso = 0.9 * tw(t, 0.0, 0.8, E.outCubic);
    bg.uGridAmt = 0.7;
    bg.uRadar = tw(t, 0.08, 0.6, E.outCubic);
    bg.uRadarC = [cx, cy];
    bg.uRadarR = R * tw(t, 0.05, 0.6, E.outExpo);
    bg.uSweep = sweepAngle(t);
    bg.uFlash = E.inExpo(inv(1.86, 2.0, t)) * 1.1;
  },
  hud: () => ({ alpha: 1, ticker: true }),
  draw(ctx, t) {
    ctx.save();
    ctx.lineCap = 'butt';
    // rings
    for (let i = 0; i < 4; i++) {
      const p = tw(t, 0.04 + i * 0.07, 0.6, E.outExpo);
      if (p <= 0) continue;
      const r = R * (i + 1) / 4;
      ctx.strokeStyle = i === 3 ? 'rgba(241,238,232,0.7)' : 'rgba(241,238,232,0.26)';
      ctx.lineWidth = i === 3 ? 2 : 1.3;
      ctx.beginPath(); ctx.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + TAU * p); ctx.stroke();
      // range label
      if (i < 3) {
        font(ctx, F.mono, 500, 13, 1);
        ctx.fillStyle = `rgba(241,238,232,${0.45 * p})`;
        ctx.textAlign = 'left';
        ctx.fillText(`${(i + 1) * 25}KM`, cx + 6, cy - r - 6);
      }
    }
    // crosshair
    const ch = tw(t, 0.1, 0.55, E.outExpo) * (R + 70);
    ctx.strokeStyle = 'rgba(241,238,232,0.28)'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - ch, cy); ctx.lineTo(cx + ch, cy);
    ctx.moveTo(cx, cy - ch); ctx.lineTo(cx, cy + ch);
    ctx.stroke();
    // tick ring + bearings
    const tp = tw(t, 0.12, 0.8, E.outExpo);
    const trot = (1 - tp) * -0.5;
    for (let d = 0; d < 360; d += 5) {
      const a = (d / 180) * Math.PI - Math.PI / 2 + trot;
      const major = d % 30 === 0;
      const len = major ? 16 : 7;
      const vis = clamp(tp * 72 - d / 5);
      if (vis <= 0) continue;
      ctx.strokeStyle = `rgba(241,238,232,${(major ? 0.7 : 0.35) * vis})`;
      ctx.lineWidth = major ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * (R + 6), cy + Math.sin(a) * (R + 6));
      ctx.lineTo(cx + Math.cos(a) * (R + 6 + len), cy + Math.sin(a) * (R + 6 + len));
      ctx.stroke();
      if (major) {
        font(ctx, F.mono, 500, 13, 1);
        ctx.fillStyle = `rgba(241,238,232,${0.55 * vis})`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(String(d).padStart(3, '0'), cx + Math.cos(a) * (R + 40), cy + Math.sin(a) * (R + 40));
      }
    }
    ctx.textBaseline = 'alphabetic';
    // sweep line
    const sa = sweepAngle(t);
    const sv = tw(t, 0.15, 0.2, E.outCubic);
    if (sv > 0) {
      ctx.strokeStyle = `rgba(255,70,50,${0.5 * sv})`; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(sa) * R, cy + Math.sin(sa) * R); ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,${0.95 * sv})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(sa) * R, cy + Math.sin(sa) * R); ctx.stroke();
      ctx.fillStyle = C.white;
      ctx.beginPath(); ctx.arc(cx, cy, 5, 0, TAU); ctx.fill();
    }
    // blips
    BLIPS.forEach((b, i) => {
      const lt = t - b.t;
      if (lt < 0) return;
      const x = cx + Math.cos(b.ang) * b.rad * R, y = cy + Math.sin(b.ang) * b.rad * R;
      // ping ring
      const pr = clamp(lt / 0.55);
      ctx.strokeStyle = `rgba(255,42,30,${(1 - pr) * 0.9})`; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, 6 + pr * 34, 0, TAU); ctx.stroke();
      const pop = 1 + 0.8 * Math.exp(-lt * 14);
      ctx.fillStyle = C.red;
      ctx.beginPath(); ctx.arc(x, y, 5.5 * pop, 0, TAU); ctx.fill();
      ctx.fillStyle = C.white;
      ctx.beginPath(); ctx.arc(x, y, 2, 0, TAU); ctx.fill();
      // leader + label
      const dir = Math.cos(b.ang) >= -0.2 ? 1 : -1;
      const lp = tw(lt, 0.02, 0.18, E.outExpo);
      const x1 = x + dir * 22 * lp, y1 = y - 22 * lp;
      const x2 = x1 + dir * 26 * lp;
      ctx.strokeStyle = 'rgba(241,238,232,0.75)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(x + dir * 6, y - 6); ctx.lineTo(x1, y1); ctx.lineTo(x2, y1); ctx.stroke();
      const txt = typed(b.name, tw(lt, 0.08, 0.16, E.linear));
      font(ctx, F.mono, 700, 17, 1.5);
      ctx.textAlign = dir > 0 ? 'left' : 'right';
      ctx.fillStyle = C.paper;
      ctx.fillText(txt, x2 + dir * 6, y1 + 6);
      font(ctx, F.mono, 500, 12, 1);
      ctx.fillStyle = `rgba(255,90,70,${tw(lt, 0.18, 0.12, E.linear)})`;
      ctx.fillText(`▲ ${b.sub}`, x2 + dir * 6, y1 + 24);
    });

    // left column: headline
    const x0 = 128;
    const tagP = tw(t, T.tag, 0.28, E.outExpo);
    if (tagP > 0) {
      font(ctx, F.mono, 800, 21, 3);
      const label = '⚠ ШТОРМОВОЕ ПРЕДУПРЕЖДЕНИЕ';
      const lw = ctx.measureText(label).width + 36;
      ctx.save();
      ctx.beginPath(); ctx.rect(x0, 214, lw * tagP, 46); ctx.clip();
      ctx.fillStyle = C.red; ctx.fillRect(x0, 214, lw, 46);
      ctx.fillStyle = C.white; ctx.textAlign = 'left';
      ctx.fillText(label, x0 + 18, 245);
      ctx.restore();
    }
    const lines = ['ВНИМАНИЕ:', 'НАД КАНАЛОМ', 'ФОРМИРУЕТСЯ'];
    const HS = fitSize(ctx, 'ФОРМИРУЕТСЯ', F.cond, 900, 760, 160);
    lines.forEach((ln, i) => {
      const p = tw(t, T.head[i], 0.5, E.outExpo);
      if (p <= 0) return;
      font(ctx, F.cond, 900, HS, 0);
      ctx.textAlign = 'left';
      ctx.fillStyle = i === 0 ? C.red : C.paper;
      maskedText(ctx, ln, x0 - 4, 405 + i * HS * 0.92, p, { h: HS * 0.95 });
    });
    // blinking cursor after last line
    if (t > T.head[2] + 0.3) {
      font(ctx, F.cond, 900, HS, 0);
      const w = ctx.measureText(lines[2]).width;
      const yb = 405 + 2 * HS * 0.92;
      if (Math.floor(t * 4) % 2 === 0) { ctx.fillStyle = C.red; ctx.fillRect(x0 + w + 10, yb - HS * 0.7, HS * 0.19, HS * 0.72); }
    }
    // mono readout
    const info = ['уровень угрозы ........ максимальный', 'источник .............. weather report', 'объект ................ гайд на нейросети v1.1'];
    font(ctx, F.mono, 500, 19, 0.5);
    ctx.fillStyle = 'rgba(241,238,232,0.7)';
    info.forEach((s, i) => {
      const p = tw(t, T.typing[0] + i * 0.17, 0.3, E.linear);
      if (p > 0) ctx.fillText(typed(s, p), x0, 790 + i * 30);
    });
    // menacing ゴ
    const gs = [[800, 800, 74, -0.12], [890, 740, 58, 0.1], [960, 822, 66, -0.05]];
    gs.forEach(([x, y, s, r], i) => {
      const lt = t - T.menace1 - i * 0.12;
      if (lt < 0) return;
      const pop = 1 + 0.6 * Math.exp(-lt * 12) * Math.cos(lt * 30);
      const bob = Math.sin((t + i) * 5) * 4;
      menacing(ctx, x, y + bob, s * pop, clamp(lt / 0.08), r);
    });
    ctx.restore();
  },
};
