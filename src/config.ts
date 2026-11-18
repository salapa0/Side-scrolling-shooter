import { rgb } from './engine/color';

export const CONFIG = {
  view: { width: 480, height: 270 },                                  // spec §8
  sim: { step: 1 / 60, maxStepsPerFrame: 5, maxFrameTime: 0.25 },
  stats: {
    baseAtk: 10, amp: 5, baseCd: 8,                                   // spec §6.5
    flatAttack: { min: 0, max: 999, default: 0 },                     // spec §5.1
    cdReduction: { min: 0, max: 80, default: 0 },
    playTime: { min: 30, max: 300, default: 120 },
  },
  player: {
    hp: 3, invulnTime: 1, blinkInterval: 0.08, speed: 140, w: 16, h: 10,  // hp, invuln: spec §6.2
    // Range the player's centre may occupy (left third). w: 0 = up/down only (spec §7).
    area: { x: 12, y: 24, w: 148, h: 236 },
    spawn: { x: 40, y: 142 },
    fireRate: 8, bulletSpeed: 360, bulletW: 6, bulletH: 2,           // fireRate: spec §6.5
    beam: { duration: 0.35, height: 12 },
  },
  boss: {
    // No-bonus player ≈ 58 effective DPS (~65% of 80 auto-fire DPS, plus the beam) × 90 s (75% of 120 s).
    maxHp: 5200,
    w: 64, h: 96, centerY: 142, moveSpeed: 60, bulletSpeed: 100,
    phaseThresholds: [0.6, 0.25],                                     // spec §5.2
    phases: [
      { x: 420, bobAmp: 40, bobSpeed: 0.15, droneInterval: 2.2, droneWave: 4, spreadInterval: 0, spreadCount: 0, spreadArc: 0, spiralInterval: 0 },
      { x: 370, bobAmp: 60, bobSpeed: 0.25, droneInterval: 2.0, droneWave: 5, spreadInterval: 1.2, spreadCount: 5, spreadArc: 0.6, spiralInterval: 0 },
      { x: 350, bobAmp: 70, bobSpeed: 0.4, droneInterval: 1.2, droneWave: 6, spreadInterval: 0.8, spreadCount: 7, spreadArc: 0.9, spiralInterval: 0.1 },
    ],
    spiralTurn: 0.35,
  },
  drone: { hp: 20, w: 12, h: 10, speed: 70, wobbleAmp: 18, wobbleFreq: 0.6, fireInterval: 2, bulletSpeed: 110, waveSpacing: 22 },
  enemyBullet: { w: 4, h: 4 },
  caps: { drones: 64, playerBullets: 128, enemyBullets: 768, particles: 2048, quads: 8192 },
  fx: {
    droneBurst: 12, phaseBurst: 40, bossBurst: 120, playerBurst: 60, hitSparks: 2,
    shakeDrone: 2, shakeBeam: 4, shakePlayerHit: 6, shakePhase: 10, shakeBossKilled: 14, shakeDecay: 8,
    hitStopPlayerHit: 0.06, hitStopPhase: 0.12,
    hitFlash: 0.06,
    flashPlayerHit: 0.1, flashPhase: 0.2, flashBossKilled: 0.3,
    particleLife: [0.25, 0.6], particleSpeed: [40, 160], particleDrag: 3, particleSize: [1, 2],
  },
  round: { endDelay: 1.5 },
  bindings: {                                                          // spec §6.4; codes are KeyboardEvent.code
    up: ['KeyW', 'ArrowUp'], down: ['KeyS', 'ArrowDown'],
    left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
    special: ['KeyE'], pause: ['Escape'], debug: ['F3', 'Backquote'],
  },
  stars: [
    { count: 60, speed: 12, size: 1, color: rgb('#3a3f6b') },
    { count: 35, speed: 30, size: 1, color: rgb('#6c74b8') },
    { count: 15, speed: 70, size: 2, color: rgb('#c8ceff') },
  ],
  colors: {
    bg: rgb('#0b0d1a'), player: rgb('#5ef2ff'), playerBullet: rgb('#fff36b'),
    boss: rgb('#ff4d6d'), drone: rgb('#ff9f43'), enemyBullet: rgb('#ff5ef0'),
    beam: rgb('#bdfcff'), hitFlash: rgb('#ffffff'),
    droneBurst: rgb('#ffb86b'), bossBurst: rgb('#ff4d6d'), playerBurst: rgb('#5ef2ff'),
  },
};
export type Config = typeof CONFIG;
