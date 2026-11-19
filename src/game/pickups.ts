import { overlaps } from '../engine/geom';
import { clearScreen, readySpecial } from './combat';
import type { PowerUpKind, World } from './world';

export function applyPowerUp(w: World, kind: PowerUpKind): void {
  const p = w.player;
  switch (kind) {
    case 'rapid': p.rapid = w.cfg.player.rapidTime; break; // resets, never stacks
    case 'health': p.hp = Math.min(w.cfg.player.hp, p.hp + 1); break;
    case 'charge': readySpecial(w); break;
    case 'clear': clearScreen(w); break;
  }
}

/** Pickups use the whole ship, not the damage hitbox, so grabbing stays generous. */
export function resolvePickups(w: World): void {
  // A lethal hit this step ends the round in updateRound; a pickup must not undo it first.
  if (w.status !== 'playing' || w.player.hp <= 0) return;
  for (let i = w.powerUps.count - 1; i >= 0; i--) {
    const u = w.powerUps.get(i);
    if (!overlaps(u, w.player)) continue;
    const kind = u.kind;
    w.events.push({ type: 'powerUpCollected', kind, x: u.x, y: u.y });
    w.lastPickup.kind = kind;
    w.lastPickup.time = w.time;
    w.powerUps.releaseAt(i);
    applyPowerUp(w, kind);
  }
}
