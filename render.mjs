// Render driver: static server + headless Chrome + ffmpeg.
//   node render.mjs probe                 -> print WebGL renderer info
//   node render.mjs stills 0,30,60 [sub]  -> out/stills/fXXXX.png
//   node render.mjs stills every=15 [sub]
//   node render.mjs audio                 -> out/audio.wav
//   node render.mjs video [sub]           -> out/weather_report_teaser.mp4
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(ROOT, 'out');
const CHROME = process.env.CHROME_PATH || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].find(p => fs.existsSync(p));
const W = 1920, H = 1080, FPS = 60;

const [mode = 'probe', arg1 = '', arg2 = ''] = process.argv.slice(2);
fs.mkdirSync(path.join(OUT, 'stills'), { recursive: true });

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json' };

let ffmpeg = null;
let frameCount = 0;
let doneResolve;
const done = new Promise(r => (doneResolve = r));

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function startFfmpeg(file) {
  const args = ['-y', '-hide_banner', '-loglevel', 'error',
    '-f', 'rawvideo', '-pix_fmt', 'rgba', '-s', `${W}x${H}`, '-r', String(FPS), '-i', '-',
    '-vf', 'vflip,scale=out_color_matrix=bt709:out_range=tv,format=yuv420p',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-tune', 'film', '-maxrate', '32M', '-bufsize', '64M', '-g', '60',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
    '-movflags', '+faststart', file];
  const p = spawn('ffmpeg', args, { stdio: ['pipe', 'inherit', 'inherit'] });
  p.done = new Promise(r => p.on('close', r));
  return p;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  try {
    if (req.method === 'POST') {
      const body = await readBody(req);
      if (url.pathname === '/frame') {
        if (!ffmpeg.stdin.write(body)) await new Promise(r => ffmpeg.stdin.once('drain', r));
        frameCount++;
        if (frameCount % 60 === 0) process.stdout.write(`  frame ${frameCount}\n`);
      } else if (url.pathname === '/still') {
        fs.writeFileSync(path.join(OUT, 'stills', url.searchParams.get('name') + '.png'), body);
      } else if (url.pathname === '/audio') {
        fs.writeFileSync(path.join(OUT, 'audio.wav'), body);
        console.log('  audio.wav written', body.length, 'bytes');
      } else if (url.pathname === '/sink') {
        // discard (transfer benchmark)
      } else if (url.pathname === '/log') {
        console.log('[page]', body.toString());
      } else if (url.pathname === '/done') {
        doneResolve(body.toString());
      }
      res.writeHead(200); res.end('ok');
      return;
    }
    let p = decodeURIComponent(url.pathname);
    if (p === '/') p = '/src/index.html';
    const file = path.join(ROOT, p);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  } catch (e) {
    console.error(e); res.writeHead(500); res.end(String(e));
  }
});

await new Promise(r => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: true,
  args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-gpu-rasterization',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--autoplay-policy=no-user-gesture-required',
    `--window-size=${W},${H}`, '--js-flags=--expose-gc'],
  protocolTimeout: 0,
});
const page = await browser.newPage();
await page.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
page.on('console', m => console.log('[console]', m.type(), m.text()));
page.on('pageerror', e => { console.error('[pageerror]', e.message); doneResolve('error'); });

const t0 = Date.now();
let query = `mode=${mode}`;
if (mode === 'stills') {
  query += `&frames=${encodeURIComponent(arg1)}` + (arg2 ? `&sub=${arg2}` : '');
} else if (mode === 'video') {
  query += arg1 ? `&sub=${arg1}` : '';
  ffmpeg = startFfmpeg(path.join(OUT, 'video_noaudio.mp4'));
}
await page.goto(`http://127.0.0.1:${port}/src/${mode === 'probe' ? 'probe' : 'index'}.html?${query}`);
const result = await done;
console.log('page finished:', result, `(${((Date.now() - t0) / 1000).toFixed(1)}s)`);

if (ffmpeg) {
  ffmpeg.stdin.end();
  await ffmpeg.done;
  const final = path.join(OUT, 'weather_report_teaser.mp4');
  await new Promise(r => {
    const p = spawn('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error',
      '-i', path.join(OUT, 'video_noaudio.mp4'), '-i', path.join(OUT, 'audio.wav'),
      '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '320k', '-ar', '48000',
      '-t', '10', '-movflags', '+faststart', final], { stdio: 'inherit' });
    p.on('close', r);
  });
  console.log('wrote', final, 'frames:', frameCount);
}

await browser.close();
server.close();
