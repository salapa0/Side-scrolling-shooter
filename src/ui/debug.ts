import type { FrameStats } from '../engine/frameStats';

export interface DebugOverlay {
  toggle(): void;
  setVisible(v: boolean): void;
  update(s: FrameStats, steps: number, quads: number): void;
}

const REFRESH_MS = 250;

export function createDebugOverlay(doc: Document): DebugOverlay {
  const el = doc.getElementById('debug');
  if (!el) throw new Error('index.html has no #debug.');
  let visible = !el.hidden;
  let lastWrite = -Infinity;

  const setVisible = (v: boolean): void => {
    visible = v;
    el.hidden = !v;
  };
  return {
    toggle: () => setVisible(!visible),
    setVisible,
    update(s, steps, quads) {
      if (!visible) return;
      const now = performance.now();
      if (now - lastWrite < REFRESH_MS) return;
      lastWrite = now;
      el.textContent =
        `FPS ${Math.round(s.fps)} · frame ${s.avgMs.toFixed(1)} ms avg / ${s.maxMs.toFixed(1)} max · steps ${steps} · quads ${quads}`;
    },
  };
}
