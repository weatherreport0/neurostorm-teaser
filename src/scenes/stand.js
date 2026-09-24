// Shot 3 (4-6s): JoJo stand card. 3D neural storm-cloud (the stand) raining prompts + stat hexagon.
import { tw, E, inv, lerp, clamp, impulse, spring, hash, hash2, rng, TAU, stepT } from '../lib/util.js';
import { F, C, font, fitSize, drawGlyphs, lightning, drawLightning, menacing, typed } from '../lib/draw.js';
import { T } from '../timeline.js';

// --- cloud geometry: cumulus lobes filled with nodes, kNN edges
const R0 = rng(4242);
const LOBES = [[-250, 20, 0, 190], [-60, -70, 20, 230], [150, -20, -30, 200], [320, 40, 10, 150], [40, 70, 60, 200], [-380, 70, -20, 120]];
const NODES = [];
for (let i = 0; i < 300; i++) {
  const L = LOBES[Math.floor(R0() * LOBES.length)];
  let x, y, z;
  do { x = R0() * 2 - 1; y = R0() * 2 - 1; z = R0() * 2 - 1; } while (x * x + y * y + z * z > 1);
  const r = L[3];
  y = Math.min(y, 0.55); // flat cloud base
  const th = R0() * Math.PI * 2, ph = Math.acos(R0() * 2 - 1), rs = 700 + R0() * 500;
  NODES.push({ x: L[0] + x * r, y: L[1] + y * r * 0.75, z: L[2] + z * r, sx: Math.sin(ph) * Math.cos(th) * rs, sy: Math.cos(ph) * rs * 0.6, sz: Math.sin(ph) * Math.sin(th) * rs, red: R0() < 0.12, d: R0() });
}
const EDGES = [];
NODES.forEach((a, i) => {
  const near = NODES.map((b, j) => [j, (a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2]).filter(v => v[0] !== i).sort((p, q) => p[1] - q[1]).slice(0, 3);
  near.forEach(([j]) => { if (j > i) EDGES.push([i, j, R0()]); });
});

const RAIN = ['промпт', '/imagine', 'сделай красиво', '4k', 'ultra realistic', '--ar 16:9', 'не галлюцинируй', 'пожалуйста', 'ещё раз', 'без ошибок', 'в стиле', 'а теперь видео', 'спасибо', 'короче', 'объясни как 5-летке'];

const STATS = [['СИЛА', 'A', 5], ['СКОРОСТЬ', 'A', 5], ['ДАЛЬНОСТЬ*', 'A', 5], ['СТОЙКОСТЬ', 'C', 3], ['ТОЧНОСТЬ**', 'B', 4], ['ПОТЕНЦИАЛ', 'A', 5]];
const HEX = { cx: 1368, cy: 628, r: 205 };
const BOLTS = T.strikes.map((s, i) => lightning(300 + i, 420 + i * 260, 610, 330 + i * 330, 1120, { detail: 7, disp: 0.3, branches: 3 }));

export const stand = {
  t0: T.stand, t1: T.cta[0],
  cam(t) {
    const lt = t - T.stand;
    return { zoom: 1.0 + 0.05 * E.outCubic(clamp(lt / 2)), c: [960, 540], rot: -0.008 + lt * 0.004 };
  },
  bg(t, bg) {
    bg.uStorm = 1.0; bg.uIso = 0.3; bg.uGridAmt = 0.3;
    let lit = 0;
    T.strikes.forEach(s => { lit += impulse(t, s, 6) * (t >= s ? 1 : 0); });
    bg.uLit = lit * 0.8;
    bg.uLitPos = [500, 600];
    bg.uFlash = 0.25 * impulse(t, T.stand, 28);
  },
  hud: () => ({ alpha: 1, ticker: true }),
  draw(ctx, t) {
    const lt = t - T.stand;
    // --- neural cloud (3D)
    const ry = 0.55 * t, rx = -0.18;
    const cosY = Math.cos(ry), sinY = Math.sin(ry), cosX = Math.cos(rx), sinX = Math.sin(rx);
    const CX = 560, CY = 430, FOC = 1300, DIST = 1500;
    let flash = 0;
    T.strikes.forEach(s => { if (t >= s) flash += impulse(t, s, 10); });
    const P = NODES.map((n, i) => {
      const as = spring(lt - 0.02 - n.d * 0.25, 2.4, 0.7);
      const x0 = lerp(n.sx, n.x, as), y0 = lerp(n.sy, n.y, as), z0 = lerp(n.sz, n.z, as);
      const x1 = x0 * cosY + z0 * sinY, z1 = -x0 * sinY + z0 * cosY;
      const y1 = y0 * cosX - z1 * sinX, z2 = y0 * sinX + z1 * cosX;
      const s = FOC / (DIST + z2);
      return { x: CX + x1 * s, y: CY + y1 * s, s, z: z2, as: clamp(as) };
    });
    ctx.lineWidth = 1;
    EDGES.forEach(([i, j, r]) => {
      const a = P[i], b = P[j];
      const depth = clamp(1.2 - (a.z + b.z) / 900);
      const k = Math.pow(a.as * b.as, 3);
      if (k < 0.01) return;
      ctx.strokeStyle = `rgba(241,238,232,${(0.07 + 0.22 * depth + 0.4 * flash) * k})`;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      if (r < 0.28) { // signal pulse
        const f = (t * (0.8 + r * 2) + r * 7) % 1;
        ctx.fillStyle = C.red;
        ctx.fillRect(lerp(a.x, b.x, f) - 2, lerp(a.y, b.y, f) - 2, 4, 4);
      }
    });
    P.forEach((p, i) => {
      const n = NODES[i];
      const sz = 1.6 + 3.2 * p.s * (n.red ? 1.5 : 1);
      const tw8 = 0.6 + 0.4 * Math.sin(t * 7 + i);
      ctx.fillStyle = n.red ? C.red : `rgba(241,238,232,${0.55 * tw8 + 0.45 * flash})`;
      ctx.fillRect(p.x - sz / 2, p.y - sz / 2, sz, sz);
    });
    // --- prompt rain
    font(ctx, F.mono, 500, 17, 0);
    ctx.textAlign = 'left';
    const rainA = tw(lt, 0.25, 0.4, E.outCubic);
    for (let i = 0; i < 54; i++) {
      const ph = hash(i * 7 + 1), sp = 0.85 + hash(i * 13) * 0.6;
      const f = (lt * sp * 1.1 + ph) % 1;
      const x = 180 + hash(i * 3 + 2) * 760 - f * 90;
      const y = 600 + f * 380;
      ctx.fillStyle = `rgba(241,238,232,${rainA * (0.18 + 0.4 * hash(i)) * (1 - f)})`;
      ctx.save(); ctx.translate(x, y); ctx.rotate(1.35);
      ctx.fillText(RAIN[i % RAIN.length], 0, 0);
      ctx.restore();
    }
    // --- lightning strikes from cloud base
    T.strikes.forEach((s, i) => {
      if (t < s) return;
      const a = impulse(t, s, 5) * (0.7 + 0.3 * Math.sin(t * 110 + i));
      drawLightning(ctx, BOLTS[i], tw(t, s, 0.05, E.linear), a, C.red, '#fff', 1);
    });
    // --- menacing
    [[150, 250, 78, -0.1], [246, 196, 62, 0.08], [332, 262, 70, -0.04]].forEach(([x, y, s, r], i) => {
      const gt = lt - 0.2 - i * 0.1;
      if (gt < 0) return;
      const pop = 1 + 0.5 * Math.exp(-gt * 12) * Math.cos(gt * 28);
      menacing(ctx, x, y + Math.sin((t + i) * 5) * 4, s * pop, clamp(gt / 0.08), r);
    });

    // --- stand card
    const X = 1010;
    font(ctx, F.mono, 600, 18, 3);
    ctx.textAlign = 'left';
    ctx.fillStyle = C.red;
    ctx.fillText(typed('СТЕНД // STAND NAME', tw(lt, 0.02, 0.25, E.linear)), X, 150);
    const rule = tw(lt, 0.05, 0.5, E.outExpo);
    ctx.fillStyle = 'rgba(241,238,232,0.35)'; ctx.fillRect(X, 164, 810 * rule, 1.5);
    font(ctx, F.jp, 400, fitSize(ctx, '「WEATHER REPORT」', F.jp, 400, 830, 74), 0);
    ctx.textBaseline = 'alphabetic';
    drawGlyphs(ctx, '「WEATHER REPORT」', X - 14, 250, 'left', (i, n) => {
      const gt = lt - 0.08 - i * 0.022;
      const e = E.outExpo(clamp(gt / 0.3));
      return { s: lerp(2.2, 1, e), a: clamp(gt / 0.05), fill: (i === 0 || i === n - 1) ? C.red : C.paper };
    });
    font(ctx, F.mono, 500, 20, 1);
    ctx.fillStyle = 'rgba(241,238,232,0.8)';
    ctx.fillText(typed('ПОЛЬЗОВАТЕЛЬ: weather report', tw(lt, 0.3, 0.3, E.linear)), X, 296);
    ctx.fillText(typed('СПОСОБНОСТЬ: управляет погодой. и нейросетями', tw(lt, 0.45, 0.35, E.linear)), X, 326);

    // hexagon chart
    const { cx, cy, r } = HEX;
    const hp = tw(t, T.hexStart - 0.1, 0.5, E.outExpo);
    const ang = i => -Math.PI / 2 + i * TAU / 6;
    for (let g = 1; g <= 5; g++) {
      ctx.strokeStyle = `rgba(241,238,232,${g === 5 ? 0.5 : 0.16})`;
      ctx.lineWidth = g === 5 ? 1.8 : 1;
      ctx.beginPath();
      for (let i = 0; i <= 6; i++) {
        const rr = r * g / 5 * hp;
        const x = cx + Math.cos(ang(i) + (1 - hp) * 0.6) * rr, y = cy + Math.sin(ang(i) + (1 - hp) * 0.6) * rr;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
    for (let i = 0; i < 6; i++) {
      ctx.strokeStyle = 'rgba(241,238,232,0.18)';
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(ang(i)) * r * hp, cy + Math.sin(ang(i)) * r * hp); ctx.stroke();
    }
    // stat polygon (per-vertex springs)
    const vs = STATS.map((s, i) => {
      const sp = spring(t - T.hexStart - i * 0.06, 3.2, 0.38);
      const rr = r * s[2] / 5 * sp;
      return [cx + Math.cos(ang(i)) * rr, cy + Math.sin(ang(i)) * rr, sp];
    });
    ctx.beginPath();
    vs.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,42,30,0.38)'; ctx.fill();
    ctx.strokeStyle = C.red; ctx.lineWidth = 3.5; ctx.lineJoin = 'round'; ctx.stroke();
    vs.forEach(([x, y, sp]) => { if (sp > 0.01) { ctx.fillStyle = C.white; ctx.fillRect(x - 4, y - 4, 8, 8); } });
    // labels + grades
    STATS.forEach(([label, grade], i) => {
      const gt = t - T.hexStart - 0.05 - i * 0.06;
      if (gt < 0) return;
      const a = ang(i);
      const bx = cx + Math.cos(a) * (r + 30), by = cy + Math.sin(a) * (r + 30);
      const al = clamp(gt / 0.12);
      font(ctx, F.cond, 800, 30, 2);
      const side = Math.abs(Math.cos(a)) < 0.2 ? 0 : Math.cos(a) > 0 ? 1 : -1;
      ctx.textAlign = side === 0 ? 'center' : side > 0 ? 'left' : 'right';
      ctx.fillStyle = `rgba(241,238,232,${al})`;
      if (side === 0) ctx.fillText(label, bx, by + (Math.sin(a) < 0 ? -34 : 52));
      else ctx.fillText(label, bx + side * 32, by + 11);
      // grade badge
      const pop = spring(gt - 0.05, 4, 0.35);
      ctx.save();
      ctx.translate(bx, by); ctx.scale(pop, pop);
      ctx.fillStyle = grade === 'A' ? C.red : C.paper;
      ctx.beginPath(); ctx.arc(0, 0, 21, 0, TAU); ctx.fill();
      font(ctx, F.jp, 400, 28, 0);
      ctx.fillStyle = grade === 'A' ? C.white : C.ink;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(grade, 0, 2);
      ctx.restore();
      ctx.textBaseline = 'alphabetic';
    });
    // footnotes
    font(ctx, F.mono, 500, 17, 0.5);
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(241,238,232,0.6)';
    ctx.fillText(typed('*  с VPN', tw(lt, 1.0, 0.15, E.linear)), X, 905);
    ctx.fillText(typed('** иногда галлюцинирует', tw(lt, 1.12, 0.3, E.linear)), X, 931);
  },
};
