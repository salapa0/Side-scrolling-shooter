import { expect, test } from 'vitest';
import { heartString, specialFraction } from './hud';

test.each([[3, 3, '♥♥♥'], [1, 3, '♥♡♡'], [0, 3, '♡♡♡'], [-1, 2, '♡♡']])('heartString(%i, %i) = %s', (hp, max, out) => {
  expect(heartString(hp, max)).toBe(out);
});

test.each([[0, 10, 1], [5, 10, 0.5], [10, 10, 0], [-1, 10, 1], [12, 10, 0], [3, 0, 1]])(
  'specialFraction(cd %f of %f) = %f',
  (cd, total, out) => {
    expect(specialFraction(cd, total)).toBe(out);
  },
);
