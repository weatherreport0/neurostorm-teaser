// Shot 2 (2.0-2.5s): НЕЙРО/ШТОРМ slam with lightning, then (2.5-4.0s) six category flashes.
import { tw, E, inv, lerp, clamp, impulse, spring, hash2, stepT, TAU } from '../lib/util.js';
import { F, C, font, fitSize, drawGlyphs, lightning, drawLightning, scribbleZig, markerStroke, menacing } from '../lib/draw.js';
import { T } from '../timeline.js';

const BOLT1 = lightning(11, 1500, -40, 1180, 1120, { detail: 8, disp: 0.28, branches: 5 });
const BOLT2 = lightning(23, 380, -40, 760, 1120, { detail: 8, disp: 0.3, branches: 4 });

export const storm = {
  t0: T.storm, t1: T.cats[0],
  cam(t) {
    const lt = t - T.storm;
    return { zoom: 1.0 + 0.06 * (1 - E.outExpo(clamp(lt / 0.5))) + lt * 0.05, c: [960, 540], rot: 0 };
  },
  bg(t, bg) {
    bg.uStorm = 1.0; bg.uIso = 0.25;
    bg.uLit = 0.8 * impulse(t, T.storm, 7) + 0.6 * impulse(t, T.bolt2, 9);
    bg.uLitPos = t < T.bolt2 ? [1300, 300] : [560, 300];
    bg.uFlash = 1.0 * impulse(t, T.storm, 28);
    bg.uSpeed = 0.9 * impulse(t, T.storm, 5);
    bg.uSpeedSeed = stepT(t, 20);
  },
  hud: () => ({ alpha: 0.9, ticker: false }),
  draw(ctx, t) {
    const lt = t - T.storm;
    // lightning behind text
    const b1 = impulse(t, T.storm, 5) * (0.75 + 0.25 * Math.sin(t * 90));
    drawLightning(ctx, BOLT1, tw(t, T.storm - 0.01, 0.05, E.linear), b1, C.red, '#fff', 1.2);
    const b2 = impulse(t, T.bolt2, 6) * (0.75 + 0.25 * Math.sin(t * 77));
    if (t >= T.bolt2) drawLightning(ctx, BOLT2, tw(t, T.bolt2, 0.05, E.linear), b2, C.red, '#fff', 1.1);

    const size = fitSize(ctx, 'ШТОРМ', F.cond, 900, 1320, 640);
    font(ctx, F.cond, 900, size, 0);
    ctx.textBaseline = 'alphabetic';
    // slice offset on second bolt
    const slice = 34 * impulse(t, T.bolt2, 10) * (t >= T.bolt2 ? 1 : 0);
    const drawWord = (word, y, mode, t0) => {
      const s = 1 + 0.35 * (1 - E.outExpo(clamp((t - t0) / 0.4)));
      ctx.save();
      ctx.translate(960, y - size * 0.35);
      ctx.scale(s, s);
      ctx.translate(-960, -(y - size * 0.35));
      const halves = slice > 0.5 ? [[-1, 0], [1, 1]] : [[0, -1]];
      for (const [dir, part] of halves) {
        ctx.save();
        if (part >= 0) {
          ctx.beginPath();
          // diagonal cut following bolt 2 roughly
          if (part === 0) { ctx.moveTo(0, 0); ctx.lineTo(1920, 0); ctx.lineTo(1920, y - size * 0.42); ctx.lineTo(0, y - size * 0.22); }
          else { ctx.moveTo(0, y - size * 0.22); ctx.lineTo(1920, y - size * 0.42); ctx.lineTo(1920, 1080); ctx.lineTo(0, 1080); }
          ctx.clip();
          ctx.translate(dir * slice, 0);
        }
        drawGlyphs(ctx, word, 960, y, 'center', (i, n) => {
          const gt = t - t0 - Math.abs(i - (n - 1) / 2) * 0.025;
          const sp = spring(gt, 5, 0.42);
          return { dy: (1 - sp) * size * 0.35 * (i % 2 ? 1 : -1), a: clamp(gt / 0.04), fill: C.paper, stroke: C.paper, lw: 5 };
        }, mode);
        ctx.restore();
      }
      ctx.restore();
    };
    drawWord('НЕЙРО', 520, 'stroke', T.storm + 0.05);
    drawWord('ШТОРМ', 1000, 'fill', T.storm);
    // red bar accent
    const bw = tw(t, T.storm + 0.1, 0.3, E.outExpo);
    ctx.fillStyle = C.red;
    ctx.fillRect(960 - 330 * bw, 553, 660 * bw, 12);
  },
};

const CATS = [
  { word: 'ТЕКСТЫ', tools: 'CHATGPT · CLAUDE · DEEPSEEK · GEMINI', bg: C.black, fg: C.paper },
  { word: 'КАРТИНКИ', tools: 'MIDJOURNEY · FLUX · IDEOGRAM', bg: C.paper, fg: C.ink },
  { word: 'ВИДЕО', tools: 'KLING · VEO · SORA · RUNWAY', bg: C.black, fg: C.paper },
  { word: 'МУЗЫКА', tools: 'SUNO · UDIO', bg: C.red, fg: C.ink },
  { word: 'КОД', tools: 'CLAUDE CODE · CODEX · CURSOR', bg: C.black, fg: C.paper },
  { word: 'АГЕНТЫ', tools: 'АВТОМАТИЗАЦИЯ ВСЕГО', bg: C.paper, fg: C.ink },
];

const CODE = ['const guide = await neuro.load("v1.1")', 'for (const tool of guide.tools) learn(tool)', 'if (likes >= 70) release()', 'await vpn.connect("NL")', 'prompt: "сделай красиво, без ошибок"', '// TODO: решать проблемы по-крупному'];

export const cats = {
  t0: T.cats[0], t1: T.stand,
  idx(t) { return clamp(Math.floor((t - T.cats[0]) / 0.25), 0, 5); },
  cam(t) {
    const k = this.idx(t), lt = t - T.cats[k];
    return { zoom: 1 + 0.12 * (1 - E.outExpo(clamp(lt / 0.2))) + lt * 0.16, c: [960, 540], rot: (k % 2 ? 1 : -1) * 0.02 * (1 - E.outExpo(clamp(lt / 0.2))) };
  },
  bg(t, bg) {
    const k = this.idx(t);
    bg.uStorm = CATS[k].bg === C.black ? 0.5 : 0;
    bg.uIso = CATS[k].bg === C.black ? 0.2 : 0;
    bg.uFlash = 0.18 * impulse(t, T.cats[k], 30);
  },
  hud: () => ({ alpha: 0.9, ticker: false }),
  draw(ctx, t) {
    const k = this.idx(t), c = CATS[k], lt = t - T.cats[k];
    if (c.bg !== C.black) { ctx.fillStyle = c.bg; ctx.fillRect(-400, -300, 2720, 1680); }
    ctx.textBaseline = 'alphabetic';
    const cyB = 700;
    // per-style backgrounds
    if (k === 2) { // film strip
      for (const yb of [140, 870]) {
        ctx.fillStyle = 'rgba(241,238,232,0.9)'; ctx.fillRect(-100, yb, 2120, 70);
        ctx.fillStyle = C.black;
        const off = (lt * 1400) % 64;
        for (let x = -100 - off; x < 2020; x += 64) ctx.fillRect(x, yb + 20, 34, 30);
      }
    }
    if (k === 3) { // EQ bars
      const st = stepT(t, 24);
      for (let i = 0; i < 48; i++) {
        const h = 120 + 560 * Math.pow(hash2(i, Math.floor(st * 24)), 1.8);
        ctx.fillStyle = 'rgba(6,6,6,0.16)';
        ctx.fillRect(i * 40 + 4, 1080 - h, 30, h);
      }
    }
    if (k === 4) { // code rain
      font(ctx, F.mono, 500, 20, 0);
      ctx.textAlign = 'left';
      for (let i = 0; i < 18; i++) {
        ctx.fillStyle = `rgba(241,238,232,${0.07 + 0.08 * hash2(i, 3)})`;
        ctx.fillText(CODE[i % CODE.length], 120 + (i % 3) * 560, 120 + i * 50 - lt * 160);
      }
    }
    // main word
    const size = fitSize(ctx, c.word, k === 4 ? F.mono : F.cond, 900, k === 4 ? 900 : 1560, k === 4 ? 460 : 560);
    font(ctx, k === 4 ? F.mono : F.cond, k === 4 ? 800 : 900, size, 0);
    ctx.fillStyle = c.fg; ctx.strokeStyle = c.fg;
    if (k === 5) { // echo stack
      for (let e = 5; e >= 1; e--) {
        ctx.save();
        ctx.globalAlpha = 0.18 + 0.1 * (5 - e) / 5;
        ctx.lineWidth = 3;
        font(ctx, F.cond, 900, size, 0);
        ctx.textAlign = 'center';
        ctx.strokeText(c.word, 960, cyB - e * 105 * E.outExpo(clamp(lt / 0.22)));
        ctx.restore();
      }
    }
    const slide = k === 2 ? 420 * (1 - E.outExpo(clamp(lt / 0.18))) : 0;
    const stretch = k === 2 ? 1 + 0.35 * (1 - E.outExpo(clamp(lt / 0.2))) : 1;
    ctx.save();
    ctx.translate(960 + slide, cyB);
    ctx.scale(stretch, 1);
    const text = k === 4 ? '>КОД' : c.word;
    const nShow = k === 0 ? Math.ceil(clamp(lt / 0.09) * text.length) : text.length;
    const shown = [...text].slice(0, nShow).join('');
    ctx.textAlign = 'center';
    font(ctx, k === 4 ? F.mono : F.cond, k === 4 ? 800 : 900, size, 0);
    const fullW = ctx.measureText(text).width;
    ctx.textAlign = 'left';
    if (k === 4) {
      ctx.fillStyle = C.red; ctx.fillText('>', -fullW / 2, 0);
      ctx.fillStyle = c.fg; ctx.fillText('КОД', -fullW / 2 + ctx.measureText('>').width, 0);
    } else ctx.fillText(shown, -fullW / 2, 0);
    // caret
    if ((k === 0 || k === 4) && Math.floor(t * 8) % 2 === 0) {
      const cw = ctx.measureText(k === 4 ? text : shown).width;
      ctx.fillStyle = C.red; ctx.fillRect(-fullW / 2 + cw + 14, -size * 0.7, size * 0.09, size * 0.72);
    }
    ctx.restore();
    // censor scribble (channel's red marker) over the pictures word
    if (k === 1) {
      const zz = scribbleZig(77, 960 + fullW * 0.02, cyB - size * 0.72, fullW * 0.46, size * 0.74, 12);
      markerStroke(ctx, zz, 0, tw(lt, 0.02, 0.16, E.outCubic), 30);
    }
    // index + tools line
    font(ctx, F.mono, 700, 26, 3);
    ctx.textAlign = 'left';
    ctx.fillStyle = k === 3 ? C.ink : C.red;
    ctx.fillText(`[0${k + 1}/06]`, 960 - fullW / 2, cyB - size * 0.78);
    font(ctx, F.mono, 600, 28, 2);
    ctx.fillStyle = c.fg;
    ctx.globalAlpha = tw(lt, 0.03, 0.08, E.linear);
    ctx.fillText(c.tools, 960 - fullW / 2, cyB + 78);
    ctx.globalAlpha = 1;
    // progress segments
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = i <= k ? (k === 3 ? C.ink : C.red) : (c.bg === C.black ? 'rgba(241,238,232,0.2)' : 'rgba(6,6,6,0.2)');
      ctx.fillRect(760 + i * 70, 930, 60, 6);
    }
  },
};
