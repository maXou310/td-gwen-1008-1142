// sprites.js — neon vector art (art-owned; same signatures as the skeleton).
// All drawing is code-generated canvas 2D. No ctx.filter, no shadowBlur:
// glows are double-stroke (wide translucent + narrow bright) and shadows are
// radial gradients only. Additive ('lighter') is used for projectile trails.

const TAU = Math.PI * 2;

// Palette (STYLE.md, exact).
const C = {
  bg: '#0b0e22',
  arrow: '#4dff9c',
  cannon: '#ffb347',
  frost: '#7fd4ff',
  support: '#ffd166',
  sniper: '#c77dff',
  grunt: '#ff6b6b',
  runner: '#ffd166',
  tank: '#8d99ae',
  flyer: '#ff9ff3',
  shield: '#54a0ff',
  boss: '#f368e0',
  accent: '#37e6ff',
};

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// Double-stroke glow: one wide translucent pass + one narrow bright pass.
function neonStroke(c, color, width, pathFn, alpha = 1) {
  c.lineJoin = 'round';
  c.lineCap = 'round';
  c.strokeStyle = hexA(color, 0.22 * alpha);
  c.lineWidth = width * 2.6;
  c.beginPath(); pathFn(); c.stroke();
  c.strokeStyle = hexA(color, alpha);
  c.lineWidth = width;
  c.beginPath(); pathFn(); c.stroke();
}

function polyPath(c, sides, r, rot = 0) {
  for (let i = 0; i < sides; i++) {
    const a = (TAU / sides) * i + rot;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
  }
  c.closePath();
}

function roundedRectPath(c, x, y, w, h, r) {
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

// Soft ground shadow (radial gradient only — never ctx.filter/blur).
function shadowEllipse(c, x, y, rx, ry) {
  const g = c.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry));
  g.addColorStop(0, 'rgba(0,0,0,.35)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  c.save();
  c.translate(x, y);
  c.scale(1, ry / Math.max(rx, ry));
  c.fillStyle = g;
  c.beginPath(); c.arc(0, 0, Math.max(rx, ry), 0, TAU); c.fill();
  c.restore();
}

// ---------------------------------------------------------------- background

// Precomputed faint nebula blobs (positions relative to grid w/h so they are
// stable across frames; drawn very subtly under the vignette).
const NEBULAE = [
  { fx: 0.16, fy: 0.22, fr: 0.34, col: 'rgba(55,230,255,.05)' },
  { fx: 0.82, fy: 0.72, fr: 0.40, col: 'rgba(199,125,255,.045)' },
  { fx: 0.55, fy: 0.9,  fr: 0.30, col: 'rgba(77,255,156,.035)' },
];

export function drawBackground(c, w, h) {
  c.fillStyle = C.bg;
  c.fillRect(0, 0, w, h);
  // Faint decorative nebula blobs.
  for (const n of NEBULAE) {
    const nx = n.fx * w, ny = n.fy * h, nr = n.fr * Math.min(w, h);
    const g = c.createRadialGradient(nx, ny, 0, nx, ny, nr);
    g.addColorStop(0, n.col);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g;
    c.fillRect(nx - nr, ny - nr, nr * 2, nr * 2);
  }
  // Subtle vignette: darker at the edges.
  const v = c.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.72);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,.45)');
  c.fillStyle = v;
  c.fillRect(0, 0, w, h);
  // Faint cell grid (CELL = 48 spacing). The renderer draws its own grid too;
  // this keeps the background self-contained when reused elsewhere.
  c.strokeStyle = 'rgba(255,255,255,.05)';
  c.lineWidth = 1;
  for (let x = 0; x <= w; x += 48) {
    c.beginPath(); c.moveTo(x + 0.5, 0); c.lineTo(x + 0.5, h); c.stroke();
  }
  for (let y = 0; y <= h; y += 48) {
    c.beginPath(); c.moveTo(0, y + 0.5); c.lineTo(w, y + 0.5); c.stroke();
  }
}

// ------------------------------------------------------------------- towers

const TOWER_COLORS = {
  arrow: C.arrow, cannon: C.cannon, frost: C.frost, support: C.support, sniper: C.sniper,
};

export function drawTower(c, type, level, x, y, cell, t) {
  const color = TOWER_COLORS[type] || C.accent;
  const bob = type === 'support' ? 0 : Math.sin(t * 2 + x * 0.05); // ±1px idle bob
  c.save();
  c.translate(x, y + bob);

  // Dark base plate (rounded rect) with a faint accent border.
  const bs = cell * 0.86;
  c.fillStyle = 'rgba(13,16,38,.9)';
  c.strokeStyle = 'rgba(55,230,255,.25)';
  c.lineWidth = 1;
  c.beginPath();
  roundedRectPath(c, -bs / 2, -bs / 2, bs, bs, cell * 0.14);
  c.fill(); c.stroke();

  const r = cell * 0.3; // glyph radius budget (~0.8*CELL body)
  switch (type) {
    case 'arrow': {
      // Chevron arrowhead pointing up, static aim; tip twinkles on a 4-frame
      // cycle driven by sin(t*3).
      const twinkle = Math.sin(t * 3) > 0;
      const tipA = twinkle ? 1 : 0.55;
      neonStroke(c, color, 2.4, () => {
        c.moveTo(-r * 0.85, -r * 0.35);
        c.lineTo(0, r * 0.75);
        c.lineTo(r * 0.85, -r * 0.35);
      }, 1);
      // Inner chevron echo.
      neonStroke(c, color, 1.2, () => {
        c.moveTo(-r * 0.45, -r * 0.6);
        c.lineTo(0, r * 0.25);
        c.lineTo(r * 0.45, -r * 0.6);
      }, 0.5);
      // Bright tip dot.
      c.fillStyle = hexA('#eafff4', tipA);
      c.beginPath(); c.arc(0, r * 0.75, 2.2, 0, TAU); c.fill();
      break;
    }
    case 'cannon': {
      // Hexagon body + barrel rectangle; barrel recoils decoratively along
      // its direction (up-right) with max(0, sin(t*4)) * 2 px.
      const rec = Math.max(0, Math.sin(t * 4)) * 2;
      const ba = -Math.PI / 4; // barrel angle
      const bx = Math.cos(ba) * rec, by = Math.sin(ba) * rec;
      c.save();
      c.rotate(ba);
      c.fillStyle = hexA(color, 0.85);
      c.fillRect(r * 0.2 + bx, by - r * 0.16, r * 0.85, r * 0.32);
      c.fillStyle = hexA('#ffe9cf', 0.9);
      c.fillRect(r * 0.95 + bx, by - r * 0.08, r * 0.18, r * 0.16);
      c.restore();
      neonStroke(c, color, 2.2, () => polyPath(c, 6, r * 0.72, 0), 1);
      c.fillStyle = hexA(color, 0.18);
      c.beginPath(); polyPath(c, 6, r * 0.72, 0); c.fill();
      // Core.
      c.fillStyle = hexA('#fff3e0', 0.9);
      c.beginPath(); c.arc(0, 0, r * 0.22, 0, TAU); c.fill();
      break;
    }
    case 'frost': {
      // Ring + 6-spoke snowflake; spokes rotate slowly (t*0.5 rad/s).
      const rot = t * 0.5;
      neonStroke(c, color, 2, () => { c.arc(0, 0, r * 0.78, 0, TAU); }, 0.9);
      neonStroke(c, color, 1.6, () => {
        for (let i = 0; i < 6; i++) {
          const a = rot + (TAU / 6) * i;
          c.moveTo(Math.cos(a) * r * 0.2, Math.sin(a) * r * 0.2);
          c.lineTo(Math.cos(a) * r * 0.78, Math.sin(a) * r * 0.78);
          // small side ticks on each spoke
          const ta = a + Math.PI / 2, tl = r * 0.12;
          const sx = Math.cos(a) * r * 0.55, sy = Math.sin(a) * r * 0.55;
          c.moveTo(sx - Math.cos(ta) * tl, sy - Math.sin(ta) * tl);
          c.lineTo(sx + Math.cos(ta) * tl, sy + Math.sin(ta) * tl);
        }
      }, 0.85);
      c.fillStyle = hexA('#eaf9ff', 0.95);
      c.beginPath(); c.arc(0, 0, r * 0.16, 0, TAU); c.fill();
      break;
    }
    case 'support': {
      // Double ring + pulsing core (radius pulses sin(t*2)*15%+1).
      const pulse = 1 + Math.sin(t * 2) * 0.15;
      const ringA = 0.6 + 0.3 * Math.sin(t * 3);
      neonStroke(c, color, 1.8, () => { c.arc(0, 0, r * 0.8, 0, TAU); }, ringA);
      neonStroke(c, color, 1.4, () => { c.arc(0, 0, r * 0.5, 0, TAU); }, ringA * 0.8);
      // Pulsing core with soft halo.
      const cr = r * 0.28 * pulse;
      const g = c.createRadialGradient(0, 0, 0, 0, 0, cr * 2.2);
      g.addColorStop(0, hexA('#fff6dd', 0.95));
      g.addColorStop(0.4, hexA(color, 0.55));
      g.addColorStop(1, hexA(color, 0));
      c.fillStyle = g;
      c.beginPath(); c.arc(0, 0, cr * 2.2, 0, TAU); c.fill();
      break;
    }
    case 'sniper': {
      // Long diamond + bright laser core line; shimmer alpha 0.7+0.3*sin(t*5).
      const shim = 0.7 + 0.3 * Math.sin(t * 5);
      neonStroke(c, color, 2, () => {
        c.moveTo(0, -r * 1.15); c.lineTo(r * 0.42, 0);
        c.lineTo(0, r * 1.15); c.lineTo(-r * 0.42, 0);
        c.closePath();
      }, shim);
      c.fillStyle = hexA(color, 0.15 * shim);
      c.beginPath();
      c.moveTo(0, -r * 1.15); c.lineTo(r * 0.42, 0);
      c.lineTo(0, r * 1.15); c.lineTo(-r * 0.42, 0);
      c.closePath(); c.fill();
      // Laser core line.
      neonStroke(c, '#f3e6ff', 1.4, () => {
        c.moveTo(0, -r * 0.95); c.lineTo(0, r * 0.95);
      }, shim);
      c.fillStyle = hexA('#ffffff', shim);
      c.beginPath(); c.arc(0, 0, 1.8, 0, TAU); c.fill();
      break;
    }
  }

  // Level pips: orbiting dots around the base plate (L1:1, L2:2).
  for (let i = 0; i < level; i++) {
    const a = t * 1.2 + i * Math.PI;
    const pr = cell * 0.42;
    const px = Math.cos(a) * pr, py = Math.sin(a) * pr;
    c.fillStyle = hexA(color, 0.35);
    c.beginPath(); c.arc(px, py, 4.5, 0, TAU); c.fill();
    c.fillStyle = color;
    c.beginPath(); c.arc(px, py, 2.5, 0, TAU); c.fill();
  }
  c.restore();
}

// ------------------------------------------------------------------ enemies

export function drawEnemy(c, type, x, y, rPx, t, hpFrac) {
  c.save();
  c.translate(x, y);

  // Grounded enemies get a soft radial shadow; flyers do not.
  if (type !== 'flyer') {
    shadowEllipse(c, 0, rPx * 0.75, rPx * 0.95, rPx * 0.4);
  }

  switch (type) {
    case 'grunt': {
      // Wobbly blob: ellipse with two sine bumps (phase t*3) + inner spot.
      const wob = Math.sin(t * 3);
      const rx = rPx * (1 + 0.08 * wob);
      const ry = rPx * (1 - 0.08 * wob);
      const g = c.createRadialGradient(-rx * 0.3, -ry * 0.35, 0, 0, 0, Math.max(rx, ry));
      g.addColorStop(0, '#ff8f8f');
      g.addColorStop(0.7, C.grunt);
      g.addColorStop(1, '#c94b4b');
      c.fillStyle = g;
      c.beginPath(); c.ellipse(0, 0, rx, ry, 0, 0, TAU); c.fill();
      c.strokeStyle = hexA(C.grunt, 0.6);
      c.lineWidth = 1.5;
      c.beginPath(); c.ellipse(0, 0, rx, ry, 0, 0, TAU); c.stroke();
      // Darker inner spot.
      c.fillStyle = 'rgba(60,10,10,.55)';
      c.beginPath(); c.ellipse(0, rPx * 0.15, rPx * 0.42, rPx * 0.32, 0, 0, TAU); c.fill();
      break;
    }
    case 'runner': {
      // Sleek dart tilted 20°, speed lines behind (alpha flickers with t).
      c.rotate(-Math.PI / 9); // 20° tilt
      const fl = 0.35 + 0.3 * Math.abs(Math.sin(t * 6));
      c.strokeStyle = hexA(C.runner, fl);
      c.lineWidth = 1.5;
      c.beginPath();
      c.moveTo(-rPx * 1.1, -rPx * 0.25); c.lineTo(-rPx * 1.7, -rPx * 0.25);
      c.moveTo(-rPx * 1.0, rPx * 0.25); c.lineTo(-rPx * 1.5, rPx * 0.25);
      c.stroke();
      const g = c.createLinearGradient(-rPx, 0, rPx, 0);
      g.addColorStop(0, '#b98a2e');
      g.addColorStop(0.6, C.runner);
      g.addColorStop(1, '#fff0c4');
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(rPx * 1.15, 0);
      c.quadraticCurveTo(rPx * 0.2, -rPx * 0.75, -rPx * 0.9, -rPx * 0.35);
      c.quadraticCurveTo(-rPx * 0.55, 0, -rPx * 0.9, rPx * 0.35);
      c.quadraticCurveTo(rPx * 0.2, rPx * 0.75, rPx * 1.15, 0);
      c.closePath(); c.fill();
      c.strokeStyle = hexA(C.runner, 0.7);
      c.lineWidth = 1.2;
      c.stroke();
      break;
    }
    case 'tank': {
      // Chunky octagon, inner armor panel, slow bob (sin(t*2)*1.5).
      c.translate(0, Math.sin(t * 2) * 1.5);
      const g = c.createRadialGradient(-rPx * 0.3, -rPx * 0.35, 0, 0, 0, rPx * 1.1);
      g.addColorStop(0, '#b8c2d4');
      g.addColorStop(0.65, C.tank);
      g.addColorStop(1, '#5c6678');
      c.fillStyle = g;
      c.beginPath(); polyPath(c, 8, rPx, Math.PI / 8); c.fill();
      c.strokeStyle = hexA(C.tank, 0.8);
      c.lineWidth = 2;
      c.beginPath(); polyPath(c, 8, rPx, Math.PI / 8); c.stroke();
      // Inner armor panel.
      c.fillStyle = 'rgba(20,26,40,.55)';
      c.beginPath(); polyPath(c, 8, rPx * 0.55, Math.PI / 8); c.fill();
      c.strokeStyle = hexA('#dfe6f2', 0.5);
      c.lineWidth = 1.2;
      c.beginPath(); polyPath(c, 8, rPx * 0.55, Math.PI / 8); c.stroke();
      break;
    }
    case 'flyer': {
      // Winged triangle; wings flap (scaleY sin(t*8)*30%). No ground shadow.
      const flap = 1 + Math.sin(t * 8) * 0.3;
      c.save();
      c.scale(1, flap);
      const wg = c.createLinearGradient(0, -rPx, 0, rPx * 0.4);
      wg.addColorStop(0, '#ffc4f7');
      wg.addColorStop(1, C.flyer);
      c.fillStyle = wg;
      c.beginPath();
      c.moveTo(0, -rPx * 0.2);
      c.quadraticCurveTo(-rPx * 1.25, -rPx * 0.9, -rPx * 1.05, rPx * 0.15);
      c.quadraticCurveTo(-rPx * 0.5, -rPx * 0.1, 0, rPx * 0.15);
      c.closePath(); c.fill();
      c.beginPath();
      c.moveTo(0, -rPx * 0.2);
      c.quadraticCurveTo(rPx * 1.25, -rPx * 0.9, rPx * 1.05, rPx * 0.15);
      c.quadraticCurveTo(rPx * 0.5, -rPx * 0.1, 0, rPx * 0.15);
      c.closePath(); c.fill();
      c.restore();
      // Body triangle.
      const g = c.createLinearGradient(0, -rPx, 0, rPx);
      g.addColorStop(0, '#fff0fb');
      g.addColorStop(1, C.flyer);
      c.fillStyle = g;
      c.beginPath();
      c.moveTo(0, -rPx * 0.9);
      c.lineTo(rPx * 0.7, rPx * 0.75);
      c.lineTo(-rPx * 0.7, rPx * 0.75);
      c.closePath(); c.fill();
      c.strokeStyle = hexA(C.flyer, 0.8);
      c.lineWidth = 1.4;
      c.stroke();
      break;
    }
    case 'shield': {
      // Hexagon + front shield plate (arc segment brighter; alpha proxies
      // shield charge via hpFrac: 0.4 + 0.6*hpFrac).
      const g = c.createRadialGradient(-rPx * 0.3, -rPx * 0.3, 0, 0, 0, rPx * 1.05);
      g.addColorStop(0, '#8cc0ff');
      g.addColorStop(0.65, C.shield);
      g.addColorStop(1, '#2f6fc4');
      c.fillStyle = g;
      c.beginPath(); polyPath(c, 6, rPx, 0); c.fill();
      c.strokeStyle = hexA(C.shield, 0.8);
      c.lineWidth = 2;
      c.beginPath(); polyPath(c, 6, rPx, 0); c.stroke();
      // Front plate: bright arc segment facing "forward" (+x).
      const pa = 0.4 + 0.6 * Math.max(0, Math.min(1, hpFrac));
      neonStroke(c, '#bfe0ff', 3, () => {
        c.arc(0, 0, rPx * 0.82, -Math.PI / 3.2, Math.PI / 3.2);
      }, pa);
      c.strokeStyle = hexA('#ffffff', pa * 0.8);
      c.lineWidth = 1.2;
      c.beginPath(); c.arc(0, 0, rPx * 0.62, -Math.PI / 4, Math.PI / 4); c.stroke();
      break;
    }
    case 'boss': {
      // Big core + rotating outer ring (two arcs, opposite rotation t*0.8)
      // + 3 orbiting dots; whole sprite pulses sin(t*1.5)*4%.
      const s = 1 + Math.sin(t * 1.5) * 0.04;
      c.scale(s, s);
      // Outer ring: two arcs rotating in opposite directions.
      neonStroke(c, C.boss, 2.6, () => {
        c.arc(0, 0, rPx, t * 0.8, t * 0.8 + Math.PI * 0.85);
      }, 0.9);
      neonStroke(c, '#ff9df0', 2.2, () => {
        c.arc(0, 0, rPx * 0.85, -t * 0.8 + Math.PI, -t * 0.8 + Math.PI * 1.85);
      }, 0.8);
      // Core with hot center.
      const g = c.createRadialGradient(0, 0, 0, 0, 0, rPx * 0.6);
      g.addColorStop(0, '#ffe4fa');
      g.addColorStop(0.45, C.boss);
      g.addColorStop(1, '#8f2ba0');
      c.fillStyle = g;
      c.beginPath(); c.arc(0, 0, rPx * 0.6, 0, TAU); c.fill();
      c.strokeStyle = hexA(C.boss, 0.7);
      c.lineWidth = 1.5;
      c.beginPath(); c.arc(0, 0, rPx * 0.6, 0, TAU); c.stroke();
      // 3 orbiting dots.
      for (let i = 0; i < 3; i++) {
        const a = t * 0.8 + (TAU / 3) * i;
        const dx = Math.cos(a) * rPx * 1.12, dy = Math.sin(a) * rPx * 1.12;
        c.fillStyle = hexA(C.boss, 0.35);
        c.beginPath(); c.arc(dx, dy, 4, 0, TAU); c.fill();
        c.fillStyle = '#ff9df0';
        c.beginPath(); c.arc(dx, dy, 2.2, 0, TAU); c.fill();
      }
      break;
    }
  }
  c.restore();
}

// -------------------------------------------------------------- projectiles

const PROJ = {
  arrow:  { col: C.arrow,   core: 2.6, trail: 10, extra: null },
  cannon: { col: C.cannon,  core: 3.4, trail: 14, extra: 'smoke' },
  frost:  { col: C.frost,   core: 2.6, trail: 12, extra: 'sparkle' },
  sniper: { col: C.sniper,  core: 2.2, trail: 22, extra: 'beam' },
};

export function drawProjectile(c, type, x, y, angle) {
  const spec = PROJ[type] || { col: '#ffffff', core: 2.5, trail: 12, extra: null };
  c.save();
  c.translate(x, y);
  c.rotate(angle);
  c.globalCompositeOperation = 'lighter';

  // Additive trail: 3 fading circles behind along -angle direction.
  for (let i = 1; i <= 3; i++) {
    const d = (spec.trail / 3) * i;
    const f = 1 - i / 4;
    c.fillStyle = hexA(spec.col, 0.35 * f);
    c.beginPath(); c.arc(-d, 0, Math.max(0.6, spec.core * f), 0, TAU); c.fill();
  }

  if (spec.extra === 'smoke') {
    // Cannon: smoke ring behind the ball.
    c.strokeStyle = hexA('#c9a06a', 0.35);
    c.lineWidth = 1.5;
    c.beginPath(); c.arc(-spec.trail * 0.8, 0, spec.core * 1.6, 0, TAU); c.stroke();
  } else if (spec.extra === 'sparkle') {
    // Frost: sparkle cross behind.
    const sx = -spec.trail * 0.7, sr = spec.core * 1.4;
    c.strokeStyle = hexA('#ffffff', 0.5);
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(sx - sr, 0); c.lineTo(sx + sr, 0);
    c.moveTo(sx, -sr); c.lineTo(sx, sr);
    c.stroke();
  } else if (spec.extra === 'beam') {
    // Sniper: long thin laser streak.
    const g = c.createLinearGradient(-spec.trail, 0, 0, 0);
    g.addColorStop(0, hexA(spec.col, 0));
    g.addColorStop(1, hexA('#f3e6ff', 0.8));
    c.strokeStyle = g;
    c.lineWidth = 1.6;
    c.beginPath(); c.moveTo(-spec.trail, 0); c.lineTo(0, 0); c.stroke();
  }

  // Bright core.
  c.fillStyle = spec.col;
  c.beginPath(); c.arc(0, 0, spec.core, 0, TAU); c.fill();
  c.fillStyle = 'rgba(255,255,255,.9)';
  c.beginPath(); c.arc(0, 0, spec.core * 0.5, 0, TAU); c.fill();

  c.globalCompositeOperation = 'source-over';
  c.restore();
}

// -------------------------------------------------------------------- icons

export function drawTowerIcon(type, level, canvas, px) {
  const c = canvas.getContext('2d');
  c.clearRect(0, 0, canvas.width, canvas.height);
  c.fillStyle = C.bg;
  c.fillRect(0, 0, canvas.width, canvas.height);
  drawTower(c, type, level || 0, canvas.width / 2, canvas.height / 2, px * 0.8, 0);
}

export function drawEnemyIcon(type, canvas, px) {
  const c = canvas.getContext('2d');
  c.clearRect(0, 0, canvas.width, canvas.height);
  c.fillStyle = C.bg;
  c.fillRect(0, 0, canvas.width, canvas.height);
  drawEnemy(c, type, canvas.width / 2, canvas.height / 2, px * 0.35, 0, 1);
}
