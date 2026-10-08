// path.js — waypoint grid path, px geometry, buildability.
import { CONFIG } from '../core/config.js';

const { COLS, ROWS, CELL, PATH } = CONFIG;

// Every cell on the axis-aligned segments between consecutive waypoints.
function computePathCells() {
  const cells = new Set();
  for (let i = 0; i < PATH.length - 1; i++) {
    let [x0, y0] = PATH[i];
    const [x1, y1] = PATH[i + 1];
    const sx = Math.sign(x1 - x0), sy = Math.sign(y1 - y0);
    while (true) {
      cells.add(`${x0},${y0}`);
      if (x0 === x1 && y0 === y1) break;
      x0 += sx; y0 += sy;
    }
  }
  return cells;
}

export const PATH_CELLS = computePathCells(); // Set of "x,y" strings

// Waypoint centers in px; spawn just off-grid left, exit just off-grid right.
const WAYPOINTS_PX = PATH.map(([c, r]) => ({ x: (c + 0.5) * CELL, y: (r + 0.5) * CELL }));
WAYPOINTS_PX.unshift({ x: -0.5 * CELL, y: 4.5 * CELL });
WAYPOINTS_PX.push({ x: 13 * CELL, y: 5.5 * CELL });

const SEG_LEN = [];
let total = 0;
for (let i = 0; i < WAYPOINTS_PX.length - 1; i++) {
  const a = WAYPOINTS_PX[i], b = WAYPOINTS_PX[i + 1];
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  SEG_LEN.push(len);
  total += len;
}

export const pathLength = total; // px

// t in 0..1 fraction of pathLength -> {x, y, angle} (angle rad, travel direction).
export function pointAt(t) {
  const clamped = Math.max(0, Math.min(1, t));
  let d = clamped * total;
  for (let i = 0; i < SEG_LEN.length; i++) {
    if (d <= SEG_LEN[i] || i === SEG_LEN.length - 1) {
      const a = WAYPOINTS_PX[i], b = WAYPOINTS_PX[i + 1];
      const f = SEG_LEN[i] > 0 ? Math.min(1, d / SEG_LEN[i]) : 0;
      const x = a.x + (b.x - a.x) * f;
      const y = a.y + (b.y - a.y) * f;
      const angle = Math.atan2(b.y - a.y, b.x - a.x);
      return { x, y, angle };
    }
    d -= SEG_LEN[i];
  }
  const last = WAYPOINTS_PX[WAYPOINTS_PX.length - 1];
  return { x: last.x, y: last.y, angle: 0 };
}

export function isBuildable(col, row) {
  if (!Number.isInteger(col) || !Number.isInteger(row)) return false;
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return false;
  return !PATH_CELLS.has(`${col},${row}`);
}

export function cellCenter(col, row) {
  return { x: (col + 0.5) * CELL, y: (row + 0.5) * CELL };
}

export function cellAtPx(x, y) {
  const col = Math.floor(x / CELL);
  const row = Math.floor(y / CELL);
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return null;
  return { col, row };
}
