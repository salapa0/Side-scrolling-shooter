# Side-Scrolling Shooter — Design Spec

Status: draft for approval · 2026-11-19

Items marked **[builder's call]** were not decided by the project owner; they are proposed defaults and can be changed freely.

## 1. Intent

A browser-based, horizontal side-scrolling shooter for a Computer Engineering festival. It is the **final game** in a series of festival games: players arrive with bonus stats earned earlier and use them in one last fight against the clock.

Gameplay is inspired by the mechanics of the classic genre (Space Impact-style: scrolling screen, auto-fire, dodging), with our own name, art, enemies, and look. We have full creative freedom.

**The feel we want:** chaotic and overwhelming — a screen full of drones and bullets — while still readable and fair enough that walk-up festival players get it within seconds.

## 2. Goals, non-goals, anti-goals

**Goals**
- A complete core loop: start screen → boss fight → results screen.
- Stats entered at the start visibly matter to the outcome.
- Runs smoothly (target 60 fps) on the festival workstation's integrated GPU.
- Runs fully offline from a single `.html` file.
- Built on our own engine (TypeScript + WebGL2, no game libraries), so the team can explain every part of it.
- Polished enough to show off what Computer Engineering students can build: GPU rendering, shader effects, and strong game feel.

**Non-goals (for now)**
- Leaderboard (planned later; keep the results data easy to export).
- Final art, final avatar design, sound/music.
- Balance tuning of base stats (later pass; all values live in one config file).
- Passing data to another game (this is the last game in the series).

**Anti-goals — failure even if it technically works**
- Frame drops when the screen gets busy.
- Controls a walk-up player can't figure out in a few seconds.
- A fight that can't be won, or is won before it gets interesting.
- Anything that needs an install, an exe, internet, or admin rights at the venue.

## 3. Constraints

- **Frontend only.** No server, no backend.
- **Hardware:** 16 GB office workstation with an **integrated GPU** (runs Valorant at 60 fps on low settings), full-size office keyboard. iGPUs share system RAM and are limited by fill rate, so full-screen effects must stay cheap.
- **Timeline:** about six weeks. The playable core should come early; most of the time goes to tuning, playtesting, polish, and testing on the real machine.
- **Deployment:**
  - *Primary:* the build produces one self-contained `.html` file (code and assets inlined). Copied via OneDrive, double-clicked, opened in the browser, F11 for fullscreen.
  - *Backup:* GitHub Pages. The repo will be made public before the festival (owner approved).

## 4. Approaches considered

| Approach | Trade-off | Decision |
|---|---|---|
| **A. TypeScript + WebGL2, own engine, built with Vite** | We write loop, input, collision, a batched GPU sprite renderer, shaders, and particles ourselves. Handles thousands of objects at 60 fps; full control of feel; type-checked. Costs ~1–2 extra days up front for the renderer. | **Chosen** (owner approved 2026-11-19). Best quality ceiling, offloads drawing to the iGPU, and gives the strongest "we built the engine" story. |
| A2. TypeScript + Canvas 2D, own engine | Simpler renderer, but drawing is CPU-heavy and struggles past a few hundred sprites; no shaders. | Rejected: caps the chaos and the visual polish. |
| B. Phaser framework | Faster to features, but ~1 MB engine, learning its conventions, and the core engine isn't ours. | Rejected. |
| C. Plain JavaScript, no build | No tooling, but no type safety in a stat-heavy game, and still needs a server or bundling to run from a file. | Rejected. |
| Exe wrapper (Electron/Tauri) | Electron adds ~100 MB and memory pressure; Tauri needs a Rust toolchain; office PCs may block unknown exes. | Rejected in favor of single-file `.html`. |

## 5. Game flow

### 5.1 Start screen
The player enters three bonus stats. Entry is supervised by festival staff, so the game trusts the values; input limits exist only to catch typos (e.g. an extra zero), not to prevent cheating.

| Field | Meaning | Input rules **[builder's call]** |
|---|---|---|
| **Flat Attack** | Added to base ATK | Whole number, 0–999. Default 0. |
| **CD Reduction (%)** | Percentage reduction of the special skill cooldown, earned in the main event | 0–80 (capped so the skill can't be spammed). Default 0. |
| **Play Time** | Length of the round | Seconds, 30–300. Default 120. |

Invalid input is clamped or rejected with a short inline message; the Start button never starts a round with bad values. Pressing **Start** (or Enter) begins the round.

The start screen also has an **Effects quality** setting (High / Low / Off, default High) so staff can turn down shader effects if the venue machine struggles. The choice is remembered between rounds.

The start screen also shows a short controls hint (WASD to move, E for special, firing is automatic) so walk-up players can start without explanation **[builder's call]**.

### 5.2 The round — one boss fight against the clock
There is **one enemy: the boss.** It is on screen from the first second. Its drones are the source of chaos and kills.

Since cycle 2, the boss has **three stages of 2,000 HP each**, one per phase, each with its own bar (`docs/superpowers/specs/2026-11-19-cycle-2-design.md`):
- When a stage's bar empties, the next bar refills over 1 s. During the refill the boss can't be damaged and doesn't attack.
- Leftover damage is lost.
- The fight is won when the stage 3 bar empties.

| Stage | Boss HP | Behavior |
|---|---|---|
| 1 | 2,000 | Boss holds at the right edge, launches waves of drones. |
| 2 | 2,000 | Boss advances, fires bullet patterns, keeps launching drones. |
| 3 | 2,000 | Desperate: faster patterns, denser drones — the most overwhelming part. |

- **Drones** fly toward / across the player's area, fire simple shots, and damage the player on contact. Each destroyed drone adds 1 to the **kill count**.
- Drones keep spawning until the boss dies or the round ends.

### 5.3 Win and lose
- **Win:** boss HP reaches 0 before the timer ends.
- **Lose:** timer reaches 0, **or** player HP reaches 0.

### 5.4 Results screen
Shows: Win / Fail, kill count, time remaining (on win), and the stats the player entered. A **Play Again** button returns to the start screen with the previous values prefilled **[builder's call]**. Results are held as a plain data object so a leaderboard can be added later without restructuring.

## 6. Player, stats, and combat

### 6.1 Formulas
```
ATK              = min(25, 10 + 5 · ln(1 + FlatAttack / 5))   (logarithmic, capped; cycle 2)
Auto-shot damage = ATK × closeBonus
AMP              = min(AMP_MAX, AMP_MIN + AMP_K · ln(1 + FlatAttack / AMP_SCALE))
Special damage   = AMP × ATK × closeBonus   (AMP grows logarithmically with Flat Attack, capped)
closeBonus       = ×1.0 at the back of the movement area, rising linearly to ×1.5 at the front
Special cooldown = BASE_CD × (1 − CDReduction / 100)
```

### 6.2 Player
- **Auto-fire:** shoots forward (to the right) continuously at a fixed rate.
- **HP:** 5 hits (cycle 2), with a 1.5 s invulnerability window (avatar flashes) after each hit; enemy fire within 48 px vanishes on a hit. Only an 8×4 hitbox in the middle of the 16×10 ship takes damage (empathy design).
- **Movement:** free movement in four directions inside a rectangular area covering the **left third** of the play field.

### 6.3 Special skill [E]
- **[builder's call]** A full-width piercing beam along the player's row. It deals `AMP × ATK` to the boss and everything else it touches, and clears drones in its path.
- A cooldown indicator is always visible on the HUD.

### 6.4 Controls

| Key | Action |
|---|---|
| W / ↑ | Move up |
| S / ↓ | Move down |
| A / ← | Move back |
| D / → | Move forward (within the left third) |
| E | Special skill |
| Esc | Pause **[builder's call]** |

Firing is automatic; there is no fire key.

### 6.5 Starting tuning values (placeholders, all in one config file)
ATK curve `10 → 25` (capped from Flat Attack about 95), AMP curve `AMP_MIN = 20, AMP_MAX = 40, AMP_K = 5, AMP_SCALE = 5` (AMP 20 at Flat Attack 0, capped at 40 from about 268), `BASE_CD = 8 s`, fire rate 8 shots/s, boss HP 3 × 2,000 (a player with no bonuses wins in about 65% of the default Play Time; tuned toward an 80% player win rate, see `docs/superpowers/specs/2026-11-19-empathy-design.md`). All of these are expected to change.

## 7. Built for change

These must be **single config values**, not hard-coded logic, because the owner may change them:
- The player's movement rectangle (setting its width to 0 gives up/down-only movement).
- Key bindings.
- All stats, phase thresholds, spawn rates, and caps.

Flipping the whole game to vertical is **not** a design goal and would be a larger rework.

## 8. Visuals and feel

- **Detailed pixel art.** The game renders at a low internal resolution (**[builder's call]** 480×270) and scales up by a whole number with nearest-neighbor filtering, letterboxed to fit the screen.
- **Placeholders for now:** colored shapes for the avatar, boss, drones, and bullets. Avatar design is undecided.
- **Juice is part of the core:** explosions, hit flashes, screen shake, boss phase-change moments. Effects sell the chaos.
- **HUD:** timer, player HP, boss HP bar, kill count, special cooldown.
- Scrolling parallax background (placeholder layers).

### 8.1 Showcase features
These are what make the game worth showing at a Computer Engineering festival. Each one is part of the plan, not an extra.
- **Batched WebGL2 sprite renderer:** all sprites drawn in a few GPU draw calls from one texture atlas.
- **Post-processing shaders**, run on the low-resolution 480×270 image so they stay cheap on an iGPU:
  - Glow (bloom) on bullets, the beam, and explosions.
  - Chromatic aberration flash when the player is hit.
  - Heat distortion during boss phase 3.
  - Optional CRT / scanline filter.
- **Game feel:** hit-stop, screen shake, hit flashes, particle bursts, and a big moment on each boss phase change.
- **Engine internals worth explaining:** fixed-timestep loop, object pools (no garbage-collection stutter), spatial-grid collision.

## 9. Performance

- Target: steady 60 fps on the festival workstation's integrated GPU, including the busiest moments of phase 3.
- Fixed-timestep simulation, independent of render rate.
- Hard caps on simultaneous drones, bullets, and particles; object pooling so busy moments don't trigger garbage-collection stutter.
- Small textures (pixel art in one atlas) to respect the iGPU's shared memory.
- **Effects quality** setting (see 5.1): High = all shaders, Low = glow only at reduced cost, Off = no post-processing.
- A read-only **dev console** on a debug key (**[builder's call]** F3). It shows FPS and frame time plus every live game value, and the round log's win rate (empathy design §5.9).
- **Test on the actual workstation early**, as soon as the renderer runs, and again before the festival.

## 10. Left to the builder

Everything marked **[builder's call]**, plus: code structure, shader implementation details, pooling strategy, drone movement and bullet patterns, background art, HUD layout, and how to produce the single-file build.

## 11. Later (out of scope now)

Leaderboard · final pixel art and avatar · sound and music · balance tuning pass.
