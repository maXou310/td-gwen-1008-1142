// enemies.js — enemy data + spawn helper + movement.
import { CONFIG } from '../core/config.js';
const CELL = CONFIG.CELL;
import { pathLength, pointAt } from '../path/path.js';

export const ENEMY_TYPES = {
  grunt:   { hp: 60,   speed: 1.1, reward: 8,   dmg: 1,  r: 0.28 },
  runner:  { hp: 38,   speed: 2.0, reward: 10,  dmg: 1,  r: 0.24 },
  tank:    { hp: 240,  speed: 0.7, reward: 22,  dmg: 2,  r: 0.38 },
  flyer:   { hp: 50,   speed: 1.4, reward: 12,  dmg: 1,  r: 0.26, flying: true },
  shield:  { hp: 90,   speed: 0.9, reward: 16,  dmg: 1,  r: 0.32, shield: 40 },
  boss:    { hp: 2600, speed: 0.5, reward: 250, dmg: 10, r: 0.6 }
};

let nextId = 1;

// Push a full enemy onto sim.enemies at the path start; returns it.
export function spawnEnemy(sim, typeKey, hpMul = 1) {
  const def = ENEMY_TYPES[typeKey];
  if (!def) throw new Error(`unknown enemy type: ${typeKey}`);
  const p = pointAt(0);
  const e = {
    id: nextId++,
    type: typeKey,
    hp: Math.round(def.hp * hpMul),
    maxHp: Math.round(def.hp * hpMul),
    shield: def.shield ? def.shield : 0,
    x: p.x,
    y: p.y,
    progress: 0,      // 0..1 of path
    slowT: 0,         // remaining slow seconds
    slowFactor: 1,    // 1 = no slow; strongest slow wins (max slow -> min factor)
    dead: false,
    leaked: false
  };
  sim.enemies.push(e);
  return e;
}

// Advance every living enemy along the path. Returns list of {enemy, x, y, dmg} for leaks.
export function moveEnemies(sim, dt) {
  const leaks = [];
  for (const e of sim.enemies) {
    if (e.dead || e.leaked) continue;
    let speed = ENEMY_TYPES[e.type].speed; // cells/s
    if (e.slowT > 0) {
      speed *= e.slowFactor;
      e.slowT -= dt;
      if (e.slowT < 0) { e.slowT = 0; e.slowFactor = 1; }
    }
    e.progress += (speed * dt) / (pathLength / CELL); // px moved / pathLength(px)
    if (e.progress >= 1) {
      e.progress = 1;
      e.leaked = true;
      const end = pointAt(1);
      e.x = end.x; e.y = end.y;
      leaks.push({ enemy: e, x: end.x, y: end.y, dmg: ENEMY_TYPES[e.type].dmg });
    } else {
      const p = pointAt(e.progress);
      e.x = p.x; e.y = p.y;
    }
  }
  return leaks;
}
