// register.js — service worker registration (production only, try/catch).
export function registerSW() {
  // No SW on file:// or non-secure contexts; just skip silently.
  if (location.protocol === 'file:') return;
  try {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('./sw.js').then(() => {
        console.info('[pwa] SW registered');
      }).catch((err) => {
        console.info('[pwa] SW unavailable', err);
      });
    } else {
      console.info('[pwa] SW unavailable');
    }
  } catch (err) {
    console.info('[pwa] SW unavailable', err);
  }
}
