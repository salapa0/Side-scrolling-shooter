import type { Config } from '../config';

export function advance(acc: number, frameDt: number, sim: Config['sim']): { steps: number; acc: number } {
  const total = acc + Math.min(frameDt, sim.maxFrameTime);
  const steps = Math.floor(total / sim.step);
  // Drop the backlog rather than chase it, so a stall can't spiral.
  if (steps > sim.maxStepsPerFrame) return { steps: sim.maxStepsPerFrame, acc: 0 };
  return { steps, acc: total - steps * sim.step };
}

export function startLoop(onFrame: (frameDt: number) => void): () => void {
  let last: number | null = null;
  let handle = 0;
  let running = true;
  const tick = (now: number): void => {
    if (!running) return;
    const frameDt = last === null ? 0 : (now - last) / 1000;
    last = now;
    onFrame(frameDt);
    if (running) handle = requestAnimationFrame(tick);
  };
  handle = requestAnimationFrame(tick);
  return () => {
    running = false;
    cancelAnimationFrame(handle);
  };
}
