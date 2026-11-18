import { expect, test } from 'vitest';
import { createRng } from '../engine/rng';
import { CONFIG } from '../config';
import { createStarfield } from './background';
import { updateEffects } from './effects';
import { fakeInput, makeWorld, run } from './testUtils';

test('drone death bursts particles', () => {
  const w = makeWorld(); w.events.push({ type: 'droneKilled', x: 100, y: 100 }); updateEffects(w, 1 / 60);
  expect(w.particles.count).toBe(12);
});
test('particles expire', () => {
  const w = makeWorld(); w.events.push({ type: 'droneKilled', x: 100, y: 100 }); updateEffects(w, 1 / 60);
  w.events.length = 0; run(w, fakeInput(), 1, (w, _i, dt) => updateEffects(w, dt)); expect(w.particles.count).toBe(0);
});
test('player hit triggers hit-stop, shake, and flash', () => {
  const w = makeWorld(); w.events.push({ type: 'playerHit', x: 0, y: 0 }); updateEffects(w, 0);
  expect(w.fx).toEqual({ hitStop: 0.06, shake: 6, flash: 0.1 });
});
test('shake settles', () => {
  const w = makeWorld(); w.fx.shake = 14; run(w, fakeInput(), 2, (w, _i, dt) => updateEffects(w, dt));
  expect(w.fx.shake).toBeLessThan(0.01);
});
test('full particle pool is skipped without throwing', () => {
  const w = makeWorld(); while (w.particles.acquire());
  w.events.push({ type: 'bossKilled', x: 0, y: 0 }); expect(() => updateEffects(w, 1 / 60)).not.toThrow();
});
test('a small event never shortens a bigger effect', () => {
  const w = makeWorld(); w.fx.shake = 10; w.fx.flash = 0.3;
  w.events.push({ type: 'droneKilled', x: 0, y: 0 }, { type: 'playerHit', x: 0, y: 0 });
  updateEffects(w, 0);
  expect(w.fx.shake).toBe(10); expect(w.fx.flash).toBe(0.3);
});
test('boss hit flashes the boss and throws sparks', () => {
  const w = makeWorld(); w.events.push({ type: 'bossHit', x: 300, y: 100 }); updateEffects(w, 0);
  expect(w.boss.flash).toBe(CONFIG.fx.hitFlash); expect(w.particles.count).toBe(2);
});
test('phase change freezes, flashes and bursts', () => {
  const w = makeWorld(); w.events.push({ type: 'phaseChanged', phase: 2, x: 300, y: 100 }); updateEffects(w, 0);
  expect(w.fx).toEqual({ hitStop: 0.12, shake: 10, flash: 0.2 }); expect(w.particles.count).toBe(40);
});
test('flash decays linearly to zero', () => {
  const w = makeWorld(); w.fx.flash = 0.1; updateEffects(w, 0.04);
  expect(w.fx.flash).toBeCloseTo(0.06); updateEffects(w, 1); expect(w.fx.flash).toBe(0);
});
test('starfield has the configured stars per layer', () => {
  const s = createStarfield(createRng(1), CONFIG);
  expect(s.x.length).toBe(110);
  expect(Array.from(s.layer.slice(0, 60)).every((l) => l === 0)).toBe(true);
  expect(s.layer[109]).toBe(2);
});
