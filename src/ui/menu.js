// menu.js — menu / game-over / victory overlay state binding.
export function bindMenu(api) {
  // api = { getState(), onMenuStart, onAgain }
  // The HUD module owns the actual DOM; this is a thin helper that computes
  // the overlay screen from sim state and exposes it via api.getState().screen.
  return {
    computeScreen(sim, bestScore) {
      if (sim.state.phase === 'lost') return 'gameover';
      if (sim.state.phase === 'won') return 'victory';
      if (sim._menuOpen) return 'menu';
      return 'playing';
    }
  };
}
