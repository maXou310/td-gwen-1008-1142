# TD Gwen — neon tower-defense PWA

TD Gwen is a neon-styled tower defense that runs entirely in the browser as a
progressive web app. Survive **15 waves** of six enemy types (grunt, runner,
tank, flyer, shield and a boss on wave 15) by placing and upgrading five tower
types (arrow, cannon, frost, support, sniper), each with three levels. No
build step, no runtime network: after the first load the game works fully
offline and can be installed to your home screen like a native app.

## Run

Zero build — any static file server works:

```sh
python3 -m http.server 8080
```

Then open <http://localhost:8080>.

## Install as PWA

- **Desktop Chrome / Edge:** click the install icon in the address bar.
- **Android Chrome:** menu → *Add to Home screen*.
- **iOS Safari:** Share → *Add to Home Screen*.

The app works fully offline after the first load (service worker caches the
whole app shell; maskable icons are provided for all platforms).

## Controls

Mouse or touch.

- Tap a dock button to select a tower type, then tap a free cell to build it.
- Tap a placed tower to select it — the side panel offers **upgrade** and
  **sell**.
- The **WAVE** button starts the next wave early (bonus gold for the remaining
  build time).
- **x1/x2** toggles game speed; **II** pauses.
- Best score and progression (unlocked wave, audio settings) are saved locally
  in your browser.

## Architecture

Pure static ES modules + canvas 2D rendering. No bundler, no framework, zero
runtime network requests. Node is used only for tests.

| Directory | Contents |
| --- | --- |
| `src/core/` | config (`CONFIG`) and local save |
| `src/sim/` | deterministic game engine (state, towers, waves, events) |
| `src/entities/` | towers, enemies, waves, projectiles, particles |
| `src/path/` | enemy pathfinding over the grid |
| `src/ui/` | HUD, input handling, menu overlays |
| `src/art/` | code-generated canvas sprites (no image assets) |
| `src/audio/` | WebAudio-synthesized sound effects and music |
| `src/render/` | canvas 2D renderer |
| `src/pwa/` | service worker registration |
| `sw.js` | service worker (app-shell caching, offline reload) |
| `manifest.json` | PWA manifest (incl. maskable icons) |

Tests:

```sh
bash tests/run.sh
```

runs `node --test tests/` (unit + static PWA checks) and
`node tests/simulation.js` — a balance simulation proving wave 15 is winnable
but not trivial. Browser-level verification uses python3 Playwright (see
`tests/pwa.test.js` for the static PWA checks).

## Credits

See [CREDITS.md](CREDITS.md).
