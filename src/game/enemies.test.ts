import { expect, test } from 'vitest';
import { updateBoss, updateDrones, phaseFor } from './enemies';
import { fakeInput, makeWorld, run } from './testUtils';

test.each([[1, 1], [0.61, 1], [0.6, 2], [0.25, 2], [0.249, 3], [0, 3]])('phaseFor(%f) = %i', (f, p) => {
  expect(phaseFor(f, [0.6, 0.25])).toBe(p);
});
test('emits phaseChanged once when crossing 60%', () => {
  const w = makeWorld(); w.boss.hp = w.boss.maxHp * 0.59;
  updateBoss(w, 1 / 60); expect(w.boss.phase).toBe(2);
  expect(w.events.filter((e) => e.type === 'phaseChanged')).toHaveLength(1);
  w.events.length = 0; updateBoss(w, 1 / 60); expect(w.events).toHaveLength(0);
});
test('jumping from phase 1 to 3 emits one event for phase 3', () => {
  const w = makeWorld(); w.boss.hp = 1; updateBoss(w, 1 / 60);
  expect(w.events).toEqual([expect.objectContaining({ type: 'phaseChanged', phase: 3 })]);
});
test('phase 1 launches drones but no boss bullets', () => {
  const w = makeWorld(); run(w, fakeInput(), 3, (w, _i, dt) => updateBoss(w, dt));
  expect(w.drones.count).toBeGreaterThanOrEqual(4); expect(w.enemyBullets.count).toBe(0);
});
test('phase 2 fires an aimed spread', () => {
  const w = makeWorld(); w.boss.hp = w.boss.maxHp * 0.5;
  run(w, fakeInput(), 1.3, (w, _i, dt) => updateBoss(w, dt)); expect(w.enemyBullets.count).toBeGreaterThanOrEqual(5);
});
test('full pools are skipped without throwing', () => {     // Review Focus 4
  const w = makeWorld(); w.boss.hp = 1;
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
  const w = makeWorld(); w.boss.hp = w.boss.maxHp * 0.5; w.boss.x = 420;
  run(w, fakeInput(), 5, (w, _i, dt) => updateBoss(w, dt)); expect(w.boss.x).toBe(370);
});
test('phase 3 spiral fires opposite bullet pairs and turns', () => {
  const w = makeWorld(); w.boss.hp = 1; w.boss.spreadTimer = 99; w.boss.droneTimer = 99;
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
