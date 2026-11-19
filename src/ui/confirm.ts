/** Two presses within windowMs confirm a destructive key; the first press only arms it. */
export interface Confirm {
  press(now: number): boolean;
  armed(now: number): boolean;
}

export function createConfirm(windowMs: number): Confirm {
  let armedAt = -Infinity;
  const armed = (now: number): boolean => now - armedAt < windowMs;
  return {
    press(now) {
      if (armed(now)) {
        armedAt = -Infinity;
        return true;
      }
      armedAt = now;
      return false;
    },
    armed,
  };
}
