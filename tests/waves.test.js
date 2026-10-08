// waves.test.js — static validation of the 15-wave design (node --test).
import test from 'node:test';
import assert from 'node:assert/strict';
import { WAVES } from '../src/entities/waves.js';
import { ENEMY_TYPES } from '../src/entities/enemies.js';

const TOTAL_KILL_GOLD = WAVES.reduce((s, w) => s + w.spawns.reduce((a, g) => a + ENEMY_TYPES[g.t].reward * g.n, 0), 0);
const TOTAL_COUNT = WAVES.reduce((s, w) => s + w.spawns.reduce((a, g) => a + g.n, 0), 0);

test('exactly 15 waves', () => {
  assert.equal(WAVES.length, 15);
});

test('every wave has valid spawn entries and positive clear bonus', () => {
  WAVES.forEach((w, i) => {
    assert.equal(w.name, 'W' + (i + 1));
    assert.ok(Number.isFinite(w.gold) && w.gold > 0, `${w.name}: clear bonus must be > 0`);
    assert.ok(Array.isArray(w.spawns) && w.spawns.length >= 1, `${w.name}: needs spawns`);
    for (const g of w.spawns) {
      assert.ok(ENEMY_TYPES[g.t], `${w.name}: unknown enemy type ${g.t}`);
      assert.ok(Number.isInteger(g.n) && g.n >= 1, `${w.name}: n must be >= 1`);
      assert.ok(Number.isFinite(g.gap) && g.gap > 0, `${w.name}: gap must be > 0`);
      assert.ok(Number.isFinite(g.delay || 0) && (g.delay || 0) >= 0, `${w.name}: delay must be >= 0`);
      if (g.hp !== undefined) assert.ok(g.hp > 0, `${w.name}: hp multiplier must be > 0`);
    }
  });
});

test('W1 is exactly 6 grunts with gold 25', () => {
  const w1 = WAVES[0];
  assert.equal(w1.gold, 25);
  assert.deepEqual(w1.spawns, [{ t: 'grunt', n: 6, gap: 1.0, delay: 0 }]);
});

test('W15 contains a boss with delay >= 20', () => {
  const boss = WAVES[14].spawns.find(g => g.t === 'boss');
  assert.ok(boss, 'W15 must contain a boss');
  assert.ok(boss.delay >= 20, `boss delay must be >= 20, got ${boss.delay}`);
});

test('total kill-gold in [1800, 2600]', () => {
  assert.ok(TOTAL_KILL_GOLD >= 1800 && TOTAL_KILL_GOLD <= 2600, `kill-gold ${TOTAL_KILL_GOLD} out of range`);
});

test('total enemy count in [120, 190]', () => {
  assert.ok(TOTAL_COUNT >= 120 && TOTAL_COUNT <= 190, `enemy count ${TOTAL_COUNT} out of range`);
});
