import type { Config } from '../config';
import type { RoundResult } from '../game/round';
import { parseStatInput, type RawStatInput, type StatField, type StatInput } from '../stats';
import { formatTime } from './format';

export interface Screens {
  showStart(prefill: StatInput): void;
  onStart(cb: (input: StatInput) => void): void;
  showPause(visible: boolean): void;
  showResults(r: RoundResult): void;
  onPlayAgain(cb: () => void): void;
  hideAll(): void;
}

const STAT_FIELDS: readonly StatField[] = ['flatAttack', 'cdReduction', 'playTime'];
const FIELD_IDS: Record<StatField, string> = { flatAttack: 'flat-attack', cdReduction: 'cd-reduction', playTime: 'play-time' };

function find<T extends HTMLElement>(doc: Document, id: string, type: new () => T): T {
  const el = doc.getElementById(id);
  if (!(el instanceof type)) throw new Error(`index.html is missing #${id}.`);
  return el;
}

function reasonText(r: RoundResult): string {
  switch (r.reason) {
    case 'boss': return `Boss destroyed with ${formatTime(r.timeLeft ?? 0)} left`;
    case 'time': return 'Time ran out';
    case 'hp': return 'Your ship was destroyed';
  }
}

export function createScreens(doc: Document, cfg: Config): Screens {
  const field = (key: StatField) => ({
    input: find(doc, FIELD_IDS[key], HTMLInputElement),
    error: find(doc, `${FIELD_IDS[key]}-error`, HTMLElement),
  });
  const fields = { flatAttack: field('flatAttack'), cdReduction: field('cdReduction'), playTime: field('playTime') };
  const start = find(doc, 'start', HTMLElement);
  const form = find(doc, 'start-form', HTMLFormElement);
  const pause = find(doc, 'pause', HTMLElement);
  const results = find(doc, 'results', HTMLElement);
  const resultsTitle = find(doc, 'results-title', HTMLElement);
  const resultsReason = find(doc, 'results-reason', HTMLElement);
  const resultsKills = find(doc, 'results-kills', HTMLElement);
  const resultsStats = find(doc, 'results-stats', HTMLElement);
  const playAgain = find(doc, 'play-again', HTMLButtonElement);
  const overlays = [start, pause, results];

  let startCb: ((input: StatInput) => void) | null = null;
  let playAgainCb: (() => void) | null = null;

  const setError = (key: StatField, message: string): void => {
    fields[key].error.textContent = message;
    fields[key].input.setAttribute('aria-invalid', String(message !== ''));
  };

  let lockoutTimer: ReturnType<typeof setTimeout> | null = null;
  const cancelLockout = (): void => {
    if (lockoutTimer !== null) clearTimeout(lockoutTimer);
    lockoutTimer = null;
  };

  const hideAll = (): void => {
    cancelLockout();
    // A control left focused under a hidden overlay would swallow game keys, or re-submit on Enter.
    const active = doc.activeElement;
    if (active instanceof HTMLElement && overlays.some((o) => o.contains(active))) active.blur();
    for (const o of overlays) o.hidden = true;
  };

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const raw: RawStatInput = {
      flatAttack: fields.flatAttack.input.value,
      cdReduction: fields.cdReduction.input.value,
      playTime: fields.playTime.input.value,
    };
    const parsed = parseStatInput(raw, cfg.stats);
    for (const key of STAT_FIELDS) setError(key, parsed.ok ? '' : parsed.errors[key] ?? '');
    if (parsed.ok) {
      startCb?.(parsed.value);
      return;
    }
    const firstBad = STAT_FIELDS.find((key) => parsed.errors[key] !== undefined);
    if (firstBad) fields[firstBad].input.focus();
  });
  playAgain.addEventListener('click', () => playAgainCb?.());
  // Space would activate the button on keyup; walk-up players mash it, so only Enter and click count.
  const blockSpace = (e: KeyboardEvent): void => {
    if (e.code === 'Space') e.preventDefault();
  };
  playAgain.addEventListener('keydown', blockSpace);
  playAgain.addEventListener('keyup', blockSpace);

  return {
    showStart(prefill) {
      for (const key of STAT_FIELDS) {
        fields[key].input.value = String(prefill[key]);
        setError(key, '');
      }
      hideAll();
      start.hidden = false;
      // Selected, so staff can type over the prefilled value.
      fields.flatAttack.input.focus();
      fields.flatAttack.input.select();
    },
    onStart(cb) { startCb = cb; },
    showPause(visible) { pause.hidden = !visible; },
    showResults(r) {
      results.dataset.outcome = r.outcome;
      resultsTitle.textContent = r.outcome === 'win' ? 'VICTORY' : 'FAILED';
      resultsReason.textContent = reasonText(r);
      resultsKills.textContent = `Drones destroyed: ${r.kills}`;
      const s = r.stats;
      resultsStats.textContent = `Flat Attack ${s.flatAttack} · CD Reduction ${s.cdReduction}% · Play Time ${s.playTime} s`;
      hideAll();
      results.hidden = false;
      // Locked out briefly so keys still held from play can't dismiss the results.
      playAgain.disabled = true;
      lockoutTimer = setTimeout(() => {
        lockoutTimer = null;
        playAgain.disabled = false;
        playAgain.focus();
      }, cfg.round.resultsLockout * 1000);
    },
    onPlayAgain(cb) { playAgainCb = cb; },
    hideAll,
  };
}
