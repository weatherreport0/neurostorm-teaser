// 2D drawing helpers: typography, strokes, lightning, scribbles, manga SFX.
import { rng, clamp, lerp, TAU, hash2, noise1 } from './util.js';

export const F = {
  display: '"Unbounded"',
  cond: '"Sofia Sans Extra Condensed"',
  mono: '"JetBrains Mono"',
  hand: '"Caveat"',
  jp: '"Dela Gothic One"',
};
export const C = {
  black: '#060606', ink: '#0B0B0C', paper: '#F1EEE8', white: '#FFFFFF',
  red: '#FF2A1E', redDeep: '#B80F09', grey: '#8C8C8C', dim: 'rgba(241,238,232,0.55)',
};

export function font(ctx, fam, weight, size, spacing = 0) {
  ctx.font = `${weight} ${size}px ${fam}`;
  ctx.letterSpacing = spacing ? `${spacing}px` : '0px';
}

export function fitSize(ctx, text, fam, weight, maxW, maxSize) {
  font(ctx, fam, weight, 100);
  const w = ctx.measureText(text).width;
  return Math.min(maxSize, (maxW / w) * 100);
}

// Glyph positions honoring kerning via prefix widths.
export function glyphLayout(ctx, text) {
  const chars = [...text];
  const xs = [];
  let prefix = '';
  for (const ch of chars) { xs.push(ctx.measureText(prefix).width); prefix += ch; }
  const total = ctx.measureText(text).width;
  const ws = chars.map((ch, i) => (i < chars.length - 1 ? xs[i + 1] - xs[i] : total - xs[i]));
  return { chars, xs, ws, total };
}

// Draw text glyph-by-glyph with a per-glyph transform callback.
// fn(i, n) -> { dx, dy, s, sx, sy, r, a, fill, stroke, lw, skip }
export function drawGlyphs(ctx, text, x, y, align, fn, mode = 'fill') {
  const L = glyphLayout(ctx, text);
  const x0 = align === 'center' ? x - L.total / 2 : align === 'right' ? x - L.total : x;
  const prevAlign = ctx.textAlign;
  ctx.textAlign = 'center';
  const ls = ctx.letterSpacing;
  ctx.letterSpacing = '0px';
  L.chars.forEach((ch, i) => {
    const g = fn ? fn(i, L.chars.length) : {};
    if (g.skip) return;
    const a = g.a ?? 1;
    if (a <= 0.001) return;
    ctx.save();
    ctx.globalAlpha *= a;
    ctx.translate(x0 + L.xs[i] + L.ws[i] / 2 + (g.dx || 0), y + (g.dy || 0));
    if (g.r) ctx.rotate(g.r);
    const s = g.s ?? 1;
    ctx.scale(s * (g.sx ?? 1), s * (g.sy ?? 1));
    if (mode === 'fill' || mode === 'both') { if (g.fill) ctx.fillStyle = g.fill; ctx.fillText(ch, 0, 0); }
    if (mode === 'stroke' || mode === 'both') { if (g.stroke) ctx.strokeStyle = g.stroke; if (g.lw) ctx.lineWidth = g.lw; ctx.strokeText(ch, 0, 0); }
    ctx.restore();
  });
  ctx.textAlign = prevAlign;
  ctx.letterSpacing = ls;
  return L;
}

// Masked line reveal: text slides up from below a clip line.
export function maskedText(ctx, text, x, y, p, opts = {}) {
  const { align = 'left', h = 200, from = 1.05, mode = 'fill' } = opts;
  const m = ctx.measureText(text);
  const w = m.width;
  const x0 = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0 - 40, y - h, w + 80, h * 1.25);
  ctx.clip();
  const dy = (1 - p) * h * from;
  if (mode !== 'stroke') ctx.fillText(text, x0 + (ctx.textAlign === 'center' ? w / 2 : ctx.textAlign === 'right' ? w : 0), y + dy);
  if (mode !== 'fill') ctx.strokeText(text, x0 + (ctx.textAlign === 'center' ? w / 2 : ctx.textAlign === 'right' ? w : 0), y + dy);
  ctx.restore();
}

// Polyline partial drawing by arc-length fraction [a, b].
export function strokePartial(ctx, pts, a, b) {
  if (b <= a || pts.length < 2) return;
  const segs = [];
  let total = 0;
  for (let i = 1; i < pts.length; i++) {
    const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    segs.push(l); total += l;
  }
  const la = a * total, lb = b * total;
  let acc = 0, started = false;
  ctx.beginPath();
  for (let i = 1; i < pts.length; i++) {
    const l = segs[i - 1];
    const s0 = acc, s1 = acc + l;
    acc = s1;
    if (s1 < la) continue;
    if (s0 > lb) break;
    const t0 = l > 0 ? clamp((la - s0) / l) : 0;
    const t1 = l > 0 ? clamp((lb - s0) / l) : 1;
    const p0 = [lerp(pts[i - 1][0], pts[i][0], t0), lerp(pts[i - 1][1], pts[i][1], t0)];
    const p1 = [lerp(pts[i - 1][0], pts[i][0], t1), lerp(pts[i - 1][1], pts[i][1], t1)];
    if (!started) { ctx.moveTo(p0[0], p0[1]); started = true; }
    ctx.lineTo(p1[0], p1[1]);
  }
  ctx.stroke();
}

// Hand-drawn loop around an ellipse (marker circle).
export function scribbleLoop(seed, cx, cy, rx, ry, turns = 1.25, wobble = 0.08) {
  const R = rng(seed);
  const pts = [];
  const n = Math.ceil(90 * turns);
  const a0 = -Math.PI * 0.8 + R() * 0.5;
  const ph = R() * 10;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const a = a0 + t * TAU * turns;
    const grow = 1 + (t - 0.5) * 0.14;
    const wob = 1 + noise1(t * 6 + ph, seed) * wobble;
    pts.push([cx + Math.cos(a) * rx * grow * wob, cy + Math.sin(a) * ry * grow * wob + t * ry * 0.08]);
  }
  return pts;
}

// Aggressive zigzag censor scribble filling a box (like the channel's red marker).
export function scribbleZig(seed, x, y, w, h, passes = 14) {
  const R = rng(seed);
  const pts = [];
  for (let i = 0; i <= passes; i++) {
    const t = i / passes;
    const yy = y + (t * 0.9 + 0.05) * h + (R() - 0.5) * h * 0.12;
    const xL = x + R() * w * 0.12, xR = x + w - R() * w * 0.12;
    if (i % 2 === 0) { pts.push([xL, yy]); pts.push([xR, yy - h * (0.06 + R() * 0.1)]); }
    else { pts.push([xR, yy]); pts.push([xL, yy - h * (0.06 + R() * 0.1)]); }
  }
  return pts;
}

// Underline stroke (slightly wavy)
export function scribbleLine(seed, x0, y0, x1, y1, back = true) {
  const R = rng(seed);
  const pts = [];
  const n = 30;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push([lerp(x0, x1, t), lerp(y0, y1, t) + Math.sin(t * 7 + R() * 0.3) * 3 + (R() - 0.5) * 2]);
  }
  if (back) {
    for (let i = n; i >= 0; i--) {
      const t = i / n;
      pts.push([lerp(x0, x1, t) + 10, lerp(y0, y1, t) + 12 + Math.sin(t * 5) * 3]);
    }
  }
  return pts;
}

export function markerStroke(ctx, pts, a, b, width, color = C.red) {
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = color; ctx.lineWidth = width;
  strokePartial(ctx, pts, a, b);
  ctx.globalAlpha *= 0.35; ctx.lineWidth = width * 0.45;
  ctx.strokeStyle = '#ff8a7a';
  strokePartial(ctx, pts.map(p => [p[0] - width * 0.12, p[1] - width * 0.12]), a, b);
  ctx.restore();
}

// Lightning: midpoint displacement with branches. Returns [{pts, w}] (w: width scale).
export function lightning(seed, x0, y0, x1, y1, opts = {}) {
  const { detail = 7, disp = 0.22, branches = 4 } = opts;
  const R = rng(seed);
  function build(ax, ay, bx, by, d, rough) {
    let pts = [[ax, ay], [bx, by]];
    for (let k = 0; k < d; k++) {
      const np = [pts[0]];
      for (let i = 1; i < pts.length; i++) {
        const [px, py] = pts[i - 1], [qx, qy] = pts[i];
        const len = Math.hypot(qx - px, qy - py);
        const nx = -(qy - py) / (len || 1), ny = (qx - px) / (len || 1);
        const off = (R() - 0.5) * len * rough;
        np.push([(px + qx) / 2 + nx * off, (py + qy) / 2 + ny * off]);
        np.push(pts[i]);
      }
      pts = np;
    }
    return pts;
  }
  const main = build(x0, y0, x1, y1, detail, disp);
  const out = [{ pts: main, w: 1 }];
  for (let b = 0; b < branches; b++) {
    const i = Math.floor((0.15 + R() * 0.6) * main.length);
    const [sx, sy] = main[i];
    const dirx = x1 - x0, diry = y1 - y0;
    const L = Math.hypot(dirx, diry) * (0.18 + R() * 0.25);
    const ang = Math.atan2(diry, dirx) + (R() < 0.5 ? -1 : 1) * (0.35 + R() * 0.6);
    const bp = build(sx, sy, sx + Math.cos(ang) * L, sy + Math.sin(ang) * L, detail - 2, disp * 1.2);
    out.push({ pts: bp, w: 0.45, start: i / main.length });
  }
  return out;
}

// Draw lightning with glow; p = reveal (0..1 along main), a = alpha
export function drawLightning(ctx, bolts, p, a, color = C.red, core = '#fff', width = 1) {
  if (a <= 0) return;
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (const pass of [{ lw: 26, c: color, al: 0.10 }, { lw: 12, c: color, al: 0.35 }, { lw: 5, c: color, al: 0.9 }, { lw: 2.2, c: core, al: 1 }]) {
    ctx.strokeStyle = pass.c;
    for (const b of bolts) {
      const bp = b.start != null ? clamp((p - b.start) / (1 - b.start)) : p;
      if (bp <= 0) continue;
      ctx.globalAlpha = a * pass.al;
      ctx.lineWidth = pass.lw * b.w * width;
      strokePartial(ctx, b.pts, 0, bp);
    }
  }
  ctx.restore();
}

// Manga "ゴ" menacing SFX glyph (red fill, black inner stroke, white outer stroke)
export function menacing(ctx, x, y, size, a = 1, r = 0, ch = 'ゴ') {
  if (a <= 0.001) return;
  ctx.save();
  ctx.globalAlpha *= a;
  ctx.translate(x, y); ctx.rotate(r);
  ctx.font = `400 ${size}px ${F.jp}`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = C.paper; ctx.lineWidth = size * 0.16; ctx.strokeText(ch, 0, 0);
  ctx.strokeStyle = C.black; ctx.lineWidth = size * 0.08; ctx.strokeText(ch, 0, 0);
  ctx.fillStyle = C.red; ctx.fillText(ch, 0, 0);
  ctx.restore();
}

export function corners(ctx, inset, len, lw = 2, color = C.dim) {
  ctx.save();
  ctx.strokeStyle = color; ctx.lineWidth = lw;
  const W = ctx.canvas.width, H = ctx.canvas.height;
  const L = inset, T = inset, R = W - inset, B = H - inset;
  ctx.beginPath();
  ctx.moveTo(L, T + len); ctx.lineTo(L, T); ctx.lineTo(L + len, T);
  ctx.moveTo(R - len, T); ctx.lineTo(R, T); ctx.lineTo(R, T + len);
  ctx.moveTo(R, B - len); ctx.lineTo(R, B); ctx.lineTo(R - len, B);
  ctx.moveTo(L + len, B); ctx.lineTo(L, B); ctx.lineTo(L, B - len);
  ctx.stroke();
  ctx.restore();
}

// Decode/scramble text effect: characters resolve left->right.
const SCRAMBLE = 'АБВГДЕЖЗИКЛМНОПРСТУФХЦЧШЩЭЮЯ0123456789#$%&@*/+=<>';
export function scramble(text, p, seed = 1, t = 0) {
  const n = text.length;
  let out = '';
  for (let i = 0; i < n; i++) {
    const reveal = p * (n + 6) - i;
    if (reveal >= 6 || text[i] === ' ') out += text[i];
    else if (reveal > 0) out += SCRAMBLE[Math.floor(hash2(i + seed * 101, Math.floor(t * 30)) * SCRAMBLE.length)];
    else out += ' ';
  }
  return out;
}

// Typewriter substring
export const typed = (text, p) => [...text].slice(0, Math.floor(clamp(p) * [...text].length + 1e-6)).join('');
