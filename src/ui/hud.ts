import type { Viewport } from '../engine/viewport';
import type { World } from '../game/world';
import { formatTime } from './format';

export const heartString = (hp: number, maxHp: number): string => {
  const left = Math.max(0, Math.min(hp, maxHp));
  return '♥'.repeat(left) + '♡'.repeat(maxHp - left);
};

/** How full the special bar is: 1 when ready, 0 right after firing. */
export const specialFraction = (cd: number, total: number): number =>
  cd <= 0 || total <= 0 ? 1 : Math.max(0, Math.min(1, 1 - cd / total));

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
  const kills = need(doc, 'hud-kills');
  const special = need(doc, 'hud-special');
  const specialFill = need(doc, 'hud-special-fill');
  const specialLabel = need(doc, 'hud-special-label');

  // Cached last-written values so the DOM is only touched on change.
  let lastTimer = '';
  let lastHearts = '';
  let lastBoss = -1;
  let lastKills = -1;
  let lastSpecial = -1;
  let lastReady: boolean | null = null;

  return {
    layout(v, dpr) {
      root.style.left = `${v.x / dpr}px`;
      root.style.top = `${v.y / dpr}px`;
      root.style.width = `${v.width / dpr}px`;
      root.style.height = `${v.height / dpr}px`;
      root.style.fontSize = `${(8 * v.scale) / dpr}px`;
    },
    update(w) {
      const t = formatTime(w.timeLeft);
      if (t !== lastTimer) { lastTimer = t; timer.textContent = t; }

      const h = heartString(w.player.hp, w.cfg.player.hp);
      if (h !== lastHearts) { lastHearts = h; hearts.textContent = h; }

      const boss = Math.max(0, Math.min(1, w.boss.hp / w.boss.maxHp));
      if (boss !== lastBoss) { lastBoss = boss; bossFill.style.width = `${boss * 100}%`; }

      if (w.kills !== lastKills) { lastKills = w.kills; kills.textContent = `KILLS ${w.kills}`; }

      const frac = specialFraction(w.player.specialCd, w.stats.specialCooldown);
      if (frac !== lastSpecial) { lastSpecial = frac; specialFill.style.width = `${frac * 100}%`; }
      const ready = w.player.specialCd <= 0;
      if (ready !== lastReady) {
        lastReady = ready;
        specialLabel.textContent = ready ? 'E READY' : 'E';
        special.classList.toggle('ready', ready);
      }
    },
    setVisible(v) {
      root.hidden = !v;
    },
  };
}
