// renderer.js — createRenderer(canvas): DPR letterbox fit, full frame draw.
import { CONFIG } from '../core/config.js';
import { PATH_CELLS, cellCenter } from '../path/path.js';
import { TOWER_TYPES } from '../entities/towers.js';
import { ENEMY_TYPES } from '../entities/enemies.js';
import * as sprites from '../art/sprites.js';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let viewW = 0, viewH = 0, scale = 1, offX = 0, offY = 0;
  const gridW = CONFIG.COLS * CONFIG.CELL;
  const gridH = CONFIG.ROWS * CONFIG.CELL;

  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    viewW = rect.width; viewH = rect.height;
    canvas.width = Math.round(viewW * dpr);
    canvas.height = Math.round(viewH * dpr);
    // Letterbox-fit the grid into the viewport.
    scale = Math.min(viewW / gridW, viewH / gridH);
    offX = (viewW - gridW * scale) / 2;
    offY = (viewH - gridH * scale) / 2;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function toPx(x, y) { return [offX + x * scale, offY + y * scale]; }

  function drawFrame(view) {
    const { sim, selected, hover, paused, speed } = view;
    ctx.clearRect(0, 0, viewW, viewH);
    ctx.fillStyle = '#0b0e22';
    ctx.fillRect(0, 0, viewW, viewH);

    // Background grid (inside letterbox area).
    const [bx, by] = toPx(0, 0);
    ctx.save();
    ctx.translate(bx, by);
    ctx.scale(scale, scale);
    sprites.drawBackground(ctx, gridW, gridH);
    ctx.strokeStyle = 'rgba(255,255,255,.05)';
    ctx.lineWidth = 1;
    for (let c = 0; c <= CONFIG.COLS; c++) {
      ctx.beginPath(); ctx.moveTo(c * CONFIG.CELL, 0); ctx.lineTo(c * CONFIG.CELL, gridH); ctx.stroke();
    }
    for (let r = 0; r <= CONFIG.ROWS; r++) {
      ctx.beginPath(); ctx.moveTo(0, r * CONFIG.CELL); ctx.lineTo(gridW, r * CONFIG.CELL); ctx.stroke();
    }
    // Path cells.
    ctx.fillStyle = '#1a2040';
    PATH_CELLS.forEach(key => {
      const [c, r] = key.split(',').map(Number);
      ctx.fillRect(c * CONFIG.CELL, r * CONFIG.CELL, CONFIG.CELL, CONFIG.CELL);
    });
    // Path outline: wide translucent halo pass underneath + bright core on top.
    // No ctx.filter/blur. The halo keeps the route legible when the grid is
    // letterboxed small (phone portrait) where a 2px logical stroke renders <1px.
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(55,230,255,.22)';
    ctx.lineWidth = 10;
    PATH_CELLS.forEach(key => {
      const [c, r] = key.split(',').map(Number);
      ctx.strokeRect(c * CONFIG.CELL + 1, r * CONFIG.CELL + 1, CONFIG.CELL - 2, CONFIG.CELL - 2);
    });
    ctx.strokeStyle = '#37e6ff';
    ctx.lineWidth = 4;
    PATH_CELLS.forEach(key => {
      const [c, r] = key.split(',').map(Number);
      ctx.strokeRect(c * CONFIG.CELL + 1, r * CONFIG.CELL + 1, CONFIG.CELL - 2, CONFIG.CELL - 2);
    });

    // Hover build ghost.
    if (hover && !selected) {
      const cc = cellCenter(hover.col, hover.row);
      const valid = canBuildAt(sim, hover.col, hover.row);
      ctx.fillStyle = valid ? 'rgba(77,255,156,.25)' : 'rgba(255,107,107,.25)';
      ctx.fillRect(cc.x - CONFIG.CELL / 2, cc.y - CONFIG.CELL / 2, CONFIG.CELL, CONFIG.CELL);
      if (valid && view.hoverType) {
        const def = TOWER_TYPES[view.hoverType];
        const range = def.levels[0].range * CONFIG.CELL;
        ctx.strokeStyle = 'rgba(55,230,255,.4)';
        ctx.beginPath(); ctx.arc(cc.x, cc.y, range, 0, Math.PI * 2); ctx.stroke();
      }
    }

    // Towers (+ range ring when selected).
    for (const t of sim.towers) {
      if (t.dead) continue;
      if (selected && selected.col === t.col && selected.row === t.row) {
        const def = TOWER_TYPES[t.type];
        const range = def.levels[t.level].range * CONFIG.CELL;
        ctx.strokeStyle = 'rgba(55,230,255,.6)';
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(t.x, t.y, range, 0, Math.PI * 2); ctx.stroke();
      }
      sprites.drawTower(ctx, t.type, t.level, t.x, t.y, CONFIG.CELL, sim.state.time);
    }

    // Enemies + hp bars.
    for (const e of sim.enemies) {
      if (e.dead || e.leaked) continue;
      const rPx = ENEMY_TYPES[e.type].r * CONFIG.CELL;
      sprites.drawEnemy(ctx, e.type, e.x, e.y, rPx, sim.state.time, e.hp / e.maxHp);
      // HP bar above enemy: 6px logical (was 4) so it stays ~3px at phone scale.
      const bw = rPx * 2, bh = 6;
      const bx2 = e.x - bw / 2, by2 = e.y - rPx - 10;
      ctx.fillStyle = 'rgba(0,0,0,.6)';
      ctx.fillRect(bx2, by2, bw, bh);
      ctx.fillStyle = '#4dff9c';
      ctx.fillRect(bx2, by2, bw * Math.max(0, e.hp / e.maxHp), bh);
    }

    // Projectiles (additive trails).
    for (const p of sim.projectiles.actives()) {
      const angle = p.straight ? p.angle : Math.atan2(p.lastY - p.y, p.lastX - p.x);
      sprites.drawProjectile(ctx, p.type, p.x, p.y, angle);
    }

    // Particles (additive).
    ctx.globalCompositeOperation = 'lighter';
    for (const p of sim.particles.actives()) {
      const a = p.life / p.maxLife;
      ctx.globalAlpha = a;
      if (p.kind === 'ring') {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1 + (1 - a) * 2), 0, Math.PI * 2); ctx.stroke();
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.restore();

    // Paused overlay text.
    if (paused) {
      ctx.fillStyle = 'rgba(13,16,38,.6)';
      ctx.fillRect(0, 0, viewW, viewH);
      ctx.fillStyle = '#37e6ff';
      ctx.font = `bold ${Math.round(20 * scale)}px system-ui`;
      ctx.textAlign = 'center';
      ctx.fillText('PAUSED', viewW / 2, viewH / 2);
    }
  }

  function canBuildAt(sim, col, row) {
    if (col < 0 || col >= CONFIG.COLS || row < 0 || row >= CONFIG.ROWS) return false;
    if (PATH_CELLS.has(`${col},${row}`)) return false;
    if (sim.towers.some(t => t.col === col && t.row === row && !t.dead)) return false;
    return true;
  }

  return { resize, drawFrame };
}
