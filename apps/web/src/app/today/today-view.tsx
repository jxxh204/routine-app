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
import { supabase } from '@/lib/supabase';

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

  window.localStorage.setItem(CUSTOM_ROUTINES_KEY, JSON.stringify(customs));
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

  window.localStorage.setItem(DEFAULT_ROUTINES_KEY, JSON.stringify(defaults));
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

    const saved = JSON.parse(raw) as Array<Pick<Routine, 'id' | 'doneByMe' | 'doneAt' | 'proofImage'>>;
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
  const [syncMessage, setSyncMessage] = useState('로컬 저장 모드');
  const [newTitle, setNewTitle] = useState('');
  const [newStart, setNewStart] = useState('09:00');
  const [newEnd, setNewEnd] = useState('10:00');
  const [isAddFormOpen, setIsAddFormOpen] = useState(false);
  const [editingRoutineId, setEditingRoutineId] = useState<string | null>(null);
  const [swipedRoutineId, setSwipedRoutineId] = useState<string | null>(null);
  const [cameraRoutineId, setCameraRoutineId] = useState<string | null>(null);
  const [cameraError, setCameraError] = useState('');
  const [isCapturing, setIsCapturing] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const snapshot = routines.map(({ id, doneByMe, doneAt, proofImage }) => ({ id, doneByMe, doneAt, proofImage }));
    window.localStorage.setItem(getTodayStorageKey(), JSON.stringify(snapshot));
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
    return () => {
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    };
  }, []);

  const doneCount = useMemo(
    () => routines.filter((routine) => routine.doneByMe).length,
    [routines],
  );

  const progress = Math.round((doneCount / routines.length) * 100);

  const closeCamera = useCallback(() => {
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
    setCameraRoutineId(null);
    setCameraError('');
  }, []);

  const finalizePhotoCertification = async (routineId: string, imageDataUrl: string) => {
    const now = new Date();
    const doneAtText = formatKoreanTime(now);
    const target = routines.find((routine) => routine.id === routineId);

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

    closeCamera();

    if (!target) {
      setSyncMessage('로컬 저장 완료');
      return;
    }

    if (!target.isDefault) {
      setSyncMessage('사진 인증 저장 완료');
      return;
    }

    const ok = await saveCertificationToSupabase(target.id, now.toISOString());
    setSyncMessage(ok ? '사진 인증 + Supabase 저장 완료' : '사진 인증 로컬 저장 완료 (Supabase 미연동)');

    if (ok) {
      void refreshFromSupabase();
    }
  };

  const openCameraForRoutine = async (id: string) => {
    const target = routines.find((routine) => routine.id === id);
    if (!target) return;

    const inWindow = isInTimeWindow(nowMinute, target.startMinute, target.endMinute);
    if (!inWindow || target.doneByMe) return;

    setCameraRoutineId(id);
    setCameraError('');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      mediaStreamRef.current = stream;

      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      }, 0);
    } catch {
      setCameraError('카메라 권한이 없거나 기기에서 지원되지 않습니다. 아래 버튼으로 사진을 선택해 인증할 수 있어요.');
    }
  };

  const captureRoutinePhoto = async () => {
    if (!cameraRoutineId || !videoRef.current || isCapturing) return;

    const video = videoRef.current;
    setIsCapturing(true);

    try {
      // iOS/WebView에서 videoWidth/videoHeight가 늦게 잡히는 경우를 대비해 짧게 대기
      for (let i = 0; i < 10 && (!video.videoWidth || !video.videoHeight); i += 1) {
        await new Promise((resolve) => setTimeout(resolve, 80));
      }

      const width = video.videoWidth;
      const height = video.videoHeight;
      if (!width || !height) {
        setCameraError('카메라 프레임을 아직 불러오지 못했습니다. 잠시 후 다시 눌러주세요.');
        return;
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) return;

      context.drawImage(video, 0, 0, width, height);
      const imageDataUrl = canvas.toDataURL('image/jpeg', 0.9);
      await finalizePhotoCertification(cameraRoutineId, imageDataUrl);
    } finally {
      setIsCapturing(false);
    }
  };

  const onPickPhotoFile = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!cameraRoutineId) return;

    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (!result) return;
      await finalizePhotoCertification(cameraRoutineId, result);
    };
    reader.readAsDataURL(file);

    event.target.value = '';
  };

  const submitRoutineForm = () => {
    const title = newTitle.trim();
    if (!title) return;

    const [startH, startM] = newStart.split(':').map(Number);
    const [endH, endM] = newEnd.split(':').map(Number);

    if ([startH, startM, endH, endM].some((value) => Number.isNaN(value))) return;

    const startMinute = startH * 60 + startM;
    const endMinute = endH * 60 + endM;

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
    setNewTitle(target.title);
    setNewStart(minuteToHHMM(target.startMinute));
    setNewEnd(minuteToHHMM(target.endMinute));
    setIsAddFormOpen(true);
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
            onClick={() => {
              if (isAddFormOpen) {
                setEditingRoutineId(null);
                setNewTitle('');
                setNewStart('09:00');
                setNewEnd('10:00');
              }
              setIsAddFormOpen((prev) => !prev);
            }}
          >
            {isAddFormOpen ? '닫기' : '+ 추가'}
          </button>
        </div>

        {isAddFormOpen ? (
          <div style={styles.addRow}>
            <input
              className="routine-title-input"
              style={styles.input}
              placeholder="예: 독서 인증"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
            />
            <div style={styles.timeRow}>
              <div style={styles.timeFieldWrap}>
                <span style={styles.timeFieldLabel}>시작시간</span>
                <input
                  style={styles.inputTime}
                  type="time"
                  value={newStart}
                  onChange={(e) => {
                    const nextStart = e.target.value;
                    setNewStart(nextStart);

                    setNewEnd(addOneHourHHMM(nextStart));
                  }}
                />
              </div>
              <div style={styles.timeFieldWrap}>
                <span style={styles.timeFieldLabel}>종료시간</span>
                <input style={styles.inputTime} type="time" value={newEnd} onChange={(e) => setNewEnd(e.target.value)} />
              </div>
            </div>
            <div style={styles.addActionRow}>
              <button style={styles.addButtonFull} onClick={submitRoutineForm}>
                {editingRoutineId ? '수정 저장' : '추가'}
              </button>
              {editingRoutineId ? (
                <button
                  style={styles.cancelButton}
                  onClick={() => {
                    setEditingRoutineId(null);
                    setNewTitle('');
                    setNewStart('09:00');
                    setNewEnd('10:00');
                    setIsAddFormOpen(false);
                  }}
                >
                  취소
                </button>
              ) : null}
            </div>
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
                ...(swipedRoutineId === routine.id ? styles.itemSwiped : {}),
              }}
            >
              <button
                onClick={() => void openCameraForRoutine(routine.id)}
                disabled={!canCertify}
                style={{
                  ...styles.checkButton,
                  ...(canCertify
                    ? styles.checkButtonReady
                    : routine.doneByMe
                      ? styles.checkButtonDone
                      : styles.checkButtonWaiting),
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
                {routine.proofImage ? (
                  <div style={styles.thumbWrap}>
                    <img src={routine.proofImage} alt={`${routine.title} 인증 사진`} style={styles.thumbImage} />
                  </div>
                ) : null}
              </div>
            </article>
          );

          return (
            <div
              key={routine.id}
              style={styles.swipeWrap}
              onTouchStart={(event) => handleRoutineTouchStart(routine.id, event)}
              onTouchEnd={handleRoutineTouchEnd}
            >
              <div style={styles.actionWrap}>
                <button style={styles.editButton} onClick={() => startEditRoutine(routine.id)}>수정</button>
                {!routine.isDefault ? (
                  <button style={styles.deleteButton} onClick={() => removeRoutine(routine.id)}>삭제</button>
                ) : null}
              </div>
              {card}
            </div>
          );
        })}
      </section>

      {cameraRoutineId ? (
        <section style={styles.cameraOverlay}>
          <div style={styles.cameraPage}>
            <div style={styles.cameraTopRow}>
              <button style={styles.cameraTopBtn} type="button">⚡</button>
              <button style={styles.cameraTopBtn} type="button">1×</button>
            </div>

            <video ref={videoRef} autoPlay playsInline muted style={styles.cameraPreview} />

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: 'none' }}
              onChange={(event) => void onPickPhotoFile(event)}
            />

            <div style={styles.cameraBottomRow}>
              <button style={styles.cameraSideIcon} type="button" onClick={() => fileInputRef.current?.click()}>🖼️</button>
              <button
                style={{
                  ...styles.cameraShutter,
                  ...(isCapturing ? styles.cameraShutterBusy : {}),
                }}
                type="button"
                onClick={() => void captureRoutinePhoto()}
                disabled={isCapturing}
                aria-label="촬영 후 저장"
              >
                <span style={styles.cameraShutterInner} />
              </button>
              <button style={styles.cameraSideIcon} type="button" onClick={closeCamera}>↻</button>
            </div>

            {cameraError ? <p style={styles.cameraError}>{cameraError}</p> : null}

            <div style={styles.cameraDock}>
              <span style={styles.cameraDockIcon}>◻︎</span>
              <span style={styles.cameraDockHome}>⌂</span>
              <span style={styles.cameraDockIcon}>◯</span>
            </div>
          </div>
        </section>
      ) : null}
      <style>{`.routine-title-input::placeholder { color: #2b3138; }`}</style>
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
    flexDirection: 'column',
    gap: 8,
    alignItems: 'stretch',
  },
  input: {
    width: '100%',
    height: 48,
    background: '#111315',
    color: '#f5f7fa',
    border: '1px solid #2b3138',
    borderRadius: 8,
    padding: '0 12px',
    fontSize: 17,
    lineHeight: '48px',
    boxSizing: 'border-box',
  },
  timeRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 8,
    alignItems: 'center',
  },
  timeFieldWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    minWidth: 0,
  },
  timeFieldLabel: {
    color: '#9aa4af',
    fontSize: 12,
    minWidth: 48,
    whiteSpace: 'nowrap',
  },
  inputTime: {
    width: '100%',
    background: '#111315',
    color: '#f5f7fa',
    border: '1px solid #2b3138',
    borderRadius: 8,
    padding: '8px 10px',
    fontSize: 17,
    boxSizing: 'border-box',
  },
  addActionRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  addButtonFull: {
    width: '100%',
    background: '#1f3a2d',
    color: '#7cffb2',
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
    gap: 10,
  },
  swipeWrap: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 14,
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
  checkButtonReady: {
    background: '#1f3a2d',
    color: '#7cffb2',
    border: '1px solid #2e664d',
    boxShadow: '0 0 0 1px rgba(124,255,178,0.2) inset',
    transform: 'scale(1.02)',
  },
  checkButtonWaiting: {
    background: '#212834',
    color: '#b3c0d0',
    border: '1px solid #314156',
    opacity: 0.88,
    cursor: 'not-allowed',
  },
  checkButtonDone: {
    background: '#1a1f26',
    color: '#6f7b89',
    border: '1px solid #2c3440',
    opacity: 0.62,
    filter: 'grayscale(0.25)',
    cursor: 'not-allowed',
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
  thumbWrap: {
    marginTop: 10,
    width: 72,
    height: 72,
    borderRadius: 10,
    overflow: 'hidden',
    border: '1px solid #2f3a46',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  cameraOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(7, 9, 11, 0.78)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    zIndex: 10,
  },
  cameraPage: {
    width: '100%',
    maxWidth: 520,
    background: '#0b0e13',
    border: '1px solid #212833',
    borderRadius: 18,
    padding: 14,
  },
  cameraTopRow: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  cameraTopBtn: {
    width: 44,
    height: 44,
    borderRadius: 999,
    border: '1px solid #3a4048',
    background: 'rgba(160,160,160,0.35)',
    color: '#ffffff',
    fontSize: 18,
    cursor: 'pointer',
  },
  cameraError: {
    marginTop: 10,
    color: '#ff9ba8',
    fontSize: 12,
    textAlign: 'center',
  },
  cameraPreview: {
    width: '100%',
    borderRadius: 28,
    border: '1px solid #2f3a46',
    background: '#0f1318',
    aspectRatio: '3 / 4',
    objectFit: 'cover',
  },
  cameraBottomRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
    padding: '0 10px',
  },
  cameraSideIcon: {
    width: 48,
    height: 48,
    borderRadius: 999,
    border: '1px solid #3b4048',
    background: 'transparent',
    color: '#f2f4f7',
    fontSize: 24,
    cursor: 'pointer',
  },
  cameraShutter: {
    width: 88,
    height: 88,
    borderRadius: 999,
    border: '4px solid #f1b74d',
    background: '#11161d',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  cameraShutterBusy: {
    opacity: 0.7,
    transform: 'scale(0.98)',
    cursor: 'not-allowed',
  },
  cameraShutterInner: {
    width: 64,
    height: 64,
    borderRadius: 999,
    background: '#f2f4f7',
    display: 'block',
  },
  cameraDock: {
    marginTop: 18,
    alignSelf: 'center',
    width: 168,
    height: 44,
    borderRadius: 22,
    background: 'rgba(80,86,98,0.45)',
    border: '1px solid rgba(120,126,138,0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-around',
    color: '#ffffff',
  },
  cameraDockIcon: {
    fontSize: 16,
    opacity: 0.8,
  },
  cameraDockHome: {
    width: 36,
    height: 36,
    borderRadius: 18,
    background: 'rgba(255,255,255,0.2)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 18,
  },
};
