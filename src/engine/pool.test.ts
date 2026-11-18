import { expect, test } from 'vitest';
import { Pool } from './pool';

test('acquires up to capacity, then null', () => {
  const p = new Pool(2, () => ({ v: 0 }));
  p.acquire();
  p.acquire();
  expect(p.acquire()).toBeNull();
});

test('creates every object up front and reuses them', () => {
  let made = 0;
  const p = new Pool(3, () => ({ id: made++ }));
  const a = p.acquire()!;
  p.releaseAt(0);
  expect(p.acquire()).toBe(a);
  expect(made).toBe(3);
});

test('releaseAt swaps the last active item into the hole', () => {
  const p = new Pool(3, () => ({ n: 0 }));
  const [a, b, c] = [p.acquire()!, p.acquire()!, p.acquire()!];
  a.n = 1;
  b.n = 2;
  c.n = 3;
  p.releaseAt(0);
  expect(p.count).toBe(2);
  expect(p.get(0)).toBe(c);
  expect(p.get(1)).toBe(b);
});

test('clear empties the pool but keeps objects for reuse', () => {
  const p = new Pool(2, () => ({ v: 0 }));
  const a = p.acquire()!;
  p.clear();
  expect(p.count).toBe(0);
  expect(p.acquire()).toBe(a);
});
