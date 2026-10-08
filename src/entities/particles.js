// particles.js — pooled particle system (burst / ring / spark), additive draw.
const POOL_SIZE = 256;

export function createParticles() {
  const pool = new Array(POOL_SIZE);
  for (let i = 0; i < POOL_SIZE; i++) {
    pool[i] = {
      active: false, kind: 'spark', x: 0, y: 0, vx: 0, vy: 0,
      life: 0, maxLife: 0.4, size: 3, color: '#ffffff'
    };
  }
  let cursor = 0;

  function alloc() {
    for (let i = 0; i < POOL_SIZE; i++) {
      cursor = (cursor + 1) % POOL_SIZE;
      if (!pool[cursor].active) return pool[cursor];
    }
    return null; // pool exhausted -> drop
  }

  function burst(x, y, color, n = 8, speed = 90, life = 0.45) {
    for (let i = 0; i < n; i++) {
      const p = alloc();
      if (!p) break;
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.5 + Math.random() * 0.7);
      p.active = true; p.kind = 'burst';
      p.x = x; p.y = y;
      p.vx = Math.cos(a) * s; p.vy = Math.sin(a) * s;
      p.life = life * (0.7 + Math.random() * 0.3); p.maxLife = p.life;
      p.size = 2 + Math.random() * 2; p.color = color;
    }
  }

  function ring(x, y, color, size = 10, life = 0.5) {
    const p = alloc();
    if (!p) return;
    p.active = true; p.kind = 'ring';
    p.x = x; p.y = y; p.vx = 0; p.vy = 0;
    p.life = life; p.maxLife = life;
    p.size = size; p.color = color;
  }

  function spark(x, y, color, n = 4) {
    for (let i = 0; i < n; i++) {
      const p = alloc();
      if (!p) break;
      const a = Math.random() * Math.PI * 2;
      const s = 40 + Math.random() * 60;
      p.active = true; p.kind = 'spark';
      p.x = x; p.y = y;
      p.vx = Math.cos(a) * s; p.vy = Math.sin(a) * s - 30;
      p.life = 0.3 + Math.random() * 0.2; p.maxLife = p.life;
      p.size = 1.5; p.color = color;
    }
  }

  function update(sim, dt) {
    for (let i = 0; i < POOL_SIZE; i++) {
      const p = pool[i];
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) { p.active = false; continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === 'burst') { p.vx *= 0.92; p.vy *= 0.92; }
    }
  }

  // Read-only list of active particles for the renderer.
  function actives() {
    const out = [];
    for (let i = 0; i < POOL_SIZE; i++) if (pool[i].active) out.push(pool[i]);
    return out;
  }

  return { burst, ring, spark, update, actives, size: POOL_SIZE };
}
