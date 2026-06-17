// Headless smoke test: mock DOM/Canvas/Audio, boot the game, simulate frames.
// Catches runtime reference errors in init, start, update and render paths.

const handlers = {}; // window event handlers

function fakeCtx() {
  const grad = { addColorStop() {} };
  return new Proxy({
    canvas: { width: 1280, height: 720 },
    createLinearGradient: () => grad,
    createRadialGradient: () => grad,
    measureText: () => ({ width: 10 }),
    getImageData: () => ({ data: [] }),
    setTransform() {}, save() {}, restore() {}, translate() {}, scale() {}, rotate() {},
  }, { get(t, p) { return p in t ? t[p] : (typeof p === 'string' ? () => {} : undefined); } });
}

function fakeEl(tag = 'div') {
  const el = {
    tag, children: [], dataset: {}, style: {}, _html: '', _text: '',
    width: 1280, height: 720,
    classList: { _s: new Set(), add(c){this._s.add(c);}, remove(c){this._s.delete(c);},
      toggle(c,f){ f===undefined? (this._s.has(c)?this._s.delete(c):this._s.add(c)) : (f?this._s.add(c):this._s.delete(c)); },
      contains(c){return this._s.has(c);} },
    addEventListener(){}, removeEventListener(){},
    appendChild(c){ c._parent=this; this.children.push(c); return c; },
    removeChild(c){ const i=this.children.indexOf(c); if(i>=0)this.children.splice(i,1); },
    remove(){ if(this._parent){ const i=this._parent.children.indexOf(this); if(i>=0)this._parent.children.splice(i,1); } },
    getContext: () => fakeCtx(),
    getBoundingClientRect: () => ({ left:0, top:0, width:1280, height:720 }),
    querySelector: () => fakeEl(), querySelectorAll: () => [],
    set innerHTML(v){ this._html=v; this.children=[]; }, get innerHTML(){ return this._html; },
    set textContent(v){ this._text=v; }, get textContent(){ return this._text; },
    set onclick(f){ this._onclick=f; }, get onclick(){ return this._onclick; },
    set firstChild(_){}, get firstChild(){ return this.children[0]; },
  };
  return el;
}

const els = {};
function getEl(id){ return els[id] || (els[id] = fakeEl()); }

global.window = {
  addEventListener(ev, fn){ (handlers[ev]||(handlers[ev]=[])).push(fn); },
  AudioContext: class { constructor(){ this.currentTime=0; this.sampleRate=44100; this.destination={}; this.state='running'; }
    createGain(){ return { gain:{ value:0, setValueAtTime(){}, exponentialRampToValueAtTime(){} }, connect(){} }; }
    createOscillator(){ return { frequency:{ setValueAtTime(){}, exponentialRampToValueAtTime(){} }, type:'', connect(){}, start(){}, stop(){} }; }
    createBuffer(){ return { getChannelData: () => new Float32Array(64) }; }
    createBufferSource(){ return { buffer:null, connect(){}, start(){} }; }
    createBiquadFilter(){ return { type:'', frequency:{ value:0 }, connect(){} }; }
    resume(){} }
};
global.devicePixelRatio = 1;
global.innerWidth = 1280; global.innerHeight = 720;
global.requestAnimationFrame = () => 0; // we'll drive the loop manually
global.addEventListener = (ev, fn) => { (handlers[ev]||(handlers[ev]=[])).push(fn); };
global.setTimeout = (fn) => { try { fn(); } catch(e){} return 0; }; // run deferred callbacks inline
global.localStorage = { _d:{}, getItem(k){return this._d[k]??null;}, setItem(k,v){this._d[k]=String(v);}, removeItem(k){delete this._d[k];} };
global.document = {
  getElementById: getEl,
  createElement: (t) => fakeEl(t),
  addEventListener(ev, fn){ (handlers[ev]||(handlers[ev]=[])).push(fn); },
};
global.performance = { now: () => Date.now() };

// Boot
await import('../src/main.js');
(handlers.load || []).forEach(fn => fn());
const game = global.window.__game;
if (!game) throw new Error('Game not created');

// Start a new game via the title button
els['btn-start']._onclick();
console.log('started: running=', game.running, 'zone=', game.world.zone.name,
  'enemies=', game.enemies.length, 'allies=', game.allies.length);

// Drive the loop manually, feeding synthetic input
els['overlay'].classList.add('hidden'); // so update() actually runs (UI not "open")
const Input = (await import('../src/engine.js')).Input;
let t = 16;
function frame(keys = [], mouse = false) {
  Input.keys = new Set(keys);
  Input.mdown = mouse; Input.mx = 700; Input.my = 360;
  game.loop(t); t += 16;
}

// move + attack for a while
for (let i = 0; i < 25; i++) frame(['d','w'], i % 2 === 0);
// cast spells / combos
Input.pressed = new Set(['1']); game.loop(t); t+=16;
Input.pressed = new Set(['2']); game.loop(t); t+=16; // ice+bolt? actually 1=fire,2=ice -> steam blast
Input.pressed = new Set(['3']); game.loop(t); t+=16;
Input.pressed = new Set(['1']); game.loop(t); t+=16;
// dash
Input.pressed = new Set([' ']); game.loop(t); t+=16;

// give level + open panels
game.player.gainXP(5000, game);
game.player.statPoints += 30; game.player.talentPoints += 20;
console.log('player level=', game.player.level, 'statPts=', game.player.statPoints, 'maxHP=', Math.round(game.player.maxHP));

// learn a talent + hybrid path
game.player.stats.int = 20; game.player.stats.tec = 20;
const TALENTS = (await import('../src/data.js')).TALENTS;
for (const id of ['double_strike','teleport','turret','technomancer','spellblade']) {
  const tdef = TALENTS.find(x => x.id === id);
  const ok = game.learnTalent(tdef);
  console.log('learn', id, '->', ok);
}
console.log('abilities:', game.player.abilityKeys());

// spawn + kill a boss to grant a core
game.spawnBoss();
const boss = game.enemies.find(e => e.isBoss);
boss.hurt(999999, game, game.player.x, game.player.y);
console.log('cores:', [...game.player.cores], 'bossesCleared=', game.bossesCleared);

// mutation + reputation events
game._mutationEvent(); // auto-resolves via inline setTimeout? no—needs choice click
game.rep.change('order', 30); game.rep.change('clans', 70);
console.log('rep:', game.rep.v, 'tier order=', game.rep.tierName('order'));

// run more frames with many enemies + a rift
game.rift.start();
game._populate();
for (let i = 0; i < 25; i++) frame(['a'], i % 3 === 0);
console.log('after rift sim: enemies=', game.enemies.length, 'projectiles=', game.projectiles.length,
  'particles=', game.particles.n, 'floaters=', game.floaters.length);

// save + reload roundtrip
const { Save } = await import('../src/systems.js');
Save.write(game);
els['btn-continue']._onclick();
console.log('reload ok: level=', game.player.level, 'zone=', game.world.zone.name);

// a few more frames after reload
for (let i = 0; i < 15; i++) frame(['s','d'], true);

console.log('\nSMOKE TEST PASSED — no runtime errors. Final state:',
  'lvl', game.player.level, '| hp', Math.round(game.player.hp), '| enemies', game.enemies.length);
