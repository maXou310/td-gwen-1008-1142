// simulation.js — standalone node, no rendering. Runs 3 strategies through
// createSim; prints JSON summary to stdout; exit 0 only if winnable && !trivial.
import { createSim } from '../src/sim/engine.js';

const DT = 1 / 60;
const MAX_TICKS = 60 * 400; // ~400s sim time cap

// Strategy A buy schedule: wave -> actions (executed at the start of that
// wave's build phase). 'start' = call startWaveNow immediately after actions.
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
// C = A but the two frost buys replaced by cannon(4,4) and cannon(9,1).
const SCHEDULE_C = {
  1: [['arrow', 1, 2], ['arrow', 3, 3], ['cannon', 4, 4]],
  3: [['arrow', 6, 5], ['cannon', 4, 3]],
  5: [['support', 2, 5], ['cannon', 9, 1]],
  6: [['up', 'arrow', 3, 3]],
  7: [['cannon', 7, 5], ['sniper', 0, 0]],
  9: [['arrow', 9, 4], ['support', 6, 3]],
  11: [['sniper', 12, 0]],
  12: [['up', 'cannon', 4, 3]],
  14: [['up', 'sniper', 0, 0]]
};
const SCHEDULE_B = {
  1: [['arrow', 1, 2], ['arrow', 3, 3]],
  3: [['arrow', 6, 5]],
  5: [['arrow', 9, 4]]
};

function runStrategy(schedule) {
  const sim = createSim({ seed: 1, onEvent: () => {} });
  let nextWaveToAct = 1;
  let ticks = 0;

  function doActions(waveNum) {
    for (const a of (schedule[waveNum] || [])) {
      if (a[0] === 'up') sim.upgradeTower(a[2], a[3]);
      else sim.buyTower(a[0], a[1], a[2]);
    }
  }

  while (sim.state.phase !== 'won' && sim.state.phase !== 'lost' && ticks < MAX_TICKS) {
    if (sim.state.phase === 'build') {
      // Execute this wave's actions, then start now (early-call bonus applies).
      if (sim.state.wave + 1 >= nextWaveToAct) {
        doActions(sim.state.wave + 1);
        nextWaveToAct = Object.keys(schedule).map(Number).find(w => w > sim.state.wave + 1) ?? Infinity;
      }
      sim.startWave();
    }
    sim.tick(DT);
    ticks++;
  }

  return {
    win: sim.state.phase === 'won',
    waveReached: sim.state.wave,
    livesLeft: sim.state.lives,
    goldLeft: sim.state.gold
  };
}

const A = runStrategy(SCHEDULE_A);
const B = runStrategy(SCHEDULE_B);
const C = runStrategy(SCHEDULE_C);

const out = {
  strategies: { A, B, C },
  wave15: { winnable: A.win, trivial: A.win && A.livesLeft === 20 }
};
console.log(JSON.stringify(out, null, 2));
process.exit(out.wave15.winnable && !out.wave15.trivial ? 0 : 1);
