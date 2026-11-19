import { expect, test } from 'vitest';
import { fakeInput, makeWorld, run } from './testUtils';
import { closeBonus } from './bonus';
import { updatePlayer } from './player';
import type { World } from './world';
import type { InputState } from '../engine/input';

const updatePlayerOnly = (w: World, i: InputState, dt: number): void => updatePlayer(w, i, dt);

test('moves right at configured speed', () => {
  const w = makeWorld(); run(w, fakeInput(['right']), 0.5, updatePlayerOnly); expect(w.player.x).toBeCloseTo(110, 0);
});
test('diagonal movement is normalised', () => {
  const w = makeWorld(); run(w, fakeInput(['right', 'down']), 0.5, updatePlayerOnly);
  expect(w.player.x - 40).toBeCloseTo(70 / Math.SQRT2, 0); expect(w.player.y - 142).toBeCloseTo(70 / Math.SQRT2, 0);
});
test('stays inside the movement area', () => {
  const w = makeWorld(); run(w, fakeInput(['left', 'up']), 5, updatePlayerOnly); expect([w.player.x, w.player.y]).toEqual([12, 24]);
});
test('area width 0 gives up/down-only movement (spec §7)', () => {
  const w = makeWorld((c) => { c.player.area.w = 0; }); run(w, fakeInput(['right', 'down']), 0.5, updatePlayerOnly);
  expect(w.player.x).toBe(12); expect(w.player.y).toBeGreaterThan(142);
});
test('auto-fires 8 shots per second with shot damage', () => {
  const w = makeWorld(); run(w, fakeInput(), 59 / 60, updatePlayerOnly);   // 59 steps: stays clear of the 9th shot at exactly 1.0 s
  expect(w.playerBullets.count).toBe(8); expect(w.playerBullets.get(0).damage).toBeCloseTo(w.stats.shotDamage * closeBonus(w));
});
test('timers count down and stop at 0', () => {
  const w = makeWorld(); w.player.invuln = 0.5; w.player.specialCd = 0.5;
  run(w, fakeInput(), 1, updatePlayerOnly); expect([w.player.invuln, w.player.specialCd]).toEqual([0, 0]);
});
test('does nothing once the round is over', () => {
  const w = makeWorld(); w.status = 'lost'; run(w, fakeInput(['right']), 0.5, updatePlayerOnly);
  expect(w.player.x).toBe(40); expect(w.playerBullets.count).toBe(0);
});
test('bullets spawn at the nose', () => {
  const w = makeWorld(); updatePlayer(w, fakeInput(), 1 / 60);
  const b = w.playerBullets.get(0);
  expect([b.x, b.y, b.vx, b.vy]).toEqual([40 + 8, 142, 360, 0]);
});
test('a full bullet pool skips the shot without throwing', () => {
  const w = makeWorld(); while (w.playerBullets.acquire()) { /* fill */ }
  expect(() => run(w, fakeInput(), 0.5, updatePlayerOnly)).not.toThrow();
});
test('shots fired at the front of the area carry ×1.5 damage', () => {
  const w = makeWorld(); w.player.x = 160; updatePlayer(w, fakeInput(), 1 / 60);
  expect(w.playerBullets.get(0).damage).toBeCloseTo(w.stats.shotDamage * 1.5);
});
test('specialReady fires once when the cooldown runs out', () => {
  const w = makeWorld(); w.player.specialCd = 0.01; updatePlayer(w, fakeInput(), 1 / 60);
  expect(w.events.map((e) => e.type)).toContain('specialReady');
  w.events.length = 0; updatePlayer(w, fakeInput(), 1 / 60); expect(w.events).toEqual([]);
});
test('no specialReady at round start (E starts ready) or after the round ends', () => {
  const w = makeWorld(); run(w, fakeInput(), 0.1, updatePlayerOnly); expect(w.events.map((e) => e.type)).not.toContain('specialReady');
  const v = makeWorld(); v.status = 'won'; v.player.specialCd = 0.01; updatePlayer(v, fakeInput(), 1 / 60);
  expect(v.events.map((e) => e.type)).not.toContain('specialReady');
});
