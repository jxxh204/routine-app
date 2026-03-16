import { describe, expect, it } from 'vitest';

import { getMonthMatrix, hhmmToMinute, minuteToHHMM, toDateKey } from './date-time';

describe('date-time', () => {
  it('converts minute <-> HH:MM', () => {
    expect(minuteToHHMM(570)).toBe('09:30');
    expect(hhmmToMinute('09:30')).toBe(570);
  });

  it('returns null on invalid HH:MM', () => {
    expect(hhmmToMinute('25:00')).toBeNull();
    expect(hhmmToMinute('ab:cd')).toBeNull();
  });

  it('creates 42-cell month matrix', () => {
    const days = getMonthMatrix(new Date('2026-03-15T00:00:00+09:00'));
    expect(days).toHaveLength(42);
  });

  it('builds yyyy-mm-dd key', () => {
    const key = toDateKey(new Date('2026-03-16T12:00:00+09:00'));
    expect(key).toBe('2026-03-16');
  });
});
