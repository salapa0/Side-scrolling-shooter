import { expect, test } from 'vitest';
import { CONFIG } from '../config';
import { Pool } from '../engine/pool';
import { updateBullets } from './projectiles';
import { blankBullet, type Bullet } from './world';

test('moves bullets and releases those past the margin', () => {
  const pool = new Pool<Bullet>(4, blankBullet);
  Object.assign(pool.acquire()!, { x: 100, vx: 360 }); Object.assign(pool.acquire()!, { x: 490, vx: 360 });
  updateBullets(pool, 1 / 60, CONFIG.view);
  expect(pool.count).toBe(1); expect(pool.get(0).x).toBeCloseTo(106);
});
test('releases on every edge, inclusive of the margin', () => {
  const pool = new Pool<Bullet>(4, blankBullet);
  Object.assign(pool.acquire()!, { x: -16, y: 100 }); Object.assign(pool.acquire()!, { x: 100, y: -16 });
  Object.assign(pool.acquire()!, { x: 100, y: 286 }); Object.assign(pool.acquire()!, { x: 496, y: 100 });
  updateBullets(pool, 1 / 60, CONFIG.view);
  expect(pool.count).toBe(0);
});
