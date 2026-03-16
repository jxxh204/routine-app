import { describe, expect, it } from 'vitest';

import { getMonthMatrix, toDateKey } from './calendar-utils';

describe('calendar-utils', () => {
  it('월 매트릭스는 42칸(6주)을 반환한다', () => {
    const matrix = getMonthMatrix(new Date('2026-03-16T00:00:00+09:00'));
    expect(matrix).toHaveLength(42);
  });

  it('월의 첫 주 시작은 일요일 기준이다', () => {
    const matrix = getMonthMatrix(new Date('2026-03-16T00:00:00+09:00'));
    expect(matrix[0]?.getDay()).toBe(0);
  });

  it('toDateKey는 YYYY-MM-DD 형식', () => {
    expect(toDateKey(new Date('2026-03-16T00:00:00+09:00'))).toBe('2026-03-16');
  });
});
