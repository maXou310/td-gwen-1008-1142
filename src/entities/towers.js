// towers.js — tower data + targeting/fire for all 5 types.
import { CONFIG } from '../core/config.js';
const CELL = CONFIG.CELL;

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
// Range is in PX (level.range * CELL); Euclidean distance to enemy x/y.
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

// Fire one shot / tick. Returns true when something was "fired"
// (projectile spawned, or support granted its gold tick).
export function fireTower(sim, tower) {
  const def = TOWER_TYPES[tower.type];
  const lvl = def.levels[tower.level];

  // Support has no projectile: grant goldTick every goldEvery s (cd set by engine).
  if (tower.type === 'support') {
    sim.state.gold += lvl.goldTick;
    sim.state.goldEarned += lvl.goldTick;
    sim.onEvent && sim.onEvent({ type: 'gold', x: tower.x, y: tower.y, amount: lvl.goldTick });
    return true;
  }

  const target = acquireTarget(sim, tower);
  if (!target) return false;

  const stats = getBuffedStats(sim, tower);
  const p = sim.projectiles.spawn(tower.type, tower.x, tower.y, target, stats.dmg, lvl.proj, {
    splash: lvl.splash, slow: lvl.slow, slowDur: lvl.slowDur, pierce: lvl.pierce
  });
  if (!p) return false; // pool exhausted

  // Impact particles are fired here (the pool system does not know particle colors).
  if (tower.type === 'cannon') {
    // AoE impact at the target's current position (homing arrival point).
    sim.particles.burst(target.x, target.y, '#ffb14d', 10, 120, 0.4);
    sim.particles.ring(target.x, target.y, '#ff7b3d', lvl.splash * CELL * 0.5, 0.35);
  } else if (tower.type === 'frost') {
    sim.particles.ring(target.x, target.y, '#7be3ff', lvl.splash * CELL * 0.5, 0.45);
    sim.particles.spark(target.x, target.y, '#bff4ff', 5);
  }

  sim.onEvent && sim.onEvent({ type: 'shoot', towerType: tower.type, x: tower.x, y: tower.y });
  return true;
}

// Stats at fire time, including support-aura buffs.
// dmg/rate = level value multiplied by the product of (1+aura) from EVERY
// support tower whose (level.range*CELL) px covers this tower's (x,y).
// Support itself returns {dmg:0, rate:1} (no shot) but still casts its aura.
export function getBuffedStats(sim, tower) {
  const def = TOWER_TYPES[tower.type];
  const lvl = def.levels[tower.level];
  let dmg = tower.type === 'support' ? 0 : (lvl.dmg ?? 1);
  let rate = tower.type === 'support' ? 1 : (lvl.rate ?? 1);
  for (const s of sim.towers) {
    if (s === tower || s.type !== 'support' || s.dead) continue;
    const sLvl = TOWER_TYPES.support.levels[s.level];
    const r = sLvl.range * CELL;
    const dx = s.x - tower.x, dy = s.y - tower.y;
    if (dx * dx + dy * dy <= r * r) {
      dmg *= (1 + sLvl.aura);
      rate *= (1 + sLvl.aura);
    }
  }
  return { dmg, rate };
}
