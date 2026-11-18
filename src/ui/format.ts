/** `m:ss`, rounded up so the display only reads 0:00 once time has fully run out. */
export function formatTime(seconds: number): string {
  const total = Math.ceil(seconds);
  const s = total % 60;
  return `${Math.floor(total / 60)}:${s < 10 ? '0' : ''}${s}`;
}
