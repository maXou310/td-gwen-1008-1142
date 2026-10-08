// kill-gold.js — one-liner check: total kill reward across all WAVES.
import { WAVES } from '../src/entities/waves.js';
import { ENEMY_TYPES } from '../src/entities/enemies.js';

let total = 0, count = 0;
for (const w of WAVES) for (const g of w.spawns) {
  total += ENEMY_TYPES[g.t].reward * g.n;
  count += g.n;
}
console.log(JSON.stringify({ totalKillGold: total, enemyCount: count }));
