# Next development cycle: playtest feedback

Written 2026-11-19, after the empathy pass shipped (`e9e29cb`, design: `docs/superpowers/specs/2026-11-19-empathy-design.md`).

This is a to-do list, not a design. Each item gives:
- the owner's request in their own words
- what the game does today
- the questions to settle before building it

**Confirmed by the owner:** marks the owner's answers. Every reading in this file has been confirmed. Only the "To settle" points are still open.

Start the cycle by brainstorming these into a design, as with the empathy pass.

## 1. One boss HP bar per stage, each charging up

> "we want a separate hp bar for each stage and it own regen charge up"

- **Today:** one boss HP bar (6,000 HP). Phases change at 60% and 25%.
- **Confirmed by the owner:**
  - "Stage" means boss phase.
  - Stage *i*'s bar drains to 0. Then stage *i+1*'s bar starts again at 100%; filling back up is the "regen charge up".
  - The boss doesn't heal in the middle of a stage.
  - Equal thirds: each stage has 2,000 HP out of today's 6,000. This replaces the 60% / 25% phase thresholds.
- **Proposed:** overkill doesn't carry into the next bar. Each bar stops at 0. That fits the killing shot being final-stage only (item 7). Confirm when designing.
- **To settle:** is the charge-up a pause in which the boss can't be damaged? How long is it?

## 2. Player starts with 5 HP

> "hp will start at 5"

- **Today:** 3 hearts (`player.hp`).
- **Confirmed by the owner:** the player's hearts go from 3 to 5.
- **Note:** the low-HP warning still triggers on the last heart only. Decide whether it should start at 2 hearts instead.

## 3. Power-ups at 20%

> "change power up to 20%"

- **Today:** a 3% drop chance per drone kill (`powerUps.dropChance`), with at most 2 on screen.
- **Confirmed by the owner:** the drop chance goes from 3% to 20%, about 7× more often.
- **To settle:**
  - Keep the 2-on-screen cap?
  - Should Kill all stay as common as the other kinds? At 20% it could empty the screen often enough to remove the tension.

## 4. A clear "E" sign during the ready slow-mo

> "while time slow down i want a flashing E on the screen not just slow i want clear sign"

- **Today:** when E becomes ready, the screen gets a see-through cyan tint (30% at its strongest, fading over 0.3 s) and the game runs at 0.35× speed for about 0.45 s. Testers didn't notice it enough.
- **Wanted:** a big flashing **E** on screen while the slow-mo lasts.
- **To settle:**
  - Where it goes (centre of the screen, or next to the ship), its size and colour, and how fast it blinks.
  - It must not hide bullets: draw it see-through, or under enemy fire.
  - The renderer only draws rectangles, so the E would be pixel-art rectangles or a HUD text element.

## 5. Flat Attack scaling is too strong

> "slow down the scaling the 35 flat felt too much"

At Flat Attack 35 the fight is about 5× shorter than with no bonus:

| Flat Attack | ATK (shot damage) | Beam AMP | Beam damage | Boss (6,000 HP) falls in about |
|---|---|---|---|---|
| 0 | 10 | 20.0 | 200 | 78 s |
| 35 | 45 | 30.4 | 1,368 | 15 s |

Most of that comes from regular shots, because ATK still grows linearly (`ATK = 10 + Flat Attack`).

**To settle:** what should Flat Attack 35 feel like? For example: "the fight takes half as long as with no bonus". A target number makes the tuning checkable.

## 6. Reward aggressive play

> "we want to reward aggressive play by linear scale the flat damage at more shallow point from the boss"

**Confirmed by the owner:**
- Closer means stronger. Damage rises linearly the closer the ship is to the boss.
- At most ×1.5, at the closest point.
- It applies to everything: regular shots and the beam.

- **Today:** the ship can move between x 12 and 160, and the boss sits around x 350–420. The closest the ship can get is about 190 px away.
- **To settle:**
  - Which distances map to ×1.0 and ×1.5? For example, ×1.0 at the back of the movement area and ×1.5 at the front.
  - Should the movement area reach further right, so "near the boss" can really be near?

## 7. An impact frame when E lands the kill

> "when boss is low enough and get killed by e make the last e an impact frame"

- **Today:** a boss kill plays a burst, a shake and a 0.3 s white flash, whatever caused it.
- **Confirmed by the owner:**
  - The killing shot is a beam fired while the boss's remaining HP is less than or equal to the beam's damage.
  - That beam gets the impact frame: a dramatic freeze-frame, such as a longer hit-stop with a high-contrast or inverted flash, then the explosion.
  - There's no execute threshold. The beam simply has to deal enough damage.
  - The killing shot can only happen in the final stage.
  - It's an easter egg, so there's no HUD cue.
- **To settle:** the look and length of the impact frame.

## 8. The logarithmic curve doesn't feel as planned

> "the log natural sclaing suppose to highhen at the very first for lower flat and not increse by alot at the end"

**What's happening:** AMP itself does follow the planned curve: steep early, then flat, capped at 40. But beam damage is `AMP × ATK`, and ATK is linear, so beam damage keeps climbing steeply at the top:

| Flat Attack | 0 | 10 | 35 | 50 | 100 | 268 | 999 |
|---|---|---|---|---|---|---|---|
| AMP | 20.0 | 25.5 | 30.4 | 32.0 | 35.2 | 40 | 40 |
| Beam damage | 200 | 510 | 1,368 | 1,920 | 3,874 | 11,120 | 40,360 |

**Direction:** apply the logarithmic curve to the damage players actually feel, not only to AMP. For example, put the log on ATK, or on beam damage directly. Settle this together with items 5 and 6, since all three change how Flat Attack turns into damage.

## Before changing numbers: keep the win-rate data clean

The round log only separates rounds by `boss.maxHp`. Items 2, 3, 5, 6 and 8 change difficulty without changing boss HP, so rounds from before and after a change would be counted together.

Add a `balanceVersion` value to `src/config.ts`. Store it on each round, and show only the current version in the dev console.

## Carried over from the empathy pass

- **Local launcher:** wanted. Still open: is it for booth staff or for the team?
- **Slow-mo frequency:** at CD Reduction 80, the flash and slow-mo come every 1.8–2.0 s. Is that too often?
- **Deferred review items:**
  - The Kill all power-up is white with a white outline, so its blink is invisible. Rapid's yellow matches the player's own bullets.
  - The Rapid countdown sits in the HUD row and squeezes the boss bar while it's showing.
  - The README doesn't say where the round log lives (local storage key `side-scroller.roundLog.v1`), or that the GitHub Pages site keeps a separate log.
  - When storage is blocked, the log falls back to memory with no sign of it, and a second open tab overwrites the first tab's log.
  - The slow-mo/hit-stop test checks at 1 s, but the measured worst case is about 0.62 s, so it should check at about 0.65 s.
  - Setting every power-up weight to 0 still drops Kill all.
  - The dev console creates a small object every frame, even when it's closed.
  - The console's refresh limit (every 250 ms, and nothing while closed) isn't tested.
  - `docs/spec.md` barely mentions power-ups, the ready flash or the low-HP pulse.
