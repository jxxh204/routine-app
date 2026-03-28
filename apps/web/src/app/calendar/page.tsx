'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type CSSProperties } from 'react';

import { AuthRequired } from '@/components/auth-required';
import { GhostButton, PageShell } from '@/components/ui';
import { getMonthMatrix, parseHistoryEntries, toDateKey, type DoneItem } from '@/lib/calendar-history';
import { readProofImage } from '@/lib/proof-image-store';

const STORAGE_PREFIX = 'routine-challenge-v1:';

function getRoutineTypeLabel(id: string) {
  if (id === 'wake' || id === 'lunch' || id === 'sleep') return '기본';
  return '커스텀';
}

function readHistory() {
  if (typeof window === 'undefined') return [] as Array<{ date: string; items: DoneItem[] }>;

  const entries: Array<{ key: string; value: string | null }> = [];
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i);
    if (!key) continue;
    entries.push({ key, value: window.localStorage.getItem(key) });
  }

  return parseHistoryEntries(entries, STORAGE_PREFIX);
}

export default function CalendarPage() {
  const history = useMemo(() => readHistory(), []);
  const byDate = useMemo(() => new Map(history.map((row) => [row.date, row.items])), [history]);

  const [month, setMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [proofByItemKey, setProofByItemKey] = useState<Record<string, string>>({});

  const availableMonths = useMemo(() => {
    const keys = Array.from(new Set(history.filter((entry) => entry.items.length > 0).map((entry) => entry.date.slice(0, 7)))).sort();
    return keys.map((key) => {
      const [year, monthText] = key.split('-').map(Number);
      return new Date(year, (monthText ?? 1) - 1, 1);
    });
  }, [history]);

  const monthIndex = availableMonths.findIndex(
    (item) => item.getFullYear() === month.getFullYear() && item.getMonth() === month.getMonth(),
  );
  const effectiveMonth = monthIndex === -1 && availableMonths.length > 0 ? availableMonths[availableMonths.length - 1] : month;
  const effectiveMonthIndex = monthIndex === -1 ? availableMonths.length - 1 : monthIndex;
  const days = useMemo(() => getMonthMatrix(effectiveMonth), [effectiveMonth]);
  const monthTitle = `${effectiveMonth.getFullYear()}년 ${effectiveMonth.getMonth() + 1}월`;
  const canGoPrevMonth = effectiveMonthIndex > 0;
  const canGoNextMonth = effectiveMonthIndex >= 0 && effectiveMonthIndex < availableMonths.length - 1;
  const selectedItems = selectedDate ? byDate.get(selectedDate) ?? [] : [];
  const selectedProofCount = useMemo(
    () =>
      selectedItems.filter((item) => {
        const key = selectedDate ? `${selectedDate}:${item.id}` : '';
        return Boolean(item.proofImage || (key && proofByItemKey[key]));
      }).length,
    [selectedDate, selectedItems, proofByItemKey],
  );
  const monthDoneCount = useMemo(() => {
    const prefix = `${effectiveMonth.getFullYear()}-${String(effectiveMonth.getMonth() + 1).padStart(2, '0')}-`;
    return history
      .filter((entry) => entry.date.startsWith(prefix))
      .reduce((acc, entry) => acc + entry.items.length, 0);
  }, [history, effectiveMonth]);

  useEffect(() => {
    if (!selectedDate || selectedItems.length === 0) return;

    let cancelled = false;

    const hydrateProofImages = async () => {
      const nextEntries = await Promise.all(
        selectedItems.map(async (item) => {
          const itemKey = `${selectedDate}:${item.id}`;
          const image = item.proofImage ?? (await readProofImage(selectedDate, item.id).catch(() => null));
          return image ? ([itemKey, image] as const) : null;
        }),
      );

      if (cancelled) return;

      setProofByItemKey((prev) => {
        const merged = { ...prev };
        for (const entry of nextEntries) {
          if (!entry) continue;
          merged[entry[0]] = entry[1];
        }
        return merged;
      });
    };

    void hydrateProofImages();

    return () => {
      cancelled = true;
    };
  }, [selectedDate, selectedItems]);

  return (
    <AuthRequired>
      <PageShell>
        <section style={styles.page}>
          {/* Header */}
          <div style={styles.header}>
            <div>
              <p style={styles.eyebrow}>HISTORY</p>
              <h1 style={styles.title}>캘린더</h1>
            </div>
            <Link href="/today" style={styles.backLink}>오늘으로</Link>
          </div>

          {/* Summary stats */}
          <div style={styles.statRow}>
            <div style={styles.statItem}>
              <span style={styles.statValue}>{monthDoneCount}</span>
              <span style={styles.statLabel}>이번 달 완료</span>
            </div>
            <div style={styles.statItem}>
              <span style={styles.statValue}>{history.length}</span>
              <span style={styles.statLabel}>기록된 날짜</span>
            </div>
          </div>

          {/* Month nav */}
          <div style={styles.monthNav}>
            <GhostButton
              style={styles.navBtn}
              onClick={() => {
                if (!canGoPrevMonth) return;
                setSelectedDate(null);
                setMonth(availableMonths[effectiveMonthIndex - 1]);
              }}
              disabled={!canGoPrevMonth}
            >
              ←
            </GhostButton>
            <span style={styles.monthTitle}>{monthTitle}</span>
            <GhostButton
              style={styles.navBtn}
              onClick={() => {
                if (!canGoNextMonth) return;
                setSelectedDate(null);
                setMonth(availableMonths[effectiveMonthIndex + 1]);
              }}
              disabled={!canGoNextMonth}
            >
              →
            </GhostButton>
          </div>

          {/* Calendar grid */}
          <div style={styles.calendarCard}>
            <div style={styles.grid}>
              {['일', '월', '화', '수', '목', '금', '토'].map((w) => (
                <div key={w} style={styles.weekday}>{w}</div>
              ))}

              {days.map((date) => {
                const key = toDateKey(date);
                const count = byDate.get(key)?.length ?? 0;
                const inMonth = date.getMonth() === effectiveMonth.getMonth();
                const isSelected = selectedDate === key;
                const isEnabled = inMonth && count > 0;

                return (
                  <button
                    key={key}
                    style={{
                      ...styles.dayCell,
                      ...(!inMonth ? styles.dayCellOut : {}),
                      ...(isEnabled ? styles.dayCellActive : {}),
                      ...(isSelected ? styles.dayCellSelected : {}),
                      ...(!isEnabled ? styles.dayCellDisabled : {}),
                    }}
                    onClick={() => isEnabled && setSelectedDate(key)}
                    disabled={!isEnabled}
                  >
                    <span style={styles.dayNum}>{inMonth ? date.getDate() : ''}</span>
                    {count > 0 && inMonth ? <span style={styles.dayDot} /> : null}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Detail */}
          {selectedDate ? (
            <div style={styles.detailCard}>
              <div style={styles.detailHeader}>
                <span style={styles.detailDate}>{selectedDate}</span>
                <div style={styles.detailBadges}>
                  <span style={styles.badge}>{selectedItems.length}개 완료</span>
                  {selectedProofCount > 0 ? <span style={styles.badgeAccent}>{selectedProofCount}장 인증</span> : null}
                </div>
              </div>

              {selectedItems.length === 0 ? (
                <p style={styles.emptyText}>완료 내역이 없습니다.</p>
              ) : (
                <div style={styles.itemList}>
                  {selectedItems.map((item) => {
                    const image = selectedDate ? proofByItemKey[`${selectedDate}:${item.id}`] ?? item.proofImage : item.proofImage;

                    return (
                      <article key={`${selectedDate}-${item.id}-${item.doneAt ?? ''}`} style={styles.itemCard}>
                        <div style={styles.itemRow}>
                          <div>
                            <p style={styles.itemTitle}>{item.title ?? item.id}</p>
                            <p style={styles.itemMeta}>{item.doneAt ?? '시간 미기록'}</p>
                          </div>
                          <span style={styles.typeChip}>{getRoutineTypeLabel(item.id)}</span>
                        </div>
                        {image ? (
                          <img src={image} alt="인증" style={styles.thumb} />
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <p style={styles.hintText}>캘린더에서 날짜를 선택하면 완료 루틴을 확인할 수 있어요.</p>
          )}
        </section>
      </PageShell>
    </AuthRequired>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    display: 'grid',
    gap: 16,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  eyebrow: {
    margin: 0,
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.08em',
    color: 'var(--ds-color-text-faint)',
    textTransform: 'uppercase' as const,
  },
  title: {
    margin: '2px 0 0',
    fontSize: 22,
    fontWeight: 600,
    letterSpacing: '-0.02em',
    color: 'var(--ds-color-text)',
  },
  backLink: {
    color: 'var(--ds-color-accent)',
    textDecoration: 'none',
    fontSize: 13,
    fontWeight: 500,
  },
  statRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 8,
  },
  statItem: {
    background: 'var(--ds-color-surface)',
    borderRadius: 'var(--ds-radius-md)',
    padding: '10px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 700,
    color: 'var(--ds-color-text)',
  },
  statLabel: {
    fontSize: 11,
    color: 'var(--ds-color-text-faint)',
    fontWeight: 500,
  },
  monthNav: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  navBtn: {
    padding: '6px 10px',
    fontSize: 14,
  },
  monthTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: 'var(--ds-color-text)',
  },
  calendarCard: {
    background: 'var(--ds-color-surface)',
    borderRadius: 'var(--ds-radius-lg)',
    padding: 12,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: 4,
  },
  weekday: {
    textAlign: 'center',
    color: 'var(--ds-color-text-faint)',
    fontSize: 11,
    fontWeight: 500,
    paddingBottom: 4,
  },
  dayCell: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    minHeight: 44,
    border: 'none',
    background: 'transparent',
    borderRadius: 'var(--ds-radius-sm)',
    cursor: 'pointer',
    padding: 4,
    transition: 'background 0.15s ease',
  },
  dayCellOut: {
    opacity: 0.2,
  },
  dayCellActive: {
    background: 'var(--ds-color-surface-strong)',
  },
  dayCellSelected: {
    background: 'var(--ds-color-accent-soft)',
    outline: '2px solid var(--ds-color-accent)',
    outlineOffset: -2,
  },
  dayCellDisabled: {
    cursor: 'default',
    opacity: 0.4,
  },
  dayNum: {
    fontSize: 14,
    fontWeight: 500,
    color: 'var(--ds-color-text)',
  },
  dayDot: {
    width: 4,
    height: 4,
    borderRadius: 'var(--ds-radius-pill)',
    background: 'var(--ds-color-accent)',
  },
  detailCard: {
    background: 'var(--ds-color-surface)',
    borderRadius: 'var(--ds-radius-lg)',
    padding: '14px 16px',
    display: 'grid',
    gap: 10,
  },
  detailHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  detailDate: {
    fontSize: 15,
    fontWeight: 600,
    color: 'var(--ds-color-text)',
  },
  detailBadges: {
    display: 'flex',
    gap: 6,
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    height: 22,
    borderRadius: 'var(--ds-radius-pill)',
    padding: '0 8px',
    fontSize: 11,
    fontWeight: 500,
    background: 'var(--ds-color-green-soft)',
    color: 'var(--ds-color-green)',
  },
  badgeAccent: {
    display: 'inline-flex',
    alignItems: 'center',
    height: 22,
    borderRadius: 'var(--ds-radius-pill)',
    padding: '0 8px',
    fontSize: 11,
    fontWeight: 500,
    background: 'var(--ds-color-blue-soft)',
    color: 'var(--ds-color-blue)',
  },
  emptyText: {
    margin: 0,
    color: 'var(--ds-color-text-faint)',
    fontSize: 13,
  },
  hintText: {
    margin: 0,
    color: 'var(--ds-color-text-faint)',
    fontSize: 13,
    textAlign: 'center',
  },
  itemList: {
    display: 'grid',
    gap: 6,
  },
  itemCard: {
    background: 'var(--ds-color-surface-strong)',
    borderRadius: 'var(--ds-radius-md)',
    padding: '10px 12px',
    display: 'grid',
    gap: 6,
  },
  itemRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  itemTitle: {
    margin: 0,
    fontSize: 14,
    fontWeight: 500,
    color: 'var(--ds-color-text)',
  },
  itemMeta: {
    margin: '2px 0 0',
    fontSize: 12,
    color: 'var(--ds-color-text-faint)',
  },
  typeChip: {
    display: 'inline-flex',
    alignItems: 'center',
    height: 20,
    borderRadius: 'var(--ds-radius-pill)',
    padding: '0 7px',
    fontSize: 10,
    fontWeight: 500,
    background: 'var(--ds-color-accent-soft)',
    color: 'var(--ds-color-accent)',
    flexShrink: 0,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: 'var(--ds-radius-sm)',
    objectFit: 'cover',
  },
};
