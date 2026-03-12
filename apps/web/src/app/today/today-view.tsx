"use client";

import { type CSSProperties, useEffect, useMemo, useState } from 'react';

type Routine = {
  id: string;
  title: string;
  timeRangeLabel: string;
  startMinute: number;
  endMinute: number;
  doneByMe: boolean;
  doneByBuddy: boolean;
  doneAt?: string;
};

const initialRoutines: Routine[] = [
  {
    id: 'wake',
    title: '기상 인증',
    timeRangeLabel: '09:00 - 11:00',
    startMinute: 9 * 60,
    endMinute: 11 * 60,
    doneByMe: false,
    doneByBuddy: false,
  },
  {
    id: 'lunch',
    title: '식사 인증',
    timeRangeLabel: '12:30 - 13:30',
    startMinute: 12 * 60 + 30,
    endMinute: 13 * 60 + 30,
    doneByMe: false,
    doneByBuddy: false,
  },
  {
    id: 'sleep',
    title: '취침 인증',
    timeRangeLabel: '23:00 - 다음날 02:00',
    startMinute: 23 * 60,
    endMinute: 2 * 60,
    doneByMe: false,
    doneByBuddy: false,
  },
];

function isInTimeWindow(nowMinute: number, startMinute: number, endMinute: number) {
  if (startMinute < endMinute) {
    return nowMinute >= startMinute && nowMinute < endMinute;
  }

  // 자정 넘어가는 구간 (예: 23:00 ~ 02:00)
  return nowMinute >= startMinute || nowMinute < endMinute;
}

function getNowMinute() {
  const now = new Date();
  return now.getHours() * 60 + now.getMinutes();
}

function formatKoreanTime(date: Date) {
  return date.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function TodayView() {
  const [routines, setRoutines] = useState(initialRoutines);
  const [nowMinute, setNowMinute] = useState(getNowMinute());

  useEffect(() => {
    const interval = setInterval(() => {
      setNowMinute(getNowMinute());
    }, 30_000);

    return () => clearInterval(interval);
  }, []);

  const doneCount = useMemo(
    () => routines.filter((routine) => routine.doneByMe).length,
    [routines],
  );

  const progress = Math.round((doneCount / routines.length) * 100);

  const certify = (id: string) => {
    setRoutines((prev) =>
      prev.map((routine) => {
        if (routine.id !== id) return routine;

        const inWindow = isInTimeWindow(
          nowMinute,
          routine.startMinute,
          routine.endMinute,
        );

        if (!inWindow || routine.doneByMe) {
          return routine;
        }

        return {
          ...routine,
          doneByMe: true,
          doneAt: formatKoreanTime(new Date()),
        };
      }),
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
          <h1 style={styles.title}>루틴 챌린지</h1>
          <p style={styles.date}>{today}</p>
        </div>
        <span style={styles.badge}>하루 3회 인증</span>
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
        {routines.map((routine) => {
          const inWindow = isInTimeWindow(
            nowMinute,
            routine.startMinute,
            routine.endMinute,
          );
          const canCertify = inWindow && !routine.doneByMe;

          return (
            <article key={routine.id} style={styles.item}>
              <button
                onClick={() => certify(routine.id)}
                disabled={!canCertify}
                style={{
                  ...styles.checkButton,
                  ...(routine.doneByMe ? styles.checkButtonDone : {}),
                  ...(!canCertify && !routine.doneByMe ? styles.checkButtonDisabled : {}),
                }}
              >
                {routine.doneByMe ? '인증완료' : canCertify ? '인증하기' : '대기중'}
              </button>

              <div style={styles.itemBody}>
                <p style={styles.itemTitle}>{routine.title}</p>
                <p style={styles.meta}>인증 가능 시간: {routine.timeRangeLabel}</p>
                <p style={styles.meta}>
                  내 상태:{' '}
                  {routine.doneByMe
                    ? `완료 ✅${routine.doneAt ? ` (${routine.doneAt})` : ''}`
                    : inWindow
                      ? '지금 인증 가능 🔓'
                      : '아직 인증 시간 아님 ⏳'}
                </p>
                <p style={styles.meta}>
                  친구 상태: {routine.doneByBuddy ? '완료 ✅' : '미완료 ⏳'}
                </p>
              </div>
            </article>
          );
        })}
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
    width: 72,
    height: 40,
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
  checkButtonDisabled: {
    opacity: 0.55,
    cursor: 'not-allowed',
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
