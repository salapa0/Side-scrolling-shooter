import { rgb } from './engine/color';

export const CONFIG = {
  // Raise whenever a difficulty change does not alter boss HP, so the round log never mixes rule sets.
  balanceVersion: 2,
  view: { width: 480, height: 270 },                                  // spec §8
  sim: { step: 1 / 60, maxStepsPerFrame: 5, maxFrameTime: 0.25 },
  stats: {
    baseCd: 8,                                                        // spec §6.5
    // Both are min(max, min + k·ln(1 + FlatAttack / scale)): big gains early, capped (cycle-2 design §5.1).
    atk: { min: 10, max: 25, k: 5, scale: 5 },                        // shot damage; cap from Flat Attack ≈ 95
    amp: { min: 20, max: 40, k: 5, scale: 5 },                        // beam = AMP × ATK; cap from ≈ 268
    flatAttack: { min: 0, max: 999, default: 0 },                     // spec §5.1
    cdReduction: { min: 0, max: 80, default: 0 },
    playTime: { min: 30, max: 300, default: 120 },
  },
  player: {
    hp: 5, invulnTime: 1.5, blinkInterval: 0.08, speed: 140, w: 16, h: 10,  // hp, invuln: spec §6.2
    // Damage hitbox, centred inside the drawn ship; pickups still use the full w × h (empathy design §5.4).
    hitW: 8, hitH: 4,
    hitClearRadius: 48,                                                // enemy fire this close vanishes on a hit
    // Range the player's centre may occupy (left third). w: 0 = up/down only (spec §7).
    area: { x: 12, y: 24, w: 148, h: 236 },
    spawn: { x: 40, y: 142 },
    fireRate: 8, bulletSpeed: 360, bulletW: 6, bulletH: 2,           // fireRate: spec §6.5
    beam: { duration: 0.35, height: 12 },
    rapidMultiplier: 2, rapidTime: 6,                                 // Rapid fire power-up
    closeBonus: 1.5,                                                  // damage ×1 at the back of the area → ×1.5 at the front
  },
  boss: {
    // Three stages (one per phase) of stageHp each, 6000 in total (cycle-2 design §5.3). No-bonus player ≈ 77 DPS
    // → ~80 s ≈ 65% of 120 s. Starting estimate for the 80% win-rate target; tune it from the dev console's round log.
    stageHp: 2000,
    chargeTime: 1,                                                    // next stage's bar refills; boss immune, no attacks
    w: 64, h: 96, centerY: 142, moveSpeed: 60, bulletSpeed: 100,
    phases: [
      { x: 420, bobAmp: 40, bobSpeed: 0.15, droneInterval: 2.2, droneWave: 4, spreadInterval: 0, spreadCount: 0, spreadArc: 0, spiralInterval: 0 },
      { x: 370, bobAmp: 60, bobSpeed: 0.25, droneInterval: 2.0, droneWave: 5, spreadInterval: 1.2, spreadCount: 5, spreadArc: 0.6, spiralInterval: 0 },
      { x: 350, bobAmp: 70, bobSpeed: 0.4, droneInterval: 1.2, droneWave: 6, spreadInterval: 0.8, spreadCount: 7, spreadArc: 0.9, spiralInterval: 0.1 },
    ],
    spiralTurn: 0.35,
  },
  drone: { hp: 20, w: 12, h: 10, speed: 70, wobbleAmp: 18, wobbleFreq: 0.6, fireInterval: 2, bulletSpeed: 110, waveSpacing: 22 },
  enemyBullet: { w: 4, h: 4 },
  powerUps: {
    // Rare drone drops (empathy design §5.7). Weights pick among kinds that would do something right now.
    dropChance: 0.2, weights: { rapid: 1, health: 1, charge: 1, clear: 1 },
    size: 8, driftSpeed: 40, bobAmp: 4, bobFreq: 1, magnetRadius: 48, magnetSpeed: 160,
    labelTime: 1.2, blinkInterval: 0.15,                              // HUD pickup label; outline blink
  },
  caps: { drones: 64, playerBullets: 128, enemyBullets: 768, particles: 2048, powerUps: 2, quads: 8192 },
  fx: {
    droneBurst: 12, phaseBurst: 40, bossBurst: 120, playerBurst: 60, hitSparks: 2, powerUpBurst: 16,
    shakeDrone: 2, shakeBeam: 4, shakePlayerHit: 6, shakePhase: 10, shakeBossKilled: 14, shakeDecay: 8,
    hitStopPlayerHit: 0.06, hitStopPhase: 0.12,
    hitFlash: 0.06,
    flashPlayerHit: 0.1, flashPhase: 0.2, flashBossKilled: 0.3,
    particleLife: [0.25, 0.6], particleSpeed: [40, 160], particleDrag: 3, particleSize: [1, 2],
    // E ready (empathy design §5.6): see-through tint plus slow-mo so the flash never hides a bullet.
    readyFlashTime: 0.3, readyFlashAlpha: 0.3,
    slowMoScale: 0.35, slowMoHold: 0.3, slowMoRamp: 0.15,
    readyGlyph: { cell: 6, alpha: 0.6, blinkInterval: 0.075 },         // flashing E during the ready slow-mo (§5.5)
    impactTime: 0.5, shakeKillingShot: 20,                            // killing-shot freeze frame (cycle-2 design §5.4)
    lowHpPulseHz: 2, lowHpEdge: 3, lowHpAlpha: 0.5,                   // last-heart edge pulse (empathy design §5.5)
  },
  round: { endDelay: 1.5, resultsLockout: 1 },
  // Round log for win-rate tuning (empathy design §5.8); bands are Flat Attack edges: 0 · 1–9 · 10–49 · 50+.
  // F4 needs a second press within confirmWindow seconds (it sits next to F3).
  tally: { key: 'side-scroller.roundLog.v1', cap: 500, bands: [1, 10, 50], confirmWindow: 2 },
  bindings: {                                                          // spec §6.4; codes are KeyboardEvent.code
    up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'],
    left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
    special: ['KeyE'], pause: ['Escape'], debug: ['F3', 'Backquote'],
    resetTally: ['F4'],                                                // clears the round log, console open only
  },
  stars: [
    { count: 60, speed: 12, size: 1, color: rgb('#3a3f6b') },
    { count: 35, speed: 30, size: 1, color: rgb('#6c74b8') },
    { count: 15, speed: 70, size: 2, color: rgb('#c8ceff') },
  ],
  colors: {
    bg: rgb('#0b0d1a'), player: rgb('#5ef2ff'), playerBullet: rgb('#fff36b'),
    boss: rgb('#ff4d6d'), drone: rgb('#ff9f43'), enemyBullet: rgb('#ff5ef0'),
    beam: rgb('#bdfcff'), hitFlash: rgb('#ffffff'), readyFlash: rgb('#bdfcff'), lowHp: rgb('#ff4d6d'),
    impactBg: rgb('#000000'), impactInk: rgb('#ffffff'),
    droneBurst: rgb('#ffb86b'), bossBurst: rgb('#ff4d6d'), playerBurst: rgb('#5ef2ff'),
    // Kept clear of enemy fire (#ff5ef0) so pickups never read as threats.
    powerUp: { rapid: rgb('#fff36b'), health: rgb('#5eff8a'), charge: rgb('#4dd2ff'), clear: rgb('#ffffff') },
  },
};
export type Config = typeof CONFIG;
