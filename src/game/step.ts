import type { InputState } from '../engine/input';
import { resolveCombat } from './combat';
import { updateBoss, updateDrones } from './enemies';
import { updateEffects } from './effects';
import { updatePlayer } from './player';
import { updateBullets } from './projectiles';
import { updateRound } from './round';
import type { World } from './world';

export function stepWorld(w: World, input: InputState, dt: number): void {
  w.events.length = 0;
  if (w.fx.hitStop > 0) {
    w.fx.hitStop -= dt;
    return;
  }
  w.time += dt;
  updatePlayer(w, input, dt);
  updateBoss(w, dt);
  updateDrones(w, dt);
  updateBullets(w.playerBullets, dt, w.cfg.view);
  updateBullets(w.enemyBullets, dt, w.cfg.view);
  resolveCombat(w);
  updateRound(w, dt);
  updateEffects(w, dt);
}
