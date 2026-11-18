import type { InputState } from '../engine/input';
import { updateBoss, updateDrones } from './enemies';
import { updatePlayer } from './player';
import { updateBullets } from './projectiles';
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
  // Slot 7: resolveCombat (Task 7).
  // Slot 8: updateRound (Task 8).
  // Slot 9: updateEffects (Task 9).
}
