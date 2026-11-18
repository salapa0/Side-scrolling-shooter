import { expect, test } from 'vitest';
import { toResult, updateRound } from './round';
import { fakeInput, makeWorld, run } from './testUtils';

test('boss at 0 HP wins', () => {
  const w = makeWorld(); w.boss.hp = 0; updateRound(w, 1 / 60);
  expect([w.status, w.reason]).toEqual(['won', 'boss']); expect(w.events[0]).toMatchObject({ type: 'bossKilled' });
});
test('boss dying on the last tick still wins', () => {
  const w = makeWorld(); w.boss.hp = 0; w.timeLeft = 0.001; updateRound(w, 1 / 60); expect(w.status).toBe('won');
});
test('player at 0 HP loses', () => {
  const w = makeWorld(); w.player.hp = 0; updateRound(w, 1 / 60); expect([w.status, w.reason]).toEqual(['lost', 'hp']);
});
test('timer running out loses and stops at 0', () => {
  const w = makeWorld(); w.timeLeft = 0.01; updateRound(w, 1 / 60);
  expect([w.status, w.reason, w.timeLeft]).toEqual(['lost', 'time', 0]);
});
test('round finishes after the end delay', () => {
  const w = makeWorld(); w.boss.hp = 0; updateRound(w, 1 / 60);
  run(w, fakeInput(), 1.4, (w, _i, dt) => updateRound(w, dt)); expect(w.finished).toBe(false);
  run(w, fakeInput(), 0.2, (w, _i, dt) => updateRound(w, dt)); expect(w.finished).toBe(true);
});
test('time left freezes once the round is decided', () => {
  const w = makeWorld(); w.boss.hp = 0; updateRound(w, 1 / 60); const left = w.timeLeft;
  run(w, fakeInput(), 1, (w, _i, dt) => updateRound(w, dt)); expect(w.timeLeft).toBe(left);
});
test('results: win keeps time left, fail does not, and both are plain JSON', () => {
  const input = { flatAttack: 5, cdReduction: 10, playTime: 120 };
  const w = makeWorld(); w.boss.hp = 0; w.kills = 7; updateRound(w, 1 / 60);
  const r = toResult(w, input);
  expect(r).toMatchObject({ outcome: 'win', reason: 'boss', kills: 7, stats: input }); expect(r.timeLeft).toBeGreaterThan(0);
  expect(JSON.parse(JSON.stringify(r))).toEqual(r);
  const l = makeWorld(); l.player.hp = 0; updateRound(l, 1 / 60); expect(toResult(l, input).timeLeft).toBeNull();
});
