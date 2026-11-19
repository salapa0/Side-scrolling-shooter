// @vitest-environment happy-dom
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { CONFIG } from '../config';
import type { RoundResult } from '../game/round';
import { createScreens } from './screens';

const FIXTURE = `
  <section id="start" hidden><form id="start-form">
    <input id="flat-attack"><span id="flat-attack-error"></span>
    <input id="cd-reduction"><span id="cd-reduction-error"></span>
    <input id="play-time"><span id="play-time-error"></span>
    <button type="submit">Start</button>
  </form></section>
  <section id="pause" hidden></section>
  <section id="results" hidden>
    <h2 id="results-title"></h2><p id="results-reason"></p><p id="results-kills"></p><p id="results-stats"></p>
    <button id="play-again" type="button">Play Again</button>
  </section>`;

const result: RoundResult = {
  outcome: 'win', reason: 'boss', kills: 3, timeLeft: 10,
  stats: { flatAttack: 250, cdReduction: 0, playTime: 120 },
};

function setup() {
  document.body.innerHTML = FIXTURE;
  const screens = createScreens(document, CONFIG);
  const again = vi.fn();
  screens.onPlayAgain(again);
  const button = document.getElementById('play-again') as HTMLButtonElement;
  return { screens, again, button };
}

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

test('Play Again is disabled during the results lockout and ignores clicks', () => {
  const { screens, again, button } = setup();
  screens.showResults(result);
  expect(button.disabled).toBe(true);
  button.click();
  expect(again).not.toHaveBeenCalled();
});

test('after the lockout Play Again is enabled and focused, and a click works', () => {
  const { screens, again, button } = setup();
  screens.showResults(result);
  vi.advanceTimersByTime(CONFIG.round.resultsLockout * 1000);
  expect(button.disabled).toBe(false);
  expect(document.activeElement).toBe(button);
  button.click();
  expect(again).toHaveBeenCalledTimes(1);
});

test('Space on Play Again does not trigger it, Enter-style clicks still do', () => {
  const { screens, again, button } = setup();
  screens.showResults(result);
  vi.advanceTimersByTime(CONFIG.round.resultsLockout * 1000);
  for (const type of ['keydown', 'keyup']) {
    const e = new KeyboardEvent(type, { code: 'Space', key: ' ', bubbles: true, cancelable: true });
    button.dispatchEvent(e);
    expect(e.defaultPrevented).toBe(true);
  }
  expect(again).not.toHaveBeenCalled();
  const enter = new KeyboardEvent('keydown', { code: 'Enter', key: 'Enter', bubbles: true, cancelable: true });
  button.dispatchEvent(enter);
  expect(enter.defaultPrevented).toBe(false);
});

test('hideAll before the lockout ends cancels the pending enable', () => {
  const { screens, button } = setup();
  screens.showResults(result);
  screens.hideAll();
  vi.advanceTimersByTime(CONFIG.round.resultsLockout * 1000 * 2);
  expect(button.disabled).toBe(true);
  expect(document.activeElement).not.toBe(button);
});

test('a second showResults restarts the lockout', () => {
  const { screens, button } = setup();
  screens.showResults(result);
  vi.advanceTimersByTime(CONFIG.round.resultsLockout * 1000 * 0.8);
  screens.showResults(result);
  vi.advanceTimersByTime(CONFIG.round.resultsLockout * 1000 * 0.5);
  expect(button.disabled).toBe(true);
  vi.advanceTimersByTime(CONFIG.round.resultsLockout * 1000 * 0.5);
  expect(button.disabled).toBe(false);
});
