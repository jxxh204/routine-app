'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type CSSProperties } from 'react';

import { AuthRequired } from '@/components/auth-required';
import { AppCard, GhostButton, PageShell, SectionHeader, StatCard } from '@/components/ui';
import { getMonthMatrix, parseHistoryEntries, toDateKey, type DoneItem } from '@/lib/calendar-history';
import { readProofImage } from '@/lib/proof-image-store';

const STORAGE_PREFIX = 'routine-challenge-v1:';

function getRoutineTypeLabel(id: string) {
  if (id === 'wake' || id === 'lunch' || id === 'sleep') return '기본 루틴';
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
  const [isCompactLayout, setIsCompactLayout] = useState(false);

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

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const update = () => {
      setIsCompactLayout(window.innerWidth < 1024);
    };

    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return (
    <AuthRequired>
      <PageShell>
        <section style={styles.pageSection}>
          <div style={styles.headerRow}>
            <SectionHeader eyebrow="History" title="캘린더" description="월별 완료 흐름과 날짜별 내역을 함께 확인해요." />
            <Link href="/today" style={styles.todayLink}>
              오늘으로
            </Link>
          </div>

          <div style={{ ...styles.summaryGrid, ...(isCompactLayout ? styles.summaryGridCompact : {}) }}>
            <StatCard label="이번 달 완료" value={`${monthDoneCount}`} />
            <StatCard label="기록된 날짜" value={`${history.length}`} />
          </div>

          <div style={{ ...styles.layoutGrid, ...(isCompactLayout ? styles.layoutGridCompact : {}) }}>
            <AppCard>
              <section>
                <div style={styles.monthHeader}>
                  <GhostButton
                    style={styles.navButton}
                    onClick={() => {
                      if (!canGoPrevMonth) return;
                      setSelectedDate(null);
                      setMonth(availableMonths[effectiveMonthIndex - 1]);
                    }}
                    disabled={!canGoPrevMonth}
                  >
                    이전달
                  </GhostButton>
                  <strong style={{ fontSize: 24 }}>{monthTitle}</strong>
                  <GhostButton
                    style={styles.navButton}
                    onClick={() => {
                      if (!canGoNextMonth) return;
                      setSelectedDate(null);
                      setMonth(availableMonths[effectiveMonthIndex + 1]);
                    }}
                    disabled={!canGoNextMonth}
                  >
                    다음달
                  </GhostButton>
                </div>

                <div style={styles.grid}>
                  {['일', '월', '화', '수', '목', '금', '토'].map((w) => (
                    <div key={w} style={styles.weekday}>
                      {w}
                    </div>
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
                          ...(inMonth ? {} : styles.dayCellOutMonth),
                          ...(!isEnabled ? styles.dayCellDisabled : {}),
                          ...(isEnabled ? styles.dayCellEnabled : {}),
                          ...(isSelected ? styles.dayCellSelected : {}),
                        }}
                        onClick={() => {
                          if (!isEnabled) return;
                          setSelectedDate(key);
                        }}
                        disabled={!isEnabled}
                      >
                        <div style={{ fontSize: 18, fontWeight: 700 }}>{inMonth ? date.getDate() : ''}</div>
                        <div style={styles.doneCount}>{count > 0 ? `완료 ${count}` : ''}</div>
                      </button>
                    );
                  })}
                </div>
              </section>
            </AppCard>

            <AppCard>
              <section style={{ ...styles.detailPanel, ...(isCompactLayout ? styles.detailPanelCompact : {}) }}>
                <strong style={{ fontSize: 20 }}>{selectedDate ?? '날짜를 선택해 주세요'}</strong>
                {selectedDate ? (
                  <div style={styles.detailStats}>
                    <StatCard label="완료 루틴" value={`${selectedItems.length}`} />
                    <StatCard label="인증 이미지" value={`${selectedProofCount}`} />
                  </div>
                ) : null}

                {!selectedDate ? (
                  <p style={styles.emptyText}>좌측 캘린더에서 날짜를 고르면 완료 루틴이 표시됩니다.</p>
                ) : selectedItems.length === 0 ? (
                  <p style={styles.emptyText}>해당일 완료 내역이 없습니다.</p>
                ) : (
                  <div style={styles.itemGrid}>
                    {selectedItems.map((item) => {
                      const image = selectedDate ? proofByItemKey[`${selectedDate}:${item.id}`] ?? item.proofImage : item.proofImage;

                      return (
                        <article key={`${selectedDate}-${item.id}-${item.doneAt ?? ''}`} style={styles.itemCard}>
                          <div style={styles.itemTopRow}>
                            <div style={styles.itemTitle}>{item.title ?? item.id}</div>
                            <span style={styles.typeChip}>{getRoutineTypeLabel(item.id)}</span>
                          </div>
                          <div style={styles.itemTime}>완료 시간: {item.doneAt ?? '미기록'}</div>
                          {image ? (
                            <img src={image} alt="인증 썸네일" style={styles.thumb} />
                          ) : (
                            <div style={styles.emptyThumb}>인증 이미지 없음</div>
                          )}
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>
            </AppCard>
          </div>
        </section>
      </PageShell>
    </AuthRequired>
  );
}

const styles: Record<string, CSSProperties> = {
  pageSection: { display: 'grid', gap: 18 },
  headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 },
  todayLink: { color: '#ffd7bd', fontSize: 14 },
  summaryGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 },
  summaryGridCompact: { gridTemplateColumns: '1fr' },
  layoutGrid: { display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 },
  layoutGridCompact: { gridTemplateColumns: '1fr' },
  monthHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 8 },
  navButton: { padding: '8px 12px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 },
  weekday: { textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, marginBottom: 4 },
  doneCount: { fontSize: 11, color: 'var(--text-muted)', marginTop: 2 },
  dayCell: {
    border: '1px solid var(--outline)',
    background: 'var(--surface-1)',
    color: '#f5f7fa',
    borderRadius: 12,
    minHeight: 72,
    padding: 8,
    textAlign: 'center',
    cursor: 'pointer',
    boxShadow: 'var(--ds-shadow-soft)',
  },
  dayCellOutMonth: {
    opacity: 0.3,
  },
  dayCellDisabled: {
    cursor: 'default',
    opacity: 0.42,
  },
  dayCellEnabled: {
    border: '1px solid #3b4454',
    boxShadow: '0 0 0 1px rgba(255,255,255,0.03) inset',
  },
  dayCellSelected: {
    border: '1px solid #8a4f1e',
    boxShadow: '0 0 0 1px rgba(255, 143, 63, 0.45) inset',
  },
  detailPanel: { display: 'grid', gap: 10, minHeight: 520, alignContent: 'flex-start' },
  detailPanelCompact: { minHeight: 'auto' },
  detailStats: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 },
  emptyText: { color: 'var(--text-muted)', marginTop: 8 },
  itemGrid: { display: 'grid', gap: 8, marginTop: 4 },
  itemCard: { border: '1px solid var(--outline)', borderRadius: 12, padding: 12, background: 'rgba(255,255,255,0.02)' },
  itemTopRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  itemTitle: { fontWeight: 600 },
  typeChip: {
    borderRadius: 999,
    border: '1px solid #5a3822',
    background: '#24170e',
    color: '#f2bd93',
    padding: '2px 8px',
    fontSize: 11,
  },
  itemTime: { color: 'var(--text-muted)', fontSize: 12, marginTop: 6 },
  thumb: { marginTop: 8, width: 96, height: 96, borderRadius: 8, objectFit: 'cover' },
  emptyThumb: {
    marginTop: 8,
    width: 96,
    height: 96,
    borderRadius: 8,
    border: '1px dashed var(--outline)',
    display: 'grid',
    placeItems: 'center',
    color: 'var(--text-muted)',
    fontSize: 11,
  },
};
