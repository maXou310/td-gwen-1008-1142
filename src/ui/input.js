// input.js — pointer events on #game-canvas: tap-to-buy, tap-tower-to-select,
// hover/drag ghost preview. Mouse + touch (pointer events, touch-action:none).
import { CONFIG } from '../core/config.js';
import { cellAtPx } from '../path/path.js';

export function bindInput(canvas, opts) {
  // opts = { buyAt(type,c,r), selectAt(c,r), deselect(), getSelected(),
  //          getSelectedType(), setHover(cell), showToast(msg) }
  canvas.style.touchAction = 'none';

  let downX = 0, downY = 0;

  function evtCell(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    // Inverse of the renderer's letterbox fit.
    const scale = Math.min(rect.width / (CONFIG.COLS * CONFIG.CELL), rect.height / (CONFIG.ROWS * CONFIG.CELL));
    const offX = (rect.width - CONFIG.COLS * CONFIG.CELL * scale) / 2;
    const offY = (rect.height - CONFIG.ROWS * CONFIG.CELL * scale) / 2;
    return cellAtPx((x - offX) / scale, (y - offY) / scale);
  }

  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch') e.preventDefault(); // avoid double-fire w/ mouse emulation
    downX = e.clientX; downY = e.clientY;
    if (canvas.setPointerCapture) { try { canvas.setPointerCapture(e.pointerId); } catch (_) {} }
    const cell = evtCell(e);
    if (!cell) return;
    const sel = opts.getSelected ? opts.getSelected() : null;
    const simTowers = opts.getTowerAt ? opts.getTowerAt(cell.col, cell.row) : null;

    if (sel && sel.col === cell.col && sel.row === cell.row) {
      // Tap the already-selected tower -> deselect.
      if (opts.deselect) opts.deselect();
      return;
    }
    if (simTowers) {
      // Tap a placed tower -> select it (panel shows upgrade/sell).
      if (opts.selectAt) opts.selectAt(cell.col, cell.row);
      return;
    }
    // Empty cell with a dock type selected -> build.
    const type = opts.getSelectedType ? opts.getSelectedType() : 'arrow';
    const res = opts.buyAt ? opts.buyAt(type, cell.col, cell.row) : null;
    if (res && !res.ok && opts.showToast) {
      const msg = { gold: 'Not enough gold', occupied: 'Cell occupied', path: "Can't build there", oob: "Can't build there" }[res.reason] || res.reason;
      opts.showToast(msg);
    } else if (res && res.ok) {
      if (opts.selectAt) opts.selectAt(cell.col, cell.row);
    }
  }, { passive: false });

  canvas.addEventListener('pointermove', (e) => {
    // Ghost preview while hovering or dragging on the grid.
    const cell = evtCell(e);
    if (opts.setHover) opts.setHover(cell);
  });

  function endDrag(e) {
    if (e.type === 'pointercancel') { if (opts.setHover) opts.setHover(null); return; }
    // Tap on empty (non-buildable or no-dock) area outside the grid -> deselect.
    const cell = evtCell(e);
    if (!cell && opts.deselect) opts.deselect();
  }
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('pointerleave', () => { if (opts.setHover) opts.setHover(null); });

  return {};
}
