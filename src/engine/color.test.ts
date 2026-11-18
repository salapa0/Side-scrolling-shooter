import { expect, test } from 'vitest';
import { rgb } from './color';

test('parses hex to 0-1 channels', () => {
  expect(rgb('#ff0000')).toEqual([1, 0, 0, 1]);
});
test('applies alpha', () => {
  expect(rgb('#000000', 0.5)).toEqual([0, 0, 0, 0.5]);
});
