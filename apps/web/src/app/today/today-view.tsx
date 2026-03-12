"use client";

import {
  type CSSProperties,
  type TouchEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { supabase } from '@/lib/supabase';

const STORAGE_PREFIX = 'routine-challenge-v1';
const buddyUserId = process.env.NEXT_PUBLIC_BUDDY_USER_ID;
const CUSTOM_ROUTINES_KEY = `${STORAGE_PREFIX}:custom-routines`;

type Routine = {
  id: string;
  title: string;
  timeRangeLabel: string;
  startMinute: number;
  endMinute: number;
  doneByMe: boolean;
  doneByBuddy: boolean;
  doneAt?: string;
  isDefault: boolean;
};

const defaultRoutines: Routine[] = [
  {
    id: 'wake',
    title: '기상 인증',
    timeRangeLabel: '09:00 - 11:00',
    startMinute: 9 * 60,
    endMinute: 11 * 60,
    doneByMe: false,
    doneByBuddy: false,
    isDefault: true,
  },
  {
    id: 'lunch',
    title: '식사 인증',
    timeRangeLabel: '12:30 - 13:30',
    startMinute: 12 * 60 + 30,
    endMinute: 13 * 60 + 30,
    doneByMe: false,
    doneByBuddy: false,
    isDefault: true,
  },
  {
    id: 'sleep',
    title: '취침 인증',
    timeRangeLabel: '23:00 - 다음날 02:00',
    startMinute: 23 * 60,
    endMinute: 2 * 60,
    doneByMe: false,
    doneByBuddy: false,
    isDefault: true,
  },
];

type StoredRoutineDefinition = {
  id: string;
  title: string;
  startMinute: number;
  endMinute: number;
};

function isInTimeWindow(nowMinute: number, startMinute: number, endMinute: number) {
  if (startMinute < endMinute) {
    return nowMinute >= startMinute && nowMinute < endMinute;
  }

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

function minuteToHHMM(minute: number) {
  const h = String(Math.floor(minute / 60)).padStart(2, '0');
  const m = String(minute % 60).padStart(2, '0');
  return `${h}:${m}`;
}

function formatTimeRangeLabel(startMinute: number, endMinute: number) {
  const start = minuteToHHMM(startMinute);
  const end = minuteToHHMM(endMinute);
  if (startMinute < endMinute) {
    return `${start} - ${end}`;
  }
  return `${start} - 다음날 ${end}`;
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

function readCustomRoutines(): Routine[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(CUSTOM_ROUTINES_KEY);
    if (!raw) return [];

    const defs = JSON.parse(raw) as StoredRoutineDefinition[];
    return defs
      .filter((item) => item.id !== 'wake' && item.id !== 'lunch' && item.id !== 'sleep')
      .map((item) => ({
        id: item.id,
        title: item.title,
        startMinute: item.startMinute,
        endMinute: item.endMinute,
        timeRangeLabel: formatTimeRangeLabel(item.startMinute, item.endMinute),
        doneByMe: false,
        doneByBuddy: false,
        isDefault: false,
      }));
  } catch {
    return [];
  }
}

function saveCustomRoutines(routines: Routine[]) {
  const customs = routines
    .filter((routine) => !routine.isDefault)
    .map((routine) => ({
      id: routine.id,
      title: routine.title,
      startMinute: routine.startMinute,
      endMinute: routine.endMinute,
    }));

  window.localStorage.setItem(CUSTOM_ROUTINES_KEY, JSON.stringify(customs));
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

async function syncTodayFromSupabase(baseRoutines: Routine[]) {
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

  return baseRoutines.map((routine) => {
    if (!routine.isDefault) {
      return { ...routine, doneByBuddy: false };
    }

    const myRow = myRows.find((item) => item.routine_key === routine.id);
    const buddyDone = buddyRows.some((item) => item.routine_key === routine.id);

    return {
      ...routine,
      doneByMe: Boolean(myRow),
      doneByBuddy: buddyDone,
      doneAt: myRow?.done_at ? formatKoreanTime(new Date(myRow.done_at)) : routine.doneAt,
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
  const base = [...defaultRoutines, ...readCustomRoutines()];

  if (typeof window === 'undefined') {
    return base;
  }

  try {
    const raw = window.localStorage.getItem(getTodayStorageKey());
    if (!raw) return base;

    const saved = JSON.parse(raw) as Array<Pick<Routine, 'id' | 'doneByMe' | 'doneAt'>>;
    return base.map((routine) => {
      const match = saved.find((item) => item.id === routine.id);
      if (!match) return routine;
      return {
        ...routine,
        doneByMe: Boolean(match.doneByMe),
        doneAt: match.doneAt,
      };
    });
  } catch {
    return base;
  }
}

export function TodayView() {
  const [routines, setRoutines] = useState(getInitialRoutines);
  const [nowMinute, setNowMinute] = useState(getNowMinute());
  const [syncMessage, setSyncMessage] = useState('로컬 저장 모드');
  const [newTitle, setNewTitle] = useState('');
  const [newStart, setNewStart] = useState('09:00');
  const [newEnd, setNewEnd] = useState('10:00');
  const [isAddFormOpen, setIsAddFormOpen] = useState(false);
  const [swipedRoutineId, setSwipedRoutineId] = useState<string | null>(null);

  useEffect(() => {
    const snapshot = routines.map(({ id, doneByMe, doneAt }) => ({ id, doneByMe, doneAt }));
    window.localStorage.setItem(getTodayStorageKey(), JSON.stringify(snapshot));
    saveCustomRoutines(routines);
  }, [routines]);

  const refreshFromSupabase = useCallback(async () => {
    setRoutines((prev) => prev);

    const synced = await syncTodayFromSupabase(routines);

    if (!synced) {
      setSyncMessage('로컬 저장 모드 (로그인 시 Supabase 동기화)');
      return;
    }

    setRoutines(synced);
    setSyncMessage('Supabase 동기화됨');
  }, [routines]);

  useEffect(() => {
    const kickoff = setTimeout(() => {
      void refreshFromSupabase();
    }, 0);

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
        .subscribe();

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
    let isDefaultRoutine = false;

    setRoutines((prev) =>
      prev.map((routine) => {
        if (routine.id !== id) return routine;

        const inWindow = isInTimeWindow(nowMinute, routine.startMinute, routine.endMinute);

        if (!inWindow || routine.doneByMe) {
          return routine;
        }

        updated = true;
        isDefaultRoutine = routine.isDefault;

        return {
          ...routine,
          doneByMe: true,
          doneAt: doneAtText,
        };
      }),
    );

    if (!updated) return;

    if (!isDefaultRoutine) {
      setSyncMessage('로컬 저장 완료');
      return;
    }

    const ok = await saveCertificationToSupabase(id, now.toISOString());
    setSyncMessage(ok ? 'Supabase 저장 완료' : '로컬 저장 완료 (Supabase 미연동)');

    if (ok) {
      void refreshFromSupabase();
    }
  };

  const addCustomRoutine = () => {
    const title = newTitle.trim();
    if (!title) return;

    const [startH, startM] = newStart.split(':').map(Number);
    const [endH, endM] = newEnd.split(':').map(Number);

    const startMinute = startH * 60 + startM;
    const endMinute = endH * 60 + endM;

    const newRoutine: Routine = {
      id: `custom-${Date.now()}`,
      title,
      startMinute,
      endMinute,
      timeRangeLabel: formatTimeRangeLabel(startMinute, endMinute),
      doneByMe: false,
      doneByBuddy: false,
      isDefault: false,
    };

    setRoutines((prev) => [...prev, newRoutine]);
    setNewTitle('');
    setIsAddFormOpen(false);
  };

  const removeRoutine = (id: string) => {
    setRoutines((prev) => prev.filter((routine) => routine.id !== id || routine.isDefault));
    setSwipedRoutineId((prev) => (prev === id ? null : prev));
  };

  const handleRoutineTouchStart = (
    id: string,
    event: TouchEvent<HTMLDivElement>,
  ) => {
    event.currentTarget.dataset.startX = String(event.touches[0]?.clientX ?? 0);
    event.currentTarget.dataset.routineId = id;
  };

  const handleRoutineTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const startX = Number(event.currentTarget.dataset.startX ?? 0);
    const endX = event.changedTouches[0]?.clientX ?? startX;
    const deltaX = startX - endX;
    const id = event.currentTarget.dataset.routineId;

    if (!id) return;

    if (deltaX > 40) {
      setSwipedRoutineId(id);
      return;
    }

    if (deltaX < -40) {
      setSwipedRoutineId(null);
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

      <section style={styles.progressCard}>
        <div style={styles.addHeaderRow}>
          <p style={{ ...styles.meta, margin: 0 }}>루틴 추가</p>
          <button
            style={styles.addToggleButton}
            onClick={() => setIsAddFormOpen((prev) => !prev)}
          >
            {isAddFormOpen ? '닫기' : '+ 추가'}
          </button>
        </div>

        {isAddFormOpen ? (
          <div style={styles.addRow}>
            <input
              style={styles.input}
              placeholder="예: 독서 인증"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
            />
            <input style={styles.inputTime} type="time" value={newStart} onChange={(e) => setNewStart(e.target.value)} />
            <input style={styles.inputTime} type="time" value={newEnd} onChange={(e) => setNewEnd(e.target.value)} />
            <button style={styles.addButton} onClick={addCustomRoutine}>추가</button>
          </div>
        ) : null}
      </section>

      <section style={styles.list}>
        {routines.map((routine) => {
          const inWindow = isInTimeWindow(nowMinute, routine.startMinute, routine.endMinute);
          const canCertify = inWindow && !routine.doneByMe;

          const card = (
            <article
              style={{
                ...styles.item,
                ...(inWindow ? styles.itemActive : styles.itemInactive),
                ...(!routine.isDefault && swipedRoutineId === routine.id ? styles.itemSwiped : {}),
              }}
            >
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
                  친구 상태: {routine.isDefault ? (routine.doneByBuddy ? '완료 ✅' : '미완료 ⏳') : '커스텀 루틴은 미연동'}
                </p>
              </div>
            </article>
          );

          if (routine.isDefault) {
            return <div key={routine.id}>{card}</div>;
          }

          return (
            <div
              key={routine.id}
              style={styles.swipeWrap}
              onTouchStart={(event) => handleRoutineTouchStart(routine.id, event)}
              onTouchEnd={handleRoutineTouchEnd}
            >
              <div style={styles.deleteActionWrap}>
                <button style={styles.deleteButton} onClick={() => removeRoutine(routine.id)}>삭제</button>
              </div>
              {card}
            </div>
          );
        })}
      </section>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    maxWidth: 680,
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
  addHeaderRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  addToggleButton: {
    background: '#1f3a2d',
    color: '#7cffb2',
    border: '1px solid #2e664d',
    borderRadius: 999,
    padding: '6px 12px',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
  },
  addRow: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  input: {
    flex: 1,
    minWidth: 180,
    background: '#111315',
    color: '#f5f7fa',
    border: '1px solid #2b3138',
    borderRadius: 8,
    padding: '8px 10px',
  },
  inputTime: {
    background: '#111315',
    color: '#f5f7fa',
    border: '1px solid #2b3138',
    borderRadius: 8,
    padding: '8px 10px',
  },
  addButton: {
    background: '#1f3a2d',
    color: '#7cffb2',
    border: '1px solid #2e664d',
    borderRadius: 8,
    padding: '8px 12px',
    cursor: 'pointer',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  swipeWrap: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 14,
  },
  deleteActionWrap: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 88,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#2b1d21',
    border: '1px solid #4a2f35',
    borderRadius: 14,
  },
  item: {
    position: 'relative',
    zIndex: 1,
    display: 'flex',
    gap: 12,
    alignItems: 'center',
    background: '#1b1f23',
    border: '1px solid #2b3138',
    borderRadius: 14,
    padding: 12,
    transition: 'all 0.2s ease',
  },
  itemSwiped: {
    transform: 'translateX(-88px)',
  },
  itemActive: {
    border: '1px solid #2e664d',
    boxShadow: '0 0 0 1px rgba(124,255,178,0.15) inset',
    opacity: 1,
  },
  itemInactive: {
    border: '1px solid #252a31',
    opacity: 0.62,
    filter: 'grayscale(0.2)',
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
  deleteButton: {
    border: '1px solid #4a2f35',
    background: '#2b1d21',
    color: '#ff9ba8',
    borderRadius: 8,
    padding: '6px 10px',
    cursor: 'pointer',
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
