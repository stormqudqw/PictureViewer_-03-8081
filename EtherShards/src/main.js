// ============================================================================
//  Осколки Эфира — Main game orchestrator & render loop.
//  Fixed-timestep-ish loop with capped dt, layered Canvas2D rendering and a
//  cached static world layer for performance.
// ============================================================================
import { Input, Camera, Particles, Sound, clamp, lerp, dist, dist2, angTo, rand, randInt, pick, chance, TAU } from './engine.js';
import { World } from './world.js';
import { Player, Enemy, Boss, Projectile, Ally } from './entities.js';
import { Reputation, Rift, Save } from './systems.js';
import { UI } from './ui.js';
import { ELEMENTS, COMBOS, MUTATIONS, TALENTS, CORES, BOSSES, FACTIONS, ENEMY_TYPES } from './data.js';

class Game {
  constructor() {
    this.canvas = document.getElementById('game');
    this.ctx = this.canvas.getContext('2d', { alpha: false });
    this.dpr = Math.min(devicePixelRatio || 1, 2);
    this.input = Input; this.cam = new Camera();
    this.particles = new Particles(2400);
    this.running = false; this.paused = false;
    this.time = 0; this.timeFreeze = 0;
    this.enemies = []; this.projectiles = []; this.allies = [];
    this.hazards = []; this.mines = []; this.pickups = []; this.floaters = [];
    this.slash = null;
    this.spawnTimer = 0; this.saveTimer = 0;
    this.bossesCleared = 0;
    this.primaryElement = 'fire'; this.secondaryElement = 'ice';
    this.companionAlly = null;
    this.stars = this._makeStars();
    Input.init(this.canvas); Sound.init();
    UI.init(this);
    this._bindUI();
    addEventListener('resize', () => this.resize());
    this.resize();
  }

  _makeStars() {
    const s = [];
    for (let i = 0; i < 140; i++) s.push({ x: rand(), y: rand(), z: rand(0.2, 1), tw: rand(TAU) });
    return s;
  }

  resize() {
    this.W = innerWidth; this.H = innerHeight;
    this.canvas.width = this.W * this.dpr; this.canvas.height = this.H * this.dpr;
  }

  _bindUI() {
    document.getElementById('btn-start').onclick = () => this.startNew();
    document.getElementById('btn-continue').onclick = () => this.continueGame();
    document.getElementById('btn-howto').onclick = () => UI.openHowTo();
    if (!Save.exists()) document.getElementById('btn-continue').style.display = 'none';

    addEventListener('keydown', e => {
      if (!this.running) return;
      const k = e.key.toLowerCase();
      if (k === 'escape') { if (UI.isOpen) UI.close(); }
      if (UI.isOpen && !['c', 't', 'm', 'k', 'b'].includes(k)) return;
      if (k === 'c') UI.isOpen ? UI.close() : UI.openCharacter(this);
      if (k === 't') UI.isOpen ? UI.close() : UI.openTalents(this);
      if (k === 'm') UI.isOpen ? UI.close() : UI.openWorldMap(this);
      if (k === 'b') UI.isOpen ? UI.close() : UI.openCores(this);
    });
  }

  // ---- session lifecycle ----------------------------------------------------
  startNew() {
    Sound.resume();
    this.world = new World();
    this.player = new Player();
    this.rep = new Reputation();
    this.rift = new Rift();
    this.companion = { level: 1, xp: 0, xpNext: 30, name: 'Дух-искра' };
    this._beginRun();
    UI.toast('Добро пожаловать', 'Найди алтарь в центре острова (F), чтобы призвать босса.', 'lore');
  }

  continueGame() {
    const data = Save.read();
    if (!data) return this.startNew();
    Sound.resume();
    this.world = new World();
    this.world.travel(data.zone || 0);
    this.rep = new Reputation(); Object.assign(this.rep.v, data.rep || {});
    this.rift = new Rift(); if (data.rift && data.rift.active) { this.rift.active = true; this.rift.floor = data.rift.floor; this.rift.roll(); }
    this.companion = data.comp || { level: 1, xp: 0, xpNext: 30, name: 'Дух-искра' };
    this.bossesCleared = data.bossesCleared || 0;
    (data.cleared || []).forEach((c, i) => { if (this.world.zones[i]) this.world.zones[i].cleared = c; });
    if (this.bossesCleared >= BOSSES.length) this._riftsUnlocked = true;
    const p = this.player = new Player();
    const d = data.player;
    Object.assign(p.stats, d.stats); p.level = d.level; p.xp = d.xp; p.xpNext = d.xpNext;
    p.statPoints = d.statPoints; p.talentPoints = d.talentPoints;
    Object.assign(p.masteryXP, d.masteryXP); p.bonusHP = d.bonusHP || 0;
    p.maxDashCharges = d.maxDashCharges || 2; p.dashCharges = p.maxDashCharges;
    // re-apply cores
    (d.cores || []).forEach(id => { const c = CORES.find(x => x.id === id); if (c) { p.cores.add(id); c.apply(p); } });
    // re-apply mutations
    (d.mutations || []).forEach(id => { const m = MUTATIONS.find(x => x.id === id); if (m) { p.mutations.push(m); m.apply(p); } });
    // re-apply talents
    (d.talents || []).forEach(id => { const t = TALENTS.find(x => x.id === id); if (t) { p.talents.add(id); if (t.apply) t.apply(p); if (t.grant) p.grantAbility(t.grant); } });
    p.recompute(true);
    this._beginRun();
    UI.toast('Игра загружена', `Уровень ${p.level} · ${this.world.zone.name}`, 'good');
  }

  _beginRun() {
    const z = this.world.zone;
    this.player.x = z.cx; this.player.y = z.cy + z.radius * 0.4;
    this.cam.x = this.player.x; this.cam.y = this.player.y;
    this.enemies.length = this.projectiles.length = this.allies.length = 0;
    this.hazards.length = this.mines.length = this.pickups.length = this.floaters.length = 0;
    // spawn persistent companion spirit
    this.spawnCompanion();
    document.getElementById('title').classList.add('hidden');
    document.getElementById('hud').classList.remove('hidden');
    this.running = true; this.paused = false; this.time = 0;
    this._populate();
    if (!this._loopStarted) { this._loopStarted = true; requestAnimationFrame(this.loop); }
  }

  spawnCompanion() {
    const a = new Ally('spirit', this.player.x, this.player.y, { owner: this.player, life: Infinity });
    a.compLevel = this.companion.level; a.persistent = true;
    this.companionAlly = a; this.allies.push(a);
    if (this.player.flags.extraSummon) { const b = new Ally('summon', this.player.x, this.player.y, { owner: this.player, life: Infinity }); b.compLevel = this.companion.level; b.persistent = true; this.allies.push(b); }
    // re-apply drone flag
    if (this.player.flags.drone) this.allies.push(new Ally('drone', this.player.x, this.player.y, { owner: this.player, life: Infinity }));
  }

  // ---- world population / spawn director ------------------------------------
  _populate() {
    const z = this.world.zone;
    const count = z.cleared ? 6 : 10 + this.world.current * 2 + (this.rift.active ? this.rift.floor * 2 : 0);
    for (let i = 0; i < count; i++) this._spawnEnemy();
  }
  _spawnEnemy(forceType) {
    const z = this.world.zone;
    let x, y, tries = 0;
    do { const a = rand(TAU), r = rand(z.radius * 0.4, z.radius * 0.92); x = z.cx + Math.cos(a) * r; y = z.cy + Math.sin(a) * r; tries++; }
    while ((!z.inBounds(x, y) || dist(x, y, this.player.x, this.player.y) < 260) && tries < 20);
    const types = Object.keys(ENEMY_TYPES);
    const key = forceType || pick(types);
    let scale = 1 + this.world.current * 0.18 + (this.player.level - 1) * 0.03;
    if (this.rift.active) { scale *= 1 + this.rift.floor * 0.12; if (this.rift.has('tankyEnemies')) scale *= 1.6; }
    const e = new Enemy(key, x, y, scale);
    this.enemies.push(e);
    return e;
  }

  spawnBoss() {
    const z = this.world.zone;
    const def = this.rift.active
      ? { ...pick(BOSSES), name: 'Аватар Разлома', hp: 700 + this.rift.floor * 220 }
      : BOSSES[Math.min(this.world.current, BOSSES.length - 1)];
    let scale = 1 + (this.player.level - 1) * 0.04;
    if (this.rift.active) scale *= 1 + this.rift.floor * 0.15;
    const b = new Boss(def, z.cx, z.cy - z.radius * 0.3, scale);
    b._coreId = def.core;
    this.enemies.push(b);
    this.cam.shake(0.8); Sound.boss();
    UI.toast('⚠ БОСС: ' + b.name, 'Победи его ради Эфирного Ядра!', 'bad');
  }

  // ---- combat helpers -------------------------------------------------------
  floater(x, y, text, color) { this.floaters.push({ x, y, text: '' + text, color, life: 0.8, vy: -40 }); }
  notify(t, b, type) { UI.toast(t, b, type); }

  spawnHazard(x, y, r, dmg, color, life, target = 'enemy') {
    this.hazards.push({ x, y, r, dmg, color, life, maxLife: life, tick: 0, target });
  }
  spawnMine(x, y, owner) {
    this.mines.push({ x, y, r: 12, trigger: 28, owner, armed: 0.4, life: 12 });
  }
  spawnExplosion(x, y, radius, dmg, color, effect, target = 'enemy') {
    this.cam.shake(0.3);
    this.particles.burst(x, y, 26, color, { speed: 260, life: 0.6, size: 4, kind: 1 });
    this.particles.spawn(x, y, 0, 0, 0.4, radius * 0.5, color, 2, 0.9, 0);
    Sound.blip(120, 0.2, 'sawtooth', 0.3, -60); Sound.noise(0.18, 0.25, 600);
    if (target === 'enemy') {
      for (const e of this.enemies) if (!e.dead && dist2(x, y, e.x, e.y) < (radius + e.r) ** 2) {
        e.hurt(dmg, this, x, y);
        if (effect === 'storm' || effect === 'chain') e.chill = 1;
        if (effect === 'burn' || effect === 'tornado') e.burn = 2;
      }
    } else {
      if (dist2(x, y, this.player.x, this.player.y) < (radius + this.player.r) ** 2) this.player.takeDamage(dmg, this, x, y);
    }
    // lingering area for some effects
    if (['cloud', 'storm', 'burn', 'tornado'].includes(effect)) this.spawnHazard(x, y, radius * 0.8, dmg * 0.25, color, 2.4, target);
  }

  // ---- progression callbacks ------------------------------------------------
  onEnemyKilled(e) {
    this.player.gainXP(e.xp, this);
    // companion xp
    this.companion.xp += Math.ceil(e.xp * 0.6);
    while (this.companion.xp >= this.companion.xpNext) {
      this.companion.xp -= this.companion.xpNext; this.companion.level++;
      this.companion.xpNext = Math.floor(30 * Math.pow(1.25, this.companion.level - 1));
      this._evolveCompanion();
    }
    if (this.player.flags.bloodrage) this.player.heal(this.player.maxHP * 0.06, this);
    if (this.player.flags.voidSiphon) this.player.energy = Math.min(this.player.maxEN, this.player.energy + this.player.maxEN * 0.08);
    // minor reputation: killing monsters pleases the Clans (warriors at heart)
    if (chance(0.12)) this.rep.change('clans', 1);
    // drops
    if (chance(0.22)) this.pickups.push({ x: e.x, y: e.y, type: chance(0.5) ? 'hp' : 'en', r: 9, bob: rand(TAU) });

    if (e.isBoss) this.onBossKilled(e);
  }

  _evolveCompanion() {
    const lv = this.companion.level;
    const names = [[1, 'Дух-искра'], [3, 'Эфирный дракончик'], [6, 'Древний дух'], [10, 'Аватар Эфира']];
    let nm = this.companion.name;
    for (const [l, n] of names) if (lv >= l) nm = n;
    const evolved = nm !== this.companion.name;
    this.companion.name = nm;
    this.allies.forEach(a => { if (a.persistent) a.compLevel = lv; });
    UI.toast('🐲 Спутник: ' + nm, evolved ? 'Эволюция! Уровень ' + lv : 'Спутник вырос до уровня ' + lv, 'good');
  }

  onBossKilled(b) {
    this.cam.shake(1); Sound.level();
    for (let i = 0; i < 60; i++) this.particles.burst(b.x, b.y, 1, [255, 220, 120], { speed: rand(80, 360), life: rand(0.6, 1.4), size: 4 });
    if (!this.rift.active) {
      const z = this.world.zone;
      if (!z.cleared) { z.cleared = true; this.bossesCleared++; }
      // grant the core
      const coreId = b._coreId;
      const core = CORES.find(c => c.id === coreId);
      if (core && !this.player.cores.has(coreId)) {
        this.player.cores.add(coreId); core.apply(this.player); this.player.recompute();
        UI.toast('💠 Получено: ' + core.name, core.desc, 'good');
      }
      this.rep.change('order', 8); // Order of Light loves stabilizing the world
      if (this.bossesCleared >= BOSSES.length && !this._riftsUnlocked) {
        this._riftsUnlocked = true;
        UI.toast('🌌 БЕСКОНЕЧНЫЕ РАЗЛОМЫ ОТКРЫТЫ', 'Найди алтарь и войди в Разлом (F).', 'lore');
      }
    } else {
      // rift boss -> advance floor
      this.rift.next();
      if (chance(0.6)) { const c = pick(CORES); UI.toast('💠 Редкое ядро усилено', c.name, 'good'); }
      UI.toast('🌌 Разлом углубляется', 'Этаж ' + this.rift.floor + ' · ' + this.rift.mods.map(m => m.name).join(', '), 'lore');
      this._populate();
    }
    Save.write(this);
  }

  onLevelUp() {
    Sound.level(); this.cam.shake(0.3);
    this.particles.burst(this.player.x, this.player.y, 30, [255, 206, 107], { speed: 220, life: 0.8, kind: 2 });
    UI.toast('⬆ Уровень ' + this.player.level, '+3 характеристики, +1 талант. Нажми C и T.', 'good');
  }

  onPlayerDeath() {
    this.running = false;
    Sound.blip(200, 0.6, 'sawtooth', 0.3, -150);
    const inRift = this.rift.active;
    UI.choice('Вы пали', inRift ? `Разлом поглотил вас на этаже ${this.rift.floor}.` : 'Эфир рассеял вашу форму... но осколки помнят.',
      [
        { icon: '✨', title: 'Возродиться', desc: 'Вернуться на остров с полным здоровьем. Разлом сбрасывается.', tag: 'Продолжить', tagType: 'pos' },
        { icon: '🏰', title: 'В главное меню', desc: 'Прогресс сохранён.', tag: 'Выход' },
      ],
      o => {
        if (o.title.startsWith('Возрод')) {
          if (this.rift.active) this.rift.stop();
          this.player.hp = this.player.maxHP; this.player.energy = this.player.maxEN;
          this.player.x = this.world.zone.cx; this.player.y = this.world.zone.cy;
          this.enemies.length = 0; this._populate(); this.running = true;
          Save.write(this);
        } else { this.toMenu(); }
      }, true);
  }

  toMenu() {
    Save.write(this);
    this.running = false;
    document.getElementById('hud').classList.add('hidden');
    document.getElementById('title').classList.remove('hidden');
    document.getElementById('btn-continue').style.display = '';
    UI.close();
  }

  // ---- talents / hybrids ----------------------------------------------------
  learnTalent(t) {
    const p = this.player;
    if (p.talents.has(t.id) || !UI._talentAvailable(p, t)) return false;
    p.talents.add(t.id); p.talentPoints -= t.cost;
    if (t.apply) t.apply(p);
    if (t.grant) p.grantAbility(t.grant);
    p.recompute();
    // talents that add allies
    if (t.id === 'drone') this.allies.push(new Ally('drone', p.x, p.y, { owner: p, life: Infinity }));
    if (t.id === 'summon') { const b = new Ally('summon', p.x, p.y, { owner: p, life: Infinity }); b.compLevel = this.companion.level; b.persistent = true; this.allies.push(b); }
    UI.toast('🌟 Изучено: ' + t.name, t.desc, 'good');
    Save.write(this);
    return true;
  }
  checkHybridUnlocks() {
    const p = this.player;
    TALENTS.filter(t => t.branch === 'hybrid' && t.reqStats && !p.talents.has(t.id)).forEach(t => {
      if (Object.entries(t.reqStats).every(([k, v]) => p.stats[k] >= v) && !this._announced?.has(t.id)) {
        (this._announced || (this._announced = new Set())).add(t.id);
        UI.toast('🔓 Доступен класс: ' + t.name, 'Открой древо талантов (T), чтобы изучить.', 'lore');
      }
    });
  }

  // ---- interaction ----------------------------------------------------------
  tryInteract() {
    const z = this.world.zone, p = this.player;
    // nearest portal
    for (const pt of z.portals) if (dist(p.x, p.y, pt.x, pt.y) < 50) { this.travelTo(pt.to); return; }
    // ether node -> mutation
    for (const n of z.etherNodes) if (!n.used && dist(p.x, p.y, n.x, n.y) < 50) { n.used = true; this._mutationEvent(); return; }
    // npc -> faction
    if (z.npc && dist(p.x, p.y, z.npc.x, z.npc.y) < 60) { this._npcEvent(z.npc); return; }
    // central altar -> summon boss / enter rift
    if (dist(p.x, p.y, z.cx, z.cy) < 80) { this._altarEvent(z); return; }
    UI.toast('Поблизости нечего активировать', 'Алтарь — в центре острова.', '');
  }

  _altarEvent(z) {
    const bossAlive = this.enemies.some(e => e.isBoss);
    if (bossAlive) { UI.toast('Босс уже призван', 'Победите его.', 'bad'); return; }
    if (this.rift.active) {
      UI.choice('Алтарь Разлома', `Этаж ${this.rift.floor}. Модификаторы: ${this.rift.mods.map(m => m.desc).join(' ')}`,
        [{ icon: '⚔️', title: 'Призвать Аватар Разлома', desc: 'Сразиться с боссом этого этажа.', tag: 'Бой', tagType: 'neg' },
         { icon: '🚪', title: 'Покинуть Разлом', desc: 'Вернуться к обычным островам.' }],
        o => { if (o.title.startsWith('Призвать')) this.spawnBoss(); else { this.rift.stop(); this._populate(); UI.toast('Вы покинули Разлом', '', ''); } });
      return;
    }
    if (z.cleared && this._riftsUnlocked) {
      UI.choice('Стабильный алтарь', 'Остров очищен. Можно войти в Бесконечные Разломы — эндгейм с модификаторами и редкими ядрами.',
        [{ icon: '🌌', title: 'Войти в Разлом', desc: 'Бесконечная прогрессия. Чем глубже — тем сильнее враги и награды.', tag: 'Эндгейм', tagType: 'pos' },
         { icon: '🧘', title: 'Остаться', desc: 'Продолжить исследование островов.' }],
        o => { if (o.title.startsWith('Войти')) { this.rift.start(); this.enemies.length = 0; this._populate(); UI.toast('🌌 Вход в Разлом', 'Этаж 1: ' + this.rift.mods.map(m => m.name).join(', '), 'lore'); } });
      return;
    }
    if (z.cleared) { UI.toast('Остров очищен', 'Найди другие острова через порталы (M).', 'good'); return; }
    this.spawnBoss();
  }

  _mutationEvent() {
    this.cam.shake(0.5);
    this.particles.burst(this.player.x, this.player.y, 40, [120, 255, 150], { speed: 200, life: 0.8, kind: 2 });
    const pool = [...MUTATIONS]; const rolls = [];
    for (let i = 0; i < 2; i++) { const m = pick(pool); pool.splice(pool.indexOf(m), 1); rolls.push(m); }
    const opts = rolls.map(m => ({ icon: m.icon, title: m.name, desc: m.desc, tag: m.good ? 'Положительная' : 'Отрицательная', tagType: m.good ? 'pos' : 'neg', _m: m }));
    opts.push({ icon: '🚫', title: 'Подавить эфир', desc: 'Отказаться от мутации и сохранить текущую форму.', tag: 'Безопасно' });
    UI.choice('☢️ Нестабильный Эфир', 'Контакт с диким эфиром меняет тело. Решай: принять мутацию или подавить её.', opts, o => {
      if (o._m) {
        this.player.mutations.push(o._m); o._m.apply(this.player); this.player.recompute();
        UI.toast((o._m.good ? '🧬 ' : '⚠ ') + o._m.name, o._m.desc, o._m.good ? 'good' : 'bad');
        this.rep.change('order', -3); // Order distrusts mutants
      }
    });
  }

  _npcEvent(npc) {
    const f = FACTIONS.find(x => x.id === npc.faction);
    const tier = this.rep.tier(npc.faction);
    UI.choice(f.icon + ' ' + f.name, `Отношение: ${this.rep.tierName(npc.faction)}. Эта фракция ценит «${f.love}». Чем выше репутация — тем ниже цены и больше наград.`,
      [
        { icon: '🤝', title: 'Помочь фракции', desc: 'Выполнить поручение: +12 репутации с этой фракцией, но −5 с остальными.', tag: '+репутация', tagType: 'pos' },
        { icon: '💰', title: 'Торговать', desc: `Купить зелье (восстановить HP/энергию). Цена зависит от репутации.`, tag: 'обмен' },
        { icon: tier >= 3 ? '🐲' : '🔒', title: tier >= 3 ? 'Получить спутника' : 'Уникальный спутник (нужен Союзник)', desc: tier >= 3 ? 'Союзная фракция даёт боевого дрона-спутника.' : 'Достигни статуса «Союзник», чтобы получить уникального спутника.', tag: tier >= 3 ? 'награда' : 'заблокировано', tagType: tier >= 3 ? 'pos' : 'neg' },
      ],
      o => {
        if (o.title.startsWith('Помочь')) {
          this.rep.change(npc.faction, 12, this);
          FACTIONS.forEach(ff => { if (ff.id !== npc.faction) this.rep.v[ff.id] = clamp(this.rep.v[ff.id] - 5, -100, 100); });
          this.checkHybridUnlocks();
        } else if (o.title.startsWith('Торг')) {
          this.player.heal(60, this); this.player.energy = Math.min(this.player.maxEN, this.player.energy + 40);
          UI.toast('🧪 Зелёное зелье', 'Восстановлено HP и энергия.', 'good'); Sound.pickup();
        } else if (tier >= 3) {
          this.allies.push(new Ally('drone', this.player.x, this.player.y, { owner: this.player, life: Infinity }));
          UI.toast('🛸 Спутник присоединился', f.name + ' дарит боевого дрона.', 'good');
        }
        Save.write(this);
      });
  }

  travelTo(idx) {
    this.world.travel(idx);
    const z = this.world.zone;
    this.player.x = z.cx; this.player.y = z.cy + z.radius * 0.4;
    this.enemies.length = this.projectiles.length = this.hazards.length = this.mines.length = 0;
    this.pickups.length = 0;
    this.cam.x = this.player.x; this.cam.y = this.player.y;
    // keep persistent allies, drop transient
    this.allies = this.allies.filter(a => a.persistent || a.life === Infinity);
    this._populate();
    UI.toast('🌀 ' + z.name, FACTIONS.find(f => f.id === z.faction).name + ' · ' + (z.cleared ? 'очищен' : 'не очищен'), 'lore');
    Save.write(this);
  }

  // ---- main loop ------------------------------------------------------------
  loop = (ts) => {
    requestAnimationFrame(this.loop);
    const dt = Math.min(0.033, (ts - (this._last || ts)) / 1000); this._last = ts;
    if (this.running && !this.paused && !UI.isOpen) this.update(dt);
    this.render();
    Input.endFrame();
  }

  update(dt) {
    this.time += dt;
    this.timeFreeze = Math.max(0, this.timeFreeze - dt);
    const p = this.player;
    p.update(dt, this);
    this.cam.follow(p.x, p.y, dt);

    // zoom slightly out in combat-heavy / boss
    const targetZoom = this.enemies.some(e => e.isBoss) ? 0.92 : 1;
    this.cam.zoom = lerp(this.cam.zoom, targetZoom, dt * 2);

    for (const e of this.enemies) e.update(dt, this);
    for (const pr of this.projectiles) pr.update(dt, this);
    for (const a of this.allies) a.update(dt, this);

    // hazards (ground AoE)
    for (const h of this.hazards) {
      h.life -= dt; h.tick -= dt;
      if (h.tick <= 0) {
        h.tick = 0.3;
        if (h.target === 'enemy') { for (const e of this.enemies) if (!e.dead && dist2(h.x, h.y, e.x, e.y) < (h.r + e.r) ** 2) e.hurt(h.dmg, this, h.x, h.y); }
        else if (dist2(h.x, h.y, p.x, p.y) < (h.r + p.r) ** 2) p.takeDamage(h.dmg, this);
      }
      if (chance(0.4)) this.particles.spawn(h.x + rand(-h.r, h.r), h.y + rand(-h.r, h.r), 0, -30, 0.5, 2, h.color, 2);
    }
    // mines
    for (const m of this.mines) {
      m.life -= dt; m.armed -= dt;
      if (m.armed <= 0) for (const e of this.enemies) if (!e.dead && dist(m.x, m.y, e.x, e.y) < m.trigger) { this.spawnExplosion(m.x, m.y, 80, p.deviceDamage() * 1.5, [255, 160, 60], 'blast'); m.life = 0; break; }
    }
    // rift lightning storm modifier
    if (this.rift.has('lightningStorm') && chance(dt * 0.6)) {
      const z = this.world.zone, a = rand(TAU), r = rand(z.radius * 0.8);
      const lx = z.cx + Math.cos(a) * r, ly = z.cy + Math.sin(a) * r;
      this.spawnExplosion(lx, ly, 60, 24, [255, 240, 120], 'chain', dist(lx, ly, p.x, p.y) < 80 ? 'player' : 'enemy');
    }

    // pickups
    for (const pk of this.pickups) {
      const d = dist(pk.x, pk.y, p.x, p.y);
      if (d < 80) { pk.x = lerp(pk.x, p.x, 0.15); pk.y = lerp(pk.y, p.y, 0.15); }
      if (d < p.r + pk.r) {
        pk.dead = true; Sound.pickup();
        if (pk.type === 'hp') { p.heal(25, this); this.floater(p.x, p.y - 20, '+25 HP', '#5bffb0'); }
        else { p.energy = Math.min(p.maxEN, p.energy + 20); this.floater(p.x, p.y - 20, '+20 EN', '#7ad2ff'); }
      }
    }
    // floaters
    for (const f of this.floaters) { f.life -= dt; f.y += f.vy * dt; f.vy *= 0.92; }

    if (this.slash) { this.slash.t -= dt; if (this.slash.t <= 0) this.slash = null; }

    // cull
    this.enemies = this.enemies.filter(e => !e.dead);
    this.projectiles = this.projectiles.filter(pr => !pr.dead);
    this.allies = this.allies.filter(a => !a.dead);
    this.hazards = this.hazards.filter(h => h.life > 0);
    this.mines = this.mines.filter(m => m.life > 0);
    this.pickups = this.pickups.filter(pk => !pk.dead);
    this.floaters = this.floaters.filter(f => f.life > 0);
    this.particles.update(dt);

    // spawn director — maintain population
    this.spawnTimer -= dt;
    const cap = (this.rift.active ? 16 + this.rift.floor * 2 : 14 + this.world.current * 2);
    const nonBoss = this.enemies.filter(e => !e.isBoss).length;
    const shouldSpawn = this.rift.active || !this.world.zone.cleared;
    if (this.spawnTimer <= 0 && nonBoss < cap && shouldSpawn) {
      this.spawnTimer = clamp(2.4 - this.world.current * 0.2, 0.7, 2.4);
      this._spawnEnemy();
    }

    // autosave
    this.saveTimer -= dt; if (this.saveTimer <= 0) { this.saveTimer = 12; Save.write(this); }

    // HUD + minimap
    UI.updateHUD(this);
    UI.drawMinimap(this);
  }

  // ---- rendering ------------------------------------------------------------
  render() {
    const ctx = this.ctx, W = this.W, H = this.H;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    // sky / void
    const z = this.world ? this.world.zone : null;
    const sky = z ? z.theme.sky : '#05060d';
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, sky); g.addColorStop(1, '#04050b');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    this._drawStars(ctx, W, H);
    if (!this.world) return;

    ctx.save();
    this.cam.apply(ctx, W, H);

    // static island layer
    if (z.bg) ctx.drawImage(z.bg, -z.bgPad, -z.bgPad);

    // ground hazards (under entities)
    for (const h of this.hazards) {
      const a = clamp(h.life / h.maxLife, 0, 1) * 0.4;
      ctx.fillStyle = `rgba(${h.color[0]},${h.color[1]},${h.color[2]},${a})`;
      ctx.beginPath(); ctx.arc(h.x, h.y, h.r, 0, TAU); ctx.fill();
    }
    // mines
    for (const m of this.mines) { ctx.fillStyle = m.armed > 0 ? '#888' : '#ff5b6e'; ctx.beginPath(); ctx.arc(m.x, m.y, m.r, 0, TAU); ctx.fill(); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(m.x, m.y, 3, 0, TAU); ctx.fill(); }

    // interactables glow
    this._drawInteractables(ctx, z);

    // pickups
    for (const pk of this.pickups) {
      pk.bob += 0.1; const col = pk.type === 'hp' ? '#5bffb0' : '#7ad2ff';
      ctx.save(); ctx.translate(pk.x, pk.y + Math.sin(pk.bob) * 3);
      ctx.shadowColor = col; ctx.shadowBlur = 12; ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(0, 0, pk.r, 0, TAU); ctx.fill();
      ctx.fillStyle = '#04060e'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(pk.type === 'hp' ? '+' : '⚡', 0, 0); ctx.restore();
    }

    // entities sorted by Y for depth
    const drawables = [...this.enemies, ...this.allies, this.player].sort((a, b) => a.y - b.y);
    for (const d of drawables) d.draw(ctx, this);

    // melee slash arc
    if (this.slash) {
      const s = this.slash, a = clamp(s.t / 0.16, 0, 1);
      ctx.strokeStyle = `rgba(255,255,255,${a * 0.8})`; ctx.lineWidth = 6 * a;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.reach * 0.8, s.a - 0.7, s.a + 0.7); ctx.stroke();
    }

    // projectiles + particles (additive)
    for (const pr of this.projectiles) pr.draw(ctx);
    this.particles.draw(ctx);

    // boss name banners
    for (const e of this.enemies) if (e.isBoss) this._drawBossLabel(ctx, e);

    // floaters
    ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center';
    for (const f of this.floaters) { ctx.globalAlpha = clamp(f.life / 0.8, 0, 1); ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y); }
    ctx.globalAlpha = 1;

    // time-freeze tint
    if (this.timeFreeze > 0) { ctx.restore(); ctx.fillStyle = 'rgba(120,170,255,0.10)'; ctx.fillRect(0, 0, W, H); ctx.save(); }

    ctx.restore();

    // vignette (screen space)
    const vg = ctx.createRadialGradient(W / 2, H / 2, H * 0.4, W / 2, H / 2, H * 0.9);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);

    // low-hp pulse
    if (this.player.hp < this.player.maxHP * 0.3) {
      const pulse = (Math.sin(this.time * 6) * 0.5 + 0.5) * 0.18;
      ctx.fillStyle = `rgba(255,40,60,${pulse})`; ctx.fillRect(0, 0, W, H);
    }
  }

  _drawStars(ctx, W, H) {
    for (const s of this.stars) {
      const tw = 0.5 + 0.5 * Math.sin(this.time * 2 + s.tw);
      ctx.globalAlpha = tw * s.z;
      ctx.fillStyle = '#cdd8ff'; ctx.fillRect(s.x * W, s.y * H, s.z * 1.6, s.z * 1.6);
    }
    ctx.globalAlpha = 1;
  }

  _drawInteractables(ctx, z) {
    const pulse = Math.sin(this.time * 3) * 0.5 + 0.5;
    // central altar
    const altarActive = !z.cleared || (this._riftsUnlocked) || this.rift.active;
    ctx.save(); ctx.translate(z.cx, z.cy);
    ctx.strokeStyle = `rgba(255,206,107,${0.4 + pulse * 0.4})`; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, 40, 0, TAU); ctx.stroke();
    ctx.fillStyle = `rgba(255,206,107,${0.15 + pulse * 0.15})`; ctx.beginPath(); ctx.arc(0, 0, 30, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffce6b'; ctx.font = '20px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(this.rift.active ? '🌌' : z.cleared ? '🕯️' : '⚔️', 0, 0);
    ctx.restore();

    // portals
    for (const pt of z.portals) {
      pt.phase += 0.04;
      ctx.save(); ctx.translate(pt.x, pt.y);
      ctx.shadowColor = '#b07cff'; ctx.shadowBlur = 18;
      for (let i = 0; i < 3; i++) { ctx.strokeStyle = `rgba(176,124,255,${0.6 - i * 0.15})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 16 + i * 5 + Math.sin(pt.phase + i) * 3, 0, TAU); ctx.stroke(); }
      ctx.restore();
    }
    // ether nodes
    for (const n of z.etherNodes) if (!n.used) {
      n.phase += 0.05;
      ctx.save(); ctx.translate(n.x, n.y);
      ctx.shadowColor = '#5bffb0'; ctx.shadowBlur = 20; ctx.fillStyle = `rgba(91,255,176,${0.5 + pulse * 0.3})`;
      ctx.beginPath(); ctx.arc(0, Math.sin(n.phase) * 4, 12, 0, TAU); ctx.fill();
      ctx.restore();
    }
    // npc
    if (z.npc) {
      const f = FACTIONS.find(x => x.id === z.npc.faction);
      ctx.save(); ctx.translate(z.npc.x, z.npc.y);
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(0, 14, 12, 5, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = f.color; ctx.beginPath(); ctx.arc(0, 0, 13, 0, TAU); ctx.fill();
      ctx.font = '14px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(f.icon, 0, 0);
      ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif'; ctx.fillText(f.short, 0, -22);
      ctx.restore();
    }
  }

  _drawBossLabel(ctx, e) {
    ctx.fillStyle = '#ff5b6e'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('☠ ' + e.name, e.x, e.y - e.r - 22);
  }
}

// boot
window.addEventListener('load', () => { window.__game = new Game(); });
