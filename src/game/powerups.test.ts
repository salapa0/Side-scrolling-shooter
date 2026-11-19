import { expect, test } from 'vitest';
import type { Config } from '../config';
import { fireBeam, resolveCombat } from './combat';
import { choosePowerUpKind, maybeDropPowerUp, updatePowerUps } from './powerups';
import { drone, fakeInput, makeWorld, run, shoot } from './testUtils';

const always = (c: Config): void => { c.powerUps.dropChance = 1; };

test.each([[0, 'rapid'], [0.3, 'health'], [0.6, 'charge'], [0.9, 'clear']])('hurt and charging: roll %f → %s', (roll, kind) => {
  const w = makeWorld(); w.player.hp = 2; w.player.specialCd = 3; expect(choosePowerUpKind(w, roll)).toBe(kind);
});
test.each([[0, 'rapid'], [0.49, 'rapid'], [0.5, 'clear'], [0.99, 'clear']])('full HP and E ready never roll health or charge: %f → %s', (roll, kind) => {
  expect(choosePowerUpKind(makeWorld(), roll)).toBe(kind);
});
test('a drone killed by a bullet drops a power-up where it died', () => {
  const w = makeWorld(always); drone(w, 200, 100, 5); shoot(w, 200, 100); resolveCombat(w);
  expect(w.powerUps.count).toBe(1); expect([w.powerUps.get(0).x, w.powerUps.get(0).y]).toEqual([200, 100]);
});
test('no drop when the roll misses', () => {
  const w = makeWorld((c) => { c.powerUps.dropChance = 0; }); drone(w, 200, 100, 5); shoot(w, 200, 100); resolveCombat(w);
  expect(w.powerUps.count).toBe(0);
});
test('beam kills drop too, but never more than 2 on screen', () => {
  const w = makeWorld(always); w.player.y = 100; drone(w, 200, 100); drone(w, 250, 100); drone(w, 300, 100); fireBeam(w);
  expect(w.powerUps.count).toBe(2);
});
test('drops are pulled inside the player area so they stay reachable', () => {   // Review Focus 3
  const w = makeWorld(always); maybeDropPowerUp(w, 300, 5); maybeDropPowerUp(w, 300, 269);
  expect([w.powerUps.get(0).y, w.powerUps.get(1).y]).toEqual([24, 260]);
});
test('drifts left at driftSpeed when far from the ship', () => {
  const w = makeWorld(always); maybeDropPowerUp(w, 300, 100); run(w, fakeInput(), 1, (v, _i, dt) => updatePowerUps(v, dt));
  expect(w.powerUps.get(0).x).toBeCloseTo(260, 0);
});
test('within magnetRadius it homes in on the ship', () => {
  const w = makeWorld(always); maybeDropPowerUp(w, w.player.x + 40, w.player.y); run(w, fakeInput(), 0.1, (v, _i, dt) => updatePowerUps(v, dt));
  const u = w.powerUps.get(0); expect(Math.hypot(u.x - w.player.x, u.y - w.player.y)).toBeCloseTo(24, 0);
});
test('leaves the pool once off the left edge', () => {
  const w = makeWorld(always); maybeDropPowerUp(w, 300, 100); w.powerUps.get(0).x = -20; updatePowerUps(w, 1 / 60);
  expect(w.powerUps.count).toBe(0);
});
