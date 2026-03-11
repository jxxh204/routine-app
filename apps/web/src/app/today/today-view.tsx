"use client";

import { type CSSProperties, useMemo, useState } from 'react';

type Routine = {
  id: string;
  title: string;
  doneByMe: boolean;
  doneByBuddy: boolean;
};

const initialRoutines: Routine[] = [
  { id: 'r1', title: '아침 물 500ml 마시기', doneByMe: false, doneByBuddy: true },
  { id: 'r2', title: '30분 운동', doneByMe: false, doneByBuddy: false },
  { id: 'r3', title: '저녁 11시 전 취침', doneByMe: false, doneByBuddy: false },
];

export function TodayView() {
  const [routines, setRoutines] = useState(initialRoutines);

  const doneCount = useMemo(
    () => routines.filter((routine) => routine.doneByMe).length,
    [routines],
  );

  const progress = Math.round((doneCount / routines.length) * 100);

  const toggleDone = (id: string) => {
    setRoutines((prev) =>
      prev.map((routine) =>
        routine.id === id ? { ...routine, doneByMe: !routine.doneByMe } : routine,
      ),
    );
  };

  const today = new Date().toLocaleDateString('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  });

  return (
    <main style={styles.page}>
      <div style={styles.headerRow}>
        <div>
          <h1 style={styles.title}>오늘 루틴</h1>
          <p style={styles.date}>{today}</p>
        </div>
        <span style={styles.badge}>친구와 함께</span>
      </div>

      <section style={styles.progressCard}>
        <div style={styles.progressTop}>
          <strong>{doneCount}/{routines.length} 완료</strong>
          <span>{progress}%</span>
        </div>
        <div style={styles.progressTrack}>
          <div style={{ ...styles.progressFill, width: `${progress}%` }} />
        </div>
      </section>

      <section style={styles.list}>
        {routines.map((routine) => (
          <article key={routine.id} style={styles.item}>
            <button
              onClick={() => toggleDone(routine.id)}
              style={{
                ...styles.checkButton,
                ...(routine.doneByMe ? styles.checkButtonDone : {}),
              }}
            >
              {routine.doneByMe ? '완료' : '체크'}
            </button>

            <div style={styles.itemBody}>
              <p style={styles.itemTitle}>{routine.title}</p>
              <p style={styles.meta}>
                친구 상태: {routine.doneByBuddy ? '완료 ✅' : '미완료 ⏳'}
              </p>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    maxWidth: 560,
    margin: '0 auto',
    padding: '32px 20px 56px',
    background: '#111315',
    minHeight: '100vh',
    color: '#f5f7fa',
    fontFamily: 'Pretendard, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
  },
  headerRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  title: {
    margin: 0,
    fontSize: 32,
    fontWeight: 700,
  },
  date: {
    margin: '6px 0 0',
    color: '#9aa4af',
    fontSize: 14,
  },
  badge: {
    background: '#1f2f27',
    color: '#7cffb2',
    border: '1px solid #2f4d3d',
    borderRadius: 999,
    padding: '6px 10px',
    fontSize: 12,
  },
  progressCard: {
    background: '#1b1f23',
    border: '1px solid #2b3138',
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
  },
  progressTop: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: 8,
    fontSize: 14,
  },
  progressTrack: {
    height: 8,
    background: '#2b3138',
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    background: '#7cffb2',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  item: {
    display: 'flex',
    gap: 12,
    alignItems: 'center',
    background: '#1b1f23',
    border: '1px solid #2b3138',
    borderRadius: 14,
    padding: 12,
  },
  checkButton: {
    width: 64,
    height: 36,
    borderRadius: 10,
    border: '1px solid #3c4652',
    background: '#242b33',
    color: '#e6edf3',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
  },
  checkButtonDone: {
    background: '#1f3a2d',
    color: '#7cffb2',
    border: '1px solid #2e664d',
  },
  itemBody: {
    flex: 1,
  },
  itemTitle: {
    margin: 0,
    fontSize: 15,
    fontWeight: 600,
  },
  meta: {
    margin: '6px 0 0',
    fontSize: 13,
    color: '#9aa4af',
  },
};
