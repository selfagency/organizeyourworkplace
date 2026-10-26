import { describe, expect, it } from 'vitest';
import { DOUBLE_ESC_WINDOW_MS, isDoublePress } from './keys';

describe('isDoublePress', () => {
  it('fires when the second press is inside the window', () => {
    expect(isDoublePress(1000, 400)).toBe(true);
  });

  it('does not fire when the second press is outside the window', () => {
    expect(isDoublePress(1000 + DOUBLE_ESC_WINDOW_MS + 1, 1000)).toBe(false);
  });

  it('does not fire on the first press', () => {
    expect(isDoublePress(1000, null)).toBe(false);
  });

  it('fires exactly at the window boundary', () => {
    expect(isDoublePress(DOUBLE_ESC_WINDOW_MS, 0)).toBe(true);
  });
});