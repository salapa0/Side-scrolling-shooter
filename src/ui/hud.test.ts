import { expect, test } from 'vitest';
import { heartString, pickupLabel, rapidText, specialFraction } from './hud';

test.each([[3, 3, '♥♥♥'], [1, 3, '♥♡♡'], [0, 3, '♡♡♡'], [-1, 2, '♡♡']])('heartString(%i, %i) = %s', (hp, max, out) => {
  expect(heartString(hp, max)).toBe(out);
});

test.each([[0, 10, 1], [5, 10, 0.5], [10, 10, 0], [-1, 10, 1], [12, 10, 0], [3, 0, 1]])(
  'specialFraction(cd %f of %f) = %f',
  (cd, total, out) => {
    expect(specialFraction(cd, total)).toBe(out);
  },
);

test.each([[null, 0, ''], ['health', 0.5, '+1 HP'], ['clear', 0, 'SCREEN CLEAR'], ['rapid', 1.2, ''], ['charge', 5, '']] as const)(
  'pickupLabel(%s, %f s ago)', (kind, since, out) => { expect(pickupLabel(kind, since, 1.2)).toBe(out); });
test.each([[0, ''], [-1, ''], [6, 'RAPID 6.0'], [4.21, 'RAPID 4.3'], [0.01, 'RAPID 0.1']])('rapidText(%f) = %s', (r, out) => {
  expect(rapidText(r)).toBe(out);
});
