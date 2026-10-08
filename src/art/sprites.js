// sprites.js — placeholder implementations (art-owned; same signatures).
// All drawing is code-generated canvas 2D, no external assets.

export function drawBackground(c, w, h) {
  c.fillStyle = '#0b0e22';
  c.fillRect(0, 0, w, h);
}

export function drawTower(c, type, level, x, y, cell, t) {
  const r = cell * 0.36;
  c.save();
  c.translate(x, y);
  switch (type) {
    case 'arrow': {
      c.fillStyle = '#4dff9c';
      c.beginPath();
      c.moveTo(0, -r); c.lineTo(r * 0.8, r * 0.7); c.lineTo(-r * 0.8, r * 0.7);
      c.closePath(); c.fill();
      break;
    }
    case 'cannon': {
      c.fillStyle = '#ffb347';
      hexPath(c, r); c.fill();
      break;
    }
    case 'frost': {
      c.strokeStyle = '#7fd4ff'; c.lineWidth = 3;
      c.beginPath(); c.arc(0, 0, r * 0.8, 0, Math.PI * 2); c.stroke();
      break;
    }
    case 'support': {
      c.strokeStyle = '#ffd166'; c.lineWidth = 2;
      c.beginPath(); c.arc(0, 0, r * 0.85, 0, Math.PI * 2); c.stroke();
      c.beginPath(); c.arc(0, 0, r * 0.45, 0, Math.PI * 2); c.stroke();
      c.fillStyle = '#ffd166';
      c.beginPath(); c.arc(0, 0, r * 0.2, 0, Math.PI * 2); c.fill();
      break;
    }
    case 'sniper': {
      c.fillStyle = '#c77dff';
      c.beginPath();
      c.moveTo(0, -r * 1.2); c.lineTo(r * 0.5, 0); c.lineTo(0, r * 1.2); c.lineTo(-r * 0.5, 0);
      c.closePath(); c.fill();
      break;
    }
  }
  // Level pips: L1 -> 1 pip, L2 -> 2 pips orbiting.
  for (let i = 0; i < level; i++) {
    const a = t * 1.5 + (i * Math.PI * 2) / Math.max(1, level);
    c.fillStyle = '#ffffff';
    c.beginPath();
    c.arc(Math.cos(a) * r * 1.15, Math.sin(a) * r * 1.15, 2.5, 0, Math.PI * 2);
    c.fill();
  }
  c.restore();
}

export function drawEnemy(c, type, x, y, rPx, t, hpFrac) {
  c.save();
  c.translate(x, y);
  if (type !== 'flyer') {
    // soft radial shadow (no ctx.filter/blur)
    const g = c.createRadialGradient(0, rPx * 0.7, 0, 0, rPx * 0.7, rPx);
    g.addColorStop(0, 'rgba(0,0,0,.35)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g;
    c.beginPath(); c.arc(0, rPx * 0.7, rPx, 0, Math.PI * 2); c.fill();
  }
  switch (type) {
    case 'grunt':
      c.fillStyle = '#ff6b6b';
      c.beginPath(); c.arc(0, 0, rPx, 0, Math.PI * 2); c.fill();
      break;
    case 'runner':
      c.fillStyle = '#ffd166';
      c.beginPath();
      c.moveTo(rPx, 0); c.lineTo(-rPx * 0.8, rPx * 0.6); c.lineTo(-rPx * 0.4, 0); c.lineTo(-rPx * 0.8, -rPx * 0.6);
      c.closePath(); c.fill();
      break;
    case 'tank':
      c.fillStyle = '#8d99ae';
      octPath(c, rPx); c.fill();
      break;
    case 'flyer':
      c.fillStyle = '#ff9ff3';
      c.beginPath();
      c.moveTo(0, -rPx); c.lineTo(rPx, rPx * 0.8); c.lineTo(-rPx, rPx * 0.8);
      c.closePath(); c.fill();
      break;
    case 'shield':
      c.fillStyle = '#54a0ff';
      hexPath(c, rPx); c.fill();
      c.fillStyle = 'rgba(255,255,255,.5)';
      c.fillRect(-rPx * 0.5, -rPx * 0.15, rPx, rPx * 0.3);
      break;
    case 'boss':
      c.fillStyle = '#f368e0';
      c.beginPath(); c.arc(0, 0, rPx * 0.7, 0, Math.PI * 2); c.fill();
      c.strokeStyle = '#f368e0'; c.lineWidth = 3;
      c.beginPath(); c.arc(0, 0, rPx, t, t + Math.PI * 1.5); c.stroke();
      break;
  }
  c.restore();
}

export function drawProjectile(c, type, x, y, angle) {
  c.save();
  c.translate(x, y);
  c.rotate(angle);
  c.globalCompositeOperation = 'lighter';
  const colors = { arrow: '#4dff9c', cannon: '#ffb347', frost: '#7fd4ff', sniper: '#c77dff' };
  const col = colors[type] || '#ffffff';
  c.fillStyle = col;
  c.beginPath(); c.arc(0, 0, 3, 0, Math.PI * 2); c.fill();
  c.fillStyle = 'rgba(255,255,255,.8)';
  c.beginPath(); c.arc(0, 0, 1.5, 0, Math.PI * 2); c.fill();
  c.globalCompositeOperation = 'source-over';
  c.restore();
}

export function drawTowerIcon(type, level, canvas, px) {
  const c = canvas.getContext('2d');
  c.clearRect(0, 0, canvas.width, canvas.height);
  c.fillStyle = '#0b0e22';
  c.fillRect(0, 0, canvas.width, canvas.height);
  drawTower(c, type, level || 0, canvas.width / 2, canvas.height / 2, px * 0.9, 0);
}

export function drawEnemyIcon(type, canvas, px) {
  const c = canvas.getContext('2d');
  c.clearRect(0, 0, canvas.width, canvas.height);
  drawEnemy(c, type, canvas.width / 2, canvas.height / 2, px * 0.35, 0, 1);
}

function hexPath(c, r) {
  c.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 6;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
  }
  c.closePath();
}

function octPath(c, r) {
  c.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (Math.PI / 4) * i;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    if (i === 0) c.moveTo(x, y); else c.lineTo(x, y);
  }
  c.closePath();
}
