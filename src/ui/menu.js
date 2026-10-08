// menu.js — overlay states: menu / game over / victory.
// Owns the #overlay DOM; main.js drives it by calling sync() each frame with
// a state from api.getState().
export function bindMenu(api) {
  // api = { getState?, onMenuStart, onAgain } — main.js currently passes only the
  // callbacks; when getState is available it drives overlay re-renders per frame.
  const $ = (id) => document.getElementById(id);
  const overlay = $('overlay');
  const title = $('overlay-title');
  const sub = $('overlay-sub');
  const hint = $('overlay-hint');
  const btnStart = $('btn-start');
  const btnAgain = $('btn-again');

  function render(screen, s) {
    if (screen === 'menu') {
      title.textContent = 'TD GWEN';
      sub.textContent = 'Tower Defense' + (s.bestScore > 0 ? `\nBest score ${s.bestScore}` : '');
      sub.style.whiteSpace = 'pre-line';
      if (hint) hint.style.display = '';
      btnStart.style.display = '';
      btnStart.textContent = 'START';
      btnAgain.style.display = 'none';
    } else if (screen === 'gameover') {
      title.textContent = 'GAME OVER';
      sub.textContent = `You lost on wave ${s.waveLost}\nScore ${s.score} \u00b7 Best ${Math.max(s.bestScore, s.score)}`;
      sub.style.whiteSpace = 'pre-line';
      if (hint) hint.style.display = 'none';
      btnStart.style.display = 'none';
      btnAgain.style.display = '';
      btnAgain.textContent = 'RETRY';
    } else if (screen === 'victory') {
      title.textContent = 'VICTORY';
      sub.textContent = `WAVE 15 CLEARED\nScore ${s.score} \u00b7 Best ${Math.max(s.bestScore, s.score)}`;
      sub.style.whiteSpace = 'pre-line';
      if (hint) hint.style.display = 'none';
      btnStart.style.display = 'none';
      btnAgain.style.display = '';
      btnAgain.textContent = 'PLAY AGAIN';
    } else {
      overlay.classList.remove('visible');
      return;
    }
    overlay.classList.add('visible');
  }

  // Initial paint: the start screen is always 'menu' at boot.
  let lastScreen = null;
  function sync(screenOverride) {
    const s = (screenOverride != null)
      ? { screen: screenOverride, bestScore: 0, score: 0, waveLost: 0 }
      : (api.getState ? api.getState() : null);
    if (!s || s.screen === lastScreen) return;
    render(s.screen, s);
    lastScreen = s.screen;
  }
  sync('menu');

  btnStart.addEventListener('click', () => {
    api.onMenuStart && api.onMenuStart();
    sync('playing');
  });
  btnAgain.addEventListener('click', () => {
    api.onAgain && api.onAgain();
    sync('playing');
  });

  return { sync, render };
}
