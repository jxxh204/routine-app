'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type CSSProperties } from 'react';

import { AuthRequired } from '@/components/auth-required';
import { AppCard, GhostButton, PageShell, SectionHeader } from '@/components/ui';
import { getMonthMatrix, parseHistoryEntries, toDateKey, type DoneItem } from '@/lib/calendar-history';
import { readProofImage } from '@/lib/proof-image-store';

const STORAGE_PREFIX = 'routine-challenge-v1:';

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

  const days = useMemo(() => getMonthMatrix(month), [month]);
  const monthTitle = `${month.getFullYear()}년 ${month.getMonth() + 1}월`;
  const selectedItems = selectedDate ? byDate.get(selectedDate) ?? [] : [];

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
        <section style={styles.pageSection}>
          <div style={styles.headerRow}>
            <SectionHeader eyebrow="History" title="캘린더" description="완료 내역을 날짜별로 확인해요." />
            <Link href="/today" style={styles.todayLink}>
              오늘으로
            </Link>
          </div>

          <AppCard>
            <section>
              <div style={styles.monthHeader}>
                <GhostButton style={styles.navButton} onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>
                  ‹
                </GhostButton>
                <strong>{monthTitle}</strong>
                <GhostButton style={styles.navButton} onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>
                  ›
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
                  const inMonth = date.getMonth() === month.getMonth();

                  return (
                    <button key={key} style={{ ...styles.dayCell, opacity: inMonth ? 1 : 0.45 }} onClick={() => setSelectedDate(key)}>
                      <div>{date.getDate()}</div>
                      {count > 0 ? <div style={styles.doneCount}>완료 {count}</div> : null}
                    </button>
                  );
                })}
              </div>
            </section>
          </AppCard>

          {selectedDate ? (
            <section style={styles.modalOverlay} onClick={() => setSelectedDate(null)}>
              <AppCard className="calendar-modal-card">
                <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
                  <strong>{selectedDate} 완료 루틴</strong>
                  {selectedItems.length === 0 ? (
                    <p style={styles.emptyText}>해당일 완료 내역이 없습니다.</p>
                  ) : (
                    <div style={styles.itemGrid}>
                      {selectedItems.map((item) => {
                        const image = selectedDate ? proofByItemKey[`${selectedDate}:${item.id}`] ?? item.proofImage : item.proofImage;

                        return (
                          <article key={`${selectedDate}-${item.id}-${item.doneAt ?? ''}`} style={styles.itemCard}>
                            <div style={styles.itemTitle}>{item.title ?? item.id}</div>
                            <div style={styles.itemTime}>{item.doneAt ?? '완료 시간 미기록'}</div>
                            {image ? <img src={image} alt="인증 썸네일" style={styles.thumb} /> : null}
                          </article>
                        );
                      })}
                    </div>
                  )}
                  <GhostButton style={{ ...styles.navButton, marginTop: 10, width: '100%' }} onClick={() => setSelectedDate(null)}>
                    닫기
                  </GhostButton>
                </div>
              </AppCard>
            </section>
          ) : null}
        </section>
      </PageShell>
    </AuthRequired>
  );
}

const styles: Record<string, CSSProperties> = {
  pageSection: { display: 'grid', gap: 18 },
  headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12 },
  todayLink: { color: '#ffd7bd', fontSize: 14 },
  monthHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  navButton: { padding: '6px 10px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 },
  weekday: { textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 },
  doneCount: { fontSize: 10, color: 'var(--ds-color-accent-strong)', marginTop: 2 },
  dayCell: {
    border: '1px solid var(--outline)',
    background: 'var(--surface-1)',
    color: '#f5f7fa',
    borderRadius: 10,
    minHeight: 56,
    padding: 8,
    textAlign: 'center',
    cursor: 'pointer',
    boxShadow: 'var(--ds-shadow-soft)',
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: { width: '100%', maxWidth: 420 },
  emptyText: { color: 'var(--text-muted)', marginTop: 8 },
  itemGrid: { display: 'grid', gap: 8, marginTop: 8 },
  itemCard: { border: '1px solid var(--outline)', borderRadius: 10, padding: 10 },
  itemTitle: { fontWeight: 600 },
  itemTime: { color: 'var(--text-muted)', fontSize: 12 },
  thumb: { marginTop: 8, width: 72, height: 72, borderRadius: 8, objectFit: 'cover' },
};
