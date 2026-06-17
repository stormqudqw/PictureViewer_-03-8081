// ============================================================================
//  Осколки Эфира — UI layer: HUD, panels, modals, minimap.
//  DOM is touched sparingly; per-frame work is limited to bar widths and
//  cooldown overlays. Panels are rebuilt only when opened.
// ============================================================================
import { STATS, MASTERIES, TALENTS, CORES, FACTIONS, ELEMENTS, ABILITIES } from './data.js';
import { masteryLevel } from './entities.js';
import { clamp } from './engine.js';

const $ = id => document.getElementById(id);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

export const UI = {
  game: null,
  _abilitySig: '',
  mmCtx: null,

  init(game) {
    this.game = game;
    this.mmCtx = $('minimap').getContext('2d');
    this.overlay = $('overlay');
    this.overlay.addEventListener('click', e => { if (e.target === this.overlay) this.close(); });
  },

  // ---- transient toasts -----------------------------------------------------
  toast(title, body, type = '') {
    const stack = $('toast-stack');
    const t = el('div', 'toast ' + type, `<span class="tt">${title}</span>${body ? ' — ' + body : ''}`);
    stack.appendChild(t);
    setTimeout(() => { t.style.animation = 'toastOut .4s ease forwards'; setTimeout(() => t.remove(), 400); }, 3200);
    while (stack.children.length > 5) stack.firstChild.remove();
  },

  // ---- per-frame HUD --------------------------------------------------------
  updateHUD(g) {
    const p = g.player;
    $('hp-fill').style.width = clamp(p.hp / p.maxHP * 100, 0, 100) + '%';
    $('hp-text').textContent = `${Math.ceil(p.hp)} / ${Math.round(p.maxHP)}`;
    $('en-fill').style.width = clamp(p.energy / p.maxEN * 100, 0, 100) + '%';
    $('en-text').textContent = `${Math.ceil(p.energy)} / ${Math.round(p.maxEN)}`;
    $('xp-fill').style.width = clamp(p.xp / p.xpNext * 100, 0, 100) + '%';
    $('xp-text').textContent = `${p.xp} / ${p.xpNext} опыта`;
    $('lvl-num').textContent = p.level;

    // clock
    const sec = Math.floor(g.time), mm = String((sec / 60 | 0)).padStart(2, '0'), ss = String(sec % 60).padStart(2, '0');
    $('clock').textContent = `${g.world.zone.name} · ${mm}:${ss}`;

    // rift
    const ri = $('rift-info');
    if (g.rift.active) { ri.classList.remove('hidden'); ri.textContent = g.rift.label(); }
    else ri.classList.add('hidden');

    // reputation chips
    this._renderRep(g);
    // combo orbs
    this._renderCombo(p);
    // abilities
    this._renderAbilities(g);
  },

  _renderRep(g) {
    const wrap = $('rep-mini');
    if (wrap.children.length !== FACTIONS.length) {
      wrap.innerHTML = '';
      FACTIONS.forEach(f => { const c = el('div', 'rep-chip', `<i style="background:${f.color}"></i><span>${f.icon}</span><b data-rep="${f.id}">0</b>`); wrap.appendChild(c); });
    }
    FACTIONS.forEach(f => { const b = wrap.querySelector(`[data-rep="${f.id}"]`); b.textContent = g.rep.v[f.id]; });
  },

  _renderCombo(p) {
    const wrap = $('combo-display');
    const sig = p.elementQueue.join(',');
    if (wrap.dataset.sig === sig) return;
    wrap.dataset.sig = sig; wrap.innerHTML = '';
    p.elementQueue.forEach(eln => {
      const e = ELEMENTS[eln]; const o = el('div', 'combo-orb', e.icon);
      o.style.color = `rgb(${e.color.join(',')})`; o.style.background = `rgba(${e.color.join(',')},0.2)`;
      wrap.appendChild(o);
    });
  },

  _renderAbilities(g) {
    const p = g.player, wrap = $('abilities');
    const grantKeys = p.abilityKeys();
    const sig = 'm,c,d,' + grantKeys.join(',');
    if (sig !== this._abilitySig) {
      this._abilitySig = sig; wrap.innerHTML = '';
      const slots = [
        { ic: '⚔️', nm: 'Удар', kb: 'ЛКМ', key: '__melee', color: '#ffce6b' },
        { ic: '✨', nm: 'Магия', kb: 'ПКМ', key: '__cast', color: '#b98bff' },
        { ic: '💨', nm: 'Рывок', kb: 'Space', key: '__dash', color: '#7ad2ff' },
      ];
      grantKeys.forEach((k, i) => { const d = ABILITIES[k]; slots.push({ ic: d.icon, nm: d.name, kb: i === 0 ? 'R' : 'R', key: k, color: d.color }); });
      slots.forEach(s => {
        const a = el('div', 'ability ready', `<span class="kb">${s.kb}</span><span class="ic" style="color:${s.color}">${s.ic}</span><span class="nm">${s.nm}</span><i class="cd"></i>`);
        a.dataset.key = s.key; wrap.appendChild(a);
      });
    }
    // update cooldown overlays
    for (const a of wrap.children) {
      const k = a.dataset.key, cd = a.querySelector('.cd');
      let frac = 0;
      if (k === '__dash') frac = p.dashCharges > 0 ? 0 : clamp(p.dashRecharge / 1.6, 0, 1);
      else if (p.abilities[k]) frac = clamp(p.abilities[k].cd / (ABILITIES[k].cd), 0, 1);
      cd.style.transform = `scaleY(${frac})`;
      a.classList.toggle('ready', frac <= 0);
    }
  },

  // ---- minimap --------------------------------------------------------------
  drawMinimap(g) {
    const ctx = this.mmCtx, z = g.world.zone, W = 170, H = 170;
    ctx.clearRect(0, 0, W, H);
    const sc = Math.min(W, H) / (z.radius * 2.3);
    const ox = W / 2 - z.cx * sc, oy = H / 2 - z.cy * sc;
    const tx = x => ox + x * sc, ty = y => oy + y * sc;
    // island
    ctx.fillStyle = '#11203099'; ctx.beginPath(); ctx.arc(tx(z.cx), ty(z.cy), z.radius * sc, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = z.theme.rim + '88'; ctx.lineWidth = 1.5; ctx.stroke();
    // portals
    z.portals.forEach(pt => { ctx.fillStyle = '#b07cff'; ctx.beginPath(); ctx.arc(tx(pt.x), ty(pt.y), 3, 0, Math.PI * 2); ctx.fill(); });
    // ether nodes
    z.etherNodes.forEach(n => { if (!n.used) { ctx.fillStyle = '#5bffb0'; ctx.beginPath(); ctx.arc(tx(n.x), ty(n.y), 2.5, 0, Math.PI * 2); ctx.fill(); } });
    // npc
    if (z.npc) { ctx.fillStyle = '#ffd86b'; ctx.fillRect(tx(z.npc.x) - 2, ty(z.npc.y) - 2, 4, 4); }
    // enemies
    ctx.fillStyle = '#ff5b6e'; for (const e of g.enemies) { ctx.fillRect(tx(e.x) - 1.5, ty(e.y) - 1.5, 3, 3); }
    // boss
    g.enemies.forEach(e => { if (e.isBoss) { ctx.fillStyle = '#ff3b54'; ctx.beginPath(); ctx.arc(tx(e.x), ty(e.y), 4, 0, Math.PI * 2); ctx.fill(); } });
    // player
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(tx(g.player.x), ty(g.player.y), 3, 0, Math.PI * 2); ctx.fill();
  },

  // ---- generic modal --------------------------------------------------------
  panel(html, opts = {}) {
    this.overlay.classList.remove('hidden');
    this.overlay.innerHTML = '';
    const p = el('div', 'panel', html);
    if (!opts.noClose) { const c = el('button', 'close', '✕'); c.onclick = () => this.close(); p.appendChild(c); }
    this.overlay.appendChild(p);
    this.game.paused = true;
    return p;
  },
  close() { this.overlay.classList.add('hidden'); this.overlay.innerHTML = ''; this.game.paused = false; },
  get isOpen() { return !this.overlay.classList.contains('hidden'); }

  ,
  // ---- choice modal (mutations, level rewards, rift) ------------------------
  choice(title, sub, options, onPick, noClose) {
    const p = this.panel(`<h2>${title}</h2><p class="sub">${sub}</p><div class="choice-row"></div>`, { noClose });
    const row = p.querySelector('.choice-row');
    options.forEach(o => {
      const c = el('div', 'choice',
        `<div class="ch-ic">${o.icon || ''}</div><div class="ch-t">${o.title}</div><div class="ch-d">${o.desc}</div>${o.tag ? `<span class="tag ${o.tagType || 'pos'}">${o.tag}</span>` : ''}`);
      c.onclick = () => { this.close(); onPick(o); };
      row.appendChild(c);
    });
  },

  // ---- Character panel ------------------------------------------------------
  openCharacter(g) {
    const p = g.player;
    let stats = '';
    STATS.forEach(s => {
      stats += `<div class="stat-row"><span class="sname">${s.icon} ${s.name}<small>${s.desc}</small></span>
        <span class="sval">${p.stats[s.key]}</span>
        <button class="splus" data-stat="${s.key}" ${p.statPoints <= 0 ? 'disabled' : ''}>+</button></div>`;
    });
    let mast = '';
    for (const k in MASTERIES) {
      const m = MASTERIES[k], lv = masteryLevel(p.masteryXP[k]);
      const into = p.masteryXP[k] - (Math.pow(2, lv) - 1) * 25, need = Math.pow(2, lv) * 25;
      mast += `<div class="mastery"><div class="mtop"><span>${m.icon} ${m.name} <b style="color:#5bffb0">ур.${lv}</b></span><span>${m.desc}</span></div>
        <div class="mbar"><i style="width:${clamp(into / need * 100, 0, 100)}%"></i></div></div>`;
    }
    const drvs = `<div class="stat-row"><span class="sname">❤️ Здоровье</span><span class="sval">${Math.round(p.maxHP)}</span></div>
      <div class="stat-row"><span class="sname">🔵 Энергия</span><span class="sval">${Math.round(p.maxEN)}</span></div>
      <div class="stat-row"><span class="sname">💨 Уклонение</span><span class="sval">${Math.round(p.evasion * 100)}%</span></div>
      <div class="stat-row"><span class="sname">🛡️ Броня</span><span class="sval">${Math.round(p.armor * 100)}%</span></div>`;
    const muts = p.mutations.length ? p.mutations.map(m => `<span class="tag ${m.good ? 'pos' : 'neg'}">${m.icon} ${m.name}</span>`).join(' ') : '<span class="sub">нет</span>';

    const panel = this.panel(`<h2>Персонаж</h2><p class="sub">Уровень ${p.level} · Прокачка «по применению» — навыки растут от использования.</p>
      <div class="points-pill">Очков характеристик: ${p.statPoints}</div>
      <div class="grid2">
        <div><h3 style="margin-bottom:10px">Характеристики</h3>${stats}<h3 style="margin:16px 0 10px">Производные</h3>${drvs}</div>
        <div><h3 style="margin-bottom:10px">Мастерства (по применению)</h3>${mast}
          <h3 style="margin:16px 0 10px">Мутации</h3><div style="line-height:2">${muts}</div></div>
      </div>`);
    panel.querySelectorAll('.splus').forEach(b => b.onclick = () => {
      if (p.statPoints > 0) { p.stats[b.dataset.stat]++; p.statPoints--; p.recompute(); g.checkHybridUnlocks(); this.openCharacter(g); }
    });
  },

  // ---- Talent panel ---------------------------------------------------------
  openTalents(g) {
    const p = g.player;
    const branches = { combat: '⚔️ Боевое', magic: '🔮 Магическое', engineer: '⚙️ Инженерное', hybrid: '🌐 Гибридное' };
    let cols = '';
    for (const br in branches) {
      let nodes = '';
      TALENTS.filter(t => t.branch === br).forEach(t => {
        const owned = p.talents.has(t.id);
        const avail = this._talentAvailable(p, t);
        nodes += `<div class="tnode ${owned ? 'owned' : avail ? '' : 'unavail'}" data-tal="${t.id}">
          <div class="tic">${t.icon}</div><div class="tinfo"><div class="tn">${t.name}</div>
          <div class="td">${t.desc}</div>
          <div class="tcost">${owned ? '✔ Изучено' : (t.reqStats ? this._reqText(t) : 'Стоимость: ' + t.cost + ' оч.')}</div></div></div>`;
      });
      cols += `<div class="tcol"><h3>${branches[br]}</h3>${nodes}</div>`;
    }
    const panel = this.panel(`<h2>Древо талантов</h2><p class="sub">Сочетай ветки, чтобы открыть гибридные классы (напр. Магия 20 + Техника 20 = Техномант).</p>
      <div class="points-pill">Очков талантов: ${p.talentPoints}</div>
      <div class="grid2" style="grid-template-columns:1fr 1fr">${cols}</div>`);
    panel.querySelectorAll('.tnode').forEach(n => n.onclick = () => {
      const t = TALENTS.find(x => x.id === n.dataset.tal);
      if (g.learnTalent(t)) this.openTalents(g);
    });
  },
  _reqText(t) { return 'Требует: ' + Object.entries(t.reqStats).map(([k, v]) => { const s = STATS.find(x => x.key === k); return `${s.name} ${v}`; }).join(', ') + ` · ${t.cost} оч.`; },
  _talentAvailable(p, t) {
    if (p.talentPoints < t.cost) return false;
    if (t.req && !t.req.every(r => p.talents.has(r))) return false;
    if (t.reqStats && !Object.entries(t.reqStats).every(([k, v]) => p.stats[k] >= v)) return false;
    return true;
  },

  // ---- World map / fast travel ---------------------------------------------
  openWorldMap(g) {
    const W = g.world;
    let nodes = '', links = '';
    const N = W.zones.length, cx = 50, cy = 50, R = 36;
    const pos = W.zones.map((z, i) => { const a = -Math.PI / 2 + i / N * Math.PI * 2; return { x: cx + Math.cos(a) * R, y: cy + Math.sin(a) * R }; });
    W.zones.forEach((z, i) => {
      const next = (i + 1) % N, A = pos[i], B = pos[next];
      const len = Math.hypot(B.x - A.x, B.y - A.y), ang = Math.atan2(B.y - A.y, B.x - A.x) * 180 / Math.PI;
      links += `<div class="wm-link" style="left:${A.x}%;top:${A.y}%;width:${len}%;transform:rotate(${ang}deg)"></div>`;
    });
    W.zones.forEach((z, i) => {
      const cur = i === W.current;
      nodes += `<div class="wm-node ${cur ? 'cur' : ''}" data-z="${i}" style="left:${pos[i].x}%;top:${pos[i].y}%">
        <div class="dot" style="color:${z.theme.rim};background:${z.theme.ground2}"></div>
        <div class="wlbl">${z.name}${cur ? ' •' : ''}</div></div>`;
    });
    const panel = this.panel(`<h2>Карта мира · Осколки Эфира</h2><p class="sub">Нажми на остров, чтобы переместиться через портал. Каждый остров принадлежит фракции.</p>
      <div class="wm">${links}${nodes}</div>`);
    panel.querySelectorAll('.wm-node').forEach(n => n.onclick = () => {
      const idx = +n.dataset.z; if (idx !== W.current) { g.travelTo(idx); this.close(); }
    });
  },

  // ---- Cores panel ----------------------------------------------------------
  openCores(g) {
    const p = g.player;
    let cards = '';
    CORES.forEach(c => {
      const owned = p.cores.has(c.id);
      cards += `<div class="core-card ${owned ? 'owned' : ''}"><div class="core-glyph" style="color:rgb(${c.color.join(',')})">${c.glyph}</div>
        <div class="cn">${c.name}</div><div class="cd">${c.desc}</div>
        <div class="lock">${owned ? '✔ Активно' : '🔒 Победи соответствующего босса'}</div></div>`;
    });
    this.panel(`<h2>Эфирные Ядра</h2><p class="sub">Ядра падают с боссов: меняют способности, характеристики и облик персонажа.</p>
      <div class="grid3">${cards}</div>`);
  },

  // ---- How to play ----------------------------------------------------------
  openHowTo() {
    this.panel(`<h2>Как играть</h2><div class="howto">
      <p><b>Цель:</b> исследуй парящие острова, побеждай боссов ради <b>Эфирных Ядер</b> и реши судьбу расколотого мира.</p>
      <p><b>Движение:</b> <span class="kbd">W A S D</span> · <b>Рывок/уклонение:</b> <span class="kbd">Space</span> (качает Ловкость).</p>
      <p><b>Бой:</b> <span class="kbd">ЛКМ</span> — удар (качает Меч), <span class="kbd">ПКМ</span>/<span class="kbd">Q</span> — заклинание, <span class="kbd">E</span> — вторая стихия.</p>
      <p><b>Комбо-магия:</b> нажми две стихии подряд <span class="kbd">1</span><span class="kbd">2</span><span class="kbd">3</span><span class="kbd">4</span> —
        напр. Лёд+Молния = Электрошторм, Огонь+Ветер = Огненный смерч.</p>
      <p><b>Развитие:</b> навыки растут <b>от применения</b>. За уровень — 3 очка характеристик и 1 очко таланта.
        <span class="kbd">C</span> персонаж, <span class="kbd">T</span> таланты, <span class="kbd">M</span> карта, <span class="kbd">F</span> взаимодействие, <span class="kbd">R</span> способность.</p>
      <p><b>Гибриды:</b> вложи Магия 20 + Техника 20 → класс <b>Техномант</b>. Другие сочетания дают Боевого мага и Паладина-механика.</p>
      <p><b>Мутации:</b> у зелёных столбов нестабильного эфира можно мутировать — выбирай, оставить, подавить или развить.</p>
      <p><b>Эндгейм:</b> после 5 боссов открываются <b>Бесконечные Разломы</b> с модификаторами и редкими ядрами.</p>
    </div>`);
  }
};
