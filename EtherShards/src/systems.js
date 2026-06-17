// ============================================================================
//  Осколки Эфира — Meta systems: reputation, endless rifts, persistence.
// ============================================================================
import { FACTIONS, RIFT_MODS } from './data.js';
import { clamp, pick } from './engine.js';

export class Reputation {
  constructor() { this.v = {}; FACTIONS.forEach(f => this.v[f.id] = 0); }
  change(id, amt, game) {
    if (this.v[id] === undefined) return;
    this.v[id] = clamp(this.v[id] + amt, -100, 100);
    if (game) {
      const f = FACTIONS.find(x => x.id === id);
      game.notify(`${f.icon} ${f.name}`, `${amt > 0 ? '+' : ''}${amt} репутации (${this.tierName(id)})`, amt > 0 ? 'good' : 'bad');
    }
  }
  tier(id) { const x = this.v[id]; return x >= 60 ? 3 : x >= 25 ? 2 : x >= -24 ? 1 : x >= -59 ? 0 : -1; }
  tierName(id) { return ['Враг', 'Холодно', 'Нейтрально', 'Дружелюбно', 'Союзник'][this.tier(id) + 1]; }
  // price multiplier & whether unique companion/quests unlocked
  priceMul(id) { return [1.5, 1.25, 1, 0.85, 0.7][this.tier(id) + 1]; }
}

export class Rift {
  constructor() { this.active = false; this.floor = 0; this.mods = []; }
  has(flag) { return this.active && this.mods.some(m => m.flag === flag); }
  start() { this.active = true; this.floor = 1; this.roll(); }
  roll() {
    const pool = [...RIFT_MODS];
    const n = Math.min(1 + Math.floor(this.floor / 3), 3);
    this.mods = [];
    for (let i = 0; i < n; i++) { const m = pick(pool); pool.splice(pool.indexOf(m), 1); this.mods.push(m); }
  }
  next() { this.floor++; this.roll(); }
  stop() { this.active = false; this.floor = 0; this.mods = []; }
  label() { return this.active ? `РАЗЛОМ · этаж ${this.floor}` : ''; }
}

// ---------------------------------------------------------------------------
//  Persistence — compact snapshot of run progression in localStorage.
// ---------------------------------------------------------------------------
const KEY = 'ethershards_save_v1';
export const Save = {
  exists() { try { return !!localStorage.getItem(KEY); } catch (e) { return false; } },
  write(game) {
    try {
      const p = game.player;
      const data = {
        t: Date.now(),
        zone: game.world.current,
        rep: game.rep.v,
        rift: { active: game.rift.active, floor: game.rift.floor },
        comp: game.companion,
        player: {
          level: p.level, xp: p.xp, xpNext: p.xpNext,
          statPoints: p.statPoints, talentPoints: p.talentPoints,
          stats: p.stats, masteryXP: p.masteryXP,
          talents: [...p.talents], cores: [...p.cores],
          mutations: p.mutations.map(m => m.id),
          bonusHP: p.bonusHP, maxDashCharges: p.maxDashCharges,
        },
        bossesCleared: game.bossesCleared,
        cleared: game.world.zones.map(z => z.cleared),
      };
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch (e) { /* storage may be unavailable */ }
  },
  read() { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } },
  clear() { try { localStorage.removeItem(KEY); } catch (e) {} }
};
