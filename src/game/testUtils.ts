import { CONFIG, type Config } from '../config';
import type { Action, InputState } from '../engine/input';
import { createRng } from '../engine/rng';
import { defaultStatInput, deriveStats } from '../stats';
import { stepWorld } from './step';
import { createWorld, type Bullet, type Drone, type World } from './world';

export function makeWorld(mutate?: (cfg: Config) => void): World {
  const cfg = structuredClone(CONFIG);
  mutate?.(cfg);
  return createWorld(cfg, deriveStats(defaultStatInput(cfg.stats), cfg.stats), createRng(1));
}

/** `pressed` actions are latched once: consume() returns true the first time only. */
export function fakeInput(held: Action[] = [], pressed: Action[] = []): InputState {
  const latched = new Set<Action>(pressed);
  return {
    isDown: (a) => held.includes(a),
    consume: (a) => latched.delete(a),
  };
}

export function run(
  w: World,
  input: InputState,
  seconds: number,
  fn: (w: World, input: InputState, dt: number) => void = stepWorld,
): void {
  const steps = Math.round(seconds * 60);
  for (let i = 0; i < steps; i++) fn(w, input, 1 / 60);
}

/** Final stage, 0 HP, not refilling: the state bossDefeated() reports as a kill. */
export function defeatBoss(w: World): void {
  w.boss.phase = w.cfg.boss.phases.length as 1 | 2 | 3; w.boss.hp = 0; w.boss.charge = 0;
}

/** Player bullet at (x, y), stationary, with the configured size and shot damage. */
export function shoot(w: World, x: number, y: number): Bullet {
  const b = w.playerBullets.acquire()!;
  b.x = x; b.y = y; b.vx = 0; b.vy = 0;
  b.w = w.cfg.player.bulletW; b.h = w.cfg.player.bulletH; b.damage = w.stats.shotDamage;
  return b;
}

/** Enemy bullet at (x, y), stationary, 1 damage. */
export function enemyShot(w: World, x: number, y: number): Bullet {
  const b = w.enemyBullets.acquire()!;
  b.x = x; b.y = y; b.vx = 0; b.vy = 0;
  b.w = w.cfg.enemyBullet.w; b.h = w.cfg.enemyBullet.h; b.damage = 1;
  return b;
}

/** Stationary drone that will not fire during a test. */
export function drone(w: World, x: number, y: number, hp = 20): Drone {
  const d = w.drones.acquire()!;
  d.x = x; d.y = y; d.baseY = y; d.vx = 0; d.vy = 0;
  d.w = w.cfg.drone.w; d.h = w.cfg.drone.h;
  d.hp = hp; d.age = 0; d.fireTimer = 99; d.flash = 0;
  return d;
}
