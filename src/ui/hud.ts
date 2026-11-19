import type { Viewport } from '../engine/viewport';
import type { PowerUpKind, World } from '../game/world';
import { formatTime } from './format';

export const heartString = (hp: number, maxHp: number): string => {
  const left = Math.max(0, Math.min(hp, maxHp));
  return '♥'.repeat(left) + '♡'.repeat(maxHp - left);
};

/** How full the special bar is: 1 when ready, 0 right after firing. */
export const specialFraction = (cd: number, total: number): number =>
  cd <= 0 || total <= 0 ? 1 : Math.max(0, Math.min(1, 1 - cd / total));

export const POWER_UP_LABEL: Record<PowerUpKind, string> = {
  rapid: 'RAPID FIRE', health: '+1 HP', charge: 'BEAM READY', clear: 'SCREEN CLEAR',
};

/** The pickup label, shown for labelTime seconds after a pickup. */
export const pickupLabel = (kind: PowerUpKind | null, since: number, labelTime: number): string =>
  kind === null || since >= labelTime ? '' : POWER_UP_LABEL[kind];

/** Rounds up to tenths, so it reads 0.1 until Rapid really ends. */
export const rapidText = (rapid: number): string =>
  rapid > 0 ? `RAPID ${(Math.ceil(rapid * 10) / 10).toFixed(1)}` : '';

export const stageLabel = (stage: number, total: number): string => `STAGE ${stage}/${total}`;

export interface Hud {
  layout(v: Viewport, dpr: number): void;
  update(w: World): void;
  setVisible(v: boolean): void;
}

function need(doc: Document, id: string): HTMLElement {
  const el = doc.getElementById(id);
  if (!el) throw new Error(`index.html has no #${id}.`);
  return el;
}

export function createHud(doc: Document): Hud {
  const root = need(doc, 'hud');
  const timer = need(doc, 'hud-timer');
  const hearts = need(doc, 'hud-hearts');
  const bossFill = need(doc, 'hud-boss-fill');
  const stage = need(doc, 'hud-stage');
  const kills = need(doc, 'hud-kills');
  const special = need(doc, 'hud-special');
  const specialFill = need(doc, 'hud-special-fill');
  const specialLabel = need(doc, 'hud-special-label');
  const rapid = need(doc, 'hud-rapid');
  const toast = need(doc, 'hud-toast');

  // Cached last-written values so the DOM is only touched on change.
  let lastSecond = NaN;
  let lastHp = NaN;
  let lastBoss = -1;
  let lastStage = -1;
  let lastKills = -1;
  let lastSpecial = -1;
  let lastReady: boolean | null = null;
  let lastRapidTenths = -1;
  let lastToast: string | null = null;

  return {
    layout(v, dpr) {
      root.style.left = `${v.x / dpr}px`;
      root.style.top = `${v.y / dpr}px`;
      root.style.width = `${v.width / dpr}px`;
      root.style.height = `${v.height / dpr}px`;
      root.style.fontSize = `${(8 * v.scale) / dpr}px`;
    },
    update(w) {
      // Format only when the displayed second or HP changes, not every frame.
      const second = Math.ceil(w.timeLeft);
      if (second !== lastSecond) { lastSecond = second; timer.textContent = formatTime(w.timeLeft); }

      if (w.player.hp !== lastHp) { lastHp = w.player.hp; hearts.textContent = heartString(w.player.hp, w.cfg.player.hp); }

      const boss = Math.max(0, Math.min(1, w.boss.hp / w.boss.maxHp));
      if (boss !== lastBoss) { lastBoss = boss; bossFill.style.width = `${boss * 100}%`; }
      if (w.boss.phase !== lastStage) { lastStage = w.boss.phase; stage.textContent = stageLabel(w.boss.phase, w.cfg.boss.phases.length); }

      if (w.kills !== lastKills) { lastKills = w.kills; kills.textContent = `KILLS ${w.kills}`; }

      const frac = specialFraction(w.player.specialCd, w.stats.specialCooldown);
      if (frac !== lastSpecial) { lastSpecial = frac; specialFill.style.width = `${frac * 100}%`; }
      const ready = w.player.specialCd <= 0;
      if (ready !== lastReady) {
        lastReady = ready;
        specialLabel.textContent = ready ? 'E READY' : 'E';
        special.classList.toggle('ready', ready);
      }

      // Compare tenths, not strings, so Rapid builds a string only when the shown value changes.
      const tenths = w.player.rapid > 0 ? Math.ceil(w.player.rapid * 10) : 0;
      if (tenths !== lastRapidTenths) { lastRapidTenths = tenths; rapid.textContent = rapidText(w.player.rapid); }

      const label = pickupLabel(w.lastPickup.kind, w.time - w.lastPickup.time, w.cfg.powerUps.labelTime);
      if (label !== lastToast) { lastToast = label; toast.textContent = label; }
    },
    setVisible(v) {
      root.hidden = !v;
    },
  };
}
