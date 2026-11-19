import { expect, test } from 'vitest';
import { closeBonus } from './bonus';
import { makeWorld } from './testUtils';

test.each([[12, 1], [160, 1.5], [86, 1.25], [0, 1], [500, 1.5]])('closeBonus at x %i = %f', (x, out) => {
  const w = makeWorld(); w.player.x = x; expect(closeBonus(w)).toBeCloseTo(out);
});
test('zero-width movement area gives ×1, never NaN', () => {   // Review Focus 3
  const w = makeWorld((c) => { c.player.area.w = 0; }); w.player.x = 12; expect(closeBonus(w)).toBe(1);
});
