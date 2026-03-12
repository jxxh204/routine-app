"use client";

import { type CSSProperties, useCallback, useEffect, useMemo, useState } from 'react';

import { supabase } from '@/lib/supabase';

const STORAGE_PREFIX = 'routine-challenge-v1';
const buddyUserId = process.env.NEXT_PUBLIC_BUDDY_USER_ID;

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

function getTodayDateKey() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getTodayStorageKey() {
  return `${STORAGE_PREFIX}:${getTodayDateKey()}`;
}

async function getAuthHeaders() {
  if (!supabase) return null;

  const [{ data: userRes }, { data: sessionRes }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.auth.getSession(),
  ]);

  const userId = userRes.user?.id;
  const accessToken = sessionRes.session?.access_token;
  if (!userId || !accessToken) return null;

  return {
    userId,
    headers: {
      apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  };
}

async function syncTodayFromSupabase() {
  const auth = await getAuthHeaders();
  if (!auth) return null;

  const today = getTodayDateKey();

  const myResponse = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/challenge_logs?user_id=eq.${auth.userId}&challenge_date=eq.${today}`,
    { headers: auth.headers },
  );

  if (!myResponse.ok) return null;

  const myRows = (await myResponse.json()) as Array<{
    routine_key: string;
    done_at: string | null;
  }>;

  let buddyRows: Array<{ routine_key: string }> = [];

  if (buddyUserId) {
    const buddyResponse = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/challenge_logs?select=routine_key&user_id=eq.${buddyUserId}&challenge_date=eq.${today}`,
      { headers: auth.headers },
    );

    if (buddyResponse.ok) {
      buddyRows = (await buddyResponse.json()) as Array<{ routine_key: string }>;
    }
  }

  return initialRoutines.map((routine) => {
    const myRow = myRows.find((item) => item.routine_key === routine.id);
    const buddyDone = buddyRows.some((item) => item.routine_key === routine.id);

    return {
      ...routine,
      doneByMe: Boolean(myRow),
      doneByBuddy: buddyDone,
      doneAt: myRow?.done_at ? formatKoreanTime(new Date(myRow.done_at)) : undefined,
    };
  });
}

async function saveCertificationToSupabase(routineKey: string, doneAtIso: string) {
  const auth = await getAuthHeaders();
  if (!auth) return false;

  const response = await fetch(
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/challenge_logs`,
    {
      method: 'POST',
      headers: {
        ...auth.headers,
        Prefer: 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify({
        user_id: auth.userId,
        challenge_date: getTodayDateKey(),
        routine_key: routineKey,
        done_at: doneAtIso,
      }),
    },
  );

  return response.ok;
}

function getInitialRoutines() {
  if (typeof window === 'undefined') {
    return initialRoutines;
  }

  try {
    const raw = window.localStorage.getItem(getTodayStorageKey());
    if (!raw) return initialRoutines;

    const saved = JSON.parse(raw) as Array<Pick<Routine, 'id' | 'doneByMe' | 'doneAt'>>;
    return initialRoutines.map((routine) => {
      const match = saved.find((item) => item.id === routine.id);
      if (!match) return routine;
      return {
        ...routine,
        doneByMe: Boolean(match.doneByMe),
        doneAt: match.doneAt,
      };
    });
  } catch {
    return initialRoutines;
  }
}

export function TodayView() {
  const [routines, setRoutines] = useState(getInitialRoutines);
  const [nowMinute, setNowMinute] = useState(getNowMinute());
  const [syncMessage, setSyncMessage] = useState('로컬 저장 모드');

  useEffect(() => {
    const snapshot = routines.map(({ id, doneByMe, doneAt }) => ({ id, doneByMe, doneAt }));
    window.localStorage.setItem(getTodayStorageKey(), JSON.stringify(snapshot));
  }, [routines]);

  const refreshFromSupabase = useCallback(async () => {
    const synced = await syncTodayFromSupabase();

    if (!synced) {
      setSyncMessage('로컬 저장 모드 (로그인 시 Supabase 동기화)');
      return;
    }

    setRoutines(synced);
    setSyncMessage('Supabase 동기화됨');
  }, []);

  useEffect(() => {
    const kickoff = setTimeout(() => {
      void refreshFromSupabase();
    }, 0);

    // 실시간 연결 실패 시에도 최소 동기화 보장
    const fallbackPolling = setInterval(() => {
      void refreshFromSupabase();
    }, 60_000);

    let cleanupRealtime: (() => void) | null = null;

    const setupRealtime = async () => {
      const client = supabase;
      if (!client) return;

      const auth = await getAuthHeaders();
      if (!auth) return;

      const channel = client
        .channel(`challenge-logs-${auth.userId}-${getTodayDateKey()}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'challenge_logs',
            filter: `challenge_date=eq.${getTodayDateKey()}`,
          },
          () => {
            void refreshFromSupabase();
          },
        )
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            setSyncMessage('Supabase 실시간 동기화됨');
          }
        });

      cleanupRealtime = () => {
        void client.removeChannel(channel);
      };
    };

    void setupRealtime();

    return () => {
      clearTimeout(kickoff);
      clearInterval(fallbackPolling);
      cleanupRealtime?.();
    };
  }, [refreshFromSupabase]);

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

  const certify = async (id: string) => {
    const now = new Date();
    const doneAtText = formatKoreanTime(now);

    let updated = false;

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

        updated = true;

        return {
          ...routine,
          doneByMe: true,
          doneAt: doneAtText,
        };
      }),
    );

    if (!updated) return;

    const ok = await saveCertificationToSupabase(id, now.toISOString());
    setSyncMessage(ok ? 'Supabase 저장 완료' : '로컬 저장 완료 (Supabase 미연동)');

    if (ok) {
      void refreshFromSupabase();
    }
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
        <p style={styles.syncText}>{syncMessage}</p>
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
  syncText: {
    margin: '8px 0 0',
    fontSize: 12,
    color: '#7f8b98',
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
