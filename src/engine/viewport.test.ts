import { expect, test } from 'vitest';
import { computeViewport } from './viewport';

test('1080p fills the screen at 4x', () => {
  expect(computeViewport(1920, 1080, 480, 270)).toEqual({ x: 0, y: 0, width: 1920, height: 1080, scale: 4 });
});

test('1366x768 letterboxes at 2x, centred', () => {
  expect(computeViewport(1366, 768, 480, 270)).toEqual({ x: 203, y: 114, width: 960, height: 540, scale: 2 });
});

test('5:4 screen is limited by width and centred vertically', () => {
  expect(computeViewport(1280, 1024, 480, 270)).toEqual({ x: 160, y: 242, width: 960, height: 540, scale: 2 });
});

test('smaller than 1x fits without cropping', () => {
  const tiny = computeViewport(320, 180, 480, 270);
  expect(tiny).toMatchObject({ x: 0, y: 0, width: 320, height: 180 });
  expect(tiny.scale).toBeCloseTo(2 / 3);
});
