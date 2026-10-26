/** Two Esc presses within this window trigger Quick Exit. */
export const DOUBLE_ESC_WINDOW_MS = 1200;

/**
 * True when `now` follows `lastPressAt` within `windowMs`.
 * `lastPressAt` is null on the first press.
 */
export function isDoublePress(
  now: number,
  lastPressAt: number | null,
  windowMs: number = DOUBLE_ESC_WINDOW_MS,
): boolean {
  return lastPressAt !== null && now - lastPressAt <= windowMs;
}