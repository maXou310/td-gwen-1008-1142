// debug-kill.js — instrumented kill probe.
// Builds one arrow tower + one grunt, ticks in 1/60s steps, logs per second:
// enemies (id/hp/dead), kills, gold, projectiles. Expect exactly ONE kill and
// gold += 8 (grunt reward) once the engine's kill path is correct.
import { createSim } from '../src/sim/engine.js';
import { spawnEnemy } from '../src/entities/enemies.js';

const events = [];
const sim = createSim({ seed: 1, onEvent: (ev) => events.push(ev) });

// Buy one arrow tower at a buildable cell near the path.
const buy = sim.buyTower('arrow', 1, 2);
if (!buy.ok) console.error('buy failed:', buy);

// Spawn ONE grunt manually via the same helper the engine uses.
spawnEnemy(sim, 'grunt');

const DT = 1 / 60;
let t = 0;
let lastLog = -1;
while (t < 30 && sim.state.phase !== 'lost' && sim.state.phase !== 'won') {
  sim.tick(DT);
  t += DT;
  const sec = Math.floor(t);
  if (sec !== lastLog) {
    lastLog = sec;
    const projs = sim.projectiles.actives().length;
    console.log(JSON.stringify({
      t: sec,
      enemies: sim.enemies.map(e => ({ id: e.id, hp: Math.round(e.hp), dead: !!e.dead })),
      kills: sim.state.kills,
      gold: sim.state.gold,
      projs
    }));
  }
}

console.log('--- events ---');
for (const ev of events) console.log(JSON.stringify(ev));
console.log('--- final ---');
console.log(JSON.stringify({
  kills: sim.state.kills,
  gold: sim.state.gold,
  goldDelta: sim.state.gold - 260, // start 260, spent 70 on arrow -> expect +8-70 = -62
  phase: sim.state.phase
}));
