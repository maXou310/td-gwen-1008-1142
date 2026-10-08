// towers-debug.mjs — one-shot debug probe for the towers job:
// builds every tower type, fires each once at a spawned grunt, and prints
// resulting events / hp / kills. Run with: node tools/towers-debug.mjs
import { createSim } from '../src/sim/engine.js';
import { spawnEnemy } from '../src/entities/enemies.js';

for (const type of ['arrow', 'cannon', 'frost', 'support', 'sniper']) {
  const sim = createSim({ seed: 1 });
  sim.state.gold = 5000;
  const evs = [];
  sim.onEvent = ev => evs.push(ev.type);
  sim.buyTower(type, 1, 2);
  const e = spawnEnemy(sim, 'grunt');
  e.progress = 100 / 1272; e.x = 100; e.y = 216; // inside all ranges
  for (let i = 0; i < 180; i++) sim.tick(1 / 60);
  console.log(JSON.stringify({
    type,
    hp: e.hp, dead: e.dead, slowFactor: e.slowFactor,
    kills: sim.state.kills, goldDelta: sim.state.gold - 5000 + (type === 'support' ? 90 : 0),
    events: evs.filter(t => t !== 'buy')
  }));
}
