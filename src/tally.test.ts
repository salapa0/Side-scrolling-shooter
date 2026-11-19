import { expect, test } from 'vitest';
import { appendRecord, createTally, parseLog, summarize, type TallyRecord, type TallyStorage } from './tally';
import { memStorage, rec } from './tallyFixtures';

const EDGES = [1, 10, 50];
const K = { bossMaxHp: 6000, balanceVersion: 2 };

test('summary counts only rounds at the given boss HP, split by loss reason', () => {
  const log = [rec('win', 'boss', 0), rec('fail', 'time', 0), rec('fail', 'hp', 0), rec('win', 'boss', 0, 5200)];
  expect(summarize(log, K, EDGES)).toMatchObject({ bossMaxHp: 6000, rounds: 3, wins: 1, lostTime: 1, lostHp: 1, winRate: 1 / 3 });
});
test('no rounds → win rate null, every band empty', () => {
  const s = summarize([], K, EDGES); expect(s.winRate).toBeNull(); expect(s.bands.map((b) => b.rounds)).toEqual([0, 0, 0, 0]);
});
test('Flat Attack bands', () => {
  const s = summarize([0, 5, 9, 10, 49, 50, 999].map((f) => rec('win', 'boss', f)), K, EDGES);
  expect(s.bands.map((b) => [b.label, b.rounds])).toEqual([['0', 1], ['1–9', 2], ['10–49', 2], ['50+', 2]]);
});
test('appendRecord keeps the newest cap records', () => {
  const a = rec('win', 'boss', 1), b = rec('win', 'boss', 2), c = rec('win', 'boss', 3), d = rec('win', 'boss', 4);
  expect(appendRecord([a, b, c], d, 3)).toEqual([b, c, d]);
});
test('parseLog survives garbage and drops invalid entries', () => {   // Review Focus 2
  expect(parseLog(null)).toEqual([]); expect(parseLog('not json')).toEqual([]); expect(parseLog('{"a":1}')).toEqual([]);
  expect(parseLog(JSON.stringify([rec('win', 'boss', 0), { outcome: 'maybe' }, null]))).toHaveLength(1);
});
test('the log persists between tallies sharing storage, and clear() empties it', () => {
  const s = memStorage(); createTally(s, 'k', 500, EDGES).record(rec('win', 'boss', 0));
  const t = createTally(s, 'k', 500, EDGES); expect(t.summary(K).rounds).toBe(1);
  t.clear(K); expect(createTally(s, 'k', 500, EDGES).summary(K).rounds).toBe(0);
});
test('clear(bossMaxHp) drops only the rounds at that boss HP; older tuning data stays', () => {
  const t = createTally(memStorage(), 'k', 500, EDGES); t.record(rec('win', 'boss', 0)); t.record(rec('fail', 'time', 0, 5200));
  t.clear(K); expect(t.summary(K).rounds).toBe(0); expect(t.summary({ bossMaxHp: 5200, balanceVersion: 2 }).rounds).toBe(1);
});
test('storage that throws (or is missing) falls back to memory', () => {   // Review Focus 2
  const broken: TallyStorage = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } };
  for (const st of [broken, null]) { const t = createTally(st, 'k', 500, EDGES); t.record(rec('fail', 'hp', 0)); expect(t.summary(K).lostHp).toBe(1); }
});
test('pre-version records load as v1 and are kept apart from v2', () => {   // Review Focus 4
  const old = { ...rec('win', 'boss', 0) } as Partial<TallyRecord>; delete old.balanceVersion;
  const log = parseLog(JSON.stringify([old, rec('fail', 'hp', 0)]));
  expect(log[0].balanceVersion).toBe(1);
  expect(summarize(log, { bossMaxHp: 6000, balanceVersion: 2 }, EDGES).rounds).toBe(1);
  const t = createTally(memStorage(), 'k', 500, EDGES); t.record(log[0]); t.record(log[1]);
  t.clear({ bossMaxHp: 6000, balanceVersion: 2 }); expect(t.summary({ bossMaxHp: 6000, balanceVersion: 1 }).rounds).toBe(1);
});
