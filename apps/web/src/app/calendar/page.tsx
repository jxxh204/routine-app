'use client';

import Link from 'next/link';
import { useMemo } from 'react';

type DoneItem = {
  id: string;
  title?: string;
  doneByMe?: boolean;
  doneAt?: string;
  proofImage?: string;
};

const STORAGE_PREFIX = 'routine-challenge-v1:';

function readHistory() {
  if (typeof window === 'undefined') return [] as Array<{ date: string; items: DoneItem[] }>;

  const rows: Array<{ date: string; items: DoneItem[] }> = [];

  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i);
    if (!key || !key.startsWith(STORAGE_PREFIX)) continue;

    const date = key.slice(STORAGE_PREFIX.length);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;

    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as DoneItem[];
      const done = parsed.filter((item) => item?.doneByMe);
      if (done.length > 0) rows.push({ date, items: done });
    } catch {
      // ignore malformed rows
    }
  }

  return rows.sort((a, b) => (a.date < b.date ? 1 : -1));
}

export default function CalendarPage() {
  const history = useMemo(() => readHistory(), []);

  return (
    <main style={{ minHeight: '100dvh', background: '#11151a', color: '#f5f7fa', padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>캘린더</h1>
        <Link href="/today" style={{ color: '#9ed0ff', textDecoration: 'none' }}>
          오늘으로
        </Link>
      </div>

      {history.length === 0 ? (
        <p style={{ color: '#9aa4af' }}>완료 내역이 없습니다.</p>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {history.map((row) => (
            <section key={row.date} style={{ border: '1px solid #2b3138', borderRadius: 12, padding: 12, background: '#1b1f23' }}>
              <strong>{row.date}</strong>
              <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
                {row.items.map((item) => (
                  <article key={`${row.date}-${item.id}-${item.doneAt ?? ''}`} style={{ border: '1px solid #303844', borderRadius: 10, padding: 10 }}>
                    <div style={{ fontWeight: 600 }}>{item.title ?? item.id}</div>
                    <div style={{ color: '#9aa4af', fontSize: 12 }}>{item.doneAt ?? '완료 시간 미기록'}</div>
                    {item.proofImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.proofImage} alt="인증 썸네일" style={{ marginTop: 8, width: 72, height: 72, borderRadius: 8, objectFit: 'cover' }} />
                    ) : null}
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
