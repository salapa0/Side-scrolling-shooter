import { expect, test } from 'vitest';
import { fireBeam, resolveCombat } from './combat';
import { updatePlayer } from './player';
import { drone, enemyShot, fakeInput, makeWorld, shoot } from './testUtils';

test('bullet damages a drone, flashes it, and is used up', () => {
  const w = makeWorld(); const d = drone(w, 200, 100); shoot(w, 200, 100); resolveCombat(w);
  expect(d.hp).toBe(10); expect(d.flash).toBeGreaterThan(0); expect(w.playerBullets.count).toBe(0);
});
test('killing a drone counts and emits droneKilled', () => {
  const w = makeWorld(); drone(w, 200, 100, 5); shoot(w, 200, 100); resolveCombat(w);
  expect(w.drones.count).toBe(0); expect(w.kills).toBe(1); expect(w.events[0]).toMatchObject({ type: 'droneKilled' });
});
test('bullet hits the boss and HP never goes below 0', () => {
  const w = makeWorld(); w.boss.hp = 5; shoot(w, w.boss.x, w.boss.y); resolveCombat(w);
  expect(w.boss.hp).toBe(0); expect(w.events[0]).toMatchObject({ type: 'bossHit' });
});
test('a bullet over both a drone and the boss hits only the drone', () => {
  const w = makeWorld(); drone(w, w.boss.x, w.boss.y); shoot(w, w.boss.x, w.boss.y); resolveCombat(w);
  expect(w.boss.hp).toBe(w.boss.maxHp);
});
test('enemy bullet hit costs 1 HP and grants invulnerability', () => {
  const w = makeWorld(); enemyShot(w, w.player.x, w.player.y); resolveCombat(w);
  expect(w.player.hp).toBe(2); expect(w.player.invuln).toBe(1); expect(w.enemyBullets.count).toBe(0);
  expect(w.events[0]).toMatchObject({ type: 'playerHit' });
});
test('invulnerable player is not hit and the bullet survives', () => {
  const w = makeWorld(); w.player.invuln = 0.5; enemyShot(w, w.player.x, w.player.y); resolveCombat(w);
  expect(w.player.hp).toBe(3); expect(w.enemyBullets.count).toBe(1);
});
test('drone collision hurts the player but does not count as a kill', () => {
  const w = makeWorld(); drone(w, w.player.x, w.player.y); resolveCombat(w);
  expect(w.player.hp).toBe(2); expect(w.drones.count).toBe(0); expect(w.kills).toBe(0);
  expect(w.events.map((e) => e.type)).toEqual(['playerHit']);
});
test('last hit emits playerKilled', () => {
  const w = makeWorld(); w.player.hp = 1; enemyShot(w, w.player.x, w.player.y); resolveCombat(w);
  expect(w.events.map((e) => e.type)).toContain('playerKilled');
});
test('after a hit, a second bullet in the same pass goes through untouched', () => {
  const w = makeWorld(); enemyShot(w, w.player.x, w.player.y); enemyShot(w, w.player.x, w.player.y); resolveCombat(w);
  expect(w.player.hp).toBe(2); expect(w.enemyBullets.count).toBe(1);
});
test('nothing collides once the round has ended', () => {
  const w = makeWorld(); w.status = 'lost'; enemyShot(w, w.player.x, w.player.y); resolveCombat(w);
  expect(w.player.hp).toBe(3); expect(w.enemyBullets.count).toBe(1);
});
test('beam hits the boss for AMP × ATK and clears drones in its row', () => {
  const w = makeWorld(); w.player.y = w.boss.y; drone(w, 250, w.boss.y, 999); const outRow = drone(w, 250, w.boss.y - 60);
  fireBeam(w);
  expect(w.boss.hp).toBe(w.boss.maxHp - 50); expect(w.kills).toBe(1);
  expect(w.drones.count).toBe(1); expect(w.drones.get(0)).toBe(outRow);
  expect(w.beam.time).toBe(0.35);
  expect(w.events.map((e) => e.type)).toEqual(['bossHit', 'droneKilled', 'beamFired']);
});
test('beam that misses the boss row leaves its HP alone', () => {
  const w = makeWorld(); w.player.y = 24; w.boss.y = 230; fireBeam(w); expect(w.boss.hp).toBe(w.boss.maxHp);
});
test('E fires the beam once, then waits for the cooldown', () => {
  const w = makeWorld(); updatePlayer(w, fakeInput([], ['special']), 1 / 60); expect(w.player.specialCd).toBe(8);
  const hp = w.boss.hp; updatePlayer(w, fakeInput([], ['special']), 1 / 60); expect(w.boss.hp).toBe(hp);
});
test('beam timer decays and stops at 0, even after the round ends', () => {
  const w = makeWorld(); w.beam.time = 0.01; w.status = 'won'; updatePlayer(w, fakeInput(), 1 / 60);
  expect(w.beam.time).toBe(0);
});
test('an enemy bullet costs the player its own damage', () => {
  const w = makeWorld(); enemyShot(w, w.player.x, w.player.y).damage = 2; resolveCombat(w);
  expect(w.player.hp).toBe(1);
});
test('a second bullet is not eaten by a drone the first one just killed', () => {
  const w = makeWorld(); drone(w, 200, 100, 10); shoot(w, 200, 100); shoot(w, 200, 100); resolveCombat(w);
  expect(w.kills).toBe(1); expect(w.playerBullets.count).toBe(1);
});
