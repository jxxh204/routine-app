"use client";

import {
  type CSSProperties,
  type ChangeEvent,
  type TouchEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  addOneHourHHMM,
  formatKoreanTime,
  formatTimeRangeLabel,
  getNowMinute,
  isInTimeWindow,
  minuteToHHMM,
} from '@/lib/routine-time';
import { readProofImage, saveProofImage } from '@/lib/proof-image-store';
import { supabase } from '@/lib/supabase';
import { AUTH_ENTRY_FEEDBACK_KEY } from '@/lib/auth-entry-feedback';
import { AppCard, GhostButton, PageShell, PrimaryButton, SectionHeader } from '@/components/ui';

const STORAGE_PREFIX = 'routine-challenge-v1';
const buddyUserId = process.env.NEXT_PUBLIC_BUDDY_USER_ID;
const CUSTOM_ROUTINES_KEY = `${STORAGE_PREFIX}:custom-routines`;
const DEFAULT_ROUTINES_KEY = `${STORAGE_PREFIX}:default-routines`;

type Routine = {
  id: string;
  title: string;
  timeRangeLabel: string;
  startMinute: number;
  endMinute: number;
  doneByMe: boolean;
  doneByBuddy: boolean;
  doneAt?: string;
  proofImage?: string;
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

function readDefaultRoutines(): Routine[] {
  if (typeof window === 'undefined') return defaultRoutines;

  try {
    const raw = window.localStorage.getItem(DEFAULT_ROUTINES_KEY);
    if (!raw) return defaultRoutines;

    const defs = JSON.parse(raw) as StoredRoutineDefinition[];

    return defaultRoutines.map((routine) => {
      const found = defs.find((item) => item.id === routine.id);
      if (!found) return routine;

      return {
        ...routine,
        title: found.title,
        startMinute: found.startMinute,
        endMinute: found.endMinute,
        timeRangeLabel: formatTimeRangeLabel(found.startMinute, found.endMinute),
      };
    });
  } catch {
    return defaultRoutines;
  }
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

  try {
    window.localStorage.setItem(CUSTOM_ROUTINES_KEY, JSON.stringify(customs));
  } catch {
    // ignore localStorage quota overflow
  }
}

function saveDefaultRoutines(routines: Routine[]) {
  const defaults = routines
    .filter((routine) => routine.isDefault)
    .map((routine) => ({
      id: routine.id,
      title: routine.title,
      startMinute: routine.startMinute,
      endMinute: routine.endMinute,
    }));

  try {
    window.localStorage.setItem(DEFAULT_ROUTINES_KEY, JSON.stringify(defaults));
  } catch {
    // ignore localStorage quota overflow
  }
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
  const base = [...readDefaultRoutines(), ...readCustomRoutines()];

  if (typeof window === 'undefined') {
    return base;
  }

  try {
    const raw = window.localStorage.getItem(getTodayStorageKey());
    if (!raw) return base;

    const saved = JSON.parse(raw) as Array<Pick<Routine, 'id' | 'doneByMe' | 'doneAt'> & { proofImage?: string }>;
    return base.map((routine) => {
      const match = saved.find((item) => item.id === routine.id);
      if (!match) return routine;
      return {
        ...routine,
        doneByMe: Boolean(match.doneByMe),
        doneAt: match.doneAt,
        proofImage: match.proofImage,
      };
    });
  } catch {
    return base;
  }
}

export function TodayView() {
  const [routines, setRoutines] = useState(getInitialRoutines);
  const [nowMinute, setNowMinute] = useState(getNowMinute());
  const [, setSyncMessage] = useState('로컬 저장 모드');
  const [newTitle, setNewTitle] = useState('');
  const [newStart, setNewStart] = useState('09:00');
  const [newEnd, setNewEnd] = useState('10:00');
  const [formError, setFormError] = useState('');
  const [isAddFormOpen, setIsAddFormOpen] = useState(false);
  const [editingRoutineId, setEditingRoutineId] = useState<string | null>(null);
  const [swipedRoutineId, setSwipedRoutineId] = useState<string | null>(null);
  const [pendingCaptureRoutineId, setPendingCaptureRoutineId] = useState<string | null>(null);
  const [thumbMenuRoutineId, setThumbMenuRoutineId] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [showWelcomeFeedback, setShowWelcomeFeedback] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.sessionStorage.getItem(AUTH_ENTRY_FEEDBACK_KEY) === '1';
  });
  const [isCompactLayout, setIsCompactLayout] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const thumbLongPressTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const todayKey = getTodayStorageKey();

    const snapshot = routines.map(({ id, title, doneByMe, doneAt, proofImage }) => ({
      id,
      title,
      doneByMe,
      doneAt,
      proofImage,
    }));

    let preservedDeletedDone: Array<{
      id: string;
      title?: string;
      doneByMe: boolean;
      doneAt?: string;
      proofImage?: string;
    }> = [];

    try {
      const raw = window.localStorage.getItem(todayKey);
      if (raw) {
        const prev = JSON.parse(raw) as Array<{
          id: string;
          title?: string;
          doneByMe: boolean;
          doneAt?: string;
          proofImage?: string;
        }>;

        const liveIds = new Set(snapshot.map((item) => item.id));
        preservedDeletedDone = prev.filter((item) => item.doneByMe && !liveIds.has(item.id));
      }
    } catch {
      preservedDeletedDone = [];
    }

    const merged = [...snapshot, ...preservedDeletedDone];

    try {
      window.localStorage.setItem(todayKey, JSON.stringify(merged));
    } catch {
      // ignore localStorage quota overflow
    }

    saveCustomRoutines(routines);
    saveDefaultRoutines(routines);
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

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const update = () => {
      setIsCompactLayout(window.innerWidth < 940);
    };

    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !showWelcomeFeedback) return;

    window.sessionStorage.removeItem(AUTH_ENTRY_FEEDBACK_KEY);

    const timer = window.setTimeout(() => {
      setShowWelcomeFeedback(false);
    }, 2400);

    return () => window.clearTimeout(timer);
  }, [showWelcomeFeedback]);

  useEffect(() => {
    const dateKey = getTodayDateKey();

    const hydrateProofImages = async () => {
      const imagePairs = await Promise.all(
        routines
          .filter((routine) => routine.doneByMe)
          .map(async (routine) => ({
            id: routine.id,
            image: await readProofImage(dateKey, routine.id).catch(() => null),
          })),
      );

      const imageMap = new Map(imagePairs.filter((item) => item.image).map((item) => [item.id, item.image as string]));
      if (imageMap.size === 0) return;

      setRoutines((prev) =>
        prev.map((routine) => {
          const image = imageMap.get(routine.id);
          if (!image || routine.proofImage === image) return routine;
          return { ...routine, proofImage: image };
        }),
      );
    };

    void hydrateProofImages();
  }, []);

  useEffect(() => {
    return () => {
      if (thumbLongPressTimerRef.current) {
        window.clearTimeout(thumbLongPressTimerRef.current);
      }
    };
  }, []);

  const doneCount = useMemo(
    () => routines.filter((routine) => routine.doneByMe).length,
    [routines],
  );

  const progress = routines.length > 0 ? Math.round((doneCount / routines.length) * 100) : 0;

  const orderedRoutines = useMemo(() => {
    return [...routines].sort((a, b) => {
      const aInWindow = isInTimeWindow(nowMinute, a.startMinute, a.endMinute);
      const bInWindow = isInTimeWindow(nowMinute, b.startMinute, b.endMinute);

      const aRank = a.doneByMe ? 2 : aInWindow ? 0 : 1;
      const bRank = b.doneByMe ? 2 : bInWindow ? 0 : 1;

      if (aRank !== bRank) return aRank - bRank;
      if (a.startMinute !== b.startMinute) return a.startMinute - b.startMinute;
      return a.title.localeCompare(b.title);
    });
  }, [routines, nowMinute]);

  const availableNowRoutines = useMemo(
    () => orderedRoutines.filter((routine) => !routine.doneByMe && isInTimeWindow(nowMinute, routine.startMinute, routine.endMinute)),
    [orderedRoutines, nowMinute],
  );

  const nextAvailableRoutine = availableNowRoutines[0] ?? null;

  const finalizePhotoCertification = async (routineId: string, imageDataUrl: string) => {
    const now = new Date();
    const doneAtText = formatKoreanTime(now);
    const dateKey = getTodayDateKey();
    const target = routines.find((routine) => routine.id === routineId);

    await saveProofImage(dateKey, routineId, imageDataUrl).catch(() => {
      // indexedDB unavailable: continue with in-memory/local snapshot only
    });

    setRoutines((prev) =>
      prev.map((routine) =>
        routine.id === routineId
          ? {
              ...routine,
              doneByMe: true,
              doneAt: doneAtText,
              proofImage: imageDataUrl,
            }
          : routine,
      ),
    );

    setPendingCaptureRoutineId(null);

    if (!target) {
      setSyncMessage('로컬 저장 완료');
      return;
    }

    if (!target.isDefault) {
      setSyncMessage('사진 인증 저장 완료');
      return;
    }

    try {
      const ok = await saveCertificationToSupabase(target.id, now.toISOString());
      setSyncMessage(ok ? '사진 인증 + Supabase 저장 완료' : '사진 인증 로컬 저장 완료 (Supabase 미연동)');

      if (ok) {
        void refreshFromSupabase();
      }
    } catch {
      setSyncMessage('사진 인증 로컬 저장 완료 (Supabase 저장 중 오류)');
    }
  };

  const openCameraForRoutine = (id: string) => {
    const target = routines.find((routine) => routine.id === id);
    if (!target) return;

    const inWindow = isInTimeWindow(nowMinute, target.startMinute, target.endMinute);
    if (!inWindow || target.doneByMe) return;

    setPendingCaptureRoutineId(id);
    fileInputRef.current?.click();
  };

  const retakeRoutinePhoto = (id: string) => {
    setThumbMenuRoutineId(null);
    setPendingCaptureRoutineId(id);
    fileInputRef.current?.click();
  };

  const startThumbLongPress = (id: string) => {
    if (thumbLongPressTimerRef.current) {
      window.clearTimeout(thumbLongPressTimerRef.current);
    }

    thumbLongPressTimerRef.current = window.setTimeout(() => {
      setThumbMenuRoutineId(id);
    }, 420);
  };

  const cancelThumbLongPress = () => {
    if (thumbLongPressTimerRef.current) {
      window.clearTimeout(thumbLongPressTimerRef.current);
      thumbLongPressTimerRef.current = null;
    }
  };

  const onPickPhotoFile = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!pendingCaptureRoutineId) return;

    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (!result) return;
      await finalizePhotoCertification(pendingCaptureRoutineId, result);
    };
    reader.readAsDataURL(file);

    event.target.value = '';
  };

  const submitRoutineForm = () => {
    const title = newTitle.trim();
    if (!title) {
      setFormError('루틴 이름을 입력해 주세요.');
      return;
    }

    const [startH, startM] = newStart.split(':').map(Number);
    const [endH, endM] = newEnd.split(':').map(Number);

    if ([startH, startM, endH, endM].some((value) => Number.isNaN(value))) {
      setFormError('시작/종료 시간을 다시 확인해 주세요.');
      return;
    }

    const startMinute = startH * 60 + startM;
    const endMinute = endH * 60 + endM;

    if (startMinute === endMinute) {
      setFormError('시작/종료 시간은 다르게 설정해 주세요.');
      return;
    }

    const duplicated = routines.some(
      (routine) => routine.title.trim() === title && routine.id !== editingRoutineId,
    );

    if (duplicated) {
      setFormError('같은 이름의 루틴이 이미 있어요.');
      return;
    }

    setFormError('');

    if (editingRoutineId) {
      setRoutines((prev) =>
        prev.map((routine) =>
          routine.id === editingRoutineId
            ? {
                ...routine,
                title,
                startMinute,
                endMinute,
                timeRangeLabel: formatTimeRangeLabel(startMinute, endMinute),
              }
            : routine,
        ),
      );
      setEditingRoutineId(null);
      setSwipedRoutineId(null);
    } else {
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
    }

    setNewTitle('');
    setNewStart('09:00');
    setNewEnd('10:00');
    setIsAddFormOpen(false);
  };

  const startEditRoutine = (id: string) => {
    const target = routines.find((routine) => routine.id === id);
    if (!target) return;

    setEditingRoutineId(id);
    setIsAddFormOpen(false);
    setFormError('');
    setNewTitle(target.title);
    setNewStart(minuteToHHMM(target.startMinute));
    setNewEnd(minuteToHHMM(target.endMinute));
    setSwipedRoutineId(null);
  };

  const cancelInlineEdit = () => {
    setEditingRoutineId(null);
    setFormError('');
    setNewTitle('');
    setNewStart('09:00');
    setNewEnd('10:00');
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
    event.currentTarget.dataset.startY = String(event.touches[0]?.clientY ?? 0);
    event.currentTarget.dataset.routineId = id;
  };

  const handleRoutineTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const startX = Number(event.currentTarget.dataset.startX ?? 0);
    const startY = Number(event.currentTarget.dataset.startY ?? 0);
    const endX = event.changedTouches[0]?.clientX ?? startX;
    const endY = event.changedTouches[0]?.clientY ?? startY;

    const deltaX = startX - endX;
    const deltaY = startY - endY;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);
    const id = event.currentTarget.dataset.routineId;

    if (!id) return;

    const isHorizontalSwipe = absX > 48 && absX > absY * 1.4;
    if (!isHorizontalSwipe) return;

    if (deltaX > 0) {
      setSwipedRoutineId(id);
      return;
    }

    setSwipedRoutineId(null);
  };

  const today = new Date().toLocaleDateString('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  });

  return (
    <PageShell>
      <section style={styles.pageSection}>
        <SectionHeader eyebrow="Today" title="루틴 실행 대시보드" description={today} />

        {showWelcomeFeedback ? (
          <AppCard>
            <section style={styles.welcomeCard}>
              <strong style={styles.welcomeTitle}>로그인 완료! 오늘 해야 할 루틴부터 시작하세요.</strong>
              <p style={styles.welcomeDesc}>지금 가능한 루틴을 상단에서 바로 인증할 수 있어요.</p>
            </section>
          </AppCard>
        ) : null}

        <section style={{ ...styles.kpiGrid, ...(isCompactLayout ? styles.kpiGridCompact : {}) }}>
          <section style={styles.progressCard}>
            <p style={styles.sectionLabel}>프로그레스 {doneCount}/{routines.length}</p>
            <div style={styles.progressTrack}>
              <div style={{ ...styles.progressFill, width: `${progress}%` }} />
            </div>
          </section>
        </section>

        {nextAvailableRoutine ? (
          <section style={styles.quickActionCard}>
            <p style={styles.quickActionTitle}>지금 인증 가능한 루틴 {availableNowRoutines.length}개</p>
            <p style={styles.quickActionDesc}>{nextAvailableRoutine.title}부터 바로 인증하세요.</p>
            <PrimaryButton style={styles.quickActionButton} onClick={() => void openCameraForRoutine(nextAvailableRoutine.id)}>
              지금 인증하기
            </PrimaryButton>
          </section>
        ) : null}

        <section style={styles.boardSection}>
          <div style={{ ...styles.boardHeader, ...(isCompactLayout ? styles.boardHeaderCompact : {}) }}>
            <h2 style={styles.boardTitle}>오늘 할 일</h2>
            <p style={styles.boardMeta}>
              {availableNowRoutines.length > 0 ? `지금 인증 가능 ${availableNowRoutines.length}개` : '지금 가능한 루틴부터 위에서 처리'}
            </p>
          </div>

          <section style={styles.list}>
            {orderedRoutines.map((routine) => {
              const inWindow = isInTimeWindow(nowMinute, routine.startMinute, routine.endMinute);
              const isEditing = editingRoutineId === routine.id;
              const canCertify = inWindow && !routine.doneByMe && !isEditing;

              const card = (
                <article
                  className="routine-card-surface"
                  onClick={canCertify ? () => void openCameraForRoutine(routine.id) : undefined}
                  style={{
                    ...styles.item,
                    ...(inWindow ? styles.itemActive : styles.itemInactive),
                    ...(canCertify ? styles.itemClickable : {}),
                    ...(swipedRoutineId === routine.id ? styles.itemSwiped : {}),
                  }}
                >
                  <div style={styles.itemHead}>
                    <p style={styles.itemTitle}>{routine.title}</p>
                    <span
                      style={{
                        ...styles.checkTag,
                        ...(canCertify
                          ? styles.checkTagReady
                          : routine.doneByMe
                            ? styles.checkTagDone
                            : styles.checkTagWaiting),
                      }}
                    >
                      {routine.doneByMe ? '완료' : canCertify ? '지금 인증' : '대기'}
                    </span>
                  </div>

                  <div style={styles.itemBody}>
                    {isEditing ? (
                      <div style={styles.inlineEditWrap} onClick={(event) => event.stopPropagation()}>
                        <input
                          className="routine-title-input"
                          style={styles.input}
                          value={newTitle}
                          onChange={(e) => {
                            setFormError('');
                            setNewTitle(e.target.value);
                          }}
                        />
                        <div style={styles.timeRow}>
                          <div style={styles.timeFieldWrap}>
                            <span style={{ ...styles.timeFieldLabel, ...(isCompactLayout ? styles.timeFieldLabelCompact : {}) }}>시작</span>
                            <input
                              style={{ ...styles.inputTime, ...(isCompactLayout ? styles.inputTimeCompact : {}) }}
                              type="time"
                              value={newStart}
                              onChange={(e) => {
                                const nextStart = e.target.value;
                                setFormError('');
                                setNewStart(nextStart);
                                setNewEnd(addOneHourHHMM(nextStart));
                              }}
                            />
                          </div>
                          <div style={styles.timeFieldWrap}>
                            <span style={{ ...styles.timeFieldLabel, ...(isCompactLayout ? styles.timeFieldLabelCompact : {}) }}>종료</span>
                            <input
                              style={{ ...styles.inputTime, ...(isCompactLayout ? styles.inputTimeCompact : {}) }}
                              type="time"
                              value={newEnd}
                              onChange={(e) => {
                                setFormError('');
                                setNewEnd(e.target.value);
                              }}
                            />
                          </div>
                        </div>
                        {formError ? <p style={styles.formError}>{formError}</p> : null}
                        <div style={styles.inlineEditActions}>
                          <GhostButton style={styles.inlineCancelButton} onClick={cancelInlineEdit}>취소</GhostButton>
                          <PrimaryButton style={styles.inlineSaveButton} onClick={submitRoutineForm}>저장</PrimaryButton>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p style={styles.meta}>인증 시간: {routine.timeRangeLabel}</p>
                        <p style={styles.meta}>
                          친구: {routine.isDefault ? (routine.doneByBuddy ? '완료 ✅' : '미완료 ⏳') : '커스텀 루틴(친구 미연동)'}
                        </p>
                        {routine.proofImage ? (
                          <div
                            style={styles.thumbWrap}
                            onContextMenu={(event) => event.preventDefault()}
                            onTouchStart={() => startThumbLongPress(routine.id)}
                            onTouchEnd={cancelThumbLongPress}
                            onTouchCancel={cancelThumbLongPress}
                            onMouseDown={() => startThumbLongPress(routine.id)}
                            onMouseUp={cancelThumbLongPress}
                            onMouseLeave={cancelThumbLongPress}
                            onClick={() => {
                              if (thumbMenuRoutineId === routine.id) return;
                              setPreviewImage(routine.proofImage ?? null);
                            }}
                          >
                            <img src={routine.proofImage} alt={`${routine.title} 인증 사진`} style={styles.thumbImage} />
                            {thumbMenuRoutineId === routine.id ? (
                              <div style={styles.thumbMenu}>
                                <PrimaryButton style={styles.thumbMenuButton} onClick={() => retakeRoutinePhoto(routine.id)}>다시찍기</PrimaryButton>
                                <GhostButton style={styles.thumbMenuCancel} onClick={() => setThumbMenuRoutineId(null)}>닫기</GhostButton>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </>
                    )}
                  </div>
                </article>
              );

              return (
                <div
                  key={routine.id}
                  className="routine-card-surface"
                  style={styles.swipeWrap}
                  onTouchStart={(event) => handleRoutineTouchStart(routine.id, event)}
                  onTouchEnd={handleRoutineTouchEnd}
                >
                  <div className="routine-card-surface" style={styles.actionWrap}>
                    <GhostButton style={styles.editButton} onClick={() => startEditRoutine(routine.id)}>수정</GhostButton>
                    {!routine.isDefault ? (
                      <GhostButton style={styles.deleteButton} onClick={() => removeRoutine(routine.id)}>삭제</GhostButton>
                    ) : null}
                  </div>
                  {card}
                </div>
              );
            })}
          </section>
        </section>

        <AppCard>
          <section style={{ ...styles.progressCard, ...styles.addSection }}>
            <div style={styles.addHeaderRow}>
              <div>
                <p style={styles.sectionLabel}>루틴 편집</p>
                <p style={{ ...styles.meta, margin: 0 }}>오늘 필요한 루틴을 추가/수정하세요.</p>
              </div>
              <GhostButton
                style={{ ...(isAddFormOpen ? styles.addToggleButtonNeutral : styles.addToggleButton) }}
                onClick={() => {
                  if (isAddFormOpen) {
                    setFormError('');
                    setNewTitle('');
                    setNewStart('09:00');
                    setNewEnd('10:00');
                  } else {
                    cancelInlineEdit();
                  }
                  setIsAddFormOpen((prev) => !prev);
                }}
              >
                {isAddFormOpen ? '닫기' : '+ 추가'}
              </GhostButton>
            </div>

            {isAddFormOpen ? (
              <div style={styles.addRow}>
                <input
                  className="routine-title-input"
                  style={styles.input}
                  placeholder="예: 독서 인증"
                  value={newTitle}
                  onChange={(e) => {
                    setFormError('');
                    setNewTitle(e.target.value);
                  }}
                />
                <div style={styles.timeRow}>
                  <div style={styles.timeFieldWrap}>
                    <span style={{ ...styles.timeFieldLabel, ...(isCompactLayout ? styles.timeFieldLabelCompact : {}) }}>시작</span>
                    <input
                      style={{ ...styles.inputTime, ...(isCompactLayout ? styles.inputTimeCompact : {}) }}
                      type="time"
                      value={newStart}
                      onChange={(e) => {
                        const nextStart = e.target.value;
                        setFormError('');
                        setNewStart(nextStart);
                        setNewEnd(addOneHourHHMM(nextStart));
                      }}
                    />
                  </div>
                  <div style={styles.timeFieldWrap}>
                    <span style={{ ...styles.timeFieldLabel, ...(isCompactLayout ? styles.timeFieldLabelCompact : {}) }}>종료</span>
                    <input
                      style={{ ...styles.inputTime, ...(isCompactLayout ? styles.inputTimeCompact : {}) }}
                      type="time"
                      value={newEnd}
                      onChange={(e) => {
                        setFormError('');
                        setNewEnd(e.target.value);
                      }}
                    />
                  </div>
                </div>
                {formError ? <p style={styles.formError}>{formError}</p> : null}
                <div style={styles.addActionRow}>
                  <PrimaryButton style={styles.addButtonFull} onClick={submitRoutineForm}>
                    추가
                  </PrimaryButton>
                  <GhostButton
                    style={styles.cancelButton}
                    onClick={() => {
                      setFormError('');
                      setNewTitle('');
                      setNewStart('09:00');
                      setNewEnd('10:00');
                      setIsAddFormOpen(false);
                    }}
                  >
                    취소
                  </GhostButton>
                </div>
              </div>
            ) : null}
          </section>
        </AppCard>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={(event) => void onPickPhotoFile(event)}
      />

      {previewImage ? (
        <section style={styles.previewOverlay} onClick={() => setPreviewImage(null)}>
          <div style={styles.previewCard} onClick={(event) => event.stopPropagation()}>
            <img src={previewImage} alt="인증 사진 확대" style={styles.previewImage} />
            <GhostButton style={styles.previewCloseButton} onClick={() => setPreviewImage(null)}>닫기</GhostButton>
          </div>
        </section>
      ) : null}

      <style>{`
        .routine-title-input::placeholder { color: #2b3138; }
        .routine-card-surface,
        .routine-card-surface * {
          -webkit-user-select: none;
          user-select: none;
          -webkit-touch-callout: none;
        }
      `}</style>
      </section>
    </PageShell>
  );
}

const styles: Record<string, CSSProperties> = {
  pageSection: {
    display: 'grid',
    gap: 18,
  },
  kpiGrid: {
    display: 'grid',
    gridTemplateColumns: '1.2fr 1fr',
    gap: 12,
  },
  kpiGridCompact: {
    gridTemplateColumns: '1fr',
  },
  sectionLabel: {
    margin: '0 0 8px',
    fontSize: 12,
    color: 'var(--text-muted)',
    letterSpacing: '0.02em',
  },
  quickGuideCard: {
    display: 'grid',
    gap: 6,
    minHeight: 132,
  },
  guideList: {
    margin: 0,
    paddingLeft: 18,
    display: 'grid',
    gap: 6,
    color: 'var(--text-muted)',
    fontSize: 13,
    lineHeight: 1.45,
  },
  boardSection: {
    display: 'grid',
    gap: 10,
  },
  boardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 8,
  },
  boardHeaderCompact: {
    flexDirection: 'column',
    alignItems: 'flex-start',
  },
  boardTitle: {
    margin: 0,
    fontSize: 22,
  },
  boardMeta: {
    margin: 0,
    color: 'var(--text-muted)',
    fontSize: 12,
  },
  quickActionCard: {
    background: 'var(--surface-1)',
    border: '1px solid #2e664d',
    borderRadius: 16,
    padding: 14,
    marginTop: 2,
    boxShadow: 'var(--ds-shadow-soft)',
  },
  quickActionTitle: {
    margin: 0,
    fontSize: 14,
    fontWeight: 700,
    color: '#d8ffe8',
  },
  quickActionDesc: {
    margin: '4px 0 10px',
    fontSize: 12,
    color: 'var(--text-muted)',
  },
  quickActionButton: {
    width: '100%',
    borderRadius: 10,
    padding: '10px 12px',
  },
  progressCard: {
    background: 'var(--surface-1)',
    border: '1px solid var(--outline)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 0,
    boxShadow: 'var(--ds-shadow-soft)',
  },
  welcomeCard: {
    background: '#18222e',
    border: '1px solid #334050',
    borderRadius: 16,
    padding: 16,
    marginBottom: 0,
    boxShadow: 'var(--ds-shadow-soft)',
  },
  welcomeTitle: {
    display: 'block',
    color: '#cfe7ff',
    fontSize: 14,
  },
  welcomeDesc: {
    margin: '6px 0 0',
    color: '#9fb3c8',
    fontSize: 12,
  },
  addSection: {
    marginTop: 2,
  },
  progressTop: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: 10,
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
    background: 'linear-gradient(90deg, var(--ds-color-accent), var(--ds-color-accent-strong))',
  },
  statRow: {
    marginTop: 10,
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 8,
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
    background: 'var(--brand-soft)',
    color: 'var(--brand)',
    border: '1px solid #2e664d',
    borderRadius: 999,
    padding: '6px 12px',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 600,
  },
  addToggleButtonNeutral: {
    background: '#2a3038',
    color: '#c8d0da',
    border: '1px solid #3b4552',
  },
  addRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    marginTop: 8,
    alignItems: 'stretch',
  },
  input: {
    width: '100%',
    height: 48,
    background: 'var(--background)',
    color: '#f5f7fa',
    border: '1px solid var(--outline)',
    borderRadius: 8,
    padding: '0 12px',
    fontSize: 16,
    lineHeight: '48px',
    boxSizing: 'border-box',
  },
  timeRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 6,
    alignItems: 'center',
  },
  timeFieldWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  timeFieldLabel: {
    color: 'var(--text-muted)',
    fontSize: 12,
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  timeFieldLabelCompact: {
    fontSize: 11,
  },
  inputTime: {
    width: '100%',
    background: 'var(--background)',
    color: '#f5f7fa',
    border: '1px solid var(--outline)',
    borderRadius: 8,
    padding: '8px 10px',
    fontSize: 16,
    boxSizing: 'border-box',
    minWidth: 0,
  },
  inputTimeCompact: {
    padding: '6px 8px',
    fontSize: 14,
  },
  addActionRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  formError: {
    margin: 0,
    color: '#ffb7b2',
    fontSize: 12,
  },
  addButtonFull: {
    width: '100%',
    background: 'var(--brand-soft)',
    color: 'var(--brand)',
    border: '1px solid #2e664d',
    borderRadius: 8,
    padding: '10px 12px',
    cursor: 'pointer',
  },
  cancelButton: {
    background: '#2a3038',
    color: '#d0d8e0',
    border: '1px solid #3b4552',
    borderRadius: 8,
    padding: '8px 12px',
    cursor: 'pointer',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  swipeWrap: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 16,
    touchAction: 'pan-y',
  },
  actionWrap: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 152,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    background: '#21262d',
    border: '1px solid #303844',
    borderRadius: 16,
  },
  item: {
    position: 'relative',
    zIndex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    alignItems: 'flex-start',
    background: 'var(--surface-1)',
    border: '1px solid var(--outline)',
    borderRadius: 16,
    padding: 14,
    transition: 'all 0.2s ease',
    boxShadow: 'var(--ds-shadow-soft)',
  },
  itemSwiped: {
    transform: 'translateX(-152px)',
  },
  itemActive: {
    border: '1px solid #2e664d',
    boxShadow: '0 0 0 1px rgba(124,255,178,0.15) inset',
    opacity: 1,
  },
  itemInactive: {
    border: '1px solid #252a31',
    background: '#171b20',
    opacity: 1,
    filter: 'grayscale(0.12)',
  },
  itemClickable: {
    cursor: 'pointer',
  },
  checkTag: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 64,
    height: 26,
    borderRadius: 999,
    border: '1px solid #3c4652',
    background: '#242b33',
    color: '#e6edf3',
    padding: '0 10px',
    fontSize: 12,
    fontWeight: 600,
  },
  checkTagReady: {
    background: 'var(--brand-soft)',
    color: 'var(--brand)',
    border: '1px solid #2e664d',
    boxShadow: '0 0 0 1px rgba(124,255,178,0.2) inset',
  },
  checkTagWaiting: {
    background: '#212834',
    color: '#b3c0d0',
    border: '1px solid #314156',
    opacity: 0.9,
  },
  checkTagDone: {
    background: '#1a1f26',
    color: '#6f7b89',
    border: '1px solid #2c3440',
    opacity: 0.7,
    filter: 'grayscale(0.2)',
  },
  editButton: {
    border: '1px solid #334050',
    background: '#1f2a36',
    color: '#9ed0ff',
    borderRadius: 8,
    padding: '6px 10px',
    cursor: 'pointer',
  },
  deleteButton: {
    border: '1px solid #4a2f35',
    background: '#2b1d21',
    color: '#ff9ba8',
    borderRadius: 8,
    padding: '6px 10px',
    cursor: 'pointer',
  },
  itemHead: {
    width: '100%',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  itemBody: {
    width: '100%',
  },
  inlineEditWrap: {
    display: 'grid',
    gap: 8,
  },
  inlineEditActions: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 8,
    marginTop: 14,
  },
  inlineSaveButton: {
    width: '100%',
  },
  inlineCancelButton: {
    width: '100%',
  },
  itemTitle: {
    margin: 0,
    fontSize: 15,
    fontWeight: 600,
  },
  meta: {
    margin: '6px 0 0',
    fontSize: 13,
    color: 'var(--text-muted)',
  },
  thumbWrap: {
    marginTop: 10,
    width: 72,
    height: 72,
    borderRadius: 10,
    overflow: 'hidden',
    border: '1px solid #2f3a46',
    position: 'relative',
    WebkitTouchCallout: 'none',
    userSelect: 'none',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    pointerEvents: 'none',
  },
  thumbMenu: {
    position: 'absolute',
    inset: 0,
    background: 'rgba(8,10,14,0.8)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    gap: 6,
    padding: 6,
  },
  thumbMenuButton: {
    border: '1px solid #2e664d',
    background: 'var(--brand-soft)',
    color: 'var(--brand)',
    borderRadius: 6,
    padding: '4px 6px',
    fontSize: 11,
    cursor: 'pointer',
  },
  thumbMenuCancel: {
    border: '1px solid #3b4552',
    background: '#2a3038',
    color: '#d0d8e0',
    borderRadius: 6,
    padding: '4px 6px',
    fontSize: 11,
    cursor: 'pointer',
  },
  previewOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(8, 10, 14, 0.78)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    zIndex: 30,
  },
  previewCard: {
    width: '100%',
    maxWidth: 560,
    borderRadius: 14,
    border: '1px solid #2f3a46',
    background: '#11151a',
    padding: 10,
  },
  previewImage: {
    width: '100%',
    maxHeight: '70vh',
    borderRadius: 10,
    objectFit: 'contain',
    background: '#000',
  },
  previewCloseButton: {
    marginTop: 10,
    width: '100%',
    border: '1px solid #3b4552',
    background: '#2a3038',
    color: '#d0d8e0',
    borderRadius: 8,
    padding: '8px 12px',
    cursor: 'pointer',
  },
};
