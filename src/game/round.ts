import type { StatInput } from '../stats';
import type { World } from './world';

/** Plain data only, so it can be stored or sent to a leaderboard later (spec §5.4). */
export interface RoundResult { outcome: 'win' | 'fail'; reason: 'boss' | 'time' | 'hp'; kills: number; timeLeft: number | null; stats: StatInput }

function endRound(w: World, status: 'won' | 'lost', reason: 'boss' | 'time' | 'hp'): void {
  w.status = status;
  w.reason = reason;
  w.endTimer = w.cfg.round.endDelay;
  if (status === 'won') w.events.push({ type: 'bossKilled', x: w.boss.x, y: w.boss.y });
}

export function updateRound(w: World, dt: number): void {
  if (w.status !== 'playing') {
    w.endTimer = Math.max(0, w.endTimer - dt);
    w.finished = w.endTimer <= 0;
    return;
  }
  w.timeLeft = Math.max(0, w.timeLeft - dt);
  // A boss kill on the final tick still counts as a win (spec §5.3).
  if (w.boss.hp <= 0) endRound(w, 'won', 'boss');
  else if (w.player.hp <= 0) endRound(w, 'lost', 'hp');
  else if (w.timeLeft === 0) endRound(w, 'lost', 'time');
}

export function toResult(w: World, input: StatInput): RoundResult {
  if (w.reason === null) throw new Error('toResult needs a round that has ended.');
  const won = w.status === 'won';
  return {
    outcome: won ? 'win' : 'fail',
    reason: w.reason,
    kills: w.kills,
    timeLeft: won ? w.timeLeft : null,
    stats: { ...input },
  };
}
