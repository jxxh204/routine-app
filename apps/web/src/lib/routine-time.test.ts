import { describe, expect, it } from 'vitest';

import { addOneHourHHMM, formatKoreanTime, formatTimeRangeLabel, isInTimeWindow, minuteToHHMM } from './routine-time';

describe('routine-time', () => {
  it('checks normal time window', () => {
    expect(isInTimeWindow(600, 540, 660)).toBe(true);
    expect(isInTimeWindow(700, 540, 660)).toBe(false);
  });

  it('checks cross-midnight time window', () => {
    expect(isInTimeWindow(30, 1380, 120)).toBe(true);
    expect(isInTimeWindow(900, 1380, 120)).toBe(false);
  });

  it('formats minute to HH:MM', () => {
    expect(minuteToHHMM(0)).toBe('00:00');
    expect(minuteToHHMM(1439)).toBe('23:59');
  });

  it('formats range labels', () => {
    expect(formatTimeRangeLabel(540, 660)).toBe('09:00 - 11:00');
    expect(formatTimeRangeLabel(1380, 120)).toBe('23:00 - 다음날 02:00');
  });

  it('auto calculates +1 hour end time', () => {
    expect(addOneHourHHMM('09:15')).toBe('10:15');
    expect(addOneHourHHMM('23:30')).toBe('00:30');
  });

  it('formats korean time as HH:MM', () => {
    expect(formatKoreanTime(new Date('2026-03-16T13:05:00+09:00'))).toMatch(/^\d{2}:\d{2}$/);
  });
});
