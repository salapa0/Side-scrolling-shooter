import type { RoundResult } from './game/round';

/** One finished round, plus the boss HP it was played under (the tuning dial). */
export interface TallyRecord extends RoundResult { bossMaxHp: number }
export interface TallyBand { label: string; wins: number; rounds: number }
export interface TallySummary {
  bossMaxHp: number; rounds: number; wins: number; lostTime: number; lostHp: number;
  winRate: number | null; bands: TallyBand[];
}
export type TallyStorage = Pick<Storage, 'getItem' | 'setItem'>;

export interface Tally {
  record(rec: TallyRecord): void;
  /** Drops the rounds at this boss HP only: the ones the console shows. Older tuning data stays. */
  clear(bossMaxHp: number): void;
  summary(bossMaxHp: number): TallySummary;
}

const OUTCOMES = new Set(['win', 'fail']);
const REASONS = new Set(['boss', 'time', 'hp']);

function isRecord(v: unknown): v is TallyRecord {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  const stats = r.stats as Record<string, unknown> | null | undefined;
  return OUTCOMES.has(r.outcome as string) && REASONS.has(r.reason as string)
    && typeof r.bossMaxHp === 'number'
    && typeof stats === 'object' && stats !== null && typeof stats.flatAttack === 'number';
}

/** Anything that isn't a valid record is dropped; unreadable text gives an empty log. */
export function parseLog(text: string | null): TallyRecord[] {
  if (text === null) return [];
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return [];
  }
  return Array.isArray(data) ? data.filter(isRecord) : [];
}

export function appendRecord(log: TallyRecord[], rec: TallyRecord, cap: number): TallyRecord[] {
  const next = [...log, rec];
  return next.length > cap ? next.slice(next.length - cap) : next;
}

/** [1, 10, 50] → ['0', '1–9', '10–49', '50+']. */
export function bandLabels(edges: readonly number[]): string[] {
  const labels: string[] = [];
  let lo = 0;
  for (const edge of edges) {
    labels.push(edge - 1 === lo ? String(lo) : `${lo}–${edge - 1}`);
    lo = edge;
  }
  labels.push(`${lo}+`);
  return labels;
}

export function summarize(log: readonly TallyRecord[], bossMaxHp: number, edges: readonly number[]): TallySummary {
  const bands = bandLabels(edges).map((label) => ({ label, wins: 0, rounds: 0 }));
  let wins = 0, lostTime = 0, lostHp = 0, rounds = 0;
  for (const r of log) {
    if (r.bossMaxHp !== bossMaxHp) continue;
    rounds++;
    const won = r.outcome === 'win';
    if (won) wins++;
    else if (r.reason === 'time') lostTime++;
    else lostHp++;
    const band = bands[edges.filter((e) => e <= r.stats.flatAttack).length];
    band.rounds++;
    if (won) band.wins++;
  }
  return { bossMaxHp, rounds, wins, lostTime, lostHp, winRate: rounds > 0 ? wins / rounds : null, bands };
}

/** Storage failures (blocked, full, private mode) leave the in-memory log as the source of truth. */
export function createTally(storage: TallyStorage | null, key: string, cap: number, edges: readonly number[]): Tally {
  let log: TallyRecord[] = [];
  try {
    log = parseLog(storage?.getItem(key) ?? null);
  } catch {
    log = [];
  }
  const save = (): void => {
    try {
      storage?.setItem(key, JSON.stringify(log));
    } catch {
      // Keep counting in memory for this session.
    }
  };
  return {
    record(rec) { log = appendRecord(log, rec, cap); save(); },
    clear(bossMaxHp) { log = log.filter((r) => r.bossMaxHp !== bossMaxHp); save(); },
    summary: (bossMaxHp) => summarize(log, bossMaxHp, edges),
  };
}
