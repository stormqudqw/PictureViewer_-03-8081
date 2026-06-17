// ============================================================================
//  Осколки Эфира — Entities: Player, Enemy, Boss, Projectile, Ally.
//  Entities receive the Game object in update() so they can read the world
//  and spawn into shared pools (projectiles, particles, floaters).
// ============================================================================
import { clamp, lerp, dist, dist2, angTo, rand, randInt, pick, chance, TAU, Sound } from './engine.js';
import { ELEMENTS, COMBOS, ABILITIES, ENEMY_TYPES } from './data.js';

let UID = 1;

// --- Mastery helpers (skill-by-use) -----------------------------------------
export const masteryLevel = xp => Math.floor(Math.log2(1 + xp / 25));
export const masteryMult = xp => 1 + masteryLevel(xp) * 0.05;

// ===========================================================================
//  PLAYER
// ===========================================================================
export class Player {
  constructor() {
    this.x = 0; this.y = 0; this.vx = 0; this.vy = 0; this.r = 16;
    this.face = 0; this.aim = 0;
    this.level = 1; this.xp = 0; this.xpNext = 80;
    this.statPoints = 0; this.talentPoints = 0;
    this.stats = { str: 5, agi: 5, int: 5, tec: 5, wil: 5 };
    this.masteryXP = { sword: 0, evasion: 0, arcana: 0, engineer: 0 };
    this.talents = new Set();
    this.cores = new Set();
    this.mutations = [];
    this.flags = {};
    this.coreMods = {}; this.mutMods = {};
    this.bonusHP = 0;
    this.maxDashCharges = 2; this.dashCharges = 2; this.dashRecharge = 0;
    this.abilities = {};            // key -> {cd}
    this.elementQueue = [];         // for combo magic
    this.queueTimer = 0;
    this.hp = 100; this.maxHP = 100; this.energy = 50; this.maxEN = 50;
    this.meleeCd = 0; this.castCd = 0; this.iFrames = 0; this.dashTime = 0;
    this.hitFlash = 0; this.fireTrailT = 0;
    this.recompute(true);
  }

  // Derive secondary stats from primary stats + cores + mutations + masteries.
  recompute(full = false) {
    const s = this.stats;
    this.maxHP = 100 + s.wil * 8 + s.str * 2 + this.bonusHP;
    this.maxEN = 50 + s.wil * 6 + s.int * 2;
    const haste = (this.coreMods.haste || 0);
    this.moveSpeed = 205 * (1 + s.agi * 0.011 + haste + (this.mutMods.speed || 0));
    this.evasion = clamp(s.agi * 0.004 + masteryLevel(this.masteryXP.evasion) * 0.015, 0, 0.55);
    this.regen = (this.mutMods.regen || 0) + s.wil * 0.04;
    this.armor = clamp((this.coreMods.armor || 0) + (this.mutMods.armor || 0) + (this.flags.paladin ? 0.2 : 0), -0.5, 0.7);
    if (full) { this.hp = this.maxHP; this.energy = this.maxEN; }
    else { this.hp = Math.min(this.hp, this.maxHP); }
  }

  meleeDamage() {
    let d = (12 + this.stats.str * 1.7) * masteryMult(this.masteryXP.sword);
    if (this.flags.berserk && this.hp < this.maxHP * 0.4) d *= 1.4;
    return d;
  }
  spellDamage(elem) {
    let d = (10 + this.stats.int * 2.1) * masteryMult(this.masteryXP.arcana);
    d *= 1 + (this.mutMods.rangedDmg || 0);
    if (elem === 'fire' && this.coreMods.fire) d *= 1 + this.coreMods.fire;
    return d;
  }
  deviceDamage() { return (8 + this.stats.tec * 1.6) * masteryMult(this.masteryXP.engineer); }
  atkInterval() {
    return 0.46 / (1 + this.stats.agi * 0.006 + (this.mutMods.atkSpeed || 0) + (this.coreMods.haste || 0));
  }

  gainXP(amt, game) {
    this.xp += amt;
    while (this.xp >= this.xpNext && this.level < 100) {
      this.xp -= this.xpNext;
      this.level++;
      this.statPoints += 3; this.talentPoints += 1;
      this.xpNext = Math.floor(80 * Math.pow(1.14, this.level - 1));
      this.recompute(); this.hp = this.maxHP; this.energy = this.maxEN;
      game.onLevelUp();
    }
  }
  gainMastery(key, amt) { this.masteryXP[key] += amt; this.recompute(); }

  takeDamage(amt, game, sx, sy) {
    if (this.iFrames > 0 || this.hp <= 0) return;
    if (chance(this.evasion)) { game.floater(this.x, this.y - 24, 'уклон', '#7ee4ff'); return; }
    amt *= 1 - this.armor;
    this.hp -= amt; this.iFrames = 0.5; this.hitFlash = 0.3;
    game.cam.shake(0.35); Sound.hurt();
    game.particles.burst(this.x, this.y, 10, [255, 90, 110], { speed: 160, life: 0.4 });
    if (sx !== undefined) { const a = angTo(sx, sy, this.x, this.y); this.vx += Math.cos(a) * 160; this.vy += Math.sin(a) * 160; }
    if (this.hp <= 0) { this.hp = 0; game.onPlayerDeath(); }
  }
  heal(amt, game) {
    if (game.rift.active && game.rift.has('noHeal')) return;
    this.hp = Math.min(this.maxHP, this.hp + amt);
  }

  update(dt, game) {
    const I = game.input;
    // --- movement ---
    let mx = (I.down('d') || I.down('arrowright')) - (I.down('a') || I.down('arrowleft'));
    let my = (I.down('s') || I.down('arrowdown')) - (I.down('w') || I.down('arrowup'));
    const ml = Math.hypot(mx, my) || 1; mx /= ml; my /= ml;
    const moving = (mx || my);
    const spd = this.moveSpeed * (this.dashTime > 0 ? 2.6 : 1);
    if (this.dashTime <= 0) {
      this.vx = lerp(this.vx, mx * spd, 1 - Math.pow(0.001, dt));
      this.vy = lerp(this.vy, my * spd, 1 - Math.pow(0.001, dt));
    }
    this.x += this.vx * dt; this.y += this.vy * dt;
    this.vx *= Math.pow(0.0001, dt); this.vy *= Math.pow(0.0001, dt);

    // aim toward mouse
    const wp = game.cam.toWorld(I.mx, I.my, game.W, game.H);
    this.aim = angTo(this.x, this.y, wp.x, wp.y);
    if (moving) this.face = Math.atan2(my, mx);

    // keep on island
    game.world.zone.clampToIsland(this);

    // timers
    this.meleeCd -= dt; this.castCd -= dt; this.iFrames -= dt; this.dashTime -= dt;
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    this.queueTimer -= dt; if (this.queueTimer <= 0) this.elementQueue.length = 0;
    for (const k in this.abilities) this.abilities[k].cd = Math.max(0, this.abilities[k].cd - dt);

    // energy + hp regen
    this.energy = Math.min(this.maxEN, this.energy + (4 + this.stats.wil * 0.2) * dt);
    if (this.regen) this.heal(this.regen * dt, game);

    // dash recharge
    if (this.dashCharges < this.maxDashCharges) {
      this.dashRecharge -= dt;
      if (this.dashRecharge <= 0) { this.dashCharges++; this.dashRecharge = 1.6; }
    }

    // fire trail core
    if (this.flags.fireTrail && (Math.abs(this.vx) + Math.abs(this.vy)) > 60) {
      this.fireTrailT -= dt;
      if (this.fireTrailT <= 0) { this.fireTrailT = 0.05; game.spawnHazard(this.x, this.y, 14, this.deviceDamage() * 0.2, [255, 120, 40], 1.5); }
    }

    // --- inputs / actions ---
    if (I.mdown && this.meleeCd <= 0) this.melee(game);
    if ((I.rdown || I.hit('q')) && this.castCd <= 0) this.cast(game, this._chosenElement(game));
    if (I.hit('e') && this.castCd <= 0) this.cast(game, this._altElement(game));
    // queue elements for combos: 1 fire 2 ice 3 bolt 4 (cycles)
    if (I.hit('1')) this.queueElement('fire', game);
    if (I.hit('2')) this.queueElement('ice', game);
    if (I.hit('3')) this.queueElement('bolt', game);
    if (I.hit('4')) this.queueElement(pick(['poison', 'wind', 'water']), game);
    if (I.hit(' ')) this.dash(game);
    if (I.hit('r')) this.useAbilityByIndex(game, 0);
    if (I.hit('f')) game.tryInteract();
  }

  _chosenElement(g) { return g.primaryElement || 'fire'; }
  _altElement(g) { return g.secondaryElement || 'ice'; }

  queueElement(elem, game) {
    this.elementQueue.push(elem); this.queueTimer = 2.2;
    Sound.cast(ELEMENTS[elem] ? 480 : 480);
    game.particles.burst(this.x, this.y - 10, 6, ELEMENTS[elem].color, { speed: 60, life: 0.4, kind: 2 });
    if (this.elementQueue.length >= 2) {
      const [a, b] = this.elementQueue;
      const combo = COMBOS.find(c => (c.a === a && c.b === b) || (c.a === b && c.b === a));
      this.elementQueue.length = 0;
      if (combo) this.castCombo(game, combo);
      else this.cast(game, b);
    }
  }

  castCombo(game, combo) {
    if (this.energy < 30) { game.floater(this.x, this.y - 24, 'нет энергии', '#ff8b5b'); return; }
    this.energy -= 30; this.castCd = 0.4;
    const wp = game.cam.toWorld(game.input.mx, game.input.my, game.W, game.H);
    let dmg = (combo.dmg + this.stats.int * 1.6) * masteryMult(this.masteryXP.arcana);
    if (game.rift.active && game.rift.has('doubleMagic')) dmg *= 2;
    game.spawnExplosion(wp.x, wp.y, combo.radius, dmg, combo.color, combo.effect);
    game.cam.shake(0.5); Sound.cast(700);
    game.notify(combo.icon + ' ' + combo.name, '', 'lore');
    this.gainMastery('arcana', 6);
  }

  cast(game, elem) {
    const cost = 8;
    if (this.energy < cost) return;
    this.energy -= cost; this.castCd = Math.max(0.18, this.atkInterval() * 0.7);
    const dmg = this.spellDamage(elem) * (game.rift.active && game.rift.has('doubleMagic') ? 2 : 1);
    const p = new Projectile(this.x + Math.cos(this.aim) * 18, this.y + Math.sin(this.aim) * 18,
      this.aim, 520, dmg, 7, ELEMENTS[elem].color, 'player');
    p.element = elem;
    if (this.flags.technomancer) { p.pierce = 1; }
    game.projectiles.push(p);
    game.particles.burst(p.x, p.y, 5, ELEMENTS[elem].color, { speed: 80, dir: this.aim, spread: 0.6, life: 0.3, kind: 2 });
    Sound.cast(ELEMENTS[elem].color[0] + 380);
    this.gainMastery('arcana', 2);
  }

  melee(game) {
    this.meleeCd = this.atkInterval();
    const reach = 56 + this.r, arc = 1.5;
    const hits = this._swing(game, this.aim, reach, arc, this.meleeDamage());
    // double strike talent
    if (this.flags.doubleStrike) setTimeout(() => { if (this.hp > 0) this._swing(game, this.aim, reach, arc, this.meleeDamage() * 0.7); }, 90);
    // spellblade wave
    if (this.flags.spellblade) {
      const p = new Projectile(this.x, this.y, this.aim, 460, this.spellDamage('fire') * 0.6, 10, [255, 150, 80], 'player');
      p.pierce = 3; p.element = 'fire'; game.projectiles.push(p);
    }
    game.slash = { x: this.x, y: this.y, a: this.aim, t: 0.16, reach };
    game.particles.burst(this.x + Math.cos(this.aim) * 30, this.y + Math.sin(this.aim) * 30, 8, [255, 240, 200],
      { speed: 200, dir: this.aim, spread: arc, life: 0.25 });
    Sound.blip(220, 0.07, 'square', 0.25, 80);
    this.gainMastery('sword', hits > 0 ? 3 : 1);
  }
  _swing(game, aim, reach, arc, dmg) {
    let hits = 0;
    for (const e of game.enemies) {
      if (e.dead) continue;
      const d = dist(this.x, this.y, e.x, e.y);
      if (d > reach + e.r) continue;
      const a = angTo(this.x, this.y, e.x, e.y);
      let da = Math.abs(((a - aim + Math.PI * 3) % TAU) - Math.PI);
      if (da < arc / 2) {
        e.hurt(dmg, game, this.x, this.y);
        if (this.flags.chillHits) e.chill = 1.5;
        if (this.flags.unstableAura) game.spawnExplosion(e.x, e.y, 60, dmg * 0.3, [180, 120, 255], 'blast');
        hits++;
      }
    }
    return hits;
  }

  dash(game) {
    if (this.dashCharges <= 0 || this.dashTime > 0) return;
    this.dashCharges--; if (this.dashRecharge <= 0) this.dashRecharge = 1.6;
    const a = (Math.abs(this.vx) + Math.abs(this.vy) > 30) ? Math.atan2(this.vy, this.vx) : this.aim;
    this.gainMastery('evasion', 3);
    if (this.flags.teleport) {
      const dx = Math.cos(a) * 220, dy = Math.sin(a) * 220;
      game.particles.burst(this.x, this.y, 18, [180, 120, 255], { speed: 200 });
      this.x += dx; this.y += dy; game.world.zone.clampToIsland(this);
      game.particles.burst(this.x, this.y, 18, [180, 120, 255], { speed: 200 });
      Sound.cast(620);
    } else {
      this.dashTime = 0.18; this.iFrames = 0.28;
      this.vx = Math.cos(a) * this.moveSpeed * 2.6; this.vy = Math.sin(a) * this.moveSpeed * 2.6;
      Sound.blip(300, 0.12, 'sine', 0.2, 160);
    }
    game.particles.burst(this.x, this.y, 12, [120, 200, 255], { speed: 120, life: 0.4, kind: 2 });
    if (this.flags.taunt) for (const e of game.enemies) if (dist(this.x, this.y, e.x, e.y) < 130) { e.taunted = 3; const ang = angTo(this.x, this.y, e.x, e.y); e.vx += Math.cos(ang) * 220; e.vy += Math.sin(ang) * 220; }
    if (this.flags.traps) game.spawnMine(this.x, this.y, this);
  }

  grantAbility(key) {
    if (!ABILITIES[key]) return;
    if (!this.abilities[key]) this.abilities[key] = { key, cd: 0 };
  }
  abilityKeys() { return Object.keys(this.abilities); }
  useAbilityByIndex(game, i) {
    const keys = this.abilityKeys(); if (i >= keys.length) return;
    this.useAbility(game, keys[i]);
  }
  useAbility(game, key) {
    const a = this.abilities[key], def = ABILITIES[key];
    if (!a || a.cd > 0) return;
    if (this.energy < def.en) { game.floater(this.x, this.y - 24, 'нет энергии', '#ff8b5b'); return; }
    this.energy -= def.en; a.cd = def.cd / (1 + this.stats.agi * 0.004);
    const wp = game.cam.toWorld(game.input.mx, game.input.my, game.W, game.H);
    if (key === 'meteor') {
      for (let i = 0; i < 6; i++) setTimeout(() => {
        const mx = wp.x + rand(-90, 90), my = wp.y + rand(-90, 90);
        game.spawnExplosion(mx, my, 80, this.spellDamage('fire') * 1.2, [255, 120, 50], 'blast');
      }, i * 130);
      game.notify('☄️ Метеоритный дождь', '', 'lore');
    } else if (key === 'timefreeze') {
      game.timeFreeze = 4; game.notify('⏱️ Время замерло', '', 'lore'); game.cam.shake(0.4);
    } else if (key === 'turret') {
      game.allies.push(new Ally('turret', this.x, this.y, { owner: this, life: 16 }));
    } else if (key === 'guardian') {
      game.allies.push(new Ally('guardian', this.x + Math.cos(this.aim) * 30, this.y + Math.sin(this.aim) * 30, { owner: this, life: 12 }));
    }
    Sound.cast(def.color ? 560 : 560);
    this.gainMastery(key === 'turret' || key === 'guardian' ? 'engineer' : 'arcana', 5);
  }

  draw(ctx, game) {
    const flash = this.hitFlash > 0 && ((game.time * 30) | 0) % 2;
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(this.x, this.y + 14, 14, 6, 0, 0, TAU); ctx.fill();
    // dash trail
    if (this.dashTime > 0) { ctx.globalAlpha = 0.4; ctx.fillStyle = '#7ad2ff'; ctx.beginPath(); ctx.arc(this.x - this.vx * 0.03, this.y - this.vy * 0.03, this.r, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; }

    ctx.save(); ctx.translate(this.x, this.y);
    // shield aura
    if (this.flags.shield || this.flags.technomancer) {
      ctx.strokeStyle = 'rgba(120,200,255,0.5)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, this.r + 8 + Math.sin(game.time * 4) * 2, 0, TAU); ctx.stroke();
    }
    // body
    ctx.rotate(this.face);
    const bodyCol = flash ? '#fff' : '#dfe6ff';
    ctx.fillStyle = bodyCol; ctx.strokeStyle = '#7c5cff'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(0, 0, this.r, 0, TAU); ctx.fill(); ctx.stroke();
    // core gem (faction-ish color based on dominant stat)
    ctx.fillStyle = '#7c5cff'; ctx.beginPath(); ctx.arc(0, 0, 6, 0, TAU); ctx.fill();
    // facing pointer (weapon)
    ctx.rotate(this.aim - this.face);
    ctx.strokeStyle = '#ffce6b'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(this.r - 2, 0); ctx.lineTo(this.r + 14, 0); ctx.stroke();
    // wings mutation
    if (this.mutMods.speed && this.mutations.some(m => m.id === 'wings')) {
      ctx.fillStyle = 'rgba(180,210,255,0.5)';
      ctx.beginPath(); ctx.ellipse(-6, -10, 10, 5, -0.6, 0, TAU); ctx.ellipse(-6, 10, 10, 5, 0.6, 0, TAU); ctx.fill();
    }
    ctx.restore();

    // queued elements glow
    this.elementQueue.forEach((el, i) => {
      const c = ELEMENTS[el].color;
      ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},0.9)`;
      ctx.beginPath(); ctx.arc(this.x - 10 + i * 20, this.y - this.r - 12, 5, 0, TAU); ctx.fill();
    });
  }
}

// ===========================================================================
//  PROJECTILE
// ===========================================================================
export class Projectile {
  constructor(x, y, ang, speed, dmg, r, color, owner) {
    this.id = UID++; this.x = x; this.y = y;
    this.vx = Math.cos(ang) * speed; this.vy = Math.sin(ang) * speed;
    this.dmg = dmg; this.r = r; this.color = color; this.owner = owner;
    this.life = 1.6; this.pierce = 0; this.dead = false; this.element = null;
    this.hitSet = new Set(); this.trail = 0;
  }
  update(dt, game) {
    this.x += this.vx * dt; this.y += this.vy * dt; this.life -= dt;
    if (this.life <= 0) { this.dead = true; return; }
    this.trail -= dt;
    if (this.trail <= 0) { this.trail = 0.03; game.particles.spawn(this.x, this.y, 0, 0, 0.25, this.r * 0.7, this.color, 2, 0.9, 0); }
    if (!game.world.zone.inBounds(this.x, this.y)) { this.dead = true; return; }

    if (this.owner === 'player' || this.owner === 'ally') {
      for (const e of game.enemies) {
        if (e.dead || this.hitSet.has(e.id)) continue;
        if (dist2(this.x, this.y, e.x, e.y) < (this.r + e.r) ** 2) {
          e.hurt(this.dmg, game, this.x, this.y);
          if (this.element === 'ice') e.chill = 1.5;
          if (this.element === 'fire') e.burn = 2;
          this.hitSet.add(e.id);
          game.particles.burst(this.x, this.y, 6, this.color, { speed: 120, life: 0.3 });
          if (this.pierce-- <= 0) { this.dead = true; return; }
        }
      }
    } else { // enemy projectile
      const p = game.player;
      if (dist2(this.x, this.y, p.x, p.y) < (this.r + p.r) ** 2) {
        p.takeDamage(this.dmg, game, this.x, this.y); this.dead = true;
      }
    }
  }
  draw(ctx) {
    const c = this.color;
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.r * 2.4);
    g.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},0.9)`); g.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(this.x, this.y, this.r * 2.4, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(this.x, this.y, this.r * 0.6, 0, TAU); ctx.fill();
  }
}

// ===========================================================================
//  ENEMY
// ===========================================================================
export class Enemy {
  constructor(typeKey, x, y, scale = 1) {
    const t = ENEMY_TYPES[typeKey];
    this.id = UID++; this.type = typeKey; this.def = t;
    this.x = x; this.y = y; this.vx = 0; this.vy = 0; this.r = t.r;
    this.maxHP = t.hp * scale; this.hp = this.maxHP; this.dmg = t.dmg * scale;
    this.spd = t.spd; this.color = t.color; this.xp = Math.floor(t.xp * scale);
    this.behavior = t.behavior; this.dead = false; this.atkCd = rand(0.5, 1.5);
    this.chill = 0; this.burn = 0; this.taunted = 0; this.hitFlash = 0; this.phase = rand(TAU);
    this.isBoss = false; this.scale = scale;
  }
  hurt(amt, game, sx, sy) {
    if (this.dead) return;
    this.hp -= amt; this.hitFlash = 0.12;
    game.floater(this.x, this.y - this.r - 6, Math.round(amt), '#ffd86b');
    if (sx !== undefined) { const a = angTo(sx, sy, this.x, this.y); this.vx += Math.cos(a) * 60; this.vy += Math.sin(a) * 60; }
    Sound.hit();
    if (this.hp <= 0) this.die(game);
  }
  die(game) {
    this.dead = true;
    game.particles.burst(this.x, this.y, this.isBoss ? 60 : 16, this._rgb(), { speed: 220, life: 0.7, size: this.isBoss ? 5 : 3 });
    game.onEnemyKilled(this);
    if (game.rift.active && game.rift.has('explodeOnDeath')) game.spawnExplosion(this.x, this.y, 70, this.dmg * 1.5, [255, 140, 60], 'blast', 'enemy');
  }
  _rgb() { const h = this.color; const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  update(dt, game) {
    const p = game.player;
    let slow = this.chill > 0 ? 0.5 : 1;
    if (game.timeFreeze > 0) slow *= 0.25;
    this.chill = Math.max(0, this.chill - dt); this.taunted = Math.max(0, this.taunted - dt);
    this.hitFlash = Math.max(0, this.hitFlash - dt);
    if (this.burn > 0) { this.burn -= dt; this.hp -= 6 * dt; if (this.hp <= 0) { this.die(game); return; } if (chance(0.3)) game.particles.spawn(this.x + rand(-8, 8), this.y, 0, -40, 0.4, 2, [255, 120, 40], 2); }

    let spdMul = slow * (game.rift.active && game.rift.has('fastEnemies') ? 1.4 : 1);
    const d = dist(this.x, this.y, p.x, p.y);
    const a = angTo(this.x, this.y, p.x, p.y);

    if (this.behavior === 'ranged') {
      // keep distance, shoot
      const want = 240;
      const dir = d < want - 40 ? -1 : d > want + 40 ? 1 : 0;
      this.vx = lerp(this.vx, Math.cos(a) * this.spd * dir * spdMul, 0.1);
      this.vy = lerp(this.vy, Math.sin(a) * this.spd * dir * spdMul, 0.1);
      this.atkCd -= dt;
      if (this.atkCd <= 0 && d < 360) { this.atkCd = 1.8; game.projectiles.push(new Projectile(this.x, this.y, a, 240, this.dmg, 6, [255, 120, 140], 'enemy')); }
    } else if (this.behavior === 'orbit') {
      const orb = a + Math.PI / 2;
      this.vx = lerp(this.vx, (Math.cos(a) * 0.5 + Math.cos(orb)) * this.spd * spdMul, 0.08);
      this.vy = lerp(this.vy, (Math.sin(a) * 0.5 + Math.sin(orb)) * this.spd * spdMul, 0.08);
    } else { // chase
      this.vx = lerp(this.vx, Math.cos(a) * this.spd * spdMul, 0.09);
      this.vy = lerp(this.vy, Math.sin(a) * this.spd * spdMul, 0.09);
    }
    this.x += this.vx * dt; this.y += this.vy * dt;
    this.vx *= 0.9; this.vy *= 0.9;

    // separation (avoid stacking) — cheap, only nearby
    for (const o of game.enemies) {
      if (o === this || o.dead) continue;
      const dd = dist2(this.x, this.y, o.x, o.y), mr = this.r + o.r;
      if (dd < mr * mr && dd > 0.01) { const dl = Math.sqrt(dd), push = (mr - dl) / dl * 0.5; this.x += (this.x - o.x) * push * 0.1; this.y += (this.y - o.y) * push * 0.1; }
    }
    game.world.zone.clampToIsland(this);

    // melee contact
    this.atkCd -= dt;
    if (this.behavior !== 'ranged' && d < this.r + p.r + 4 && this.atkCd <= 0) {
      this.atkCd = 0.9; p.takeDamage(this.dmg, game, this.x, this.y);
    }
  }
  draw(ctx, game) {
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(this.x, this.y + this.r * 0.7, this.r * 0.8, this.r * 0.35, 0, 0, TAU); ctx.fill();
    ctx.save(); ctx.translate(this.x, this.y);
    const wob = Math.sin(game.time * 6 + this.phase) * 0.08;
    ctx.rotate(wob);
    const col = this.hitFlash > 0 ? '#fff' : this.color;
    if (this.chill > 0) ctx.shadowColor = '#7ad2ff', ctx.shadowBlur = 12;
    ctx.fillStyle = col; ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 2;
    if (this.behavior === 'ranged') { // diamond drone
      ctx.beginPath(); ctx.moveTo(0, -this.r); ctx.lineTo(this.r, 0); ctx.lineTo(0, this.r); ctx.lineTo(-this.r, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
    } else { // blob
      ctx.beginPath();
      for (let i = 0; i <= 10; i++) { const ang = i / 10 * TAU, rr = this.r * (1 + Math.sin(ang * 3 + this.phase) * 0.12); i ? ctx.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr) : ctx.moveTo(Math.cos(ang) * rr, Math.sin(ang) * rr); }
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    // eye
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, -this.r * 0.15, this.r * 0.25, 0, TAU); ctx.fill();
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(0, -this.r * 0.15, this.r * 0.12, 0, TAU); ctx.fill();
    ctx.restore();
    // hp bar
    if (this.hp < this.maxHP) {
      const w = this.r * 2, hppc = this.hp / this.maxHP;
      ctx.fillStyle = '#000a'; ctx.fillRect(this.x - w / 2, this.y - this.r - 12, w, 4);
      ctx.fillStyle = this.isBoss ? '#ff5b6e' : '#ff8b5b'; ctx.fillRect(this.x - w / 2, this.y - this.r - 12, w * hppc, 4);
    }
  }
}

// ===========================================================================
//  BOSS — extends Enemy with phases & special attacks
// ===========================================================================
export class Boss extends Enemy {
  constructor(def, x, y, scale = 1) {
    super('brute', x, y, 1);
    this.isBoss = true; this.bossDef = def; this.name = def.name;
    this.maxHP = def.hp * scale; this.hp = this.maxHP; this.dmg = def.dmg * scale;
    this.spd = def.spd; this.color = def.color; this.r = def.r;
    this.xp = Math.floor(220 * scale); this.specialCd = 4; this.behavior = 'chase';
  }
  update(dt, game) {
    super.update(dt, game);
    this.specialCd -= dt;
    if (this.specialCd <= 0 && !this.dead) {
      this.specialCd = rand(3.5, 5);
      const p = game.player, a = angTo(this.x, this.y, p.x, p.y);
      // radial burst of projectiles
      const n = 12;
      for (let i = 0; i < n; i++) {
        const ang = a + (i / n) * TAU;
        game.projectiles.push(new Projectile(this.x, this.y, ang, 200, this.dmg * 0.6, 7, this._rgb(), 'enemy'));
      }
      game.cam.shake(0.4); Sound.boss();
    }
  }
}

// ===========================================================================
//  ALLY — companions, summons, turrets, drones, guardians
// ===========================================================================
export class Ally {
  constructor(type, x, y, opts = {}) {
    this.id = UID++; this.type = type; this.x = x; this.y = y; this.vx = 0; this.vy = 0;
    this.owner = opts.owner; this.life = opts.life || Infinity; this.atkCd = 0; this.r = 12;
    this.phase = rand(TAU); this.dead = false;
    this.hp = type === 'guardian' ? 200 : 60; this.maxHP = this.hp;
    const cfg = {
      spirit:   { mode: 'orbit', r: 11, color: '#5bffb0', dmgMul: 0.5, rate: 0.7, range: 320 },
      summon:   { mode: 'orbit', r: 10, color: '#b07cff', dmgMul: 0.4, rate: 0.8, range: 300 },
      drone:    { mode: 'orbit', r: 9,  color: '#6ea8ff', dmgMul: 0.45, rate: 0.6, range: 340 },
      turret:   { mode: 'static',r: 14, color: '#5bffb0', dmgMul: 0.7, rate: 0.5, range: 320 },
      guardian: { mode: 'tank',  r: 22, color: '#9ad0ff', dmgMul: 1.0, rate: 0.9, range: 90 },
    }[type];
    Object.assign(this, cfg);
    this.r = cfg.r;
  }
  hurt(amt) { this.hp -= amt; if (this.hp <= 0) this.dead = true; }
  _nearest(game) {
    let best = null, bd = this.range * this.range;
    for (const e of game.enemies) { if (e.dead) continue; const d = dist2(this.x, this.y, e.x, e.y); if (d < bd) { bd = d; best = e; } }
    return best;
  }
  update(dt, game) {
    this.life -= dt; if (this.life <= 0) { this.dead = true; return; }
    const p = game.player;
    if (this.mode === 'orbit') {
      const t = game.time * (this.type === 'drone' ? 2.4 : 1.6) + this.phase;
      const tx = p.x + Math.cos(t) * 52, ty = p.y + Math.sin(t) * 52;
      this.x = lerp(this.x, tx, 0.12); this.y = lerp(this.y, ty, 0.12);
    } else if (this.mode === 'tank') {
      const e = this._nearest(game);
      if (e) { const a = angTo(this.x, this.y, e.x, e.y); this.x += Math.cos(a) * 80 * dt; this.y += Math.sin(a) * 80 * dt; if (dist(this.x, this.y, e.x, e.y) < this.r + e.r + 4 && this.atkCd <= 0) { this.atkCd = this.rate; e.hurt(this._dmg(), game, this.x, this.y); e.taunted = 1; } }
      else { const a = angTo(this.x, this.y, p.x, p.y); if (dist(this.x, this.y, p.x, p.y) > 60) { this.x += Math.cos(a) * 80 * dt; this.y += Math.sin(a) * 80 * dt; } }
    }
    this.atkCd -= dt;
    if (this.mode !== 'tank') {
      const e = this._nearest(game);
      if (e && this.atkCd <= 0) {
        this.atkCd = this.rate;
        const a = angTo(this.x, this.y, e.x, e.y);
        const rgb = this.color.match(/\w\w/g).map(h => parseInt(h, 16));
        const pr = new Projectile(this.x, this.y, a, 480, this._dmg(), 5, rgb, 'ally');
        game.projectiles.push(pr);
      }
    }
  }
  _dmg() {
    const p = this.owner;
    const base = (this.type === 'spirit' || this.type === 'summon')
      ? 12 + (this.compLevel || 1) * 4
      : (p ? p.deviceDamage() : 12);
    return base * this.dmgMul;
  }
  draw(ctx, game) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(this.x, this.y + this.r * 0.6, this.r * 0.7, this.r * 0.3, 0, 0, TAU); ctx.fill();
    ctx.save(); ctx.translate(this.x, this.y);
    ctx.shadowColor = this.color; ctx.shadowBlur = 10; ctx.fillStyle = this.color;
    if (this.type === 'turret') {
      ctx.fillRect(-10, -6, 20, 12);
      const e = this._nearest(game); const a = e ? angTo(this.x, this.y, e.x, e.y) : 0;
      ctx.rotate(a); ctx.fillRect(0, -3, 18, 6);
    } else if (this.type === 'guardian') {
      ctx.beginPath(); ctx.arc(0, 0, this.r, 0, TAU); ctx.fill();
      ctx.fillStyle = '#0a1018'; ctx.fillRect(-6, -4, 12, 8);
    } else if (this.type === 'drone') {
      ctx.beginPath(); ctx.moveTo(0, -this.r); ctx.lineTo(this.r, this.r); ctx.lineTo(-this.r, this.r); ctx.closePath(); ctx.fill();
    } else { // spirit / summon
      const wob = Math.sin(game.time * 5 + this.phase) * 2;
      ctx.beginPath(); ctx.arc(0, wob, this.r, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-3, wob - 2, 2.5, 0, TAU); ctx.arc(3, wob - 2, 2.5, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }
}
