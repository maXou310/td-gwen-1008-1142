// engine.test.js — node --test: gold math, interest cap, path, wave flow, leak, kill.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createSim } from '../src/sim/engine.js';
import { pathLength, pointAt, isBuildable, PATH_CELLS } from '../src/path/path.js';
import { spawnEnemy } from '../src/entities/enemies.js';

function tickTo(sim, t) {
  while (sim.state.time < t) sim.tick(1 / 60);
}

test('pathLength > 0 and pointAt endpoints', () => {
  assert.ok(pathLength > 0);
  const a = pointAt(0), b = pointAt(1);
  assert.ok(a.x < 0); // spawn off-grid left
  assert.ok(b.x > 13 * 48); // exit off-grid right
  assert.equal(PATH_CELLS.size, 26);
});

test('buyTower gold + occupied + path + oob reasons', () => {
  const sim = createSim({});
  assert.equal(sim.state.gold, 260);
  let r = sim.buyTower('arrow', 1, 2);
  assert.deepEqual(r, { ok: true });
  assert.equal(sim.state.gold, 190);
  assert.deepEqual(sim.buyTower('arrow', 1, 2), { ok: false, reason: 'occupied' });
  assert.deepEqual(sim.buyTower('arrow', 0, 4), { ok: false, reason: 'path' });
  assert.deepEqual(sim.buyTower('arrow', -1, 0), { ok: false, reason: 'oob' });
  sim.state.gold = 10;
  assert.deepEqual(sim.buyTower('arrow', 12, 0), { ok: false, reason: 'gold' });
});

test('sell refund = round(0.7 * invested)', () => {
  const sim = createSim({});
  sim.buyTower('cannon', 1, 2); // cost 120
  const r = sim.sellTower(1, 2);
  assert.deepEqual(r, { ok: true, refund: Math.round(0.7 * 120) });
  assert.equal(sim.state.gold, 260 - 120 + 84);
  assert.deepEqual(sim.sellTower(1, 2), { ok: false, reason: 'notfound' });
});

test('upgrade gold math + max level', () => {
  const sim = createSim({});
  sim.buyTower('arrow', 1, 2);
  let r = sim.upgradeTower(1, 2);
  assert.deepEqual(r, { ok: true, cost: 80 });
  assert.equal(sim.state.gold, 260 - 70 - 80);
  sim.upgradeTower(1, 2); // to level 2, cost 150
  assert.deepEqual(sim.upgradeTower(1, 2), { ok: false, reason: 'max' });
  assert.deepEqual(sim.upgradeTower(5, 5), { ok: false, reason: 'notfound' });
});

test('interest capped at INTEREST_CAP on waveClear', () => {
  const sim = createSim({});
  sim.state.gold = 1000;
  sim.startWave();
  // Clear W1 instantly: remove all enemies and force clear check.
  for (let i = 0; i < 6; i++) {}
  // Spawn the wave's grunts then kill them via applyDamage.
  // Simpler: run ticks until all spawned, then damage each enemy to death.
  tickTo(sim, 10);
  while (sim.enemies.some(e => !e.dead && !e.leaked)) {
    const e = sim.enemies.find(e => !e.dead && !e.leaked);
    sim.applyDamage(sim, e, e.hp + e.shield + 100, 0, 0);
  }
  sim.tick(1 / 60);
  assert.equal(sim.state.phase, 'build');
  assert.equal(sim.state.wave, 1);
  // gold was 1000; kills added 6*8=48; bonus = 25 + min(floor(gold*.05),12)
  // After kills gold = 1048; interest = min(52,12)=12; total += 25+12=37
  assert.equal(sim.state.gold, 1048 + 37);
});

test('wave flow: startWave -> combat -> clear -> build with buildT countdown', () => {
  const sim = createSim({});
  assert.equal(sim.state.phase, 'build');
  const r = sim.startWave();
  assert.deepEqual(r, { ok: true });
  assert.equal(sim.state.phase, 'combat');
  assert.equal(sim.state.wave, 1);
  assert.deepEqual(sim.startWave(), { ok: false, reason: 'combat' });
  // Let wave 1 play out with no towers -> leaks reduce lives but phase advances.
  for (let i = 0; i < 60 * 60 && sim.state.phase === 'combat'; i++) sim.tick(1 / 60);
  assert.equal(sim.state.phase, 'build');
  assert.ok(sim.buildT > 0 && sim.buildT <= 20);
});

test('leak reduces lives by enemy dmg', () => {
  const sim = createSim({});
  sim.startWave();
  const before = sim.state.lives;
  for (let i = 0; i < 60 * 60 && sim.state.phase === 'combat'; i++) sim.tick(1 / 60);
  assert.equal(sim.state.lives, before - 6); // 6 grunts x dmg 1
});

test('KILL increments kills and credits reward gold (regression)', () => {
  const sim = createSim({});
  sim.buyTower('arrow', 1, 2);
  const e = spawnEnemy(sim, 'grunt');
  const g0 = sim.state.gold, k0 = sim.state.kills;
  sim.applyDamage(sim, e, 999, 0, 0);
  assert.equal(sim.state.kills, k0 + 1);
  assert.equal(sim.state.gold, g0 + 8); // grunt reward
  assert.equal(e.dead, true);
});

test('shield absorbs damage before hp', () => {
  const sim = createSim({});
  const e = spawnEnemy(sim, 'shield');
  sim.applyDamage(sim, e, 30, 0, 0);
  assert.equal(e.shield, 10);
  assert.equal(e.hp, 90);
  sim.applyDamage(sim, e, 999, 0, 0);
  assert.equal(e.dead, true);
});

test('lost when lives reach 0', () => {
  const sim = createSim({});
  sim.state.lives = 1;
  sim.startWave();
  for (let i = 0; i < 60 * 60 && sim.state.phase === 'combat'; i++) sim.tick(1 / 60);
  assert.equal(sim.state.phase, 'lost');
});
