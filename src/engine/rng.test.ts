import { expect, test } from 'vitest';
import { createRng } from './rng';

test('same seed gives the same sequence', () => {
  const a = createRng(7);
  const b = createRng(7);
  expect([a(), a()]).toEqual([b(), b()]);
});

test('different seeds differ', () => {
  expect(createRng(1)()).not.toBe(createRng(2)());
});

test('draws stay in [0, 1)', () => {
  const r = createRng(1);
  for (let i = 0; i < 1000; i++) {
    const v = r();
    expect(v).toBeGreaterThanOrEqual(0);
    expect(v).toBeLessThan(1);
  }
});
