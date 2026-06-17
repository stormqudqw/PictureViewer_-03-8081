// ============================================================================
//  Осколки Эфира — World: floating islands, portals, props, destructibles.
//  The static layer of each island is rendered once into an offscreen canvas
//  and blitted each frame — keeps per-frame cost low (good optimization).
// ============================================================================
import { rand, randInt, pick, chance, TAU, makeNoise, dist, clamp } from './engine.js';
import { FACTIONS } from './data.js';

const BIOMES = [
  { id: 'verdant', ground: '#1c3a2e', ground2: '#244a3a', rim: '#3fd99a', accent: '#5bffb0', sky: '#0a1d22', prop: 'tree' },
  { id: 'frost',   ground: '#1e3350', ground2: '#27456a', rim: '#7ad2ff', accent: '#aee6ff', sky: '#0a1626', prop: 'crystal' },
  { id: 'ember',   ground: '#3a221c', ground2: '#4a2a22', rim: '#ff8b5b', accent: '#ffb27a', sky: '#1d0f0a', prop: 'rock' },
  { id: 'arcane',  ground: '#2a1f47', ground2: '#352856', rim: '#b07cff', accent: '#d2a6ff', sky: '#150e26', prop: 'rune' },
  { id: 'machine', ground: '#222a36', ground2: '#2c3744', rim: '#6ea8ff', accent: '#9ad0ff', sky: '#0a1018', prop: 'pylon' },
];

export class Zone {
  constructor(index, def) {
    this.index = index;
    this.name = def.name;
    this.biome = def.biome;
    this.faction = def.faction;
    this.w = def.w; this.h = def.h;
    this.cx = this.w / 2; this.cy = this.h / 2;
    this.radius = Math.min(this.w, this.h) * 0.46;
    this.noise = makeNoise(1000 + index * 71);
    this.portals = [];      // {x,y,to,label}
    this.props = [];        // decorative {x,y,type,s}
    this.destructibles = [];// {x,y,r,hp,type,alive}
    this.etherNodes = [];   // {x,y,used} -> mutation events
    this.npc = def.npc || null; // {x,y,faction,name}
    this.cleared = false;
    this.bg = null;         // cached offscreen canvas
    this._gen();
  }

  inBounds(x, y) {
    // Irregular island edge using low-freq noise on the radius.
    const a = Math.atan2(y - this.cy, x - this.cx);
    const wob = 1 + this.noise(a * 2.2) * 0.12;
    return dist(x, y, this.cx, this.cy) < this.radius * wob - 8;
  }
  clampToIsland(e) {
    const a = Math.atan2(e.y - this.cy, e.x - this.cx);
    const wob = 1 + this.noise(a * 2.2) * 0.12;
    const max = this.radius * wob - e.r - 6;
    const d = dist(e.x, e.y, this.cx, this.cy);
    if (d > max) { e.x = this.cx + Math.cos(a) * max; e.y = this.cy + Math.sin(a) * max; return true; }
    return false;
  }

  _gen() {
    const b = BIOMES.find(x => x.id === this.biome) || BIOMES[0];
    this.theme = b;
    // Props scattered within the island
    const propCount = randInt(26, 40);
    for (let i = 0; i < propCount; i++) {
      const a = rand(TAU), r = Math.sqrt(rand()) * this.radius * 0.9;
      const x = this.cx + Math.cos(a) * r, y = this.cy + Math.sin(a) * r;
      if (!this.inBounds(x, y)) continue;
      this.props.push({ x, y, type: b.prop, s: rand(0.7, 1.5), seed: rand(TAU) });
    }
    // Destructibles
    for (let i = 0; i < randInt(6, 10); i++) {
      const a = rand(TAU), r = Math.sqrt(rand()) * this.radius * 0.8;
      const x = this.cx + Math.cos(a) * r, y = this.cy + Math.sin(a) * r;
      if (this.inBounds(x, y)) this.destructibles.push({ x, y, r: rand(16, 24), hp: 20, type: pick(['crate', 'pillar']), alive: true });
    }
    // Ether nodes — unstable ether causing mutations
    for (let i = 0; i < randInt(1, 2); i++) {
      const a = rand(TAU), r = rand(this.radius * 0.4, this.radius * 0.78);
      this.etherNodes.push({ x: this.cx + Math.cos(a) * r, y: this.cy + Math.sin(a) * r, used: false, phase: rand(TAU) });
    }
  }

  // Build a portal toward another zone, placed near island edge.
  addPortal(toIndex, label, angle) {
    const r = this.radius * 0.82;
    this.portals.push({ x: this.cx + Math.cos(angle) * r, y: this.cy + Math.sin(angle) * r, to: toIndex, label, phase: rand(TAU) });
  }

  // Render the static island (ground + rim + props) once into an offscreen.
  buildBackground() {
    const pad = 60, W = this.w + pad * 2, H = this.h + pad * 2;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d'); x.translate(pad, pad);
    const b = this.theme;

    // Island silhouette
    x.beginPath();
    const steps = 90;
    for (let i = 0; i <= steps; i++) {
      const a = (i / steps) * TAU;
      const wob = 1 + this.noise(a * 2.2) * 0.12;
      const px = this.cx + Math.cos(a) * this.radius * wob;
      const py = this.cy + Math.sin(a) * this.radius * wob;
      i ? x.lineTo(px, py) : x.moveTo(px, py);
    }
    x.closePath();

    // Underside depth glow (floating look)
    x.save(); x.clip();
    const g = x.createRadialGradient(this.cx, this.cy, this.radius * 0.2, this.cx, this.cy, this.radius * 1.1);
    g.addColorStop(0, b.ground2); g.addColorStop(0.7, b.ground); g.addColorStop(1, '#05060d');
    x.fillStyle = g; x.fillRect(0, 0, this.w, this.h);

    // Subtle ground texture
    for (let i = 0; i < 900; i++) {
      const a = rand(TAU), r = Math.sqrt(rand()) * this.radius;
      const px = this.cx + Math.cos(a) * r, py = this.cy + Math.sin(a) * r;
      x.fillStyle = chance(0.5) ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.06)';
      x.fillRect(px, py, rand(1.5, 3.5), rand(1.5, 3.5));
    }
    // Cracks (the world is shattered)
    x.strokeStyle = 'rgba(0,0,0,0.25)'; x.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      x.beginPath(); let px = this.cx + rand(-this.radius * .5, this.radius * .5), py = this.cy + rand(-this.radius * .5, this.radius * .5);
      x.moveTo(px, py);
      for (let s = 0; s < 6; s++) { px += rand(-50, 50); py += rand(-50, 50); x.lineTo(px, py); }
      x.stroke();
    }
    x.restore();

    // Glowing rim
    x.save();
    x.beginPath();
    for (let i = 0; i <= steps; i++) {
      const a = (i / steps) * TAU;
      const wob = 1 + this.noise(a * 2.2) * 0.12;
      const px = this.cx + Math.cos(a) * this.radius * wob, py = this.cy + Math.sin(a) * this.radius * wob;
      i ? x.lineTo(px, py) : x.moveTo(px, py);
    }
    x.closePath();
    x.shadowColor = b.rim; x.shadowBlur = 28; x.strokeStyle = b.rim; x.lineWidth = 3; x.globalAlpha = 0.9; x.stroke();
    x.restore();

    // Props
    for (const p of this.props) this._drawProp(x, p, b);

    this.bg = c; this.bgPad = pad;
  }

  _drawProp(x, p, b) {
    x.save(); x.translate(p.x, p.y); x.scale(p.s, p.s);
    // soft shadow
    x.fillStyle = 'rgba(0,0,0,0.25)'; x.beginPath(); x.ellipse(0, 6, 12, 5, 0, 0, TAU); x.fill();
    if (p.type === 'tree') {
      x.fillStyle = '#2a1c12'; x.fillRect(-3, -6, 6, 14);
      x.fillStyle = b.ground2; x.beginPath(); x.arc(0, -16, 16, 0, TAU); x.fill();
      x.fillStyle = b.accent + '55'; x.beginPath(); x.arc(-5, -20, 9, 0, TAU); x.fill();
    } else if (p.type === 'crystal') {
      x.fillStyle = b.rim; x.shadowColor = b.rim; x.shadowBlur = 16;
      x.beginPath(); x.moveTo(0, -28); x.lineTo(9, 0); x.lineTo(0, 8); x.lineTo(-9, 0); x.closePath(); x.fill();
    } else if (p.type === 'rock') {
      x.fillStyle = b.ground2; x.beginPath(); x.ellipse(0, 0, 16, 12, p.seed, 0, TAU); x.fill();
      x.fillStyle = b.accent + '33'; x.beginPath(); x.ellipse(-4, -3, 6, 4, 0, 0, TAU); x.fill();
    } else if (p.type === 'rune') {
      x.strokeStyle = b.rim; x.shadowColor = b.rim; x.shadowBlur = 14; x.lineWidth = 2.5;
      x.beginPath(); x.arc(0, -8, 12, 0, TAU); x.moveTo(0, -20); x.lineTo(0, 4); x.moveTo(-10, -8); x.lineTo(10, -8); x.stroke();
    } else if (p.type === 'pylon') {
      x.fillStyle = '#39424f'; x.fillRect(-5, -26, 10, 30);
      x.fillStyle = b.rim; x.shadowColor = b.rim; x.shadowBlur = 14;
      x.beginPath(); x.arc(0, -30, 5, 0, TAU); x.fill();
    }
    x.restore();
  }
}

export class World {
  constructor() {
    this.zones = [];
    this.current = 0;
    this._build();
  }

  get zone() { return this.zones[this.current]; }

  _build() {
    const layout = [
      { name: 'Зелёный Осколок', biome: 'verdant', faction: 'clans' },
      { name: 'Ледяной Шпиль',   biome: 'frost',   faction: 'order' },
      { name: 'Тлеющие Руины',   biome: 'ember',   faction: 'clans' },
      { name: 'Арканум',         biome: 'arcane',  faction: 'order' },
      { name: 'Цитадель Союза',  biome: 'machine', faction: 'machine' },
    ];
    layout.forEach((d, i) => {
      const z = new Zone(i, { ...d, w: 1500 + i * 120, h: 1400 + i * 100,
        npc: { faction: d.faction } });
      // place npc
      const a = rand(TAU), r = z.radius * 0.5;
      z.npc.x = z.cx + Math.cos(a) * r; z.npc.y = z.cy + Math.sin(a) * r;
      z.npc.name = FACTIONS.find(f => f.id === d.faction).name;
      z.npc.phase = rand(TAU);
      this.zones.push(z);
    });
    // Link zones in a ring + spokes
    for (let i = 0; i < this.zones.length; i++) {
      const next = (i + 1) % this.zones.length;
      const prev = (i - 1 + this.zones.length) % this.zones.length;
      this.zones[i].addPortal(next, this.zones[next].name, -Math.PI / 4);
      this.zones[i].addPortal(prev, this.zones[prev].name, Math.PI * 0.75);
    }
    this.zones.forEach(z => z.buildBackground());
  }

  travel(toIndex) { this.current = clamp(toIndex, 0, this.zones.length - 1); }
}
