import { expect, test } from 'vitest';
import { createConfirm } from './confirm';

test('the first press only arms; a second press inside the window confirms', () => {
  const c = createConfirm(2000);
  expect(c.press(0)).toBe(false); expect(c.armed(1000)).toBe(true);
  expect(c.press(1500)).toBe(true); expect(c.armed(1600)).toBe(false);
});
test('a second press after the window only re-arms', () => {
  const c = createConfirm(2000);
  c.press(0); expect(c.armed(2500)).toBe(false);
  expect(c.press(2500)).toBe(false); expect(c.press(3000)).toBe(true);
});
