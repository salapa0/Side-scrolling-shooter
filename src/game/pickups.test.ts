import { expect, test } from 'vitest';
import type { Config } from '../config';
import { updateEffects } from './effects';
import { applyPowerUp, resolvePickups } from './pickups';
import { updatePlayer } from './player';
import { maybeDropPowerUp } from './powerups';
import { stepWorld } from './step';
import { drone, enemyShot, fakeInput, makeWorld, run } from './testUtils';

const always = (c: Config): void => { c.powerUps.dropChance = 1; };

test('touching the ship edge collects it: pickup uses the whole ship, not the hitbox', () => {
  const w = makeWorld(always); maybeDropPowerUp(w, w.player.x + 10, w.player.y); const kind = w.powerUps.get(0).kind;
  resolvePickups(w);
  expect(w.powerUps.count).toBe(0); expect(w.events).toContainEqual(expect.objectContaining({ type: 'powerUpCollected', kind }));
  expect(w.lastPickup).toEqual({ kind, time: w.time });
});
test('nothing is collected once the round has ended', () => {
  const w = makeWorld(always); maybeDropPowerUp(w, w.player.x, w.player.y); w.status = 'won'; resolvePickups(w);
  expect(w.powerUps.count).toBe(1);
});
test('rapid doubles the fire rate', () => {
  const w = makeWorld(); applyPowerUp(w, 'rapid'); expect(w.player.rapid).toBe(6);
  run(w, fakeInput(), 59 / 60, (v, i, dt) => updatePlayer(v, i, dt)); expect(w.playerBullets.count).toBe(16);
});
test('rapid wears off, and a second pickup resets it to 6 s instead of stacking', () => {
  const w = makeWorld(); applyPowerUp(w, 'rapid'); run(w, fakeInput(), 6.1, (v, i, dt) => updatePlayer(v, i, dt)); expect(w.player.rapid).toBe(0);
  w.player.rapid = 2; applyPowerUp(w, 'rapid'); expect(w.player.rapid).toBe(6);
});
test('health adds a heart up to max', () => {
  const w = makeWorld(); const max = w.cfg.player.hp; w.player.hp = max - 1; applyPowerUp(w, 'health'); expect(w.player.hp).toBe(max);
  applyPowerUp(w, 'health'); expect(w.player.hp).toBe(max);
});
test('charge readies E and fires specialReady, and does nothing when E is ready', () => {
  const w = makeWorld(); w.player.specialCd = 5; applyPowerUp(w, 'charge');
  expect(w.player.specialCd).toBe(0); expect(w.events.map((e) => e.type)).toEqual(['specialReady']);
  w.events.length = 0; applyPowerUp(w, 'charge'); expect(w.events).toEqual([]);
});
test('clear destroys every drone (counted, no drops), removes enemy fire, spares the boss', () => {
  const w = makeWorld(always); drone(w, 200, 100); drone(w, 250, 150); drone(w, 300, 200); enemyShot(w, 100, 100); enemyShot(w, 120, 60);
  applyPowerUp(w, 'clear');
  expect([w.drones.count, w.kills, w.powerUps.count, w.enemyBullets.count, w.boss.hp]).toEqual([0, 3, 0, 0, w.boss.maxHp]);
});
test('clear with a full drone pool does not throw', () => {   // Review Focus 4
  const w = makeWorld(); w.player.invuln = 99;
  for (let i = 0; i < w.drones.capacity; i++) drone(w, 200 + (i % 8) * 20, 40 + Math.floor(i / 8) * 25);
  applyPowerUp(w, 'clear'); expect(w.kills).toBe(64); expect(() => updateEffects(w, 1 / 60)).not.toThrow();   // runs the 64 death bursts
});
test('a pickup touched on the step of a lethal hit is not collected (no revive)', () => {
  const w = makeWorld(always); w.player.hp = 1;
  maybeDropPowerUp(w, w.player.x, w.player.y); w.powerUps.get(0).kind = 'health';
  enemyShot(w, w.player.x, w.player.y); stepWorld(w, fakeInput(), 1 / 60);
  expect([w.player.hp, w.status, w.powerUps.count]).toEqual([0, 'lost', 1]);
  expect(w.events.map((e) => e.type)).not.toContain('powerUpCollected');
});
