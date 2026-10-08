// projectiles.js — fixed-pool projectile system (NO allocation in update loop).
import { CONFIG } from '../core/config.js';
const CELL = CONFIG.CELL;

const POOL_SIZE = 96;

export function createProjectiles() {
  const pool = new Array(POOL_SIZE);
  for (let i = 0; i < POOL_SIZE; i++) {
    pool[i] = {
      active: false, type: '', x: 0, y: 0, vx: 0, vy: 0, speed: 0, dmg: 0,
      target: null, lastX: 0, lastY: 0, splash: 0, slow: 0, slowDur: 0, pierce: 0,
      hitSet: null, straight: false, angle: 0
    };
  }
  let cursor = 0;

  // Spawn a projectile (reuses a free slot; returns null when pool exhausted).
  function spawn(type, x, y, target, dmg, speed, opts = {}) {
    for (let i = 0; i < POOL_SIZE; i++) {
      cursor = (cursor + 1) % POOL_SIZE;
      const p = pool[cursor];
      if (!p.active) {
        p.active = true;
        p.type = type;
        p.x = x; p.y = y;
        p.vx = 0; p.vy = 0;
        p.speed = speed;
        p.dmg = dmg;
        p.target = target || null;
        p.lastX = target ? target.x : x;
        p.lastY = target ? target.y : y;
        p.splash = opts.splash || 0;
        p.slow = opts.slow || 0;
        p.slowDur = opts.slowDur || 0;
        p.pierce = opts.pierce || 0;
        p.hitSet = null;
        p.straight = !!target && !!(opts.pierce > 0); // sniper keeps a straight line
        p.angle = Math.atan2(p.lastY - y, p.lastX - x);
        if (p.straight) {
          p.vx = Math.cos(p.angle) * speed;
          p.vy = Math.sin(p.angle) * speed;
        }
        return p;
      }
    }
    return null;
  }

  // Update every tick. Applies damage through sim.applyDamage (single kill path).
  function update(sim, dt) {
    for (let i = 0; i < POOL_SIZE; i++) {
      const p = pool[i];
      if (!p.active) continue;

      // Retarget position each frame while homing.
      if (!p.straight) {
        const t = p.target;
        if (t && !t.dead && !t.leaked) {
          p.lastX = t.x; p.lastY = t.y;
        }
        const dx = p.lastX - p.x, dy = p.lastY - p.y;
        const dist = Math.hypot(dx, dy);
        const step = p.speed * dt;
        if (dist <= step || dist < 0.5) {
          // Arrived at last known position.
          onArrive(sim, p);
          p.active = false;
          continue;
        }
        p.x += (dx / dist) * step;
        p.y += (dy / dist) * step;
      } else {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        // Straight-line pierce: check hits against enemies along the way.
        if (checkPierceHit(sim, p)) {
          p.active = false;
          continue;
        }
        if (p.x < -CELL || p.x > 13 * CELL || p.y < -CELL || p.y > 9 * CELL) {
          p.active = false; // left the world
        }
      }
    }
  }

  function onArrive(sim, p) {
    const x = p.lastX, y = p.lastY;
    if (p.splash > 0) {
      // AoE explosion: full dmg to primary, splash to others (flyers take 25% less from cannon splash).
      const rPx = p.splash * CELL;
      for (const e of sim.enemies) {
        if (e.dead || e.leaked) continue;
        const dx = e.x - x, dy = e.y - y;
        if (dx * dx + dy * dy > rPx * rPx) continue;
        let d = p.dmg;
        if (p.type === 'cannon' && e.type === 'flyer') d *= 0.75;
        sim.applyDamage(sim, e, d, x, y);
      }
      sim.onEvent && sim.onEvent({ type: 'explode', x, y, splash: p.splash, towerType: p.type });
      if (p.slow > 0) applySlow(sim, x, y, p.splash * CELL, p.slow, p.slowDur);
    } else {
      // Single-target hit (homing): damage the carried target if still alive.
      const t = p.target;
      if (t && !t.dead && !t.leaked) {
        sim.applyDamage(sim, t, p.dmg, x, y);
        if (!t.dead) {
          sim.onEvent && sim.onEvent({ type: 'hit', x, y, dmg: p.dmg });
        }
      }
      if (p.slow > 0) applySlow(sim, x, y, p.splash * CELL, p.slow, p.slowDur);
    }
  }

  function checkPierceHit(sim, p) {
    if (!p.hitSet) p.hitSet = new Set();
    const count = 1 + p.pierce;
    for (const e of sim.enemies) {
      if (e.dead || e.leaked || p.hitSet.has(e.id)) continue;
      const def = ENEMY_R[e.type] || 0.3;
      const rPx = def * CELL + 4;
      const dx = e.x - p.x, dy = e.y - p.y;
      if (dx * dx + dy * dy <= rPx * rPx) {
        sim.applyDamage(sim, e, p.dmg, p.x, p.y);
        sim.onEvent && sim.onEvent({ type: 'hit', x: p.x, y: p.y, dmg: p.dmg });
        p.hitSet.add(e.id);
        if (p.hitSet.size >= count) return true;
      }
    }
    return false;
  }

  function applySlow(sim, x, y, rPx, slow, dur) {
    if (slow <= 0) return;
    for (const e of sim.enemies) {
      if (e.dead || e.leaked) continue;
      const dx = e.x - x, dy = e.y - y;
      if (dx * dx + dy * dy > rPx * rPx) continue;
      // Strongest slow wins (max slow -> min factor), timer resets.
      const newFactor = 1 - slow;
      if (newFactor < e.slowFactor || e.slowT <= 0) {
        e.slowFactor = newFactor;
      }
      e.slowT = dur;
    }
    sim.onEvent && sim.onEvent({ type: 'slow', x, y });
  }

  // Read-only view for renderer/debug: list of active projectiles.
  function actives() {
    const out = [];
    for (let i = 0; i < POOL_SIZE; i++) if (pool[i].active) out.push(pool[i]);
    return out;
  }

  return { spawn, update, actives, size: POOL_SIZE };
}

// Sprite radii (cells) for pierce collision; mirror of ENEMY_TYPES.r.
const ENEMY_R = { grunt: 0.28, runner: 0.24, tank: 0.38, flyer: 0.26, shield: 0.32, boss: 0.6 };
