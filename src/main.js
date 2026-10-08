// main.js — boot, rAF loop, state machine, __game/__test/__perf APIs.
import { CONFIG } from './core/config.js';
import { save } from './core/save.js';
import { createSim } from './sim/engine.js';
import { createRenderer } from './render/renderer.js';
import { bindInput } from './ui/input.js';
import { bindHud } from './ui/hud.js';
import { bindMenu } from './ui/menu.js';
import { TOWER_TYPES } from './entities/towers.js';
import { audio } from './audio/audio.js';
import { registerSW } from './pwa/register.js';

const canvas = document.getElementById('game-canvas');
const renderer = createRenderer(canvas);

let saved = save.load();
audio.init(saved);
registerSW();

let sim = createSim({ seed: 1, onEvent: onEvent });
let paused = false;
let selectedType = 'arrow';
let selectedCell = null; // {col,row} of selected tower
let hoverCell = null;    // {col,row} or null
let menuOpen = true;
let bestScore = saved.bestScore || 0;

function score() {
  return sim.state.wave * 1000 + sim.state.lives * 50 + sim.state.gold;
}

function onEvent(ev) {
  switch (ev.type) {
    case 'shoot': audio.play('shoot', ev.towerType); break;
    case 'hit': audio.play('hit'); break;
    case 'explode': audio.play('explode'); break;
    case 'slow': audio.play('slow'); break;
    case 'kill': audio.play('kill'); break;
    case 'leak': audio.play('leak'); break;
    case 'gold': break;
    case 'waveStart': audio.play('wave'); break;
    case 'waveClear':
      persistUnlockedWave(ev.n);
      break;
    case 'win':
      bestScore = Math.max(bestScore, score());
      save.persist({ bestScore });
      audio.play('win');
      break;
    case 'lose':
      bestScore = Math.max(bestScore, score());
      save.persist({ bestScore });
      audio.play('lose');
      break;
    case 'buy': audio.play('buy'); break;
    case 'upgrade': audio.play('upgrade'); break;
    case 'sell': audio.play('sell'); break;
  }
}

function persistUnlockedWave(clearedWave) {
  const cur = save.load().unlockedWave || 1;
  save.persist({ unlockedWave: Math.max(cur, clearedWave) });
}

function newGame() {
  sim = createSim({ seed: 1, onEvent: onEvent });
  paused = false;
  selectedCell = null;
  menuOpen = false;
}

// ---- HUD API -------------------------------------------------------------
let toastFn = () => {};
const hudApi = {
  getSim: () => sim,
  buyAt: (type, c, r) => {
    const res = sim.buyTower(type, c, r);
    if (!res.ok && res.reason === 'gold') toastFn('Not enough gold');
    return res;
  },
  upgradeAt: (c, r) => sim.upgradeTower(c, r),
  sellAt: (c, r) => sim.sellTower(c, r),
  setSpeed: (n) => { sim.state.speed = n; },
  togglePause: () => { paused = !paused; },
  startWaveNow: () => {
    if (menuOpen) return;
    sim.startWave();
  },
  selectAt: (c, r) => { selectedCell = { col: c, row: r }; },
  deselect: () => { selectedCell = null; },
  setSelectedType: (t) => { selectedType = t; },
  getSelected: () => selectedCell,
  getSelectedType: () => selectedType,
  getState: () => ({
    screen: sim.state.phase === 'lost' ? 'gameover' : sim.state.phase === 'won' ? 'victory' : (menuOpen ? 'menu' : 'playing'),
    bestScore,
    score: score(),
    waveLost: sim.state.wave
  }),
  onMenuStart: () => { newGame(); audio.play('click'); },
  onAgain: () => { newGame(); audio.play('click'); }
};

const hud = bindHud(hudApi);
toastFn = hud.showToast;
bindMenu({
  onMenuStart: () => { newGame(); audio.play('click'); },
  onAgain: () => { newGame(); audio.play('click'); }
});
const inputCtl = bindInput(canvas, {
  buyAt: hudApi.buyAt,
  selectAt: hudApi.selectAt,
  deselect: hudApi.deselect,
  getSelected: hudApi.getSelected,
  setSelectedType: (t) => { selectedType = t; },
  getSelectedType: () => selectedType,
  setHover: (cell) => { hoverCell = cell; }
});

// Unlock audio on first gesture.
function firstGesture() {
  audio.unlock();
  if (!save.load().muted) audio.startMusic();
  window.removeEventListener('pointerdown', firstGesture);
  window.removeEventListener('keydown', firstGesture);
}
window.addEventListener('pointerdown', firstGesture);
window.addEventListener('keydown', firstGesture);

// ---- rAF loop ------------------------------------------------------------
window.__perf = { frames: 0 };
let lastT = performance.now();

function frame(now) {
  let dtMs = now - lastT;
  lastT = now;
  dtMs = Math.max(0, Math.min(50, dtMs)); // clamp 0..50ms
  window.__perf.frames++;

  const dt = (dtMs / 1000) * sim.state.speed;
  if (!paused && (sim.state.phase === 'build' || sim.state.phase === 'combat')) {
    sim.tick(dt);
  }

  renderer.drawFrame({
    sim,
    selected: selectedCell,
    hover: hoverCell,
    hoverType: selectedType,
    paused,
    speed: sim.state.speed
  });
  hud.sync();
  requestAnimationFrame(frame);
}

renderer.resize();
window.addEventListener('resize', () => renderer.resize());
requestAnimationFrame(frame);

// ---- public test/game handles --------------------------------------------
window.__game = {
  getHud: () => ({ gold: sim.state.gold, lives: sim.state.lives, wave: sim.state.wave, phase: sim.state.phase }),
  buyAt: (type, c, r) => sim.buyTower(type, c, r),
  upgradeAt: (c, r) => sim.upgradeTower(c, r),
  sellAt: (c, r) => sim.sellTower(c, r),
  setSpeed: (n) => { sim.state.speed = n; },
  togglePause: () => { paused = !paused; },
  startWaveNow: () => { sim.startWave(); },
  selectAt: (c, r) => { selectedCell = { col: c, row: r }; },
  getState: () => sim.state
};

window.__test = {
  fastForward(waveNum, layout) {
    sim.state.gold = 300;
    sim.state.lives = 20;
    sim.state.wave = waveNum - 1;
    sim.state.phase = 'build';
    for (const entry of (layout || [])) {
      const res = sim.buyTower(entry.t, entry.c, entry.r);
      if (res.ok) {
        for (let l = 1; l <= (entry.l || 0); l++) sim.upgradeTower(entry.c, entry.r);
      }
    }
    sim.startWave();
  }
};
