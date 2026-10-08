// input.js — pointer events on #game-canvas: dock selection, tap-to-buy,
// tap-tower-to-select, hover/drag ghost preview. Mouse + touch.
import { CONFIG } from '../core/config.js';
import { cellAtPx } from '../path/path.js';

export function bindInput(canvas, api) {
  // api = { buyAt(type,c,r), selectAt(c,r), deselect(), getSelected(), setHoverType(t) }
  let selectedType = 'arrow'; // default dock selection
  let dragging = false;

  canvas.style.touchAction = 'none';

  function evtCell(e) {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left);
    const y = (e.clientY - rect.top);
    // Inverse of renderer letterbox: use canvas logical size == viewport px here
    // because renderer fits grid into the same box; approximate via scale.
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
    const sel = api.getSelected ? api.getSelected() : null;
    if (sel && sel.col === cell.col && sel.row === cell.row) {
      // Tap placed tower -> select (already selected: keep).
      api.selectAt(cell.col, cell.row);
      return;
    }
    if (api.buyAt) {
      const res = api.buyAt(selectedType, cell.col, cell.row);
      if (res && res.ok) {
        api.selectAt(cell.col, cell.row);
      }
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    const cell = evtCell(e);
    api.setHover && api.setHover(cell);
  });

  function endDrag(e) {
    dragging = false;
    const cell = evtCell(e);
    if (cell && !api.getSelected()) {
      api.deselect && api.deselect();
    }
  }
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('pointerleave', () => { api.setHover && api.setHover(null); });

  return {
    setSelectedType(t) { selectedType = t; },
    getSelectedType() { return selectedType; }
  };
}
