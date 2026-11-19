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

## Dev console and checking performance

**F3** (or the backtick key) toggles the read-only dev console, bottom-right. It works on every screen, even while a start-screen field has focus. It refreshes four times a second with one line per section:

| Section | Shows |
|---|---|
| **PERFORMANCE** | FPS, average and worst frame time, simulation steps, quads drawn |
| **ROUND** | screen, round status, time left, time scale (below 1.00 during the E-ready slow-mo), kills |
| **PLAYER** | HP, position, invulnerability left, beam cooldown, fire rate, Rapid time left, hitbox size, close bonus (×1.00 at the back of the movement area up to ×1.50 at the front) |
| **STATS** | the entered Flat Attack, CD Reduction and Play Time; ATK, shot damage, beam AMP and beam damage |
| **BOSS** | stage (1–3), the current stage's HP and %, refill time left, position |
| **POOLS** | drones, bullets, enemy bullets, particles and power-ups in use, each against its cap |
| **TALLY** | the round log under the current balance version and boss HP (`TALLY v2 @6000`): rounds, wins, losses by time and by HP, win rate, and win rate per Flat Attack band (0 · 1–9 · 10–49 · 50+) |

### Tuning the win rate

The target is about 80% of walk-up players beating the boss.

Every finished round is saved in the browser's local storage, under the key `side-scroller.roundLog.v1`. Each saved round includes its stats, the total boss HP and the balance version it was played under. The log keeps the last 500 rounds, and stress-mode rounds are left out.

Each browser and each copy of the game keeps its own log. The GitHub Pages site and the copied `.html` file count separately, so read the win rate on the machine where people actually played. To export the log, open DevTools → Application → Local Storage.

The TALLY line only counts rounds that match the current `balanceVersion` and total boss HP (`boss.stageHp` × 3) in `src/config.ts`. Raise `balanceVersion` whenever a difficulty change doesn't alter boss HP, such as hearts, drop chance or damage scaling. Otherwise old and new rounds get mixed together.

Use the losses to pick the next change:
- mostly **time-outs**: lower `boss.stageHp`
- mostly **deaths**: give players more help surviving

**F4** pressed twice within 2 s, with the console open, clears the rounds the TALLY line is counting. Use it to drop staff test rounds. After the first press, the TALLY line shows "F4 again to clear N rounds". Rounds from other boss HP values or balance versions stay in the log. F4 does nothing while the console is closed.

### Stress mode

- Add `?stress` to the URL (for the built file: `file:///.../index.html?stress`) for the worst case. Each round starts with the boss in phase 3, the player invulnerable, and the dev console open. Player damage is zero, so the boss stays in phase 3. This measures sustained phase 3 as currently tuned, the busiest the real game gets (about 25-35 drones and ~240 quads on screen), not the pool caps. Stress mode cannot be won; it runs until the timer ends, and its rounds are not added to the round log.

## Backup: GitHub Pages

Every push to `main` runs the tests, builds the game, and publishes it to <https://salapa0.github.io/Side-scrolling-shooter/> (see `.github/workflows/pages.yml`). If the booth PC cannot run the file, or has no Node.js to build it, open that URL instead. `?stress` works there too.

## License

Apache License 2.0. See [LICENSE](LICENSE).
