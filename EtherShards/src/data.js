// ============================================================================
//  Осколки Эфира — Game data definitions
//  All tunable design content lives here so systems stay generic.
// ============================================================================

// ---- Elements & combo magic --------------------------------------------------
export const ELEMENTS = {
  fire:  { name: 'Огонь',  icon: '🔥', color: [255, 120, 40] },
  ice:   { name: 'Лёд',    icon: '❄️', color: [120, 210, 255] },
  bolt:  { name: 'Молния', icon: '⚡', color: [255, 240, 120] },
  poison:{ name: 'Яд',     icon: '☠️', color: [150, 255, 90] },
  wind:  { name: 'Ветер',  icon: '🌪️', color: [200, 255, 230] },
  water: { name: 'Вода',   icon: '💧', color: [90, 170, 255] },
};

// Combining two queued elements produces a stronger reaction.
export const COMBOS = [
  { a: 'ice',  b: 'bolt',  name: 'Электрошторм', icon: '🌩️', color: [180, 220, 255], dmg: 34, radius: 130, effect: 'storm' },
  { a: 'water',b: 'poison',name: 'Токсичный туман', icon: '🟢', color: [150, 255, 90], dmg: 20, radius: 150, effect: 'cloud' },
  { a: 'fire', b: 'wind',  name: 'Огненный смерч', icon: '🔥', color: [255, 140, 50], dmg: 40, radius: 120, effect: 'tornado' },
  { a: 'fire', b: 'ice',   name: 'Паровой взрыв', icon: '💥', color: [230, 230, 255], dmg: 30, radius: 140, effect: 'blast' },
  { a: 'bolt', b: 'water', name: 'Перегрузка',   icon: '⚡', color: [120, 200, 255], dmg: 38, radius: 110, effect: 'chain' },
  { a: 'poison',b:'fire',  name: 'Напалм',        icon: '🟠', color: [255, 100, 30], dmg: 28, radius: 130, effect: 'burn' },
];

// ---- Core stats --------------------------------------------------------------
export const STATS = [
  { key: 'str', name: 'Сила',      desc: 'Физический урон, провокация',       icon: '💪' },
  { key: 'agi', name: 'Ловкость',  desc: 'Скорость, уклонение, перезарядка',  icon: '🏃' },
  { key: 'int', name: 'Интеллект', desc: 'Сила магии и заклинаний',           icon: '🔮' },
  { key: 'tec', name: 'Техника',   desc: 'Турели, дроны, устройства',         icon: '⚙️' },
  { key: 'wil', name: 'Воля',      desc: 'Макс. энергия и сопротивления',     icon: '🛡️' },
];

// ---- Skill-by-use masteries --------------------------------------------------
export const MASTERIES = {
  sword:   { name: 'Мастерство меча', icon: '⚔️', desc: '+физ. урон ближнего боя' },
  evasion: { name: 'Уклонение',       icon: '💨', desc: '+шанс уклонения и скорость рывка' },
  arcana:  { name: 'Тайные искусства',icon: '✨', desc: '+урон заклинаний' },
  engineer:{ name: 'Инженерия',       icon: '🔧', desc: '+прочность устройств' },
};

// ---- Talent tree -------------------------------------------------------------
// branch: combat / magic / engineer / hybrid. req = {talentId or stat reqs}
export const TALENTS = [
  // Combat
  { id: 'double_strike', branch: 'combat', name: 'Двойной удар', icon: '⚔️', cost: 1,
    desc: 'Атака ближнего боя бьёт дважды.', apply: p => p.flags.doubleStrike = true },
  { id: 'berserk', branch: 'combat', name: 'Берсерк', icon: '🪓', cost: 1, req: ['double_strike'],
    desc: '+40% урона при HP ниже 40%.', apply: p => p.flags.berserk = true },
  { id: 'bloodrage', branch: 'combat', name: 'Кровавая ярость', icon: '🩸', cost: 2, req: ['berserk'],
    desc: 'Убийства восстанавливают 6% здоровья.', apply: p => p.flags.bloodrage = true },
  { id: 'taunt', branch: 'combat', name: 'Провокация', icon: '📢', cost: 1,
    desc: 'Рывок провоцирует и отталкивает врагов.', apply: p => p.flags.taunt = true },

  // Magic
  { id: 'teleport', branch: 'magic', name: 'Телепорт', icon: '🌀', cost: 1,
    desc: 'Рывок становится мгновенным телепортом.', apply: p => p.flags.teleport = true },
  { id: 'timefreeze', branch: 'magic', name: 'Заморозка времени', icon: '⏱️', cost: 2, req: ['teleport'],
    desc: 'Способность: замедляет всех врагов на 4с.', grant: 'timefreeze' },
  { id: 'meteor', branch: 'magic', name: 'Метеоритный дождь', icon: '☄️', cost: 2, req: ['teleport'],
    desc: 'Способность: метеоры по области у курсора.', grant: 'meteor' },
  { id: 'summon', branch: 'magic', name: 'Призыв духа', icon: '👻', cost: 1,
    desc: 'Призывает второго духа-спутника.', apply: p => p.flags.extraSummon = true },

  // Engineer
  { id: 'turret', branch: 'engineer', name: 'Автотурель', icon: '🔫', cost: 1,
    desc: 'Способность: ставит стреляющую турель.', grant: 'turret' },
  { id: 'drone', branch: 'engineer', name: 'Боевой дрон', icon: '🛸', cost: 1, req: ['turret'],
    desc: 'Постоянный дрон кружит и стреляет.', apply: p => p.flags.drone = true },
  { id: 'guardian', branch: 'engineer', name: 'Робот-защитник', icon: '🤖', cost: 2, req: ['drone'],
    desc: 'Способность: тяжёлый робот-щит на 12с.', grant: 'guardian' },
  { id: 'traps', branch: 'engineer', name: 'Ловушки', icon: '🧨', cost: 1,
    desc: 'Рывок оставляет взрывную мину.', apply: p => p.flags.traps = true },

  // Hybrid (unlock by combined stat investment)
  { id: 'technomancer', branch: 'hybrid', name: 'Техномант', icon: '🌐', cost: 2,
    reqStats: { int: 20, tec: 20 },
    desc: 'Магические турели + энергощит. Открывает лазерные залпы.',
    apply: p => { p.flags.technomancer = true; p.flags.shield = true; } },
  { id: 'spellblade', branch: 'hybrid', name: 'Боевой маг', icon: '🗡️', cost: 2,
    reqStats: { str: 20, int: 20 },
    desc: 'Удары ближнего боя выпускают волну стихии.', apply: p => p.flags.spellblade = true },
  { id: 'paladin', branch: 'hybrid', name: 'Паладин-механик', icon: '✝️', cost: 2,
    reqStats: { str: 20, tec: 20 },
    desc: 'Аура брони: −20% урона себе и спутникам.', apply: p => p.flags.paladin = true },
];

// ---- Ether Cores (dropped by bosses) ----------------------------------------
export const CORES = [
  { id: 'dragon', name: 'Ядро Дракона', glyph: '🐲', color: [255, 120, 40],
    desc: '+25% огненного урона, иммунитет к горению, огненный след.',
    apply: p => { p.coreMods.fire = 0.25; p.flags.burnImmune = true; p.flags.fireTrail = true; } },
  { id: 'glacier', name: 'Ядро Ледника', glyph: '🧊', color: [120, 210, 255],
    desc: '+40 макс. HP, атаки замедляют врагов.',
    apply: p => { p.bonusHP += 40; p.flags.chillHits = true; } },
  { id: 'storm', name: 'Ядро Бури', glyph: '🌩️', color: [255, 240, 120],
    desc: '+20% скорости передвижения и атаки.',
    apply: p => { p.coreMods.haste = 0.2; } },
  { id: 'void', name: 'Ядро Бездны', glyph: '🌑', color: [180, 120, 255],
    desc: 'Убийства дают 8% энергии, +1 заряд рывка.',
    apply: p => { p.flags.voidSiphon = true; p.maxDashCharges += 1; } },
  { id: 'titan', name: 'Ядро Титана', glyph: '🗿', color: [200, 160, 110],
    desc: '+60 макс. HP, −15% получаемого урона.',
    apply: p => { p.bonusHP += 60; p.coreMods.armor = 0.15; } },
];

// ---- Factions ----------------------------------------------------------------
export const FACTIONS = [
  { id: 'order',  name: 'Орден Света',    short: 'Орден',  icon: '⚖️', color: '#ffd86b', love: 'порядок' },
  { id: 'clans',  name: 'Свободные Кланы',short: 'Кланы',  icon: '🗡️', color: '#5bffb0', love: 'свобода' },
  { id: 'machine',name: 'Машинный Союз',  short: 'Союз',   icon: '⚙️', color: '#6ea8ff', love: 'технологии' },
];

// ---- Mutations (from unstable ether) ----------------------------------------
export const MUTATIONS = [
  { id: 'extra_arms', name: 'Дополнительные руки', icon: '🖐️', good: true,
    desc: '+30% скорости атаки.', apply: p => p.mutMods.atkSpeed = 0.3 },
  { id: 'wings', name: 'Эфирные крылья', icon: '🦋', good: true,
    desc: '+25% скорости, дополнительный заряд рывка.',
    apply: p => { p.mutMods.speed = 0.25; p.maxDashCharges += 1; } },
  { id: 'regen', name: 'Ускоренная регенерация', icon: '💚', good: true,
    desc: 'Восстановление 3 HP/с.', apply: p => p.mutMods.regen = 3 },
  { id: 'carapace', name: 'Хитиновый панцирь', icon: '🪲', good: true,
    desc: '−18% получаемого урона.', apply: p => p.mutMods.armor = 0.18 },
  { id: 'unstable', name: 'Нестабильная аура', icon: '☢️', good: true,
    desc: 'Урон по площади вокруг при попадании.', apply: p => p.flags.unstableAura = true },
  // negatives
  { id: 'shaky', name: 'Потеря точности', icon: '😵', good: false,
    desc: '−15% урона дальнего боя.', apply: p => p.mutMods.rangedDmg = -0.15 },
  { id: 'brittle', name: 'Уязвимость к стихиям', icon: '🥀', good: false,
    desc: '+15% получаемого урона.', apply: p => p.mutMods.armor = -0.15 },
  { id: 'heavy', name: 'Тяжёлая поступь', icon: '🐌', good: false,
    desc: '−12% скорости передвижения.', apply: p => p.mutMods.speed = -0.12 },
];

// ---- Granted abilities (talent-granted active skills) ------------------------
export const ABILITIES = {
  timefreeze: { name: 'Стоп-время', icon: '⏱️', cd: 16, en: 35, color: '#aaccff' },
  meteor:     { name: 'Метеор',     icon: '☄️', cd: 9,  en: 28, color: '#ff7a3c' },
  turret:     { name: 'Турель',     icon: '🔫', cd: 12, en: 22, color: '#5bffb0' },
  guardian:   { name: 'Защитник',   icon: '🤖', cd: 22, en: 40, color: '#9ad0ff' },
};

// ---- Enemy archetypes --------------------------------------------------------
export const ENEMY_TYPES = {
  shard:   { name: 'Осколочник', hp: 30,  spd: 70,  dmg: 8,  r: 14, color: '#b07cff', xp: 12, behavior: 'chase' },
  drone:   { name: 'Дрон-страж', hp: 22,  spd: 95,  dmg: 6,  r: 12, color: '#6ea8ff', xp: 14, behavior: 'ranged' },
  brute:   { name: 'Эфирный голем', hp: 80, spd: 45, dmg: 16, r: 22, color: '#ff8b5b', xp: 26, behavior: 'chase' },
  wisp:    { name: 'Блуждающий дух', hp: 16, spd: 130, dmg: 5, r: 10, color: '#5bffb0', xp: 10, behavior: 'orbit' },
};

export const BOSSES = [
  { name: 'Пожиратель Эфира', hp: 520, spd: 55, dmg: 22, r: 42, color: '#ff5b6e', core: 'dragon' },
  { name: 'Ледяной Архонт',   hp: 640, spd: 50, dmg: 24, r: 44, color: '#7ad2ff', core: 'glacier' },
  { name: 'Грозовой Левиафан',hp: 760, spd: 60, dmg: 26, r: 46, color: '#ffe06b', core: 'storm' },
  { name: 'Владыка Бездны',   hp: 900, spd: 58, dmg: 30, r: 48, color: '#b07cff', core: 'void' },
  { name: 'Титан Руин',       hp: 1100,spd: 46, dmg: 34, r: 54, color: '#d2a86b', core: 'titan' },
];

// ---- Rift modifiers (endless endgame) ---------------------------------------
export const RIFT_MODS = [
  { name: 'Взрывная смерть', desc: 'Враги взрываются после гибели.', flag: 'explodeOnDeath' },
  { name: 'Усиленная магия', desc: 'Магия наносит двойной урон.',    flag: 'doubleMagic' },
  { name: 'Запрет лечения',  desc: 'Лечение недоступно.',            flag: 'noHeal' },
  { name: 'Стремительность', desc: 'Враги двигаются на 40% быстрее.',flag: 'fastEnemies' },
  { name: 'Стальная шкура',  desc: 'У врагов +60% здоровья.',        flag: 'tankyEnemies' },
  { name: 'Эфирный шторм',   desc: 'Случайные удары молний с неба.', flag: 'lightningStorm' },
];
