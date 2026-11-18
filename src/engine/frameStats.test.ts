import { expect, test } from 'vitest';
import { FrameStats } from './frameStats';

test('steady 60 fps', () => {
  const s = new FrameStats();
  for (let i = 0; i < 60; i++) s.record(1000 / 60);
  expect(s.fps).toBeCloseTo(60, 0);
});

test('tracks the worst frame', () => {
  const s = new FrameStats();
  s.record(16);
  s.record(50);
  s.record(16);
  expect(s.maxMs).toBe(50);
});

test('averages only the frames recorded so far', () => {
  const s = new FrameStats();
  s.record(20);
  expect(s.avgMs).toBe(20);
  expect(s.fps).toBeCloseTo(50);
});

test('reports zero before anything is recorded', () => {
  const s = new FrameStats();
  expect(s.fps).toBe(0);
  expect(s.avgMs).toBe(0);
  expect(s.maxMs).toBe(0);
});

test('old frames fall out of the 60-frame window', () => {
  const s = new FrameStats();
  s.record(100);
  for (let i = 0; i < 60; i++) s.record(10);
  expect(s.maxMs).toBe(10);
});
