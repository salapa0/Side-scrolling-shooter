// Test-only helpers for the round log.
import type { RoundResult } from './game/round';
import type { TallyRecord, TallyStorage } from './tally';

export function rec(outcome: RoundResult['outcome'], reason: RoundResult['reason'], flatAttack: number, bossMaxHp = 6000): TallyRecord {
  return {
    outcome, reason, kills: 0, timeLeft: outcome === 'win' ? 10 : null,
    stats: { flatAttack, cdReduction: 0, playTime: 120 }, bossMaxHp,
  };
}

export function memStorage(): TallyStorage {
  const m = new Map<string, string>();
  return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => { m.set(k, v); } };
}
