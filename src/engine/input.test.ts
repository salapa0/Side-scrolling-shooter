import { beforeEach, expect, test } from 'vitest';
import { CONFIG } from '../config';
import { Input } from './input';

let input: Input;
beforeEach(() => {
  input = new Input(CONFIG.bindings);
});

test('either bound key holds the action', () => {
  input.keyDown('KeyW');
  input.keyDown('ArrowUp');
  input.keyUp('KeyW');
  expect(input.isDown('up')).toBe(true);
});

test('consume returns true once per press', () => {
  input.keyDown('KeyE');
  expect(input.consume('special')).toBe(true);
  expect(input.consume('special')).toBe(false);
});

test('press and release before the step still counts', () => {
  input.keyDown('KeyE');
  input.keyUp('KeyE');
  expect(input.consume('special')).toBe(true);
});

test('auto-repeat does not latch a press', () => {
  input.keyDown('KeyE', true);
  expect(input.consume('special')).toBe(false);
});

test('auto-repeat keeps the key held and reports it as bound', () => {
  expect(input.keyDown('KeyD', true)).toBe(true);
  expect(input.isDown('right')).toBe(true);
});

test('clear releases held keys and pending presses', () => {
  input.keyDown('KeyD');
  input.keyDown('KeyE');
  input.clear();
  expect(input.isDown('right')).toBe(false);
  expect(input.consume('special')).toBe(false);
});

test('unbound keys are ignored', () => {
  expect(input.keyDown('KeyQ')).toBe(false);
  expect(input.keyUp('KeyQ')).toBe(false);
});
