// Broadcast HUD overlay: corners, REC, timecode, news ticker.
import { tw, E, clamp, FPS } from '../lib/util.js';
import { F, C, font, corners, typed } from '../lib/draw.js';

const TICKER = 'ОСАДКИ: ПРОМПТЫ, 100%   •   ВЕТЕР: ПЕРЕМЕН   •   ОЩУЩАЕТСЯ КАК +70 ЛАЙКОВ   •   ВИДИМОСТЬ: С VPN ОТЛИЧНАЯ   •   УЛИТКИ: НЕ ОЖИДАЮТСЯ   •   ГАЙД НА НЕЙРОСЕТИ v1.1 — В РАЗРАБОТКЕ   •   ';

export function drawHud(ctx, t, o = {}) {
  const { alpha = 1, ticker = true, top = true } = o;
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  // corners draw-on
  const cp = tw(t, 0.0, 0.5, E.outExpo);
  corners(ctx, 40, 44 * cp, 2, 'rgba(241,238,232,0.55)');

  if (top) {
    const tp = tw(t, 0.05, 0.35, E.outCubic);
    ctx.textBaseline = 'alphabetic';
    // REC dot
    const blink = Math.floor(t * 2) % 2 === 0 ? 1 : 0.25;
    ctx.fillStyle = C.red;
    ctx.globalAlpha = alpha * tp * blink;
    ctx.beginPath(); ctx.arc(86, 82, 8, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = alpha * tp;
    font(ctx, F.mono, 700, 19, 2);
    ctx.fillStyle = C.paper; ctx.textAlign = 'left';
    ctx.fillText('REC', 104, 89);
    font(ctx, F.mono, 500, 17, 2);
    ctx.fillStyle = 'rgba(241,238,232,0.62)';
    ctx.fillText(typed('WEATHER REPORT // ЭКСТРЕННЫЙ ВЫПУСК', tw(t, 0.1, 0.5, E.linear)), 170, 89);
    // timecode (real TC of the video)
    const f = Math.floor(t * FPS + 1e-4);
    const ss = Math.floor(f / FPS), ff = f % FPS;
    const tc = `TC 00:00:${String(ss).padStart(2, '0')}:${String(ff).padStart(2, '0')}`;
    font(ctx, F.mono, 500, 17, 2);
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(241,238,232,0.62)';
    ctx.fillText(tc, 1760, 89);
    // LIVE tag
    ctx.fillStyle = C.red;
    ctx.fillRect(1774, 68, 72, 28);
    font(ctx, F.mono, 800, 16, 2);
    ctx.fillStyle = C.white; ctx.textAlign = 'center';
    ctx.fillText('LIVE', 1811, 88);
  }

  if (ticker) {
    const k = tw(t, 0.2, 0.45, E.outExpo);
    const y = 968, h = 44;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.beginPath(); ctx.rect(80, y, 1760 * k, h); ctx.clip();
    ctx.fillStyle = 'rgba(6,6,6,0.82)';
    ctx.fillRect(80, y, 1760, h);
    ctx.fillStyle = 'rgba(241,238,232,0.25)';
    ctx.fillRect(80, y, 1760, 1);
    // label block
    ctx.fillStyle = C.red;
    ctx.fillRect(80, y, 168, h);
    font(ctx, F.cond, 900, 30, 3);
    ctx.fillStyle = C.white; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('СРОЧНО', 164, y + h / 2 + 1);
    // marquee
    ctx.beginPath(); ctx.rect(260, y, 1580, h); ctx.clip();
    font(ctx, F.mono, 600, 19, 1);
    ctx.textAlign = 'left';
    ctx.fillStyle = C.paper;
    const tw1 = ctx.measureText(TICKER).width;
    const x = 1840 - ((t * 260) % tw1) - 900;
    for (let i = -1; i < 3; i++) ctx.fillText(TICKER, x + i * tw1, y + h / 2 + 1);
    ctx.restore();
  }
  ctx.restore();
}
