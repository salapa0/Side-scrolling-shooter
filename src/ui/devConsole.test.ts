import { expect, test } from 'vitest';
import { CONFIG } from '../config';
import { FrameStats } from '../engine/frameStats';
import { makeWorld } from '../game/testUtils';
import { summarize } from '../tally';
import { rec } from '../tallyFixtures';
import { devConsoleText, type DevSnapshot } from './devConsole';

const K = { bossMaxHp: 6000, balanceVersion: 2 };
const snap = (w = makeWorld(), tally = summarize([], K, CONFIG.tally.bands)): DevSnapshot => ({
  appState: 'playing', world: w, input: { flatAttack: 0, cdReduction: 0, playTime: 120 }, frame: new FrameStats(), steps: 1, quads: 240, tally,
  clearArmed: false,
});

test('one line per section, in order', () => {
  expect(devConsoleText(snap()).split('\n').map((l) => l.split(' ')[0])).toEqual(['PERFORMANCE', 'ROUND', 'PLAYER', 'STATS', 'BOSS', 'POOLS', 'TALLY']);
});
test('shows stats, HP and pool use', () => {
  const t = devConsoleText(snap());
  for (const s of ['AMP 20.00', 'beam 200', 'HP 5/5', 'TALLY v2 @6000', 'HP 2000/2000 (100.0%)', 'stage 1/3', 'drones 0/64', 'power-ups 0/2', 'hitbox 8×4', 'scale 1.00'])
    expect(t).toContain(s);
});
test('tally: dash with no rounds, otherwise overall and per-band rates', () => {
  expect(devConsoleText(snap())).toContain('win rate —');
  const log = [...Array(4)].map(() => rec('win', 'boss', 0)).concat(rec('fail', 'time', 0));   // rec from src/tallyFixtures.ts
  const t = devConsoleText(snap(makeWorld(), summarize(log, K, CONFIG.tally.bands)));
  expect(t).toContain('win rate 80%'); expect(t).toContain('0: 4/5');
});
test('after one F4 the tally line asks for a second press', () => {
  const log = [rec('win', 'boss', 0), rec('fail', 'hp', 0)];
  expect(devConsoleText(snap())).not.toContain('F4 again');
  expect(devConsoleText({ ...snap(makeWorld(), summarize(log, K, CONFIG.tally.bands)), clearArmed: true })).toContain('F4 again to clear 2 rounds');
});
test('the player line shows the live close bonus', () => {
  const w = makeWorld(); w.player.x = 160; expect(devConsoleText(snap(w))).toContain('close ×1.50');
});
