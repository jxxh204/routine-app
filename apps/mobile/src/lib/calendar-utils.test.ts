import { describe, expect, it } from 'vitest';

import { getMonthMatrix, toDateKey } from './calendar-utils';

describe('calendar-utils', () => {
  const sampleDate = new Date(2026, 2, 16, 12, 0, 0); // local-time noon to avoid TZ boundary flakiness

  it('월 매트릭스는 42칸(6주)을 반환한다', () => {
    const matrix = getMonthMatrix(sampleDate);
    expect(matrix).toHaveLength(42);
  });

  it('월의 첫 주 시작은 일요일 기준이다', () => {
    const matrix = getMonthMatrix(sampleDate);
    expect(matrix[0]?.getDay()).toBe(0);
  });

  it('toDateKey는 YYYY-MM-DD 형식', () => {
    expect(toDateKey(sampleDate)).toBe('2026-03-16');
  });
});
