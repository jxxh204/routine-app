"use client";

import {
  type ChangeEvent,
  type TouchEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Button, Card, Progress } from 'antd';

import {
  addOneHourHHMM,
  formatKoreanTime,
  formatTimeRangeLabel,
  getNowMinute,
  isInTimeWindow,
  minuteToHHMM,
} from '@/lib/routine-time';
import { readProofImage, saveProofImage } from '@/lib/proof-image-store';
import { uploadProofImage, getProofImageUrl } from '@/lib/proof-image-upload';
import { supabase } from '@/lib/supabase';
import { AUTH_ENTRY_FEEDBACK_KEY } from '@/lib/auth-entry-feedback';
import { PageShell } from '@/components/ui';
import { FriendStatusSection } from '@/components/friend-status-section';

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
  proofImagePath?: string;
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
    `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/challenge_logs?select=routine_key,done_at,proof_image_path&user_id=eq.${auth.userId}&challenge_date=eq.${today}`,
    { headers: auth.headers },
  );

  if (!myResponse.ok) return null;

  const myRows = (await myResponse.json()) as Array<{
    routine_key: string;
    done_at: string | null;
    proof_image_path: string | null;
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
      proofImagePath: myRow?.proof_image_path ?? undefined,
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

  // ✅ Use ref to access latest routines without re-creating callback
  const routinesRef = useRef(routines);
  useEffect(() => { routinesRef.current = routines; }, [routines]);

  const refreshFromSupabase = useCallback(async () => {
    const synced = await syncTodayFromSupabase(routinesRef.current);

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
          .map(async (routine) => {
            // Try local IndexedDB first
            const local = await readProofImage(dateKey, routine.id).catch(() => null);
            if (local) return { id: routine.id, image: local };

            // Fall back to server signed URL if we have a storage path
            if (routine.proofImagePath) {
              const serverUrl = await getProofImageUrl(routine.proofImagePath).catch(() => null);
              if (serverUrl) return { id: routine.id, image: serverUrl };
            }

            return { id: routine.id, image: null };
          }),
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
  // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once on mount; routines read via closure at mount time
  }, []);

  // ✅ Cleanup on unmount — combined into single ref cleanup
  // thumbLongPressTimerRef is cleaned up by cancelThumbLongPress handlers;
  // unmount cleanup kept inline for safety
  useEffect(() => () => {
    if (thumbLongPressTimerRef.current) window.clearTimeout(thumbLongPressTimerRef.current);
  }, []);

  // ✅ Derived values: calculated during rendering (no state/effect needed)
  const doneCount = routines.filter((routine) => routine.doneByMe).length;
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
      // Upload to storage even for custom routines (best-effort)
      void uploadProofImage(dateKey, target.id, imageDataUrl).catch(() => {});
      setSyncMessage('사진 인증 저장 완료');
      return;
    }

    try {
      const ok = await saveCertificationToSupabase(target.id, now.toISOString());

      // Upload proof image to Supabase Storage (after challenge_log exists)
      if (ok) {
        void uploadProofImage(dateKey, target.id, imageDataUrl).catch(() => {});
      }

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

  // ✅ Stable within session — memoized to avoid locale formatting on every render
  const today = useMemo(() => new Date().toLocaleDateString('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  }), []);

  return (
    <PageShell>
      <section className="grid gap-ds-section-gap">
        {/* Header */}
        <div className="flex justify-between items-baseline">
          <h1 className="m-0 text-[22px] font-semibold tracking-tight text-ds-text">
            {today}
          </h1>
          <p className="m-0 text-[13px] text-ds-text-muted font-normal">
            {doneCount}/{routines.length} 완료
          </p>
        </div>

        {/* Welcome Feedback */}
        {showWelcomeFeedback ? (
          <Card variant="borderless" styles={{ body: { padding: 'var(--ds-space-card-y) var(--ds-space-card-x)', background: 'var(--ds-color-accent-soft)' } }}>
            <strong className="block text-ds-accent-strong text-[13px] font-medium">
              로그인 완료! 오늘 해야 할 루틴부터 시작하세요.
            </strong>
            <p className="mt-ds-tight mb-0 text-ds-text-muted text-[12px]">
              지금 가능한 루틴을 상단에서 바로 인증할 수 있어요.
            </p>
          </Card>
        ) : null}

        {/* Progress Bar */}
        <Progress
          percent={progress}
          strokeColor="var(--ds-color-accent)"
          showInfo={false}
          strokeLinecap="round"
          size="small"
          className="mb-0"
          styles={{
            rail: { background: 'var(--ds-color-surface-strong)' }
          }}
        />

        {/* Routine List */}
        <section className="grid gap-ds-inline">
          <div className="flex flex-col gap-ds-card-gap">
            {orderedRoutines.map((routine) => {
              const inWindow = isInTimeWindow(nowMinute, routine.startMinute, routine.endMinute);
              const isEditing = editingRoutineId === routine.id;
              const canCertify = inWindow && !routine.doneByMe && !isEditing;

              const card = (
                <article
                  className={`
                    routine-card-surface relative z-[1] w-full flex flex-col gap-ds-inline
                    border-0 rounded-ds-lg pad-card box-border
                    transition-all duration-300 ease-[var(--ds-ease)]
                    ${inWindow 
                      ? 'bg-ds-blue-soft border-l-[3px] border-l-ds-blue' 
                      : 'bg-ds-surface'
                    }
                    ${canCertify ? 'cursor-pointer' : ''}
                  `}
                  style={{
                    transform: swipedRoutineId === routine.id ? 'translateX(-130px)' : 'translateX(0)',
                    transition: 'transform 0.3s var(--ds-ease)',
                  }}
                  onClick={canCertify ? () => void openCameraForRoutine(routine.id) : undefined}
                >
                  <div className="w-full flex justify-between items-center gap-2">
                    <p className="m-0 text-[14px] font-medium text-ds-text">
                      {routine.title}
                    </p>
                    <span
                      className={`
                        inline-flex items-center justify-center h-[22px] rounded-ds-pill
                        border-0 px-2 text-[11px] font-medium
                        ${canCertify 
                          ? 'bg-ds-blue-soft text-ds-blue'
                          : routine.doneByMe
                            ? 'bg-ds-green-soft text-ds-green'
                            : 'bg-ds-gray-soft text-ds-gray'
                        }
                      `}
                    >
                      {routine.doneByMe ? '완료' : canCertify ? '지금 인증' : '대기'}
                    </span>
                  </div>

                  <div className="w-full">
                    {isEditing ? (
                      <div className="grid gap-2" onClick={(event) => event.stopPropagation()}>
                        <input
                          className="routine-title-input w-full h-10 bg-ds-bg text-ds-text
                            border border-ds-border-strong rounded-ds-sm px-3 text-[14px]
                            leading-10 box-border transition-[border-color] duration-300"
                          value={newTitle}
                          onChange={(e) => {
                            setFormError('');
                            setNewTitle(e.target.value);
                          }}
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <div className="flex items-center gap-ds-inline min-w-0">
                            <span className={`text-ds-text-faint text-[11px] whitespace-nowrap flex-shrink-0 font-medium ${isCompactLayout ? '!text-[10px]' : ''}`}>
                              시작
                            </span>
                            <input
                              className={`w-full bg-ds-bg text-ds-text border border-ds-border-strong rounded-ds-sm px-[10px] py-[7px] text-[14px] box-border min-w-0 ${isCompactLayout ? '!px-2 !py-[5px] !text-[13px]' : ''}`}
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
                          <div className="flex items-center gap-ds-inline min-w-0">
                            <span className={`text-ds-text-faint text-[11px] whitespace-nowrap flex-shrink-0 font-medium ${isCompactLayout ? '!text-[10px]' : ''}`}>
                              종료
                            </span>
                            <input
                              className={`w-full bg-ds-bg text-ds-text border border-ds-border-strong rounded-ds-sm px-[10px] py-[7px] text-[14px] box-border min-w-0 ${isCompactLayout ? '!px-2 !py-[5px] !text-[13px]' : ''}`}
                              type="time"
                              value={newEnd}
                              onChange={(e) => {
                                setFormError('');
                                setNewEnd(e.target.value);
                              }}
                            />
                          </div>
                        </div>
                        {formError ? (
                          <p className="m-0 text-ds-pink text-[12px]">{formError}</p>
                        ) : null}
                        <div className="grid grid-cols-2 gap-2 mt-[10px]">
                          <Button onClick={cancelInlineEdit} className="w-full">
                            취소
                          </Button>
                          <Button type="primary" onClick={submitRoutineForm} className="w-full">
                            저장
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="mt-ds-tight mb-0 text-[12px] text-ds-text-faint">
                          인증 시간: {routine.timeRangeLabel}
                        </p>
                        {routine.proofImage ? (
                          <div
                            className="mt-[6px] w-14 h-14 rounded-ds-sm overflow-hidden relative"
                            style={{ WebkitTouchCallout: 'none', userSelect: 'none' }}
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
                            {/* eslint-disable-next-line @next/next/no-img-element -- base64 proof image, next/image incompatible */}
                            <img
                              src={routine.proofImage}
                              alt={`${routine.title} 인증 사진`}
                              className="w-full h-full object-cover pointer-events-none"
                            />
                            {thumbMenuRoutineId === routine.id ? (
                              <div className="absolute inset-0 bg-[var(--ds-color-overlay-thumb)] flex flex-col justify-center gap-1 p-1">
                                <Button
                                  type="primary"
                                  size="small"
                                  onClick={() => retakeRoutinePhoto(routine.id)}
                                  className="!text-[10px] !h-auto !py-[3px] !px-[6px]"
                                >
                                  다시찍기
                                </Button>
                                <Button
                                  size="small"
                                  onClick={() => setThumbMenuRoutineId(null)}
                                  className="!text-[10px] !h-auto !py-[3px] !px-[6px]"
                                >
                                  닫기
                                </Button>
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
                  className="routine-card-surface relative overflow-hidden rounded-ds-lg touch-pan-y"
                  onTouchStart={(event) => handleRoutineTouchStart(routine.id, event)}
                  onTouchEnd={handleRoutineTouchEnd}
                >
                  <div
                    className="routine-card-surface absolute right-0 top-0 bottom-0 w-[130px] flex items-center justify-center gap-ds-inline bg-ds-surface-strong rounded-ds-lg z-0"
                    style={{ visibility: swipedRoutineId === routine.id ? 'visible' : 'hidden' }}
                  >
                    <Button
                      onClick={() => startEditRoutine(routine.id)}
                      className="!border-0 !bg-ds-accent-soft !text-ds-accent !text-[12px] !font-medium"
                    >
                      수정
                    </Button>
                    {!routine.isDefault ? (
                      <Button
                        onClick={() => removeRoutine(routine.id)}
                        className="!border-0 !bg-ds-pink-soft !text-ds-pink !text-[12px] !font-medium"
                      >
                        삭제
                      </Button>
                    ) : null}
                  </div>
                  {card}
                </div>
              );
            })}
          </div>
        </section>

        {/* Add Routine Section */}
        <Card variant="borderless" styles={{ body: { padding: 'var(--ds-space-card-y) var(--ds-space-card-x)' } }}>
          <div className="flex justify-between items-center">
            <div>
              <p className="m-0 text-[11px] text-ds-text-faint font-medium">
                루틴 추가
              </p>
              <p className="m-0 text-[12px] text-ds-text-muted">
                새로운 루틴을 추가하세요.
              </p>
            </div>
            <Button
              className={`!border-0 !rounded-ds-pill !px-3 !py-[5px] !text-[12px] !font-medium !h-auto ${
                isAddFormOpen
                  ? '!bg-ds-surface-strong !text-ds-text-muted'
                  : '!bg-ds-accent-soft !text-ds-accent'
              }`}
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
            </Button>
          </div>

          {isAddFormOpen ? (
            <div className="flex flex-col gap-2 mt-2">
                <input
                  className="routine-title-input w-full h-10 bg-ds-bg text-ds-text
                    border border-ds-border-strong rounded-ds-sm px-3 text-[14px]
                    leading-10 box-border transition-[border-color] duration-300"
                  placeholder="예: 독서 인증"
                  value={newTitle}
                  onChange={(e) => {
                    setFormError('');
                    setNewTitle(e.target.value);
                  }}
                />
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-ds-inline min-w-0">
                    <span className={`text-ds-text-faint text-[11px] whitespace-nowrap flex-shrink-0 font-medium ${isCompactLayout ? '!text-[10px]' : ''}`}>
                      시작
                    </span>
                    <input
                      className={`w-full bg-ds-bg text-ds-text border border-ds-border-strong rounded-ds-sm px-[10px] py-[7px] text-[14px] box-border min-w-0 ${isCompactLayout ? '!px-2 !py-[5px] !text-[13px]' : ''}`}
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
                  <div className="flex items-center gap-ds-inline min-w-0">
                    <span className={`text-ds-text-faint text-[11px] whitespace-nowrap flex-shrink-0 font-medium ${isCompactLayout ? '!text-[10px]' : ''}`}>
                      종료
                    </span>
                    <input
                      className={`w-full bg-ds-bg text-ds-text border border-ds-border-strong rounded-ds-sm px-[10px] py-[7px] text-[14px] box-border min-w-0 ${isCompactLayout ? '!px-2 !py-[5px] !text-[13px]' : ''}`}
                      type="time"
                      value={newEnd}
                      onChange={(e) => {
                        setFormError('');
                        setNewEnd(e.target.value);
                      }}
                    />
                  </div>
                </div>
                {formError ? (
                  <p className="m-0 text-ds-pink text-[12px]">{formError}</p>
                ) : null}
                <div className="flex flex-col gap-ds-inline">
                  <Button
                    type="primary"
                    onClick={submitRoutineForm}
                    className="w-full !text-[13px] !font-medium"
                  >
                    추가
                  </Button>
                  <Button
                    onClick={() => {
                      setFormError('');
                      setNewTitle('');
                      setNewStart('09:00');
                      setNewEnd('10:00');
                      setIsAddFormOpen(false);
                    }}
                    className="w-full !bg-ds-surface-strong !text-ds-text-muted !border-0 !text-[13px]"
                  >
                    취소
                  </Button>
                </div>
              </div>
            ) : null}
        </Card>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={(event) => void onPickPhotoFile(event)}
      />

      {previewImage ? (
        <section
          className="fixed inset-0 bg-[var(--ds-color-overlay-heavy)] flex items-center justify-center p-4 z-30 backdrop-blur-[12px]"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="w-full max-w-[420px] rounded-ds-lg bg-ds-surface p-[10px]"
            onClick={(event) => event.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- base64 proof image, next/image incompatible */}
            <img
              src={previewImage}
              alt="인증 사진 확대"
              className="w-full max-h-[70vh] rounded-ds-md object-contain bg-[var(--ds-color-image-bg)]"
            />
            <Button
              onClick={() => setPreviewImage(null)}
              className="mt-2 w-full !border-0 !bg-ds-surface-strong !text-ds-text-muted !font-medium"
            >
              닫기
            </Button>
          </div>
        </section>
      ) : null}

      <style>{`
        .routine-title-input::placeholder { color: var(--ds-color-placeholder); }
        .routine-card-surface,
        .routine-card-surface * {
          -webkit-user-select: none;
          user-select: none;
          -webkit-touch-callout: none;
        }
      `}</style>

      {/* 친구 현황 섹션 */}
      <FriendStatusSection
        routineKeys={routines.filter((r) => r.isDefault).map((r) => r.id)}
        myDoneRoutineKeys={routines.filter((r) => r.isDefault && r.doneByMe).map((r) => r.id)}
      />
      </section>
    </PageShell>
  );
}
