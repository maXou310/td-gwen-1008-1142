// input.js — pointer events on #game-canvas: dock selection, tap-to-buy,
// tap-tower-to-select, hover/drag ghost preview. Mouse + touch.
import { CONFIG } from '../core/config.js';
import { cellAtPx } from '../path/path.js';
import { TOWER_TYPES } from '../entities/towers.js';
import { drawTowerIcon } from '../art/sprites.js';

export function bindInput(canvas, opts) {
  // opts = { buyAt(type,c,r), selectAt(c,r), deselect(), getSelected(),
  //          setSelectedType(t), getSelectedType(), setHover(cell) }
  let dragging = false;

  canvas.style.touchAction = 'none';

  function evtCell(e) {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left);
    const y = (e.clientY - rect.top);
    // Inverse of renderer letterbox fit.
    const scale = Math.min(rect.width / (CONFIG.COLS * CONFIG.CELL), rect.height / (CONFIG.ROWS * CONFIG.CELL));
    const offX = (rect.width - CONFIG.COLS * CONFIG.CELL * scale) / 2;
    const offY = (rect.height - CONFIG.ROWS * CONFIG.CELL * scale) / 2;
    return cellAtPx((x - offX) / scale, (y - offY) / scale);
  }

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    dragging = true;
    canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId);
    const cell = evtCell(e);
    if (!cell) return;
    const sel = opts.getSelected ? opts.getSelected() : null;
    if (sel && sel.col === cell.col && sel.row === cell.row) {
      // Tap placed tower -> select (already selected: keep).
      opts.selectAt(cell.col, cell.row);
      return;
    }
    if (opts.buyAt) {
      const res = opts.buyAt(opts.getSelectedType?.() || 'arrow', cell.col, cell.row);
      if (res && res.ok) {
        opts.selectAt(cell.col, cell.row);
      }
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    const cell = evtCell(e);
    opts.setHover && opts.setHover(cell);
  });

  function endDrag(e) {
    dragging = false;
    const cell = evtCell(e);
    if (cell && !opts.getSelected()) {
      opts.deselect && opts.deselect();
    }
  }
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('pointerleave', () => { opts.setHover && opts.setHover(null); });

  // ---- Dock (tower type selection) -------------------------------------------
  const dock = document.getElementById('dock');
  for (const [key, def] of Object.entries(TOWER_TYPES)) {
    const btn = document.createElement('button');
    btn.className = 'dock-btn' + (key === (opts.getSelectedType?.() || 'arrow') ? ' selected' : '');
    btn.dataset.type = key;
    const cv = document.createElement('canvas');
    cv.width = 40; cv.height = 40;
    drawTowerIcon(key, 0, cv, 40);
    const cost = document.createElement('span');
    cost.className = 'dock-cost';
    cost.textContent = def.cost;
    btn.append(cv, cost);
    btn.addEventListener('click', () => {
      opts.setSelectedType?.(key);
      for (const b of dock.querySelectorAll('.dock-btn')) b.classList.toggle('selected', b.dataset.type === key);
    });
    dock.appendChild(btn);
  }

  return {
    setSelectedType(t) { opts.setSelectedType?.(t); },
    getSelectedType() { return opts.getSelectedType?.() || 'arrow'; }
  };
}
