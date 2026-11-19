// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, test } from 'vitest';
import { CONFIG } from '../config';
import { Input } from './input';

let input: Input;
let detach: () => void;
let field: HTMLInputElement;

beforeEach(() => {
  input = new Input(CONFIG.bindings);
  detach = input.attach(window);
  field = document.createElement('input');
  document.body.append(field);
  field.focus();
});
afterEach(() => {
  detach();
  field.remove();
});

const key = (target: HTMLElement, code: string): void => {
  target.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
};

test('F3 and F4 typed in a text field still reach the console', () => {   // Review Focus 5
  key(field, 'F3'); key(field, 'F4'); expect(input.consume('debug')).toBe(true); expect(input.consume('resetTally')).toBe(true);
});
test('game keys typed in a text field do not reach the game', () => {
  key(field, 'KeyE'); key(field, 'KeyW'); expect(input.consume('special')).toBe(false); expect(input.isDown('up')).toBe(false);
});
