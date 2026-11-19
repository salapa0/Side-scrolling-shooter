# Cycle 2 — Design

Status: approved by the owner 2026-11-19 · branch `feat/cycle-2` · source list: `docs/next-cycle.md`

Items marked **[builder's call]** were filled in by the builder and can be changed.

## 1. Intent

Playtest feedback on the empathy pass found four problems:
- Flat Attack scaled too hard: at Flat Attack 35 the fight was over in about 15 s.
- The log curve didn't feel like a log curve.
- The E-ready moment was too easy to miss.
- The fight needed clearer structure, and it needed more reasons to play aggressively.

This cycle reshapes damage scaling, splits the boss into three stages, rewards getting close, and adds a hidden finisher. The 80% win-rate target and the round-log tuning loop from the empathy pass stay.

## 2. Goals, non-goals, anti-goals

**Goals**
- Flat Attack gives big gains at low values and small gains at high values, for shots and the beam alike.
- The boss is three stages, each with its own bar.
- Playing close to the boss pays off.
- The E-ready moment is unmistakable.
- A beam that finishes the boss gets a dramatic impact frame (easter egg).
- Win-rate data never mixes rounds played under different rules.

**Non-goals:** the local launcher, the slow-mo frequency at CD Reduction 80, and the remaining review minors listed in `docs/next-cycle.md`.

**Anti-goals**
- The flashing E or the impact frame hides bullets during play. The impact frame happens only after the boss is dead.
- Frame drops, or allocation inside `stepWorld`.

## 3. Constraints

Same as the empathy pass:
- tunables in `src/config.ts`
- Vitest tests next to the code
- single offline `.html` file
- 60 fps on an integrated GPU

## 4. Approaches (Flat Attack curve)

| Approach | Trade-off | Decision |
|---|---|---|
| **A. A capped log curve on ATK, keeping the capped log curve on AMP** | Shots and the beam both climb steeply early and level off. The beam stays the bigger reward. Keeps the AMP curve the owner asked for last cycle. | **Chosen** by the owner |
| B. A curve on ATK only, with AMP fixed at 20 | Simpler, but the beam tops out at 500 and no longer feels like a finisher. | Rejected |
| C. Linear ATK with a gentler slope | Still climbs a lot at the top, so it doesn't fix the feel. | Rejected |

## 5. Design

### 5.1 Damage scaling (approach A)

```
logCurve(x, c) = min(c.max, c.min + c.k · ln(1 + x / c.scale))
ATK  = logCurve(FlatAttack, { min: 10, max: 25, k: 5, scale: 5 })   (capped from Flat Attack ≈ 95)
AMP  = logCurve(FlatAttack, { min: 20, max: 40, k: 5, scale: 5 })   (unchanged; capped from ≈ 268)
Shot damage = ATK · closeBonus          Beam damage = AMP · ATK · closeBonus
```

| Flat Attack | 0 | 10 | 35 | 50 | 100+ |
|---|---|---|---|---|---|
| ATK | 10 | 15.5 | 20.4 | 22.0 | 25 |
| Beam (×1.0 bonus) | 200 | 395 | 620 | 703 | 881 → 1,000 at Flat Attack 268+ |

`stats.baseAtk` is replaced by the `stats.atk` curve.

### 5.2 Near-boss bonus

`closeBonus = 1 + (player.closeBonus − 1) · t`, where `t = (ship x − area.x) / area.w` is clamped to 0–1.

- ×1.0 at the back of the movement area, rising in a straight line to **×1.5** (`player.closeBonus`) at the front.
- If the area has zero width (up/down-only mode), the bonus is ×1.0.
- It applies to everything: each shot's damage is set when the shot is fired, and the beam's damage when it fires.
- The movement area doesn't change.

### 5.3 Boss stages

- **Structure:**
  - Three stages, each `boss.stageHp` = **2,000** HP. That's 6,000 in total, as before.
  - The stage number is the old phase number. It drives the same per-phase behaviour (`boss.phases[i]`).
  - `phaseThresholds` is removed.
- **Stage clear:** when a stage's HP reaches 0 (stages 1 and 2):
  - The stage number goes up and the existing `phaseChanged` event fires (hit-stop, flash, burst).
  - The next bar refills from 0 to 100% over `boss.chargeTime` = **1 s**.
  - During the refill the boss can't be damaged. Shots that hit it are used up.
  - Leftover damage is lost.
  - **[builder's call]** During the refill the boss keeps moving but launches no new drones or bullets, which gives the player a short breather.
- **Defeat:** the boss is defeated when it is in the final stage, has 0 HP, and isn't refilling.
- **HUD:** the boss bar shows the current stage's HP, and its label reads `STAGE n/3`.
- **Stress mode:** starts in stage 3 at full stage HP.

### 5.4 Killing shot (easter egg)

- **Trigger:** a beam that hits the boss in the final stage, while the boss isn't refilling, and whose damage (bonus included) is at least the boss's remaining HP.
- **Hint:** none.
- **Effect:** a `killingShot` event starts a **0.5 s** freeze (`fx.impactTime`, applied as hit-stop). While it lasts, the frame is drawn stark two-tone: a black background, with the boss, the beam and the ship in white, and nothing else. When the freeze ends, the normal boss explosion plays with a bigger shake (`fx.shakeKillingShot` = 20).
- **Kills by regular shots:** no impact frame.

### 5.5 Flashing E

- **When:** while the E-ready slow-mo runs (`fx.slowMo > 0`).
- **What:** a big pixel-art **E** in the centre of the screen. It's 5×7 cells of 6 px (30×42 px at 480×270), drawn in the beam colour at 60% alpha.
- **Blink:** it toggles every 0.075 s, which gives three flashes in 0.45 s.
- **Layer:** it's drawn with the ready tint, under enemy fire, so it never hides a bullet. **[builder's call: size, alpha, blink rate]**

### 5.6 Player and drops

- The player has 5 hearts (`player.hp`). The low-HP edge warning stays on the last heart.
- The power-up drop chance is 20% (`powerUps.dropChance`). The 2-on-screen cap and the equal weights stay.

### 5.7 Clean win-rate data

- **Version:** a top-level `balanceVersion` value in config, starting at **2**.
- **Tagging:** each round-log record stores `balanceVersion` and the total boss HP (`stageHp × 3`). Records saved before this change count as version 1.
- **What counts:** the dev console's TALLY line counts only records matching the current version and total boss HP. F4-F4 clears only those records.
- **Rule:** raise `balanceVersion` whenever a difficulty change doesn't alter boss HP.

### 5.8 Dev console

- **BOSS line:** `BOSS stage n/3 · HP h/2000 (pct%) · charge c s · pos`.
- **PLAYER line:** adds `close ×1.23`.
- **TALLY line:** starts `TALLY v2 @6000`.

### 5.9 Fixes while there

- `#hud-rapid` comes out of the HUD's flex row (positioned like the toast), so it stops squeezing the boss bar.
- The README says where the round log lives: browser local storage under `side-scroller.roundLog.v1`, with a separate log on the GitHub Pages site. It also explains `balanceVersion`.

## 6. Left to the builder

Everything marked **[builder's call]**, plus module placement:
- the stage logic and `bossDefeated` live with the boss code in `enemies.ts`
- the glyph and impact drawing go in `draw.ts`
- event shapes
- test updates for the new HP and stage model
