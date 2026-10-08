// ui.test.js — node --test: pure helpers exported from src/ui/hud.js.
import test from 'node:test';
import assert from 'node:assert/strict';
import { TOWER_TYPES } from '../src/entities/towers.js';
import { reasonMsg, dockButtonState, formatPanelStats, sellRefund } from '../src/ui/hud.js';

test('dock has exactly 5 tower types', () => {
  assert.deepEqual(Object.keys(TOWER_TYPES).sort(), ['arrow', 'cannon', 'frost', 'sniper', 'support']);
});

test('dockButtonState affordability', () => {
  assert.deepEqual(dockButtonState(260, 'arrow'), { affordable: true, disabled: false, cost: 70 });
  assert.deepEqual(dockButtonState(69, 'arrow'), { affordable: false, disabled: true, cost: 70 });
  assert.deepEqual(dockButtonState(150, 'sniper'), { affordable: true, disabled: false, cost: 150 });
  assert.deepEqual(dockButtonState(149, 'sniper'), { affordable: false, disabled: true, cost: 150 });
});

test('reasonMsg maps engine reasons to toast strings', () => {
  assert.equal(reasonMsg('gold'), 'Not enough gold');
  assert.equal(reasonMsg('path'), "Can't build there");
  assert.equal(reasonMsg('occupied'), 'Cell occupied');
  assert.equal(reasonMsg('max'), 'Max level');
  assert.equal(reasonMsg('weird'), 'weird'); // fallback passes through
});

test('formatPanelStats combat tower (arrow L2)', () => {
  const s = formatPanelStats({ type: 'arrow', level: 1, invested: 150 });
  assert.match(s, /DMG 22/);
  assert.match(s, /RNG 2\.9/);
  assert.match(s, /RATE 1\.25\/s/);
  assert.doesNotMatch(s, /AURA/);
});

test('formatPanelStats support tower shows AURA + GOLD, no DMG/RATE', () => {
  const s = formatPanelStats({ type: 'support', level: 1, invested: 190 });
  assert.match(s, /AURA \+25%/);
  assert.match(s, /GOLD \+4\/4s/);
  assert.doesNotMatch(s, /DMG/);
  assert.doesNotMatch(s, /RATE/);
});

test('formatPanelStats frost shows slow', () => {
  const s = formatPanelStats({ type: 'frost', level: 0, invested: 100 });
  assert.match(s, /SLOW 35%/);
  assert.match(s, /SPLASH 1\.4/);
});

test('sellRefund = round(0.7 * invested)', () => {
  assert.equal(sellRefund({ invested: 120 }), 84);
  assert.equal(sellRefund({ invested: 200 }), 140);
  assert.equal(sellRefund({}), 0);
});
