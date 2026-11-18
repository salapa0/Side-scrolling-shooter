import { expect, test } from 'vitest';
import { stepWorld } from './step';
import { drone, fakeInput, makeWorld, shoot } from './testUtils';

test('hit-stop freezes the whole simulation, timer included', () => {
  const w = makeWorld(); w.fx.hitStop = 0.1; const t = w.timeLeft; const x = w.boss.x;
  stepWorld(w, fakeInput(['right']), 1 / 60);
  expect([w.timeLeft, w.boss.x, w.player.x]).toEqual([t, x, 40]); expect(w.fx.hitStop).toBeCloseTo(0.1 - 1 / 60);
});
test('events are handled once', () => {
  const w = makeWorld(); w.player.invuln = 99; drone(w, 200, 100, 1); shoot(w, 200, 100);
  stepWorld(w, fakeInput(), 1 / 60); const n = w.particles.count; stepWorld(w, fakeInput(), 1 / 60);
  expect(w.particles.count).toBeLessThanOrEqual(n);
});
