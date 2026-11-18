import { CONFIG, type Config } from '../config';
import type { Color } from '../engine/color';
import { clamp, type Box } from '../engine/geom';
import { SpatialGrid, type Stamped } from '../engine/grid';
import { Pool } from '../engine/pool';
import type { Rng } from '../engine/rng';
import type { DerivedStats } from '../stats';

export interface Body extends Box, Stamped { vx: number; vy: number }
export interface Bullet extends Body { damage: number }
export interface Drone extends Body { hp: number; age: number; baseY: number; fireTimer: number; flash: number }
export interface Particle { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; size: number; color: Color }
export interface Player extends Box { hp: number; invuln: number; fireTimer: number; specialCd: number }
export interface Boss extends Box { hp: number; maxHp: number; phase: 1 | 2 | 3; age: number; droneTimer: number; spreadTimer: number; spiralTimer: number; spiralAngle: number; flash: number }
export interface Beam { x: number; y: number; time: number }               // time > 0 while visible
export type GameEvent =
  | { type: 'droneKilled' | 'bossHit' | 'playerHit' | 'bossKilled' | 'playerKilled'; x: number; y: number }
  | { type: 'phaseChanged'; phase: 2 | 3; x: number; y: number }
  | { type: 'beamFired'; x: number; y: number };
export interface World {
  cfg: Config; stats: DerivedStats; rng: Rng;
  time: number; timeLeft: number; kills: number;
  status: 'playing' | 'won' | 'lost'; reason: 'boss' | 'time' | 'hp' | null; endTimer: number; finished: boolean;
  player: Player; boss: Boss; beam: Beam;
  drones: Pool<Drone>; playerBullets: Pool<Bullet>; enemyBullets: Pool<Bullet>; particles: Pool<Particle>;
  grid: SpatialGrid<Drone>; events: GameEvent[];
  fx: { shake: number; hitStop: number; flash: number };
}

const GRID_CELL = 32;

export const blankBullet = (): Bullet => ({ x: 0, y: 0, w: 0, h: 0, stamp: 0, vx: 0, vy: 0, damage: 0 });
export const blankDrone = (): Drone => ({
  x: 0, y: 0, w: 0, h: 0, stamp: 0, vx: 0, vy: 0, hp: 0, age: 0, baseY: 0, fireTimer: 0, flash: 0,
});
// Colours are shared references; spawners overwrite `color`, never copy it.
export const blankParticle = (): Particle => ({
  x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 0, size: 0, color: CONFIG.colors.player,
});

export function createWorld(cfg: Config, stats: DerivedStats, rng: Rng): World {
  const { view, player, boss, caps } = cfg;
  const { area } = player;
  return {
    cfg, stats, rng,
    time: 0, timeLeft: stats.playTime, kills: 0,
    status: 'playing', reason: null, endTimer: 0, finished: false,
    player: {
      x: clamp(player.spawn.x, area.x, area.x + area.w),
      y: clamp(player.spawn.y, area.y, area.y + area.h),
      w: player.w, h: player.h, hp: player.hp, invuln: 0, fireTimer: 0, specialCd: 0,
    },
    boss: {
      x: boss.phases[0].x, y: boss.centerY, w: boss.w, h: boss.h,
      hp: boss.maxHp, maxHp: boss.maxHp, phase: 1, age: 0,
      droneTimer: 1, spreadTimer: 0, spiralTimer: 0, spiralAngle: 0, flash: 0,
    },
    beam: { x: 0, y: 0, time: 0 },
    drones: new Pool(caps.drones, blankDrone),
    playerBullets: new Pool(caps.playerBullets, blankBullet),
    enemyBullets: new Pool(caps.enemyBullets, blankBullet),
    particles: new Pool(caps.particles, blankParticle),
    grid: new SpatialGrid<Drone>(view.width, view.height, GRID_CELL),
    events: [],
    fx: { shake: 0, hitStop: 0, flash: 0 },
  };
}
