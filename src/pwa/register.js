// register.js — service worker registration (try/catch, no-op on failure).
export function registerSW() {
  try {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    }
  } catch { /* unsupported */ }
}
