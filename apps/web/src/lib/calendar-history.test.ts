import { describe, expect, it } from 'vitest';

import { getMonthMatrix, parseHistoryEntries, toDateKey } from './calendar-history';

describe('parseHistoryEntries', () => {
  it('filters and sorts done history rows', () => {
    const rows = parseHistoryEntries(
      [
        { key: 'routine-challenge-v1:2026-03-10', value: JSON.stringify([{ id: 'a', doneByMe: true }]) },
        { key: 'routine-challenge-v1:2026-03-09', value: JSON.stringify([{ id: 'b', doneByMe: false }]) },
        { key: 'routine-challenge-v1:2026-03-11', value: JSON.stringify([{ id: 'c', doneByMe: true }]) },
      ],
      'routine-challenge-v1:',
    );

    expect(rows.map((r) => r.date)).toEqual(['2026-03-11', '2026-03-10']);
  });
});

describe('calendar utils', () => {
  it('creates 42-day matrix', () => {
    expect(getMonthMatrix(new Date('2026-03-15')).length).toBe(42);
  });

  it('formats date key', () => {
    expect(toDateKey(new Date('2026-03-05T00:00:00'))).toBe('2026-03-05');
  });
});
