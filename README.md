# RAIJIN · 작전명, 뇌신

A touch-first vertical arcade shooter inspired by classic military shoot-em-ups. Original aircraft, art, enemy patterns, and music. One complete coastal stage culminating in **Iron Wing**, a three-phase aerial fortress.

**Play:** https://rockyhong-a11y.github.io/raijin-strike/

## Controls

| Action | Touch / mouse | Keyboard |
|---|---|---|
| Move | Press and drag anywhere in the flight feed | Arrows / WASD |
| Fire | Automatic | Automatic |
| Bomb | Tap with a second finger while dragging | Space |
| Pause | Pause button | P / Escape |

Drag is relative: touching the screen never teleports the aircraft beneath your finger. The small bright center on your plane is its collision point. Collect **P** for upgrades, **B** for bombs, and medals for points. Near misses earn graze points. Three lives, a respawn shield, and local high scores. Sound can be muted before launch. The game pauses when the tab loses focus and honors reduced-motion preferences.

## Run locally

Requires Node.js 24. No install or third-party JavaScript dependencies.

```sh
npm run dev
npm test
npm run build
```

Open `http://localhost:5173`. `dist/` is a static site and works under a subdirectory. The GitHub Actions workflow checks the game and publishes GitHub Pages on every push to `main`.

## Artwork

- **Blender 5.2**: five original aircraft / armor models and transparent pre-rendered sprites. Reproducible script and editable `.blend` files in `tools/`.
- **Higgsfield Nano Banana 2**: coastal terrain and cinematic launch cover in `assets/`. Generation references are recorded in `assets/CREDITS.md`.
- **Barlow Condensed**: locally served typeface, SIL Open Font License included.
- **Web Audio**: synthesized percussion, bass, arpeggios, boss music, and combat effects. No external audio files or runtime services.

Render the sprites again:

```sh
/Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python tools/render-assets.py
```

Simulation is separate from the Canvas renderer, uses a fixed 60 Hz step and seeded enemy patterns, and is tested through the complete final encounter. Add `?debug` for a read-only `window.raijin.snapshot()` diagnostic. Scores and sound settings persist only on the player's device. No accounts, telemetry, or backend.

This is an original homage, with no assets, soundtrack, branding, or level data from the Raiden series.
