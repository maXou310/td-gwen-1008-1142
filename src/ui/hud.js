// hud.js — HUD numbers, dock (5 tower buttons), selected-tower panel, toasts.
// Pure helpers (formatPanelStats / dockButtonState) are exported for node tests.
import { CONFIG } from '../core/config.js';
import { TOWER_TYPES } from '../entities/towers.js';
import { drawTowerIcon } from '../art/sprites.js';

const REASON_MSG = {
  gold: 'Not enough gold',
  occupied: 'Cell occupied',
  path: "Can't build there",
  oob: "Can't build there",
  max: 'Max level',
  notfound: 'No tower there'
};

/** Map an engine failure reason to a toast string. */
export function reasonMsg(reason) {
  return REASON_MSG[reason] || String(reason);
}

/**
 * Dock button state for one tower type given current gold.
 * @returns {{affordable:boolean, disabled:boolean, cost:number}}
 */
export function dockButtonState(gold, type) {
  const def = TOWER_TYPES[type];
  const affordable = gold >= def.cost;
  return { affordable, disabled: !affordable, cost: def.cost };
}

/**
 * One-line stat string for the selected-tower panel.
 * @param {object} tower sim tower ({type, level, invested})
 * @returns {string} e.g. "DMG 22 · RNG 2.9 · RATE 1.3/s" or support "AURA +25% · GOLD +4/4s"
 */
export function formatPanelStats(tower) {
  const def = TOWER_TYPES[tower.type];
  if (!def) return '';
  const lvl = def.levels[Math.min(tower.level, def.levels.length - 1)];
  const parts = [];
  if (lvl.dmg != null) parts.push(`DMG ${Math.round(lvl.dmg)}`);
  if (lvl.range != null) parts.push(`RNG ${lvl.range}`);
  if (lvl.rate != null) parts.push(`RATE ${lvl.rate}/s`);
  if (lvl.splash != null) parts.push(`SPLASH ${lvl.splash}`);
  if (lvl.slow != null) parts.push(`SLOW ${Math.round(lvl.slow * 100)}%`);
  if (lvl.aura != null) parts.push(`AURA +${Math.round(lvl.aura * 100)}%`);
  if (lvl.goldTick != null) parts.push(`GOLD +${lvl.goldTick}/${lvl.goldEvery}s`);
  return parts.join(' \u00b7 ');
}

/** Sell refund for a tower (round(0.7 * invested)). */
export function sellRefund(tower) {
  return Math.round(CONFIG.SELL_REFUND * (tower.invested || 0));
}

export function bindHud(api) {
  // api = { getSim(), buyAt, upgradeAt, sellAt, setSpeed, togglePause, startWaveNow,
  //         selectAt, deselect, setSelectedType, getSelected, getSelectedType,
  //         getState, onMenuStart, onAgain }
  const $ = (id) => document.getElementById(id);
  const hudGold = $('hud-gold'), hudLives = $('hud-lives'), hudWave = $('hud-wave');
  const btnNext = $('btn-next'), btnSpeed = $('btn-speed'), btnPause = $('btn-pause');
  const dock = $('dock'), panel = $('panel');
  const panelTitle = $('panel-title'), panelStats = $('panel-stats');
  const btnBuy = $('btn-buy'), btnUpgrade = $('btn-upgrade'), btnSell = $('btn-sell');
  const toast = $('toast');

  let toastTimer = null;
  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2000);
  }

  // ---- Dock: 5 tower buttons (icon canvas via sprites.drawTowerIcon) --------
  const dockBtns = {};
  for (const key of Object.keys(TOWER_TYPES)) {
    const def = TOWER_TYPES[key];
    const btn = document.createElement('button');
    btn.className = 'dock-btn' + (key === 'arrow' ? ' selected' : '');
    btn.dataset.type = key;
    const cv = document.createElement('canvas');
    cv.width = 68; cv.height = 68; // 2x for crispness
    drawTowerIcon(key, 0, cv, 60);
    const name = document.createElement('span');
    name.className = 'dock-name';
    name.textContent = def.name;
    const cost = document.createElement('span');
    cost.className = 'dock-cost';
    cost.textContent = def.cost;
    btn.append(cv, name, cost);
    btn.addEventListener('click', () => {
      for (const k in dockBtns) dockBtns[k].classList.toggle('selected', k === key);
      if (api.setSelectedType) api.setSelectedType(key);
      if (api.deselect) api.deselect();
    });
    dock.appendChild(btn);
    dockBtns[key] = btn;
  }

  function syncDockAffordability() {
    const gold = api.getSim().state.gold;
    for (const key in dockBtns) {
      const st = dockButtonState(gold, key);
      dockBtns[key].classList.toggle('disabled', st.disabled);
    }
  }

  // ---- Control buttons -------------------------------------------------------
  btnNext.addEventListener('click', () => { api.startWaveNow && api.startWaveNow(); });
  btnSpeed.addEventListener('click', () => {
    const s = api.getSim().state.speed;
    api.setSpeed(s === 1 ? 2 : 1);
  });
  btnPause.addEventListener('click', () => { api.togglePause && api.togglePause(); });

  // ---- Panel actions -----------------------------------------------------------
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
    if (res && res.ok) {
      if (api.deselect) api.deselect();
      showToast(`Sold +${res.refund}`);
    } else if (res) {
      showToast(reasonMsg(res.reason));
    }
  });

  // ---- Panel -------------------------------------------------------------------
  function syncPanel() {
    const sel = api.getSelected();
    if (!sel) { panel.classList.remove('visible'); return; }
    const sim = api.getSim();
    const t = sim.towers.find(tw => tw.col === sel.col && tw.row === sel.row && !tw.dead);
    if (!t) { panel.classList.remove('visible'); return; }
    const def = TOWER_TYPES[t.type];
    const lvl = def.levels[t.level];
    panel.classList.add('visible');
    // Keep the panel off the selected tower on phone: left-half tower -> right side.
    panel.classList.toggle('side-right', sel.col < CONFIG.COLS / 2);
    panelTitle.textContent = `${def.name} LV${t.level + 1}`;
    panelStats.textContent = formatPanelStats(t);
    const next = def.levels[t.level + 1];
    btnUpgrade.textContent = next ? `UPGRADE ${next.cost}` : 'MAX';
    btnUpgrade.disabled = !next || sim.state.gold < next.cost;
    btnSell.textContent = `SELL +${sellRefund(t)}`;
    btnBuy.style.display = 'none';
  }

  // ---- Per-frame sync (affordability throttled to 200ms) ------------------------
  let lastAfford = 0;
  function sync(now) {
    const sim = api.getSim();
    hudGold.textContent = String(sim.state.gold);
    hudLives.textContent = String(sim.state.lives);
    hudWave.textContent = String(sim.state.wave);
    btnSpeed.textContent = 'x' + sim.state.speed;
    btnNext.disabled = sim.state.phase !== 'build';
    if (now - lastAfford > 200) {
      lastAfford = now;
      syncDockAffordability();
    }
    syncPanel();
  }

  return { sync, showToast };
}
