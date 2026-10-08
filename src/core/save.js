// save.js — localStorage persistence, never throws.
import { CONFIG } from './config.js';

const DEFAULTS = { bestScore: 0, unlockedWave: 1, muted: false, sfxVol: 0.8, musicVol: 0.6 };

function storage() {
  try { return globalThis.localStorage; } catch { return null; }
}

export const save = {
  load() {
    let out = { ...DEFAULTS };
    const ls = storage();
    if (ls) {
      try {
        const raw = ls.getItem(CONFIG.SAVE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed === 'object') {
            for (const k of Object.keys(DEFAULTS)) {
              if (k in parsed) out[k] = parsed[k];
            }
          }
        }
      } catch { /* corrupt save -> defaults */ }
    }
    return out;
  },
  persist(partial) {
    const merged = { ...this.load(), ...(partial || {}) };
    const ls = storage();
    if (ls) {
      try { ls.setItem(CONFIG.SAVE_KEY, JSON.stringify(merged)); } catch { /* full/blocked */ }
    }
    return merged;
  }
};
