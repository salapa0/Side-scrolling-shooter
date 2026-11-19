# Empathy Pass — Design

Status: draft for approval · 2026-11-19 · branch `feat/empathy`

Items marked **[builder's call]** were filled in by the builder, not decided by the owner. They are proposals and can be changed.

## 1. Intent

Make the boss fight more forgiving for walk-up festival players, so most of them win. A player who did badly in the earlier festival games should still feel strong, and a player who did well should still feel rewarded. The owner's target is that **about 80% of players beat the boss**.

The fight should still feel intense. A smaller hitbox, i-frames and power-ups are meant to create "I barely survived that" moments. They should not make the fight empty.

The owner also wants a **dev console** that shows every value in the game (stats, HP, and so on). It's for tuning toward the 80% target.

## 2. Goals, non-goals, anti-goals

**Goals**
- The beam becomes a strong tool and finisher. Its multiplier (AMP) grows logarithmically with Flat Attack and is capped.
- Getting hit is less punishing: longer i-frames, nearby bullets cleared, and a smaller hitbox.
- The moment E becomes ready is unmissable: a full-screen flash, with the game slowed so the flash doesn't cost the player sight of the bullets.
- Rare power-ups: fire rate, health restore, instant charge, and kill all drones.
- A low-HP warning on the last heart.
- A win/loss tally and a read-only dev console that show the real win rate during playtests.

**Non-goals**
- Editing values from the dev console. It is read-only for now.
- Changing how Flat Attack feeds regular shots. ATK stays linear (owner's call). Very high Flat Attack still shortens the fight through regular shots. That belongs to the later balance pass.
- Final art for power-ups, sound, and the leaderboard.
- A local launcher. The owner wants one later. Who it's for (booth staff or the team) is still open.

**Anti-goals: failure even if it technically works**
- The ready flash or the slow-mo hides bullets or makes the game feel sluggish.
- Power-ups are common enough that the fight loses its tension.
- Difficulty that changes between players. Every player must face the same fight so results stay comparable (this rules out auto-adjusting difficulty).
- Frame drops. The 60 fps iGPU target from the main spec still holds, and so does allocation-free stepping (pools only).

## 3. Constraints

Everything in the main spec (`docs/spec.md`) still applies:
- frontend only, single offline `.html` file
- own engine, TypeScript + WebGL2
- every tunable is a single value in `src/config.ts`
- no allocation inside `stepWorld`

New game logic is covered by Vitest tests in the existing style (`makeWorld`, `fakeInput`, `run` in `src/game/testUtils.ts`).

## 4. Approaches

The only real fork was **how to reach an 80% win rate**:

| Approach | Trade-off | Decision |
|---|---|---|
| **A. Measure and tune by hand.** Boss HP starts at an estimate, a win/loss tally shows the real rate, and one config value is adjusted after playtests. | Cheap, and every player faces the same fight. Needs playtests to converge. | **Chosen** by the owner. |
| B. Difficulty that adjusts itself. Boss HP is nudged after each round toward 80% wins. | Reaches the target unattended, but each player's fight depends on the previous player's result. That's unfair and breaks leaderboard comparisons. | Rejected. |
| C. A, plus a simulated bot that plays thousands of rounds to pick the starting HP. | A number before any playtest, but a bot dodges nothing like a person. About a day of work for a rough guess. | Rejected. |

Everything else has one sensible way to build it, using patterns the engine already has:
- power-ups get a pool and a module like drones
- AMP becomes a formula in `deriveStats`
- the hitbox is a separate box used only for damage checks
- slow-mo is a time scale inside the simulation, so tests cover it and the countdown slows with everything else

The other way to do slow-mo, scaling the frame time in `main.ts`, was rejected. It can't be tested and it mixes app code with simulation code.

## 5. Design

### 5.1 Beam AMP: logarithmic, capped

```
ATK              = BASE_ATK + FlatAttack                        (unchanged, linear)
AMP              = min(AMP_MAX, AMP_MIN + AMP_K · ln(1 + FlatAttack / AMP_SCALE))
Special damage   = AMP × ATK
```

The input is Flat Attack, because that's the stat earned in the last game **[builder's call]**. Starting values **[builder's call]**: `AMP_MIN = 20, AMP_MAX = 40, AMP_K = 5, AMP_SCALE = 5`.

| Flat Attack | AMP | Beam damage | Share of boss HP (6,000) |
|---|---|---|---|
| 0 | 20.0 | 200 | 3% |
| 10 | 25.5 | 510 | 8.5% |
| 50 | 32.0 | 1,920 | 32% |
| 100 | 35.2 | 3,870 | 65% |
| ≥ 268 | 40 (cap) | 40 × ATK | |

The steep early part of the curve gives low scorers a big AMP straight away. The cap keeps top scorers from scaling forever. `DerivedStats` gains an `amp` field so the dev console can show it. Update `docs/spec.md` §6.1 to the new formula.

### 5.2 Boss HP starting estimate

`boss.maxHp` goes from 5,200 to **6,000** **[builder's call]**.

New no-bonus damage is about 52 DPS from auto-fire (65% of 80) plus about 20–25 DPS from the beam (200 per 8 s). That's roughly 75 DPS, so the boss falls at about 80 s of a 120 s round (~65% of the clock). The target is looser than the spec's old 75%, because walk-up players are worse than the estimate. This is only a starting point: the tally (5.8) shows the real rate, and `maxHp` is the dial.

### 5.3 Getting hit

- **I-frames:** `player.invulnTime` goes from 1 s to **1.5 s** (owner left the duration to the builder). The existing blink and pass-through behaviour stays.
- **Bullet clear on hit:** when the player takes a hit, every enemy bullet whose centre is within `player.hitClearRadius` (**48 px** **[builder's call]**) of the player's centre is removed. Drones aren't affected. Careful: the clear runs while `resolveCombat` is iterating the enemy-bullet pool, so it must not break that loop. One option is to do the clear after the loop.

### 5.4 Smaller hitbox

- The ship is still drawn at 16×10 (owner: "still as big").
- Damage checks (enemy bullets and drone contact) use a centred **8×4** box (`player.hitW`, `player.hitH` **[builder's call]**). It is invisible, not a dot (owner's call).
- Power-up pickup uses the **full** 16×10 ship **[builder's call]**, so dodging is tight but grabbing is generous.

### 5.5 Low-HP warning

When the player is on their last heart (hp = 1) and the round is still playing, the four screen edges pulse red. It's drawn in the WebGL frame as four thin rects (~3 px) with alpha pulsing at about 2 Hz. The pulse is driven by `world.time`, so it freezes while paused **[builder's call: thickness, rate, colour]**.

### 5.6 E ready: flash + slow-mo

- **Trigger:** a new `specialReady` event fires when `player.specialCd` goes from > 0 to 0. This happens when the cooldown runs out, or when the Instant charge power-up is picked up while E isn't ready. It does **not** fire at round start, because E starts ready.
- **Flash:** a see-through overlay in the beam colour covers the whole screen. It starts at about 30% alpha and fades over **0.3 s** **[builder's call]**. It's drawn under the enemy bullets so they stay visible. This is separate from the existing white `fx.flash`.
- **Slow-mo:** the world runs at **0.35×** for 0.3 s, then ramps linearly back to 1× over 0.15 s **[builder's call: all three numbers]**. It's built as `w.fx.timeScale`: `stepWorld` multiplies `dt` by it for all simulation, including the countdown, player movement and cooldowns. Everything slows together **[builder's call]**. The slow-mo timer itself counts down in real time. Hit-stop keeps working as it does now.
- **Repeats:** at 80% CD Reduction the cooldown is 1.6 s, so this can happen every ~2 s. That's accepted. All the numbers are in config if it feels too much.

### 5.7 Power-ups

- **Drop:** each drone killed by a player bullet or the beam has a `powerUps.dropChance` (**3%** **[builder's call]**) to drop a power-up at its position. The roll uses `w.rng`. Drones destroyed by Kill all never drop. There are at most **2** power-ups on screen (`caps.powerUps` **[builder's call]**). A drop is skipped if the pool is full.
- **Choosing the kind:** weighted random (`powerUps.weights`, all equal to start), picking only from kinds that would do something right now:
  - Health isn't rolled at full HP.
  - Instant charge isn't rolled when E is already ready.

  The other two kinds are always eligible, so there's always a valid pick.
- **Movement:** drifts left at about 40 px/s with a gentle bob. Within about 48 px of the player it moves toward the ship at about 160 px/s (magnet) **[builder's call: all numbers]**. It's removed once it leaves the left edge.
- **Pickup:** overlap with the full ship box (5.4). Pickup fires a `powerUpCollected` event with the kind, a particle burst in the power-up's colour, and a HUD label for about 1.2 s.
- **Effects:**

| Kind | Effect | HUD label |
|---|---|---|
| Fire rate | Fire rate ×2 for 6 s. Picking another one resets the timer to 6 s (no stacking). | `RAPID FIRE`, plus a countdown while active |
| Health | +1 heart, up to max HP | `+1 HP` |
| Instant charge | `specialCd = 0`, which fires `specialReady` (5.6) | `BEAM READY` |
| Kill all | Destroys every drone on screen (they count toward kills, with normal death bursts) and removes every enemy bullet. The boss is untouched. | `SCREEN CLEAR` |

Clearing enemy bullets on Kill all is **[builder's call]**, since the owner only specified "kill all, not boss".

- **Look:** placeholder 8×8 squares, each kind in its own colour, with a blinking outline so they read as pickups and not threats. Colours must stay clearly different from enemy fire (`#ff5ef0`) **[builder's call: colours]**.

### 5.8 Win/loss tally (round log)

- When a round finishes (outside `?stress`), the app appends a record to a round log. The record is the existing `RoundResult` plus the `boss.maxHp` the round was played under. `RoundResult` already holds the outcome, the reason, kills, time left and the entered stats.
- The log is capped at the last **500** rounds, oldest dropped first **[builder's call]**.
- The log is stored in `localStorage` under one key, read and written inside `try/catch`. If storage is unavailable or the stored data is corrupt, it falls back to an empty in-memory log for the session.
- **The dev console counts only rounds played at the current `boss.maxHp`** **[builder's call]**. Changing the dial and rebuilding starts a fresh count without anyone remembering to reset. Older rounds stay in the log for the balance pass.
- **F4**, pressed twice within 2 s while the dev console is open, clears the rounds at the current `boss.maxHp` **[builder's call: key, double press]**. Use it to drop staff test rounds. Rounds from earlier boss HP values stay. The double press was added after review, because F4 sits next to F3.

What the console shows (all for the current `maxHp`):
- wins, losses by time, and losses by HP, with the overall win rate
- the win rate for each Flat Attack band: **0**, **1–9**, **10–49**, **50+** **[builder's call: band edges]**

Splitting losses by reason shows which dial to turn. Mostly time-outs means lower boss HP. Mostly deaths means more survival help. The bands show whether the 80% holds for low scorers as well as high ones. ATK stays linear, so Flat Attack 10 roughly halves the fight (about 36 s against about 78 s). The overall rate can hide low scorers losing.

### 5.9 Dev console (read-only)

The existing F3 / backtick overlay grows into a multi-section panel. It updates every 250 ms (as now) and only does work while visible, so string building never runs during normal play. It works on any screen and shows the current world, which is the backdrop world on the start screen.

| Section | Values |
|---|---|
| Performance | FPS, avg / max frame time, steps, quads |
| Round | app state, status, time left / play time, time scale, kills |
| Player | HP / max, position, invuln left, special cooldown left / total, fire rate (with Rapid time left), hitbox size |
| Stats | Flat Attack, CD Reduction, Play Time (as entered); ATK, shot damage, AMP, beam damage |
| Boss | HP / max (and %), phase, position |
| Pools | drones, player bullets, enemy bullets, particles, power-ups, each as count / cap |
| Tally | boss max HP the count is for; wins, losses (time), losses (HP), win rate; win rate per Flat Attack band (5.8) |

Edge cases **[builder's call]**:
- Slow-mo and the ready flash keep running out after the round ends.
- A power-up that has become useless by the time it's picked up (e.g. Health at full HP) is still used up and shows its label.
- F3/F4 must still work while a start-screen text field has focus. The input layer currently ignores keys from text fields, so the console keys need an exception.

`README.md`'s "Checking performance" section is updated to describe the console and the F4 reset.

## 6. Config summary

New or changed values in `src/config.ts` (all starting values, all tunable):
- `stats.amp`: `{ min: 20, max: 40, k: 5, scale: 5 }` (replaces the constant `amp: 5`)
- `player.invulnTime`: 1.5
- `player.hitW` / `hitH`: 8 / 4
- `player.hitClearRadius`: 48
- `player.rapidMultiplier`: 2
- `player.rapidTime`: 6
- `boss.maxHp`: 6000
- `powerUps`: drop chance, weights, size, drift speed, bob, magnet radius and speed, label time
- `fx`: ready-flash time and alpha, slow-mo scale, hold and ramp times, low-HP pulse rate and thickness
- `caps.powerUps`: 2
- `tally`: log cap (500), Flat Attack band edges `[1, 10, 50]`
- `colors`: one per power-up kind, the ready flash, the low-HP edge
- `bindings.resetTally`: `['F4']`

## 7. Left to the builder

Everything marked **[builder's call]**, plus:
- module layout (e.g. a new `src/game/powerups.ts`, and a tally module outside `game/`)
- event shapes
- how the HUD label and Rapid countdown are laid out
- the dev console's markup and formatting
- how the tally is wired into `main.ts`
