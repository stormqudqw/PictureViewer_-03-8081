// ============================================================================
//  Осколки Эфира — Engine core
//  Lightweight, allocation-conscious helpers: math, RNG, input, camera,
//  pooled particle system and a tiny procedural WebAudio synth.
// ============================================================================

export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export const lerp = (a, b, t) => a + (b - a) * t;
export const dist2 = (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };
export const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);
export const angTo = (ax, ay, bx, by) => Math.atan2(by - ay, bx - ax);
export const rand = (a = 1, b) => b === undefined ? Math.random() * a : a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(rand(a, b + 1));
export const pick = arr => arr[(Math.random() * arr.length) | 0];
export const chance = p => Math.random() < p;
export const approach = (v, t, step) => v < t ? Math.min(v + step, t) : Math.max(v - step, t);

// Smooth pseudo-random value noise for terrain edges / drift.
export function makeNoise(seed = 1234) {
  let s = seed >>> 0;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const perm = new Float32Array(512);
  for (let i = 0; i < 512; i++) perm[i] = rnd();
  return (x) => {
    const i = Math.floor(x), f = x - i;
    const u = f * f * (3 - 2 * f);
    return lerp(perm[i & 511], perm[(i + 1) & 511], u) * 2 - 1;
  };
}

// ---------------------------------------------------------------------------
//  Input — keyboard + mouse, with edge detection for "just pressed".
// ---------------------------------------------------------------------------
export const Input = {
  keys: new Set(),
  pressed: new Set(),
  mx: 0, my: 0, wx: 0, wy: 0,
  mdown: false, rdown: false,
  mpressed: false, rpressed: false,
  _consumed: new Set(),

  init(canvas) {
    addEventListener('keydown', e => {
      const k = e.key.toLowerCase();
      if (!this.keys.has(k)) this.pressed.add(k);
      this.keys.add(k);
      if ([' ', 'tab'].includes(k)) e.preventDefault();
    });
    addEventListener('keyup', e => this.keys.delete(e.key.toLowerCase()));
    canvas.addEventListener('mousemove', e => {
      const r = canvas.getBoundingClientRect();
      this.mx = (e.clientX - r.left) * (canvas.width / r.width / (window.devicePixelRatio || 1));
      this.my = (e.clientY - r.top) * (canvas.height / r.height / (window.devicePixelRatio || 1));
    });
    canvas.addEventListener('mousedown', e => {
      if (e.button === 0) { this.mdown = true; this.mpressed = true; }
      if (e.button === 2) { this.rdown = true; this.rpressed = true; }
    });
    addEventListener('mouseup', e => {
      if (e.button === 0) this.mdown = false;
      if (e.button === 2) this.rdown = false;
    });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    addEventListener('blur', () => { this.keys.clear(); this.mdown = this.rdown = false; });
  },
  down(k) { return this.keys.has(k); },
  // "just pressed this frame"
  hit(k) { return this.pressed.has(k); },
  endFrame() { this.pressed.clear(); this.mpressed = false; this.rpressed = false; }
};

// ---------------------------------------------------------------------------
//  Camera — follows a target, supports trauma-based screen shake & zoom.
// ---------------------------------------------------------------------------
export class Camera {
  constructor() { this.x = 0; this.y = 0; this.zoom = 1; this.trauma = 0; this.sx = 0; this.sy = 0; }
  follow(tx, ty, dt) {
    this.x = lerp(this.x, tx, 1 - Math.pow(0.0001, dt));
    this.y = lerp(this.y, ty, 1 - Math.pow(0.0001, dt));
    if (this.trauma > 0) {
      const s = this.trauma * this.trauma * 16;
      this.sx = rand(-s, s); this.sy = rand(-s, s);
      this.trauma = Math.max(0, this.trauma - dt * 1.6);
    } else this.sx = this.sy = 0;
  }
  shake(amt) { this.trauma = Math.min(1, this.trauma + amt); }
  apply(ctx, w, h) {
    ctx.translate(w / 2, h / 2);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-this.x + this.sx, -this.y + this.sy);
  }
  toWorld(sx, sy, w, h) {
    return { x: (sx - w / 2) / this.zoom + this.x - this.sx, y: (sy - h / 2) / this.zoom + this.y - this.sy };
  }
}

// ---------------------------------------------------------------------------
//  Particle system — fixed pool, zero per-frame allocation in the hot path.
// ---------------------------------------------------------------------------
export class Particles {
  constructor(max = 2200) {
    this.max = max; this.n = 0;
    this.x = new Float32Array(max); this.y = new Float32Array(max);
    this.vx = new Float32Array(max); this.vy = new Float32Array(max);
    this.life = new Float32Array(max); this.max_life = new Float32Array(max);
    this.r = new Float32Array(max); this.drag = new Float32Array(max);
    this.grav = new Float32Array(max); this.kind = new Uint8Array(max); // 0 dot 1 spark 2 glow 3 smoke
    this.cr = new Uint8Array(max); this.cg = new Uint8Array(max); this.cb = new Uint8Array(max);
  }
  spawn(x, y, vx, vy, life, r, color, kind = 0, drag = 0.9, grav = 0) {
    const i = this.n < this.max ? this.n++ : (Math.random() * this.max) | 0;
    this.x[i] = x; this.y[i] = y; this.vx[i] = vx; this.vy[i] = vy;
    this.life[i] = life; this.max_life[i] = life; this.r[i] = r;
    this.drag[i] = drag; this.grav[i] = grav; this.kind[i] = kind;
    this.cr[i] = color[0]; this.cg[i] = color[1]; this.cb[i] = color[2];
  }
  burst(x, y, count, color, opt = {}) {
    const spd = opt.speed || 120, life = opt.life || 0.6, size = opt.size || 3,
      kind = opt.kind ?? 1, spread = opt.spread || TAU, base = opt.dir ?? 0, grav = opt.grav || 0;
    for (let k = 0; k < count; k++) {
      const a = base + rand(-spread / 2, spread / 2), v = spd * rand(0.3, 1);
      this.spawn(x, y, Math.cos(a) * v, Math.sin(a) * v, life * rand(0.6, 1.2),
        size * rand(0.6, 1.3), color, kind, opt.drag ?? 0.9, grav);
    }
  }
  update(dt) {
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      const d = Math.pow(this.drag[i], dt * 60);
      this.vx[i] *= d; this.vy[i] = this.vy[i] * d + this.grav[i] * dt;
      this.x[i] += this.vx[i] * dt; this.y[i] += this.vy[i] * dt;
    }
  }
  draw(ctx) {
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < this.n; i++) {
      const l = this.life[i]; if (l <= 0) continue;
      const t = l / this.max_life[i];
      const a = Math.min(1, t * 1.6);
      const r = this.r[i] * (this.kind[i] === 3 ? (2 - t) : t < .3 ? t / .3 : 1);
      const col = `rgba(${this.cr[i]},${this.cg[i]},${this.cb[i]},`;
      if (this.kind[i] === 2) { // glow
        const g = ctx.createRadialGradient(this.x[i], this.y[i], 0, this.x[i], this.y[i], r * 3);
        g.addColorStop(0, col + (a * 0.5) + ')'); g.addColorStop(1, col + '0)');
        ctx.fillStyle = g; ctx.fillRect(this.x[i] - r * 3, this.y[i] - r * 3, r * 6, r * 6);
      } else {
        ctx.fillStyle = col + a + ')';
        ctx.beginPath(); ctx.arc(this.x[i], this.y[i], Math.max(0.4, r), 0, TAU); ctx.fill();
      }
    }
    ctx.globalCompositeOperation = 'source-over';
  }
}

// ---------------------------------------------------------------------------
//  Audio — minimal procedural SFX via WebAudio (no asset loading).
// ---------------------------------------------------------------------------
export const Sound = {
  ctx: null, master: null, muted: false,
  init() {
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = this.ctx.createGain(); this.master.gain.value = 0.35;
      this.master.connect(this.ctx.destination);
    } catch (e) { /* audio optional */ }
  },
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },
  blip(freq = 440, dur = 0.1, type = 'sine', vol = 0.5, slide = 0) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime, o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.02);
  },
  noise(dur = 0.2, vol = 0.4, freq = 1200) {
    if (!this.ctx || this.muted) return;
    const t = this.ctx.currentTime, n = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
    const g = this.ctx.createGain(); g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(this.master); src.start();
  },
  hit() { this.blip(180, 0.12, 'square', 0.35, -120); this.noise(0.1, 0.25, 800); },
  cast(f = 520) { this.blip(f, 0.18, 'triangle', 0.3, 220); },
  pickup() { this.blip(660, 0.08, 'sine', 0.3); setTimeout(() => this.blip(990, 0.12, 'sine', 0.3), 70); },
  boss() { this.blip(90, 0.5, 'sawtooth', 0.4, -40); this.noise(0.5, 0.3, 400); },
  level() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.blip(f, 0.18, 'triangle', 0.3), i * 90)); },
  hurt() { this.blip(140, 0.16, 'sawtooth', 0.35, -80); }
};
