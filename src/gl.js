// WebGL2 pipeline: per-subframe scene pass (procedural bg + 2D content) accumulated
// into a float buffer (motion blur), then bloom + post (CA, glitch, shock, grade, grain).
import { W, H } from './lib/util.js';

const VS = `#version 300 es
in vec2 aPos; void main(){ gl_Position = vec4(aPos, 0.0, 1.0); }`;

const COMMON = `#version 300 es
precision highp float;
uniform vec2 uRes;
out vec4 o;
float h21(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float h11(float x){ return fract(sin(x * 127.1) * 43758.5453); }
uint pcg(uint v){ uint s = v * 747796405u + 2891336453u; uint w = ((s >> ((s >> 28u) + 4u)) ^ s) * 277803737u; return (w >> 22u) ^ w; }
float hpx(vec2 p, float seed){ return float(pcg(uint(p.x) + pcg(uint(p.y) + pcg(uint(seed))))) / 4294967295.0; }
float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*f*(f*(f*6.0-15.0)+10.0);
  return mix(mix(h21(i), h21(i+vec2(1,0)), u.x), mix(h21(i+vec2(0,1)), h21(i+vec2(1,1)), u.x), u.y); }
float fbm(vec2 p){ float s = 0.0, a = 0.5; mat2 m = mat2(1.6, 1.2, -1.2, 1.6);
  for (int i = 0; i < 5; i++){ s += a * vnoise(p); p = m * p; a *= 0.5; } return s; }
vec2 rot(vec2 v, float a){ float c = cos(a), s = sin(a); return vec2(c*v.x - s*v.y, s*v.x + c*v.y); }
`;

const SCENE_FS = COMMON + `
uniform sampler2D uContent;
uniform float uTime, uWeight;
uniform vec2 uShake; uniform float uShakeRot;
uniform float uZoom, uRot; uniform vec2 uCamC;
uniform vec3 uBase;
uniform float uIso, uStorm, uRadar, uLit, uFlash, uSpeed, uGridAmt;
uniform vec2 uRadarC; uniform float uRadarR, uSweep;
uniform vec2 uLitPos; uniform vec3 uLitCol;
uniform float uSpeedSeed;
void main(){
  vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec2 c = uRes * 0.5;
  vec2 sp = c + rot(px - uShake - c, -uShakeRot);
  vec2 w = uCamC + rot((sp - c) / uZoom, -uRot);
  vec2 uv = w / uRes.y;
  float vgrad = sp.y / uRes.y;
  vec3 col = uBase * (1.0 + 0.35 * (1.0 - vgrad));

  // storm clouds (domain-warped fbm)
  if (uStorm > 0.0) {
    vec2 p = uv * 1.7 + vec2(uTime * 0.035, uTime * 0.01);
    vec2 q = vec2(fbm(p + vec2(0.0, uTime * 0.06)), fbm(p + vec2(5.2, 1.3) - uTime * 0.05));
    float n = fbm(p + 1.8 * q);
    float cloud = smoothstep(0.30, 0.95, n);
    float rim = smoothstep(0.55, 0.75, n) - smoothstep(0.75, 0.95, n);
    col += uStorm * (cloud * vec3(0.085, 0.085, 0.095) + rim * 0.02);
    float d = length(w - uLitPos) / uRes.y;
    col += uLit * uLitCol * cloud * (0.95 * exp(-d * 2.6) + 0.05);
    col += uLit * uLitCol * 0.012;
  }
  // isobars
  if (uIso > 0.0) {
    float v = fbm(uv * 0.75 + vec2(uTime * 0.015, -uTime * 0.01)) * 16.0;
    float dist = (0.5 - abs(fract(v) - 0.5)) / max(fwidth(v), 1e-4);
    float line = 1.0 - smoothstep(0.4, 1.4, dist);
    float major = step(0.5, fract(floor(v + 0.5) / 5.0 + 0.1)) ;
    col += uIso * line * mix(0.16, 0.07, major);
  }
  // world grid (map graticule)
  if (uGridAmt > 0.0) {
    vec2 g = w / 120.0;
    vec2 gd = (0.5 - abs(fract(g) - 0.5)) / max(fwidth(g), vec2(1e-4));
    float gl = 1.0 - smoothstep(0.3, 1.2, min(gd.x, gd.y));
    col += uGridAmt * gl * 0.05;
  }
  // radar: sweep beam + halftone echoes
  if (uRadar > 0.0) {
    vec2 r = w - uRadarC;
    float rl = length(r) / uRadarR;
    float inside = 1.0 - smoothstep(0.985, 1.0, rl);
    float ang = atan(r.y, r.x);
    float since = mod(uSweep - ang, 6.2831853);
    float beam = exp(-since * 4.0) * inside;
    col += uRadar * beam * vec3(0.22, 0.06, 0.05);
    col += uRadar * inside * exp(-since * 40.0) * 0.25;
    float cells = smoothstep(0.50, 0.74, fbm(w / uRes.y * 2.6 + vec2(3.7, 1.3) + vec2(uTime * 0.02, 0.0)));
    float echo = cells * inside * (0.10 + 0.9 * exp(-since * 0.9)) * smoothstep(0.0, 0.08, rl);
    vec2 gp = w / 10.0; vec2 gf = fract(gp) - 0.5;
    float dotR = 0.52 * sqrt(clamp(echo, 0.0, 1.0));
    float dm = 1.0 - smoothstep(dotR - 0.06, dotR + 0.06, length(gf));
    col = mix(col, vec3(1.0, 0.17, 0.11), uRadar * dm * min(1.0, echo * 1.6));
  }
  // manga speed lines (screen space)
  if (uSpeed > 0.0) {
    vec2 sc = px - c;
    float a = atan(sc.y, sc.x) / 6.2831853 + 0.5;
    float rr = length(sc) / uRes.y;
    float bins = 160.0;
    float b = floor(a * bins);
    float fr = fract(a * bins);
    float rnd = h11(b + uSpeedSeed * 17.0);
    float wdt = mix(0.08, 0.6, h11(b * 3.1 + uSpeedSeed));
    float inner = mix(0.28, 0.62, h11(b * 7.7 + uSpeedSeed * 3.0));
    float taper = smoothstep(inner, inner + 0.25, rr);
    float lineM = step(0.45, rnd) * (1.0 - smoothstep(wdt * taper * 0.5, wdt * taper * 0.5 + 0.08, abs(fr - 0.5)));
    col = mix(col, vec3(0.94, 0.93, 0.90), uSpeed * lineM * taper);
  }
  col += uFlash;
  vec4 ct = texture(uContent, sp / uRes);
  col = col * (1.0 - ct.a) + ct.rgb;
  o = vec4(col * uWeight, uWeight);
}`;

const DOWN_FS = COMMON + `
uniform sampler2D uSrc; uniform vec2 uTexel; uniform float uThresh; uniform float uFirst;
vec3 s(vec2 uv){ return texture(uSrc, uv).rgb; }
void main(){
  vec2 uv = gl_FragCoord.xy / uRes; vec2 t = uTexel;
  vec3 a = s(uv + t*vec2(-2,-2)), b = s(uv + t*vec2(0,-2)), cc = s(uv + t*vec2(2,-2));
  vec3 d = s(uv + t*vec2(-1,-1)), e = s(uv), f = s(uv + t*vec2(1,-1));
  vec3 g = s(uv + t*vec2(-2,0)), h = s(uv + t*vec2(2,0));
  vec3 i = s(uv + t*vec2(-1,1)), j = s(uv + t*vec2(1,1));
  vec3 k = s(uv + t*vec2(-2,2)), l = s(uv + t*vec2(0,2)), m = s(uv + t*vec2(2,2));
  vec3 col = e*0.125 + (d+f+i+j)*0.125 + (a+cc+k+m)*0.03125 + (b+g+h+l)*0.0625;
  if (uFirst > 0.5) {
    float br = max(col.r, max(col.g, col.b));
    float soft = clamp(br - uThresh + 0.25, 0.0, 0.5); soft = soft*soft / 2.0;
    col *= max(soft, br - uThresh) / max(br, 1e-4);
  }
  o = vec4(col, 1.0);
}`;

const UP_FS = COMMON + `
uniform sampler2D uSrc; uniform vec2 uTexel; uniform float uAmt;
void main(){
  vec2 uv = gl_FragCoord.xy / uRes; vec2 t = uTexel;
  vec3 c = texture(uSrc, uv).rgb * 4.0;
  c += (texture(uSrc, uv + t*vec2(-1,0)).rgb + texture(uSrc, uv + t*vec2(1,0)).rgb + texture(uSrc, uv + t*vec2(0,-1)).rgb + texture(uSrc, uv + t*vec2(0,1)).rgb) * 2.0;
  c += texture(uSrc, uv + t*vec2(-1,-1)).rgb + texture(uSrc, uv + t*vec2(1,-1)).rgb + texture(uSrc, uv + t*vec2(-1,1)).rgb + texture(uSrc, uv + t*vec2(1,1)).rgb;
  o = vec4(c / 16.0 * uAmt, 1.0);
}`;

const POST_FS = COMMON + `
uniform sampler2D uAccum, uBloom;
uniform float uFrame, uCA, uGlitch, uGlitchSeed, uGrain, uVig, uBloomAmt, uExposure, uSepia, uDuo, uInvert, uScan, uShockR, uShockAmt, uFade, uContrast;
uniform vec2 uShockC;
uniform vec3 uBloomTint;
vec3 samp(vec2 uv){ return texture(uAccum, uv).rgb; }
void main(){
  vec2 uv = gl_FragCoord.xy / uRes;
  float asp = uRes.x / uRes.y;
  // shockwave (uShockC in top-left normalized coords)
  vec2 sc = vec2(uShockC.x, 1.0 - uShockC.y);
  vec2 d = (uv - sc) * vec2(asp, 1.0);
  float dist = length(d);
  float ring = exp(-pow((dist - uShockR) / 0.06, 2.0));
  uv -= normalize(d + 1e-6) * ring * uShockAmt / vec2(asp, 1.0);
  // glitch: band displacement
  float gOff = 0.0;
  if (uGlitch > 0.0) {
    float rows = 18.0 + floor(h11(uGlitchSeed) * 30.0);
    float band = floor(uv.y * rows);
    float r = h11(band * 1.37 + uGlitchSeed * 91.7);
    if (r > 1.0 - 0.45 * uGlitch) gOff = (h11(band * 7.13 + uGlitchSeed * 3.1) - 0.5) * 0.16 * uGlitch;
    float fine = floor(uv.y * uRes.y / 3.0);
    gOff += (h11(fine + uGlitchSeed * 17.0) - 0.5) * 0.004 * uGlitch;
    uv.x += gOff;
  }
  vec2 cc = uv - 0.5;
  float ca = uCA * (0.35 + dot(cc, cc) * 2.4) + abs(gOff) * 0.35;
  vec3 col;
  col.r = samp(uv + cc * ca + vec2(gOff * 0.25, 0.0)).r;
  col.g = samp(uv).g;
  col.b = samp(uv - cc * ca - vec2(gOff * 0.25, 0.0)).b;
  vec3 bl = texture(uBloom, uv).rgb;
  col += bl * uBloomAmt * uBloomTint;
  col *= uExposure;
  col = clamp(col, 0.0, 1.0);
  // contrast S-curve around mid grey
  col = mix(col, col * col * (3.0 - 2.0 * col), uContrast);
  float lum = dot(col, vec3(0.299, 0.587, 0.114));
  // JoJo-style duotone flash (black -> red -> white)
  vec3 duo = lum < 0.5 ? mix(vec3(0.04, 0.0, 0.02), vec3(1.0, 0.1, 0.07), lum * 2.0) : mix(vec3(1.0, 0.1, 0.07), vec3(1.0, 0.97, 0.9), (lum - 0.5) * 2.0);
  col = mix(col, duo, uDuo);
  col = mix(col, vec3(1.0) - col, uInvert);
  // sepia freeze (to be continued)
  lum = mix(dot(col, vec3(0.299, 0.587, 0.114)), max(col.r, max(col.g, col.b)), 0.55);
  vec3 sep = vec3(lum) * vec3(1.12, 0.93, 0.62) + vec3(0.06, 0.035, 0.0);
  col = mix(col, sep, uSepia);
  // vignette
  vec2 vv = (gl_FragCoord.xy / uRes - 0.5) * vec2(asp, 1.0);
  col *= 1.0 - uVig * smoothstep(0.35, 1.05, length(vv));
  // scanlines
  col *= 1.0 - uScan * (0.5 + 0.5 * sin(gl_FragCoord.y * 3.14159));
  // grain + dither
  float g1 = hpx(gl_FragCoord.xy, uFrame) - 0.5;
  float g2 = hpx(gl_FragCoord.xy + 17.0, uFrame + 101.0) - 0.5;
  col += (g1 + g2) * uGrain * (0.55 + 0.45 * (1.0 - clamp(lum, 0.0, 1.0)));
  col += (hpx(gl_FragCoord.xy, uFrame * 3.0 + 7.0) - 0.5) / 255.0;
  col *= 1.0 - uFade;
  o = vec4(clamp(col, 0.0, 1.0), 1.0);
}`;

function compile(gl, type, src) {
  const s = gl.createShader(type);
  gl.shaderSource(s, src); gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s);
    const lines = src.split('\n').map((l, i) => `${i + 1}: ${l}`).join('\n');
    throw new Error('Shader compile error: ' + log + '\n' + lines.slice(0, 4000));
  }
  return s;
}

function program(gl, fs) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, VS));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fs));
  gl.bindAttribLocation(p, 0, 'aPos');
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('Link error: ' + gl.getProgramInfoLog(p));
  const uni = {};
  const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
  for (let i = 0; i < n; i++) {
    const info = gl.getActiveUniform(p, i);
    uni[info.name] = { loc: gl.getUniformLocation(p, info.name), type: info.type };
  }
  return { p, uni };
}

function makeTarget(gl, w, h, float = true) {
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, float ? gl.RGBA16F : gl.RGBA8, w, h, 0, gl.RGBA, float ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  const fb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  return { tex, fb, w, h };
}

export class Pipeline {
  constructor(canvas) {
    const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, premultipliedAlpha: false, preserveDrawingBuffer: true });
    if (!gl) throw new Error('WebGL2 unavailable');
    if (!gl.getExtension('EXT_color_buffer_float')) throw new Error('EXT_color_buffer_float unavailable');
    gl.getExtension('OES_texture_float_linear');
    this.gl = gl;
    this.scene = program(gl, SCENE_FS);
    this.down = program(gl, DOWN_FS);
    this.up = program(gl, UP_FS);
    this.post = program(gl, POST_FS);
    const vb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.accum = makeTarget(gl, W, H);
    this.levels = [];
    let w = W, h = H;
    for (let i = 0; i < 6; i++) { w = Math.max(1, Math.ceil(w / 2)); h = Math.max(1, Math.ceil(h / 2)); this.levels.push(makeTarget(gl, w, h)); }
    this.contentTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.contentTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  }

  set(prog, name, v) {
    const u = prog.uni[name];
    if (!u) return;
    const gl = this.gl;
    if (typeof v === 'number') {
      if (u.type === gl.SAMPLER_2D || u.type === gl.INT) gl.uniform1i(u.loc, v); else gl.uniform1f(u.loc, v);
    } else if (v.length === 2) gl.uniform2fv(u.loc, v);
    else if (v.length === 3) gl.uniform3fv(u.loc, v);
    else gl.uniform4fv(u.loc, v);
  }

  setAll(prog, obj) { for (const k in obj) this.set(prog, k, obj[k]); }

  beginFrame() {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.accum.fb);
    gl.viewport(0, 0, W, H);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
  }

  // Render one subframe: content canvas + bg params, accumulated with weight.
  addSubframe(contentCanvas, bg, weight) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.contentTex);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, contentCanvas);
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.accum.fb);
    gl.viewport(0, 0, W, H);
    gl.useProgram(this.scene.p);
    this.set(this.scene, 'uRes', [W, H]);
    this.set(this.scene, 'uContent', 0);
    this.set(this.scene, 'uWeight', weight);
    this.setAll(this.scene, bg);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.disable(gl.BLEND);
  }

  finishFrame(post) {
    const gl = this.gl;
    // bloom chain
    let src = this.accum;
    gl.useProgram(this.down.p);
    for (let i = 0; i < this.levels.length; i++) {
      const dst = this.levels[i];
      gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fb);
      gl.viewport(0, 0, dst.w, dst.h);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, src.tex);
      this.set(this.down, 'uSrc', 0);
      this.set(this.down, 'uRes', [dst.w, dst.h]);
      this.set(this.down, 'uTexel', [1 / src.w, 1 / src.h]);
      this.set(this.down, 'uThresh', post.bloomThresh ?? 0.72);
      this.set(this.down, 'uFirst', i === 0 ? 1 : 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      src = dst;
    }
    gl.useProgram(this.up.p);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    for (let i = this.levels.length - 1; i > 0; i--) {
      const s = this.levels[i], dst = this.levels[i - 1];
      gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fb);
      gl.viewport(0, 0, dst.w, dst.h);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, s.tex);
      this.set(this.up, 'uSrc', 0);
      this.set(this.up, 'uRes', [dst.w, dst.h]);
      this.set(this.up, 'uTexel', [1 / s.w, 1 / s.h]);
      this.set(this.up, 'uAmt', 1.0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    gl.disable(gl.BLEND);
    // final
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, W, H);
    gl.useProgram(this.post.p);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.accum.tex);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.levels[0].tex);
    this.set(this.post, 'uAccum', 0);
    this.set(this.post, 'uBloom', 1);
    this.set(this.post, 'uRes', [W, H]);
    const p = { uCA: 0.002, uGlitch: 0, uGlitchSeed: 0, uGrain: 0.05, uVig: 0.55, uBloomAmt: 0.9, uExposure: 1, uSepia: 0,
      uDuo: 0, uInvert: 0, uScan: 0.0, uShockR: 0, uShockAmt: 0, uShockC: [0.5, 0.5], uFade: 0, uContrast: 0.15,
      uBloomTint: [1.0, 0.72, 0.66], uFrame: 0, ...post.uniforms };
    this.setAll(this.post, p);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  readPixels(buf) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    return buf;
  }
}
