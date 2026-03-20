'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState, type CSSProperties } from 'react';

import { AuthRequired } from '@/components/auth-required';
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
          return image ? [itemKey, image] as const : null;
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
    <main style={{ minHeight: '100dvh', background: 'var(--background)', color: 'var(--foreground)', padding: '28px 16px 40px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: 12, letterSpacing: 0.8 }}>HISTORY</p>
          <h1 style={{ margin: '6px 0 0', fontSize: 28 }}>캘린더</h1>
        </div>
        <Link href="/today" style={{ color: '#9ed0ff', textDecoration: 'none', fontSize: 14 }}>
          오늘으로
        </Link>
      </div>

      <section style={{ border: '1px solid var(--outline)', borderRadius: 16, padding: 14, background: 'var(--surface-1)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <button style={navButton} onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>‹</button>
          <strong>{monthTitle}</strong>
          <button style={navButton} onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>›</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
          {['일', '월', '화', '수', '목', '금', '토'].map((w) => (
            <div key={w} style={{ textAlign: 'center', color: '#9aa4af', fontSize: 12 }}>{w}</div>
          ))}

          {days.map((date) => {
            const key = toDateKey(date);
            const count = byDate.get(key)?.length ?? 0;
            const inMonth = date.getMonth() === month.getMonth();

            return (
              <button key={key} style={{ ...dayCell, opacity: inMonth ? 1 : 0.45 }} onClick={() => setSelectedDate(key)}>
                <div>{date.getDate()}</div>
                {count > 0 ? <div style={{ fontSize: 10, color: '#7cffb2' }}>완료 {count}</div> : null}
              </button>
            );
          })}
        </div>
      </section>

      {selectedDate ? (
        <section style={modalOverlay} onClick={() => setSelectedDate(null)}>
          <div style={modalCard} onClick={(e) => e.stopPropagation()}>
            <strong>{selectedDate} 완료 루틴</strong>
            {selectedItems.length === 0 ? (
              <p style={{ color: '#9aa4af' }}>해당일 완료 내역이 없습니다.</p>
            ) : (
              <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
                {selectedItems.map((item) => {
                  const image = selectedDate ? proofByItemKey[`${selectedDate}:${item.id}`] ?? item.proofImage : item.proofImage;

                  return (
                    <article key={`${selectedDate}-${item.id}-${item.doneAt ?? ''}`} style={{ border: '1px solid #303844', borderRadius: 10, padding: 10 }}>
                      <div style={{ fontWeight: 600 }}>{item.title ?? item.id}</div>
                      <div style={{ color: '#9aa4af', fontSize: 12 }}>{item.doneAt ?? '완료 시간 미기록'}</div>
                      {image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={image} alt="인증 썸네일" style={{ marginTop: 8, width: 72, height: 72, borderRadius: 8, objectFit: 'cover' }} />
                      ) : null}
                    </article>
                  );
                })}
              </div>
            )}
            <button style={{ ...navButton, marginTop: 10, width: '100%' }} onClick={() => setSelectedDate(null)}>닫기</button>
          </div>
        </section>
      ) : null}
    </main>
    </AuthRequired>
  );
}

const navButton: CSSProperties = {
  border: '1px solid var(--outline)',
  background: 'var(--surface-2)',
  color: '#d0d8e0',
  borderRadius: 8,
  padding: '4px 8px',
  cursor: 'pointer',
};

const dayCell: CSSProperties = {
  border: '1px solid var(--outline)',
  background: '#121821',
  color: '#f5f7fa',
  borderRadius: 8,
  minHeight: 52,
  padding: 6,
  textAlign: 'center',
  cursor: 'pointer',
};

const modalOverlay: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.6)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 16,
};

const modalCard: CSSProperties = {
  width: '100%',
  maxWidth: 420,
  border: '1px solid #2b3138',
  borderRadius: 12,
  background: '#1b1f23',
  padding: 12,
};
