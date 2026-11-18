import { expect, test } from 'vitest';
import { CONFIG } from '../config';
import { advance } from './loop';

const SIM = CONFIG.sim;

test('one frame at 60 Hz runs one step', () => {
  const r = advance(0, 1 / 60, SIM);
  expect(r.steps).toBe(1);
  expect(r.acc).toBeCloseTo(0);
});

test('remainder carries over', () => {
  const r = advance(0.01, 0.01, SIM);
  expect(r.steps).toBe(1);
  expect(r.acc).toBeCloseTo(0.02 - 1 / 60);
});

test('a 10 s stall runs at most maxStepsPerFrame and drops the backlog', () => {
  expect(advance(0, 10, SIM)).toEqual({ steps: 5, acc: 0 });
});
