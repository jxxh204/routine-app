import { describe, expect, it } from 'vitest';

import { hhmmToMinute, minuteToHHMM } from './time-utils';

describe('time-utils', () => {
  it('minuteToHHMM 변환', () => {
    expect(minuteToHHMM(0)).toBe('00:00');
    expect(minuteToHHMM(570)).toBe('09:30');
    expect(minuteToHHMM(1439)).toBe('23:59');
  });

  it('hhmmToMinute 변환', () => {
    expect(hhmmToMinute('00:00')).toBe(0);
    expect(hhmmToMinute('09:30')).toBe(570);
    expect(hhmmToMinute('23:59')).toBe(1439);
  });

  it('잘못된 시간 문자열은 null', () => {
    expect(hhmmToMinute('24:00')).toBeNull();
    expect(hhmmToMinute('12:60')).toBeNull();
    expect(hhmmToMinute('nope')).toBeNull();
  });
});
