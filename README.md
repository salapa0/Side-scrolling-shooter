# Side-scrolling shooter

A browser side-scrolling shooter (TypeScript + WebGL2, no runtime dependencies) built for a university festival booth.

## Develop

```
npm install
npm run dev      # dev server at http://localhost:5173
npm test         # Vitest
npm run build    # type-checks, then writes dist/index.html
```

On Git Bash, run the tests from a `C:/...` path (not `/c/...`), or use PowerShell. Otherwise every suite fails with "failed to find the current suite".

## Booth procedure

1. Run `npm run build`.
2. Copy the single file `dist/index.html` to the booth PC (a USB stick is fine; it needs no network).
3. Double-click it to open it in Chrome or Edge, then press **F11** for full screen.

The game needs WebGL2, so keep browser hardware acceleration on.

## Checking performance

- **F3** (or the backtick key) toggles the FPS overlay: FPS, average and worst frame time, simulation steps, and quads drawn.
- Add `?stress` to the URL (for the built file: `file:///.../index.html?stress`) for the worst case. Each round starts with the boss in phase 3, the player invulnerable, and the overlay on. Player damage is zero, so the boss stays in phase 3. This measures sustained phase 3 as currently tuned, the busiest the real game gets (about 25-35 drones and ~240 quads on screen), not the pool caps. Stress mode cannot be won; it runs until the timer ends.

## Backup: GitHub Pages

If the booth PC cannot run the file, publish the contents of the built `dist/` folder (just `index.html`) to GitHub Pages and open that URL instead.

## License

Apache License 2.0. See [LICENSE](LICENSE).
