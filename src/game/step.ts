import type { InputState } from '../engine/input';
import { resolveCombat } from './combat';
import { updateBoss, updateDrones } from './enemies';
import { timeScaleFor, updateEffects } from './effects';
import { resolvePickups } from './pickups';
import { updatePlayer } from './player';
import { updatePowerUps } from './powerups';
import { updateBullets } from './projectiles';
import { updateRound } from './round';
import type { World } from './world';

export function stepWorld(w: World, input: InputState, dt: number): void {
  w.events.length = 0;
  w.fx.impact = Math.max(0, w.fx.impact - dt); // real time, so the freeze frame ends with its hit-stop
  if (w.fx.hitStop > 0) {
    w.fx.hitStop -= dt;
    return;
  }
  // Slow-mo timers run on real time; everything simulated runs on the scaled step.
  const f = w.fx;
  f.timeScale = timeScaleFor(f.slowMo, w.cfg.fx);
  f.slowMo = Math.max(0, f.slowMo - dt);
  f.readyFlash = Math.max(0, f.readyFlash - dt);
  const s = dt * f.timeScale;
  w.time += s;
  updatePlayer(w, input, s);
  updateBoss(w, s);
  updateDrones(w, s);
  updateBullets(w.playerBullets, s, w.cfg.view);
  updateBullets(w.enemyBullets, s, w.cfg.view);
  resolveCombat(w);
  updatePowerUps(w, s);
  resolvePickups(w);
  updateRound(w, s);
  updateEffects(w, s);
}
