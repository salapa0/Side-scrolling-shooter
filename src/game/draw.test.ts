import { expect, test } from 'vitest';
import { lowHpAlpha } from './draw';
import { makeWorld } from './testUtils';

test('no warning above 1 HP, at 0 HP, or after the round ends', () => {
  const w = makeWorld(); expect(lowHpAlpha(w)).toBe(0);
  w.player.hp = 0; expect(lowHpAlpha(w)).toBe(0);
  w.player.hp = 1; w.status = 'lost'; expect(lowHpAlpha(w)).toBe(0);
});
test('on the last heart the edge pulses between 0 and lowHpAlpha with world time', () => {
  const w = makeWorld(); w.player.hp = 1; const seen = new Set<number>();
  for (let i = 0; i < 30; i++) { w.time = i / 60; const a = lowHpAlpha(w); expect(a).toBeGreaterThanOrEqual(0); expect(a).toBeLessThanOrEqual(0.5); seen.add(Math.round(a * 100)); }
  expect(seen.size).toBeGreaterThan(5);
});
