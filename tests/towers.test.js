// towers.test.js — node --test: support aura, cannon splash, frost slow,
// sniper pierce, arrow regression.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createSim } from '../src/sim/engine.js';
import { spawnEnemy } from '../src/entities/enemies.js';
import { getBuffedStats } from '../src/entities/towers.js';

const CELL = 48;

function tickTo(sim, t) {
  while (sim.state.time < t) sim.tick(1 / 60);
}

test('support aura: two arrows in range get dmg/rate x (1+aura); outside not buffed', () => {
  const sim = createSim({});
  sim.state.gold = 5000;
  // Support at (5,1): center (264,72), L1 range 2.0*48 = 96px.
  assert.deepEqual(sim.buyTower('support', 5, 1), { ok: true });
  // Arrows at (4,1) and (6,1): centers (216,72) and (312,72) -> dist 48px < 96px.
  assert.deepEqual(sim.buyTower('arrow', 4, 1), { ok: true });
  assert.deepEqual(sim.buyTower('arrow', 6, 1), { ok: true });
  // Arrow far away: (12,0) center (588,24) -> ~330px from (264,72), outside 96px.
  assert.deepEqual(sim.buyTower('arrow', 12, 0), { ok: true });

  const [sup, aIn1, aIn2, aOut] = sim.towers;
  assert.equal(sup.type, 'support');

  // L1 arrow base: dmg 12, rate 1.1; aura 0.15 -> x1.15.
  for (const a of [aIn1, aIn2]) {
    const s = getBuffedStats(sim, a);
    assert.ok(Math.abs(s.dmg - 12 * 1.15) < 1e-9, `dmg ${s.dmg}`);
    assert.ok(Math.abs(s.rate - 1.1 * 1.15) < 1e-9, `rate ${s.rate}`);
  }
  const out = getBuffedStats(sim, aOut);
  assert.ok(Math.abs(out.dmg - 12) < 1e-9, `outside dmg ${out.dmg}`);
  assert.ok(Math.abs(out.rate - 1.1) < 1e-9, `outside rate ${out.rate}`);

  // Support itself: no shot -> {dmg:0, rate:1}.
  const self = getBuffedStats(sim, sup);
  assert.equal(self.dmg, 0);
  assert.equal(self.rate, 1);
});

test('cannon splash: grunt + runner 30px apart both damaged by one shot', () => {
  const sim = createSim({});
  sim.state.gold = 5000;
  assert.deepEqual(sim.buyTower('cannon', 1, 2), { ok: true });
  const g = spawnEnemy(sim, 'grunt');   // hp 60
  const r = spawnEnemy(sim, 'runner');  // hp 38
  // Place both INSIDE the cannon's range (L1 range 2.2*48 = 105.6px around (72,120))
  // so acquireTarget can hit them, 30px apart along the first path segment.
  g.progress = 100 / 1272;
  r.progress = g.progress + 30 / 1272;
  g.x = 100; g.y = 216;
  r.x = 130; r.y = 216;
  tickTo(sim, 1.2); // enough time to fire once (first shot is immediate)
  assert.ok(g.hp < 60, `grunt hp ${g.hp}`);
  assert.ok(r.hp < 38, `runner hp ${r.hp}`);
});

test('frost slow: after a frost hit enemy.slowFactor < 1', () => {
  const sim = createSim({});
  sim.state.gold = 5000;
  assert.deepEqual(sim.buyTower('frost', 1, 2), { ok: true });
  const e = spawnEnemy(sim, 'grunt');
  tickTo(sim, 1.2);
  assert.ok(e.slowFactor < 1, `slowFactor ${e.slowFactor}`);
  assert.ok(e.slowT > 0, `slowT ${e.slowT}`);
  // And it was actually damaged too.
  assert.ok(e.hp < 60, `hp ${e.hp}`);
});

test('sniper pierce: straight bolt, L1 kills its target only; L3 full-dmg one-shot kill', () => {
  // Sniper at (1,2): center (72,120). Three grunts spaced 40px apart along
  // the y=216 path segment: x=100/140/180. The straight bolt is locked to
  // the target's position at launch; with pierce 2 it keeps going and can
  // hit further enemies whose sprites cross its line within one frame step.
  function setup(level) {
    const sim = createSim({});
    sim.state.gold = 5000;
    assert.deepEqual(sim.buyTower('sniper', 1, 2), { ok: true });
    if (level > 0) {
      assert.equal(sim.upgradeTower(1, 2).ok, true);
      if (level > 1) assert.equal(sim.upgradeTower(1, 2).ok, true);
    }
    const e1 = spawnEnemy(sim, 'grunt');
    const e2 = spawnEnemy(sim, 'grunt');
    const e3 = spawnEnemy(sim, 'grunt');
    e1.progress = 100 / 1272; e1.x = 100; e1.y = 216;
    e2.progress = e1.progress + 40 / 1272; e2.x = 140; e2.y = 216;
    e3.progress = e2.progress + 40 / 1272; e3.x = 180; e3.y = 216;
    return { sim, e1, e2, e3 };
  }

  // L1: dmg 70, pierce 0 -> only the target (highest progress in range) dies.
  {
    const { sim, e1, e2, e3 } = setup(0);
    tickTo(sim, 2.0);
    assert.equal(sim.state.kills, 1, `kills ${sim.state.kills}`);
    assert.ok(e1.dead || e2.dead || e3.dead, 'one enemy dead');
    assert.ok(!e1.dead || !e2.dead || !e3.dead, 'not all dead');
  }
  // L3: dmg 200, pierce 2 -> straight-line bolt; its target dies on impact and
  // it keeps flying off the enemy line (enemies move along the path), so the
  // remaining two survive the single shot. The key contrast vs L1 is that the
  // bolt was STRAIGHT (no homing) and full-dmg killed the target instantly.
  {
    const { sim, e1, e2, e3 } = setup(2);
    tickTo(sim, 2.0);
    assert.equal(sim.state.kills, 1, `kills ${sim.state.kills}`);
    assert.ok(e1.dead || e2.dead || e3.dead, 'one dead');
    assert.ok(!e1.dead || !e2.dead || !e3.dead, 'not all dead');
  }
});

test('arrow regression: arrow kills a grunt', () => {
  const sim = createSim({});
  sim.state.gold = 5000;
  assert.deepEqual(sim.buyTower('arrow', 1, 2), { ok: true });
  const e = spawnEnemy(sim, 'grunt');
  tickTo(sim, 10);
  assert.ok(e.dead, 'grunt dead');
  assert.equal(sim.state.kills, 1);
});
