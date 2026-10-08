// towers.js — tower data + targeting/fire. Arrow fully working; other 4 types
// are data-only with a stub fireTower (towers job fills them in).
import { CELL } from '../core/config.js';

export const TOWER_TYPES = {
  arrow:   { name: 'Arrow',   cost: 70,  levels: [
    { dmg: 12, range: 2.6, rate: 1.1, proj: 380 },
    { dmg: 22, range: 2.9, rate: 1.25, proj: 400, cost: 80 },
    { dmg: 40, range: 3.2, rate: 1.5,  proj: 430, cost: 150 } ] },
  cannon:  { name: 'Cannon',  cost: 120, levels: [
    { dmg: 26, range: 2.2, rate: 0.55, proj: 300, splash: 1.1 },
    { dmg: 44, range: 2.4, rate: 0.6,  proj: 320, splash: 1.3, cost: 130 },
    { dmg: 75, range: 2.6, rate: 0.7,  proj: 340, splash: 1.6, cost: 240 } ] },
  frost:   { name: 'Frost',   cost: 100, levels: [
    { dmg: 8,  range: 2.4, rate: 0.9,  proj: 340, splash: 1.4, slow: 0.35, slowDur: 1.2 },
    { dmg: 14, range: 2.6, rate: 1.0,  proj: 360, splash: 1.6, slow: 0.45, slowDur: 1.5, cost: 110 },
    { dmg: 24, range: 2.8, rate: 1.1,  proj: 380, splash: 1.8, slow: 0.55, slowDur: 1.8, cost: 200 } ] },
  support: { name: 'Support', cost: 90,  levels: [
    { aura: 0.15, goldTick: 2, goldEvery: 4, range: 2.0 },
    { aura: 0.25, goldTick: 4, goldEvery: 4, range: 2.4, cost: 100 },
    { aura: 0.4,  goldTick: 8, goldEvery: 3, range: 2.8, cost: 180 } ] },
  sniper:  { name: 'Sniper',  cost: 150, levels: [
    { dmg: 70,  range: 5.5, rate: 0.32, proj: 700, pierce: 0 },
    { dmg: 120, range: 6.0, rate: 0.36, proj: 750, pierce: 1, cost: 160 },
    { dmg: 200, range: 6.5, rate: 0.42, proj: 800, pierce: 2, cost: 300 } ] }
};

// Enemy with highest path progress within range of the tower.
export function acquireTarget(sim, tower) {
  const def = TOWER_TYPES[tower.type];
  const lvl = def.levels[tower.level];
  const rangePx = lvl.range * CELL;
  let best = null;
  for (const e of sim.enemies) {
    if (e.dead || e.leaked) continue;
    const dx = e.x - tower.x, dy = e.y - tower.y;
    if (dx * dx + dy * dy > rangePx * rangePx) continue;
    if (!best || e.progress > best.progress) best = e;
  }
  return best;
}

// Support has no projectiles: its gold tick happens here (cd used as timer).
// Returns true when something was "fired" (support: granted gold).
export function fireTower(sim, tower) {
  const def = TOWER_TYPES[tower.type];
  const lvl = def.levels[tower.level];

  if (tower.type === 'support') {
    sim.state.gold += lvl.goldTick;
    sim.onEvent && sim.onEvent({ type: 'gold', x: tower.x, y: tower.y, amount: lvl.goldTick });
    return true;
  }

  // Projectile-based towers (arrow working; others share the same spawn path).
  const target = acquireTarget(sim, tower);
  if (!target) return false;

  const stats = getBuffedStats(sim, tower);
  const p = sim.projectiles.spawn(tower.type, tower.x, tower.y, target, stats.dmg, lvl.proj, {
    splash: lvl.splash, slow: lvl.slow, slowDur: lvl.slowDur, pierce: lvl.pierce
  });
  if (!p) return false; // pool exhausted
  sim.onEvent && sim.onEvent({ type: 'shoot', towerType: tower.type, x: tower.x, y: tower.y });
  return true;
}

// Stats at fire time, including support-aura buffs (+aura to dmg and rate).
export function getBuffedStats(sim, tower) {
  const def = TOWER_TYPES[tower.type];
  const lvl = def.levels[tower.level];
  let dmg = lvl.dmg ?? 0;
  let rate = lvl.rate ?? 0;
  for (const s of sim.towers) {
    if (s === tower || s.type !== 'support' || s.dead) continue;
    const sLvl = TOWER_TYPES.support.levels[s.level];
    const dx = s.x - tower.x, dy = s.y - tower.y;
    const r = sLvl.range * CELL;
    if (dx * dx + dy * dy <= r * r) {
      dmg *= (1 + sLvl.aura);
      rate *= (1 + sLvl.aura);
    }
  }
  return { dmg, rate };
}
