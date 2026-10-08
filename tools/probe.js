// probe.js — per-wave leak/kill/gold trace for strategy A (tuning aid).
import { createSim } from '../src/sim/engine.js';

const SCHEDULE_A = {
  1: [['arrow', 1, 2], ['arrow', 3, 3], ['frost', 5, 1]],
  3: [['arrow', 6, 5], ['cannon', 4, 3]],
  5: [['support', 2, 5], ['frost', 9, 3]],
  6: [['up', 'arrow', 3, 3]],
  7: [['cannon', 7, 5], ['sniper', 0, 0]],
  9: [['arrow', 9, 4], ['support', 6, 3], ['up', 'frost', 5, 1]],
  11: [['sniper', 12, 0]],
  12: [['up', 'cannon', 4, 3]],
  14: [['up', 'sniper', 0, 0]]
};

const DT = 1 / 60;
const MAX_TICKS = 60 * 400;
const sim = createSim({ seed: 1, onEvent: () => {} });
let nextWaveToAct = 1;
let ticks = 0;
const leaksByWave = {};
let lastClear = null;

sim.onEvent = (ev) => {
  if (ev.type === 'leak') leaksByWave[sim.state.wave] = (leaksByWave[sim.state.wave] || 0) + ev.dmg;
  if (ev.type === 'waveClear') lastClear = { wave: ev.n, bonus: ev.bonus };
};

while (sim.state.phase !== 'won' && sim.state.phase !== 'lost' && ticks < MAX_TICKS) {
  if (sim.state.phase === 'build') {
    if (sim.state.wave + 1 >= nextWaveToAct) {
      for (const a of (SCHEDULE_A[sim.state.wave + 1] || [])) {
        if (a[0] === 'up') sim.upgradeTower(a[2], a[3]);
        else sim.buyTower(a[0], a[1], a[2]);
      }
      nextWaveToAct = Object.keys(SCHEDULE_A).map(Number).find(w => w > sim.state.wave + 1) ?? Infinity;
    }
    sim.startWave();
  }
  sim.tick(DT);
  ticks++;
}

console.log(JSON.stringify({
  final: { phase: sim.state.phase, lives: sim.state.lives, gold: sim.state.gold, kills: sim.state.kills },
  leaksByWave,
  lastClear
}, null, 1));
