import { expect, test } from 'vitest';
import { formatTime } from './format';

test('formats m:ss with seconds rounded up', () => {
  expect(formatTime(120)).toBe('2:00');
  expect(formatTime(59.2)).toBe('1:00');
  expect(formatTime(9.01)).toBe('0:10');
  expect(formatTime(0)).toBe('0:00');
});
