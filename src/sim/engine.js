// engine.js — the simulation core. buy/upgrade/sell/startWave/tick, wave flow,
// damage+shield, slow stacking, support gold ticks, all events, projectile +
// particle updates. Damage application lives in ONE function: applyDamage.
import { CONFIG } from '../core/config.js';
import { isBuildable, cellCenter, PATH_CELLS } from '../path/path.js';
import { TOWER_TYPES, fireTower, getBuffedStats } from '../entities/towers.js';
import { ENEMY_TYPES, spawnEnemy, moveEnemies } from '../entities/enemies.js';
import { WAVES } from '../entities/waves.js';
import { createProjectiles } from '../entities/projectiles.js';
import { createParticles } from '../entities/particles.js';

let towerId = 1;

export function createSim({ seed = 1, onEvent } = {}) {
  const sim = {
    state: {
      gold: CONFIG.START_GOLD,
      lives: CONFIG.START_LIVES,
      wave: 0,
      phase: 'build',
      time: 0,
      speed: 1,
      kills: 0,
      goldEarned: 0
    },
    towers: [],
    enemies: [],
    projectiles: null, // filled below (read-only view for consumers)
    particles: null,   // filled below
    buildT: 0,         // remaining build-phase seconds during combat->build
    _spawnQueue: [],   // pending spawns for current wave
    _waveTime: 0,
    onEvent: onEvent || null,
    seed
  };
  sim.projectiles = createProjectiles();
  sim.particles = createParticles();

  function emit(ev) { if (sim.onEvent) sim.onEvent(ev); }

  function towerAt(col, row) {
    return sim.towers.find(t => t.col === col && t.row === row && !t.dead) || null;
  }

  sim.buyTower = function (type, col, row) {
    const def = TOWER_TYPES[type];
    if (!def) return { ok: false, reason: 'oob' };
    if (!isBuildable(col, row)) {
      return { ok: false, reason: PATH_CELLS_TEST(col, row) ? 'path' : 'oob' };
    }
    if (towerAt(col, row)) return { ok: false, reason: 'occupied' };
    if (sim.state.gold < def.cost) return { ok: false, reason: 'gold' };
    sim.state.gold -= def.cost;
    const c = cellCenter(col, row);
    const t = { id: towerId++, type, level: 0, col, row, x: c.x, y: c.y, cd: 0, invested: def.cost };
    sim.towers.push(t);
    emit({ type: 'buy', col, row, towerType: type });
    return { ok: true };
  };

  sim.upgradeTower = function (col, row) {
    const t = towerAt(col, row);
    if (!t) return { ok: false, reason: 'notfound' };
    const def = TOWER_TYPES[t.type];
    if (t.level >= def.levels.length - 1) return { ok: false, reason: 'max' };
    const cost = def.levels[t.level + 1].cost;
    if (sim.state.gold < cost) return { ok: false, reason: 'gold' };
    sim.state.gold -= cost;
    t.invested += cost;
    t.level++;
    emit({ type: 'upgrade', col, row, level: t.level });
    return { ok: true, cost };
  };

  sim.sellTower = function (col, row) {
    const i = sim.towers.findIndex(t => t.col === col && t.row === row && !t.dead);
    if (i < 0) return { ok: false, reason: 'notfound' };
    const t = sim.towers[i];
    const refund = Math.round(CONFIG.SELL_REFUND * t.invested);
    sim.state.gold += refund;
    t.dead = true;
    sim.towers.splice(i, 1);
    emit({ type: 'sell', col, row });
    return { ok: true, refund };
  };

  sim.startWave = function () {
    if (sim.state.phase === 'combat') return { ok: false, reason: 'combat' };
    if (sim.state.phase === 'won') return { ok: false, reason: 'won' };
    if (sim.state.phase === 'lost') return { ok: false, reason: 'lost' };
    // Early call bonus: start now during build countdown.
    if (sim.buildT > 0) {
      const bonus = Math.ceil(sim.buildT);
      sim.state.gold += bonus;
      emit({ type: 'gold', x: 0, y: 0, amount: bonus });
      sim.buildT = 0;
    }
    sim.state.wave++;
    sim.state.phase = 'combat';
    sim._waveTime = 0;
    const w = WAVES[sim.state.wave - 1];
    sim._spawnQueue = [];
    for (const g of w.spawns) {
      for (let i = 0; i < g.n; i++) {
        sim._spawnQueue.push({ at: (g.delay || 0) + i * (g.gap || 0), type: g.t, hp: g.hp || 1 });
      }
    }
    sim._spawnQueue.sort((a, b) => a.at - b.at);
    emit({ type: 'waveStart', n: sim.state.wave });
    return { ok: true };
  };

  // Single kill path: shield-first, then hp; dead -> kills++ + gold += reward.
  sim.applyDamage = function (enemy, amount, sourceX, sourceY) {
    if (enemy.dead || enemy.leaked) return;
    let d = amount;
    if (enemy.shield > 0) {
      const s = Math.min(enemy.shield, d);
      enemy.shield -= s;
      d -= s;
    }
    if (d > 0) enemy.hp -= d;
    if (enemy.hp <= 0) {
      enemy.hp = 0;
      enemy.dead = true;
      sim.state.kills++;
      const reward = ENEMY_TYPES[enemy.type].reward;
      sim.state.gold += reward;
      sim.state.goldEarned += reward;
      emit({ type: 'kill', x: enemy.x, y: enemy.y, gold: reward });
      sim.particles.burst(enemy.x, enemy.y, '#4dff9c', 8, 90, 0.45);
    }
  };

  function handleLeaks(leaks) {
    for (const lk of leaks) {
      const e = lk.enemy;
      e.dead = true; // remove from world
      sim.state.lives -= lk.dmg;
      emit({ type: 'leak', x: lk.x, y: lk.y, dmg: lk.dmg });
      sim.particles.ring(lk.x, lk.y, '#ff6b6b', 12, 0.5);
      if (sim.state.lives <= 0) {
        sim.state.lives = 0;
        sim.state.phase = 'lost';
        emit({ type: 'lose' });
      }
    }
  }

  function pruneEnemies() {
    // Remove dead/leaked enemies (kept out of targeting/movement).
    if (!sim.enemies.some(e => e.dead || e.leaked)) return;
    sim.enemies = sim.enemies.filter(e => !e.dead && !e.leaked);
  }

  sim.tick = function (dt) {
    if (sim.state.phase === 'won' || sim.state.phase === 'lost') return;
    sim.state.time += dt;

    // Build phase countdown -> auto startWave.
    if (sim.state.phase === 'build') {
      if (sim.buildT > 0) {
        sim.buildT -= dt;
        if (sim.buildT <= 0) { sim.buildT = 0; sim.startWave(); }
      } else {
        // Initial build phase before first wave: wait for player (no auto-start).
      }
    }

    // Combat: spawn scheduled enemies.
    if (sim.state.phase === 'combat') {
      sim._waveTime += dt;
      while (sim._spawnQueue.length && sim._spawnQueue[0].at <= sim._waveTime) {
        const s = sim._spawnQueue.shift();
        spawnEnemy(sim, s.type, s.hp);
      }
    }

    // Towers fire.
    for (const t of sim.towers) {
      if (t.dead) continue;
      const def = TOWER_TYPES[t.type];
      const lvl = def.levels[t.level];
      if (t.type === 'support') {
        // Gold tick inside fireTower via cd timer.
        t.cd -= dt;
        if (t.cd <= 0) {
          t.cd = lvl.goldEvery;
          fireTower(sim, t);
        }
      } else {
        t.cd -= dt;
        if (t.cd <= 0) {
          const stats = getBuffedStats(sim, t);
          if (fireTower(sim, t)) {
            t.cd = 1 / stats.rate;
          } else {
            t.cd = 0; // no target yet; retry next frame
          }
        }
      }
    }

    // Projectiles + particles.
    sim.projectiles.update(sim, dt);
    sim.particles.update(sim, dt);

    // Enemy movement + leaks.
    const leaks = moveEnemies(sim, dt);
    if (leaks.length) handleLeaks(leaks);
    pruneEnemies();

    // Wave clear check.
    if (sim.state.phase === 'combat' && sim.state.phase !== 'lost') {
      const allSpawned = sim._spawnQueue.length === 0;
      const noneAlive = sim.enemies.every(e => e.dead || e.leaked);
      if (allSpawned && noneAlive) {
        const w = WAVES[sim.state.wave - 1];
        const interest = Math.min(Math.floor(sim.state.gold * CONFIG.INTEREST), CONFIG.INTEREST_CAP);
        sim.state.gold += w.gold + interest;
        emit({ type: 'waveClear', n: sim.state.wave, bonus: w.gold + interest });
        if (sim.state.wave >= WAVES.length) {
          sim.state.phase = 'won';
          emit({ type: 'win' });
        } else {
          sim.state.phase = 'build';
          sim.buildT = CONFIG.BUILD_TIME;
        }
      }
    }
  };

  return sim;
}

// helper: distinguish 'path' vs 'oob' reason for buyTower
function onPathCell(col, row) {
  if (col < 0 || col >= CONFIG.COLS || row < 0 || row >= CONFIG.ROWS) return false;
  return PATH_CELLS.has(`${col},${row}`);
}
