// hud.js — binds HUD buttons, builds the dock, panel, toasts, overlays.
import { CONFIG } from '../core/config.js';
import { TOWER_TYPES } from '../entities/towers.js';
import { drawTowerIcon } from '../art/sprites.js';

export function bindHud(api) {
  // api = { getSim(), buyAt, upgradeAt, sellAt, setSpeed, togglePause, startWaveNow,
  //         selectAt, deselect, setSelectedType, getState, onMenuStart, onAgain }
  const $ = (id) => document.getElementById(id);
  const hudGold = $('hud-gold'), hudLives = $('hud-lives'), hudWave = $('hud-wave');
  const btnNext = $('btn-next'), btnSpeed = $('btn-speed'), btnPause = $('btn-pause');
  const dock = $('dock'), panel = $('panel');
  const panelTitle = $('panel-title'), panelStats = $('panel-stats');
  const btnBuy = $('btn-buy'), btnUpgrade = $('btn-upgrade'), btnSell = $('btn-sell');
  const overlay = $('overlay'), overlayTitle = $('overlay-title'), overlaySub = $('overlay-sub');
  const btnStart = $('btn-start'), btnAgain = $('btn-again');
  const toast = $('toast');

  let toastTimer = null;
  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2000);
  }

  // Dock: 5 tower buttons with icon + cost.
  const dockBtns = {};
  for (const key of Object.keys(TOWER_TYPES)) {
    const def = TOWER_TYPES[key];
    const btn = document.createElement('button');
    btn.className = 'dock-btn' + (key === 'arrow' ? ' selected' : '');
    btn.dataset.type = key;
    const cv = document.createElement('canvas');
    cv.width = 40; cv.height = 40;
    drawTowerIcon(key, 0, cv, 36);
    btn.appendChild(cv);
    const cost = document.createElement('span');
    cost.className = 'dock-cost';
    cost.textContent = def.cost;
    btn.appendChild(cost);
    btn.addEventListener('click', () => {
      for (const k in dockBtns) dockBtns[k].classList.remove('selected');
      btn.classList.add('selected');
      api.setSelectedType && api.setSelectedType(key);
      api.deselect && api.deselect();
    });
    dock.appendChild(btn);
    dockBtns[key] = btn;
  }

  function syncDockAffordability() {
    const gold = api.getSim().state.gold;
    for (const key in dockBtns) {
      dockBtns[key].classList.toggle('disabled', gold < TOWER_TYPES[key].cost);
    }
  }

  // Buttons.
  btnNext.addEventListener('click', () => { api.startWaveNow(); });
  btnSpeed.addEventListener('click', () => {
    const s = api.getSim().state.speed;
    api.setSpeed(s === 1 ? 2 : 1);
  });
  btnPause.addEventListener('click', () => { api.togglePause(); });

  btnBuy.addEventListener('click', () => {
    const sel = api.getSelected();
    if (!sel) return;
    const res = api.buyAt(api.getSelectedType ? api.getSelectedType() : 'arrow', sel.col, sel.row);
    if (res && !res.ok) showToast(reasonMsg(res.reason));
  });
  btnUpgrade.addEventListener('click', () => {
    const sel = api.getSelected();
    if (!sel) return;
    const res = api.upgradeAt(sel.col, sel.row);
    if (res && !res.ok) showToast(reasonMsg(res.reason));
  });
  btnSell.addEventListener('click', () => {
    const sel = api.getSelected();
    if (!sel) return;
    const res = api.sellAt(sel.col, sel.row);
    if (res && res.ok) { api.deselect && api.deselect(); showToast(`Sold +${res.refund}`); }
  });

  btnStart.addEventListener('click', () => { api.onMenuStart && api.onMenuStart(); });
  btnAgain.addEventListener('click', () => { api.onAgain && api.onAgain(); });

  function reasonMsg(r) {
    return { gold: 'Not enough gold', occupied: 'Cell occupied', path: 'Cannot build on path', oob: 'Out of bounds', max: 'Max level', notfound: 'No tower there' }[r] || r;
  }

  function syncPanel() {
    const sel = api.getSelected();
    if (!sel) {
      panel.classList.remove('visible');
      return;
    }
    const sim = api.getSim();
    const t = sim.towers.find(tw => tw.col === sel.col && tw.row === sel.row && !tw.dead);
    if (!t) { panel.classList.remove('visible'); return; }
    const def = TOWER_TYPES[t.type];
    const lvl = def.levels[t.level];
    panel.classList.add('visible');
    panelTitle.textContent = `${def.name} L${t.level + 1}`;
    const next = def.levels[t.level + 1];
    const refund = Math.round(CONFIG.SELL_REFUND * t.invested);
    let stats = '';
    if (lvl.dmg) stats += `DMG ${Math.round(lvl.dmg)}  `;
    if (lvl.rate) stats += `RATE ${lvl.rate}/s  `;
    if (lvl.range) stats += `RNG ${lvl.range}  `;
    if (lvl.splash) stats += `SPLASH ${lvl.splash}  `;
    if (lvl.slow) stats += `SLOW ${Math.round(lvl.slow * 100)}%  `;
    if (lvl.aura) stats += `AURA +${Math.round(lvl.aura * 100)}%  `;
    if (lvl.goldTick) stats += `GOLD +${lvl.goldTick}/${lvl.goldEvery}s`;
    panelStats.textContent = stats.trim();
    btnUpgrade.textContent = next ? `UPGRADE ${next.cost}` : 'MAX';
    btnUpgrade.disabled = !next || sim.state.gold < next.cost;
    btnSell.textContent = `SELL +${refund}`;
    btnBuy.style.display = 'none';
  }

  function syncOverlay() {
    const state = api.getState();
    if (state.screen === 'menu') {
      overlay.classList.add('visible');
      overlayTitle.textContent = 'TD GWEN';
      overlaySub.textContent = `Best score: ${state.bestScore || 0}`;
      btnStart.style.display = '';
      btnAgain.style.display = 'none';
    } else if (state.screen === 'gameover') {
      overlay.classList.add('visible');
      overlayTitle.textContent = 'GAME OVER';
      overlaySub.textContent = `Wave ${state.waveLost} · Score ${state.score} · Best ${state.bestScore}`;
      btnStart.style.display = 'none';
      btnAgain.style.display = '';
    } else if (state.screen === 'victory') {
      overlay.classList.add('visible');
      overlayTitle.textContent = 'VICTORY';
      overlaySub.textContent = `Score ${state.score} · Best ${state.bestScore}`;
      btnStart.style.display = 'none';
      btnAgain.style.display = '';
    } else {
      overlay.classList.remove('visible');
    }
  }

  function sync() {
    const sim = api.getSim();
    hudGold.textContent = String(sim.state.gold);
    hudLives.textContent = String(sim.state.lives);
    hudWave.textContent = String(sim.state.wave);
    btnSpeed.textContent = 'x' + sim.state.speed;
    btnPause.textContent = sim.paused ? '▶' : 'II';
    syncDockAffordability();
    syncPanel();
    syncOverlay();
  }

  return { sync, showToast };
}
