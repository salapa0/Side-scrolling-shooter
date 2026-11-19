import { expect, test } from 'vitest';
import { bossDefeated, damageBoss, updateBoss, updateDrones } from './enemies';
import { defeatBoss, fakeInput, makeWorld, run } from './testUtils';

test('emptying stage 1 moves to stage 2 once, refilling and immune', () => {
  const w = makeWorld(); damageBoss(w, 5000);   // overkill is lost   (Review Focus 1)
  expect([w.boss.phase, w.boss.hp, w.boss.charge]).toEqual([2, 0, 1]);
  expect(w.events.filter((e) => e.type === 'phaseChanged')).toHaveLength(1);
  expect(damageBoss(w, 100)).toBe(false); expect(w.boss.phase).toBe(2);   // Review Focus 2
});
test('the next bar refills to full over chargeTime, with no attacks meanwhile', () => {
  const w = makeWorld(); damageBoss(w, 2000); w.events.length = 0;
  run(w, fakeInput(), 0.5, (v, _i, dt) => updateBoss(v, dt)); expect(w.boss.hp).toBeCloseTo(1000, -1);
  expect(w.drones.count).toBe(0); expect(w.enemyBullets.count).toBe(0);
  run(w, fakeInput(), 0.6, (v, _i, dt) => updateBoss(v, dt)); expect([w.boss.hp, w.boss.charge]).toEqual([2000, 0]);
});
test('only the final stage at 0 HP counts as defeated', () => {
  const w = makeWorld(); damageBoss(w, 2000); expect(bossDefeated(w.boss, 3)).toBe(false);
  w.boss.phase = 3; w.boss.charge = 0; w.boss.hp = 10; damageBoss(w, 10); expect(bossDefeated(w.boss, 3)).toBe(true);
});
test('phase 1 launches drones but no boss bullets', () => {
  const w = makeWorld(); run(w, fakeInput(), 3, (w, _i, dt) => updateBoss(w, dt));
  expect(w.drones.count).toBeGreaterThanOrEqual(4); expect(w.enemyBullets.count).toBe(0);
});
test('phase 2 fires an aimed spread', () => {
  const w = makeWorld(); w.boss.phase = 2;
  run(w, fakeInput(), 1.3, (w, _i, dt) => updateBoss(w, dt)); expect(w.enemyBullets.count).toBeGreaterThanOrEqual(5);
});
test('full pools are skipped without throwing', () => {     // Review Focus 4
  const w = makeWorld(); w.boss.phase = 3;
  while (w.drones.acquire()); while (w.enemyBullets.acquire());
  expect(() => run(w, fakeInput(), 3, (w, _i, dt) => updateBoss(w, dt))).not.toThrow();
  expect(w.drones.count).toBe(w.drones.capacity);
  expect(() => run(w, fakeInput(), 1, (w, _i, dt) => updateDrones(w, dt))).not.toThrow(); // blank drones fire into the full bullet pool
});
test('drone flies left and is released off-screen', () => {
  const w = makeWorld(); const d = w.drones.acquire()!; Object.assign(d, { x: 10, y: 100, baseY: 100, hp: 20, age: 0, fireTimer: 99 });
  run(w, fakeInput(), 1, (w, _i, dt) => updateDrones(w, dt)); expect(w.drones.count).toBe(0);
});
test('drone shots are aimed at the player at bullet speed', () => {
  const w = makeWorld(); const d = w.drones.acquire()!; Object.assign(d, { x: 300, y: 142, baseY: 142, hp: 20, age: 0, fireTimer: 0 });
  updateDrones(w, 1 / 60); const b = w.enemyBullets.get(0);
  expect(b.vx).toBeLessThan(0); expect(Math.hypot(b.vx, b.vy)).toBeCloseTo(110);
});
test('nothing spawns once the round is over', () => {
  const w = makeWorld(); w.status = 'won'; run(w, fakeInput(), 3, (w, _i, dt) => updateBoss(w, dt)); expect(w.drones.count).toBe(0);
});
test('boss flash decays even after the round ends, clamped at 0', () => {
  const w = makeWorld(); w.status = 'won'; w.boss.flash = 0.05;
  run(w, fakeInput(), 1, (w, _i, dt) => updateBoss(w, dt)); expect(w.boss.flash).toBe(0);
});
test('boss moves to the phase x without overshooting', () => {
  const w = makeWorld(); w.boss.phase = 2; w.boss.x = 420;
  run(w, fakeInput(), 5, (w, _i, dt) => updateBoss(w, dt)); expect(w.boss.x).toBe(370);
});
test('phase 3 spiral fires opposite bullet pairs and turns', () => {
  const w = makeWorld(); w.boss.phase = 3; w.boss.spreadTimer = 99; w.boss.droneTimer = 99;
  updateBoss(w, 1 / 60);
  expect(w.enemyBullets.count).toBe(2);
  const a = w.enemyBullets.get(0), b = w.enemyBullets.get(1);
  expect(a.vx + b.vx).toBeCloseTo(0); expect(a.vy + b.vy).toBeCloseTo(0);
  expect(w.boss.spiralAngle).toBeCloseTo(w.cfg.boss.spiralTurn);
});
test('drones keep moving and aging but do not fire after the round ends', () => {
  const w = makeWorld(); w.status = 'lost'; const d = w.drones.acquire()!;
  Object.assign(d, { x: 300, y: 142, baseY: 142, hp: 20, age: 0, fireTimer: 0, flash: 0 });
  updateDrones(w, 1 / 60); expect(w.enemyBullets.count).toBe(0); expect(d.x).toBeLessThan(300); expect(d.age).toBeGreaterThan(0);
});
test('a dead boss emits no phase change and spawns nothing', () => {
  const w = makeWorld(); defeatBoss(w);
  updateBoss(w, 1 / 60);
  expect(w.events).toHaveLength(0); expect(w.drones.count).toBe(0); expect(w.enemyBullets.count).toBe(0);
});
test.each([0, -1])('droneInterval %i means no drone waves, and does not hang', (interval) => {
  const w = makeWorld((c) => { c.boss.phases[0].droneInterval = interval; });
  updateBoss(w, 1 / 60);
  expect(w.drones.count).toBe(0);
});
test.each([0, -1])('drone fireInterval %i means drones do not fire, and does not hang', (interval) => {
  const w = makeWorld((c) => { c.drone.fireInterval = interval; });
  const d = w.drones.acquire()!; Object.assign(d, { x: 300, y: 142, baseY: 142, hp: 20, age: 0, fireTimer: 0 });
  updateDrones(w, 1 / 60);
  expect(w.enemyBullets.count).toBe(0);
});
test('chargeTime 0 means no pause, and the next stage still starts at full HP', () => {
  const w = makeWorld((c) => { c.boss.chargeTime = 0; }); damageBoss(w, 2000);
  expect([w.boss.phase, w.boss.hp, w.boss.charge]).toEqual([2, 2000, 0]);
  damageBoss(w, 1); damageBoss(w, 1); expect([w.boss.phase, bossDefeated(w.boss, 3)]).toEqual([2, false]);
});
