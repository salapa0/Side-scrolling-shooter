import { expect, test } from 'vitest';
import { stepWorld } from './step';
import { drone, fakeInput, makeWorld, run, shoot } from './testUtils';

test('hit-stop freezes the whole simulation, timer included', () => {
  const w = makeWorld(); w.fx.hitStop = 0.1; const t = w.timeLeft; const x = w.boss.x;
  stepWorld(w, fakeInput(['right']), 1 / 60);
  expect([w.timeLeft, w.boss.x, w.player.x]).toEqual([t, x, 40]); expect(w.fx.hitStop).toBeCloseTo(0.1 - 1 / 60);
});
test('events are handled once', () => {
  const w = makeWorld(); w.player.invuln = 99; drone(w, 200, 100, 1); shoot(w, 200, 100);
  stepWorld(w, fakeInput(), 1 / 60); const n = w.particles.count;
  expect(n).toBe(12); // fx.droneBurst: proves the first step emitted the burst
  stepWorld(w, fakeInput(), 1 / 60);
  expect(w.particles.count).toBeLessThanOrEqual(n);
});
test('E becoming ready flashes and slows everything, the countdown included', () => {
  const w = makeWorld(); w.player.invuln = 99; w.player.specialCd = 0.01; stepWorld(w, fakeInput(), 1 / 60);
  expect(w.fx.readyFlash).toBeCloseTo(0.3); expect(w.fx.slowMo).toBeCloseTo(0.45);
  const t = w.timeLeft; stepWorld(w, fakeInput(), 1 / 60);
  expect(t - w.timeLeft).toBeCloseTo((1 / 60) * 0.35); expect(w.fx.timeScale).toBeCloseTo(0.35);
});
test('slow-mo timers run in real time and the game returns to full speed', () => {
  const w = makeWorld(); w.player.invuln = 99; w.player.specialCd = 0.01; stepWorld(w, fakeInput(), 1 / 60);
  run(w, fakeInput(), 0.5); expect(w.fx.readyFlash).toBe(0); expect(w.fx.slowMo).toBe(0);
  const t = w.timeLeft; stepWorld(w, fakeInput(), 1 / 60); expect(t - w.timeLeft).toBeCloseTo(1 / 60);
});
test('slow-mo overlapping a hit-stop still ends', () => {   // Review Focus 1
  const w = makeWorld(); w.player.invuln = 99; w.player.specialCd = 0.01; stepWorld(w, fakeInput(), 1 / 60);
  w.fx.hitStop = 0.12; run(w, fakeInput(), 1); expect(w.fx.timeScale).toBe(1);
});
test('the killing shot freezes the game for impactTime, then the round ends', () => {
  const w = makeWorld(); w.player.invuln = 99; w.player.x = 12; w.player.y = w.boss.y; w.boss.phase = 3; w.boss.hp = 150;
  stepWorld(w, fakeInput([], ['special']), 1 / 60);
  expect(w.fx.impact).toBeCloseTo(0.5); expect(w.status).toBe('won');
  const t = w.time; run(w, fakeInput(), 0.4); expect(w.time).toBe(t); expect(w.fx.impact).toBeGreaterThan(0);
  run(w, fakeInput(), 0.2); expect(w.fx.impact).toBe(0); expect(w.time).toBeGreaterThan(t);
});
