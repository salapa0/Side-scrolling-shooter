import { CONFIG, type Config } from '../config';
import type { Action, InputState } from '../engine/input';
import { createRng } from '../engine/rng';
import { defaultStatInput, deriveStats } from '../stats';
import { stepWorld } from './step';
import { createWorld, type World } from './world';

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
