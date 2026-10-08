# TD Gwen — Integration Results (1008-1142)

Branch: `integration/1008-1142` (all 6 contributor branches merged: art, ui, audio, pwa, towers, waves).
This sheet records the re-verification, the 15 browser screenshots, the visual-polish fixes, and known issues.

## 1. Test results (verbatim)

### `node --test tests/`
```
# tests 39
# pass 39
# fail 0
# cancelled 0
# skipped 0
# todo 0
```

### `node tests/simulation.js`  (exit 0)
```json
{
  "strategies": {
    "A": { "win": true,  "waveReached": 15, "livesLeft": 10, "goldLeft": 2393 },
    "B": { "win": false, "waveReached": 9,  "livesLeft": 0,  "goldLeft": 1321 },
    "C": { "win": true,  "waveReached": 15, "livesLeft": 10, "goldLeft": 2436 }
  },
  "wave15": { "winnable": true, "trivial": false }
}
```
Gate satisfied: A wins W15 **and** `trivial=false`. (Run once.)

### `node tools/debug-kill.js`  (exit 0)
```
{"type":"kill","x":120,"y":142.64,"gold":8}
--- final ---
{"kills":1,"gold":198,"goldDelta":-62,"phase":"build"}
```
`kills == 1` as expected.

### `python3 tools/offline-test.py`
```
=== offline-test ===
HUD visible offline: True
hud-wave after start (offline): 1
screenshot: /tmp/pwa-offline.png
RESULT: PASS
```

## 2. Browser screenshots (15)

Shot with headless Chromium (Playwright), fresh context per scenario, served over local HTTP.
Sizes: S1 = 390×844 (phone portrait), S2 = 844×390 (phone landscape), S3 = 1400×900 (desktop).
Every shot captured **zero** console errors, zero page errors, and zero HTTP ≥400 responses.

| File | Moment | What was verified visually |
|------|--------|----------------------------|
| M1_S1 | menu | Start overlay ("TD GWEN" + START) fills viewport; board dimmed behind. |
| M1_S2 | menu | Same overlay in landscape; top bar + dock fit without clipping. |
| M1_S3 | menu | Desktop overlay; bright cyan path legible on the full-size board. |
| M2_S1 | wave-start | Wave-1 combat; HUD (top) + dock (bottom) both present; 3 towers placed; path glow now clearly neon at phone scale. |
| M2_S2 | wave-start | Landscape combat; dock centered, nothing clipped. |
| M2_S3 | wave-start | Desktop combat; towers/enemies/projectiles crisp. |
| M3_S1 | wave-busy | Many enemies + HP bars visible above them at phone scale (green fill measured ~175px vs enemy bodies ~96px). |
| M3_S2 | wave-busy | Landscape busy scene; no clipping. |
| M3_S3 | wave-busy | Desktop busy scene; distinct sprite count high (many colors). |
| M4_S1 | boss | Boss present (20 enemies on screen); its HP bar visible at phone scale (green fill ~1115px). |
| M4_S2 | boss | Landscape boss scene. |
| M4_S3 | boss | Desktop boss scene; highest distinct-color count of all shots (densest frame). |
| M5_S1 | game-over | GAME OVER overlay: "You lost on wave 11 / Score 11319 · Best 11319". |
| M5_S2 | game-over | Landscape game-over overlay. |
| M5_S3 | game-over | Desktop game-over overlay. |

PIL fallback metrics (single pass over all 15, post-fix) confirm the same:
- Cyan path-glow pixels on S1 rose from a pre-fix baseline (~490) to ~1790–1800 on M2/M3/M4 (≈3.6× brighter) — the faint-wireframe issue is fixed.
- HUD strip (top 12%) non-background ≈ 900 px and dock strip (bottom 15%) bright ≈ 950 px on every playing shot (M2–M4); M1/M5 correctly show the overlay instead.
- No large black band in the middle third of any shot → board never clipped/empty.
- Dock bottom margin: S1 = 7px, S2 = 5px → dock fully inside the viewport (not clipped).

## 3. Fixes made (visual polish)

All four target the phone-portrait scale, where the 624×432 logical grid is letterboxed into ~270px height so thin logical strokes render <1px.

1. **Path too faint** — `src/render/renderer.js`: draw the route as a wide translucent halo pass (`rgba(55,230,255,.22)`, 10px) underneath a bright `#37e6ff` core (4px). No `ctx.filter`/blur. Keeps the neon look while staying legible when letterboxed small.
2. **Tower sprites small/low-contrast** — `src/art/sprites.js`: base plate enlarged to ~0.92·cell (was ~0.86) with a stronger border; primary glyph neon strokes bumped +1px (arrow/cannon/frost/support/sniper). Neon style preserved, no fill-in.
3. **Dock dim at the bottom** — `css/style.css` + `src/art/sprites.js`: `.dock-cost` raised to 12px `#ffd166` with a dark text-shadow for contrast; dock icon canvases get a subtle box-shadow and are drawn at a larger cell (0.95·px) on a slightly brighter backdrop so the glyph fills the button. Dock row confirmed fully inside the viewport via safe-area padding.
4. **HP bars not clearly visible on phone** — `src/render/renderer.js`: enemy HP bar raised to 6px logical (was 4) with an `rgba(0,0,0,.6)` background track and `#4dff9c` fill, so it stays ~3px at phone scale. Verified present in M3_S1/M4_S1.

No balance changes were made; `node tests/simulation.js` output is byte-identical before/after the edits.

## 4. Remaining known issues

- **Test-harness quirk (not a game bug):** `__test.fastForward()` does not clear the module-level `menuOpen` flag in `src/main.js`, so the start overlay stays up until `#btn-start` is clicked. The screenshot harness clicks `#btn-start` first for M2–M5. If you drive scenes purely through `__test.fastForward` in your own tooling, click start (or set the flag) or the overlay will cover the board.
- **Phone portrait is inherently low-detail:** even after the fixes, the board occupies only ~270px of the 844px-tall viewport, so fine detail (individual projectile trails, small frost slow rings) reads softer than on desktop. This is a consequence of fitting a 13×9 grid into a narrow column, not a rendering defect; landscape (S2) and desktop (S3) are clean.
- Everything else (menu, HUD, dock, path, towers, enemies, HP bars, boss, game-over/victory overlays) renders correctly with zero console/page/network errors across all three viewports.

## M3 re-shot (paused at peak)
M3_S1/S2/S3 were re-captured as a PAUSED busy scene: after fastForward(5) + setSpeed(2), polled getEnemies() every 500ms and called togglePause() the instant on-screen count peaked at 8 enemies. The paused frame shows multiple wave-5 enemies (shield/tank/grunt) with visible #4dff9c HP bars at phone scale — confirming the busy moment and HP-bar legibility.
