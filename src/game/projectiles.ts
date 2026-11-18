import type { Config } from '../config';
import type { Pool } from '../engine/pool';
import type { Bullet } from './world';

// Off-screen culling distance, not a gameplay value.
const BULLET_MARGIN = 16;

export function updateBullets(pool: Pool<Bullet>, dt: number, view: Config['view'], margin = BULLET_MARGIN): void {
  for (let i = pool.count - 1; i >= 0; i--) {
    const b = pool.get(i);
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.x <= -margin || b.x >= view.width + margin || b.y <= -margin || b.y >= view.height + margin) {
      pool.releaseAt(i);
    }
  }
}
