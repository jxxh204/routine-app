"use client";

import {
  type CSSProperties,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  getNowMinute,
  isInTimeWindow,
  formatTimeRangeLabel,
  minuteToHHMM,
  addOneHourHHMM,
} from '@/lib/routine-time';
import { AUTH_ENTRY_FEEDBACK_KEY } from '@/lib/auth-entry-feedback';
import { AppCard, GhostButton, PageShell, PrimaryButton, SectionHeader } from '@/components/ui';

import type { Routine } from './types';
import { getTodayStorageKey } from './constants';
import { useRoutines, saveCustomRoutines, saveDefaultRoutines } from './use-routines';
import { useSupabaseSync } from './use-supabase-sync';
import { useProofImage } from './use-proof-image';
import { ProgressBar } from './ProgressBar';
import { QuickActionCard } from './QuickActionCard';
import { AddRoutineForm } from './AddRoutineForm';
import { RoutineCard } from './RoutineCard';
import { ProofImagePreview } from './ProofImagePreview';

export function TodayView() {
  const { routines, setRoutines, addRoutine, editRoutine, removeRoutine } = useRoutines();
  const [nowMinute, setNowMinute] = useState(getNowMinute());
  const [, setSyncMessage] = useState('로컬 저장 모드');
  const [newTitle, setNewTitle] = useState('');
  const [newStart, setNewStart] = useState('09:00');
  const [newEnd, setNewEnd] = useState('10:00');
  const [formError, setFormError] = useState('');
  const [isAddFormOpen, setIsAddFormOpen] = useState(false);
  const [editingRoutineId, setEditingRoutineId] = useState<string | null>(null);
  const [swipedRoutineId, setSwipedRoutineId] = useState<string | null>(null);
  const [showWelcomeFeedback, setShowWelcomeFeedback] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.sessionStorage.getItem(AUTH_ENTRY_FEEDBACK_KEY) === '1';
  });
  const [isCompactLayout, setIsCompactLayout] = useState(false);

  const { refreshFromSupabase } = useSupabaseSync(routines, setRoutines, setSyncMessage);

  const proof = useProofImage(routines, setRoutines, setSyncMessage, refreshFromSupabase);

  // Persist routines to localStorage
  useEffect(() => {
    const todayKey = getTodayStorageKey();

    const snapshot = routines.map(({ id, title, doneByMe, doneAt, proofImage }) => ({
      id, title, doneByMe, doneAt, proofImage,
    }));

    let preservedDeletedDone: Array<{
      id: string; title?: string; doneByMe: boolean; doneAt?: string; proofImage?: string;
    }> = [];

    try {
      const raw = window.localStorage.getItem(todayKey);
      if (raw) {
        const prev = JSON.parse(raw) as Array<{
          id: string; title?: string; doneByMe: boolean; doneAt?: string; proofImage?: string;
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

  // Clock tick
  useEffect(() => {
    const interval = setInterval(() => { setNowMinute(getNowMinute()); }, 30_000);
    return () => clearInterval(interval);
  }, []);

  // Compact layout
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const update = () => { setIsCompactLayout(window.innerWidth < 940); };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  // Welcome feedback
  useEffect(() => {
    if (typeof window === 'undefined' || !showWelcomeFeedback) return;
    window.sessionStorage.removeItem(AUTH_ENTRY_FEEDBACK_KEY);
    const timer = window.setTimeout(() => { setShowWelcomeFeedback(false); }, 2400);
    return () => window.clearTimeout(timer);
  }, [showWelcomeFeedback]);

  const doneCount = useMemo(
    () => routines.filter((r) => r.doneByMe).length,
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
    () => orderedRoutines.filter((r) => !r.doneByMe && isInTimeWindow(nowMinute, r.startMinute, r.endMinute)),
    [orderedRoutines, nowMinute],
  );

  const nextAvailableRoutine = availableNowRoutines[0] ?? null;

  const submitRoutineForm = () => {
    const title = newTitle.trim();
    if (!title) { setFormError('루틴 이름을 입력해 주세요.'); return; }

    const [startH, startM] = newStart.split(':').map(Number);
    const [endH, endM] = newEnd.split(':').map(Number);

    if ([startH, startM, endH, endM].some((v) => Number.isNaN(v))) {
      setFormError('시작/종료 시간을 다시 확인해 주세요.'); return;
    }

    const startMinute = startH * 60 + startM;
    const endMinute = endH * 60 + endM;

    if (startMinute === endMinute) { setFormError('시작/종료 시간은 다르게 설정해 주세요.'); return; }

    const duplicated = routines.some(
      (r) => r.title.trim() === title && r.id !== editingRoutineId,
    );
    if (duplicated) { setFormError('같은 이름의 루틴이 이미 있어요.'); return; }

    setFormError('');

    if (editingRoutineId) {
      editRoutine(editingRoutineId, {
        title,
        startMinute,
        endMinute,
        timeRangeLabel: formatTimeRangeLabel(startMinute, endMinute),
      });
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
      addRoutine(newRoutine);
    }

    setNewTitle('');
    setNewStart('09:00');
    setNewEnd('10:00');
    setIsAddFormOpen(false);
  };

  const startEditRoutine = (id: string) => {
    const target = routines.find((r) => r.id === id);
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

  const handleRemoveRoutine = (id: string) => {
    removeRoutine(id);
    setSwipedRoutineId((prev) => (prev === id ? null : prev));
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
          <ProgressBar doneCount={doneCount} totalCount={routines.length} progress={progress} />
        </section>

        {nextAvailableRoutine ? (
          <QuickActionCard
            availableNowRoutines={availableNowRoutines}
            nextAvailableRoutine={nextAvailableRoutine}
            onCertify={proof.openCameraForRoutine}
          />
        ) : null}

        <section style={styles.boardSection}>
          <div style={{ ...styles.boardHeader, ...(isCompactLayout ? styles.boardHeaderCompact : {}) }}>
            <h2 style={styles.boardTitle}>오늘 할 일</h2>
            <p style={styles.boardMeta}>
              {availableNowRoutines.length > 0 ? `지금 인증 가능 ${availableNowRoutines.length}개` : '지금 가능한 루틴부터 위에서 처리'}
            </p>
          </div>

          <section style={styles.list}>
            {orderedRoutines.map((routine) => (
              <RoutineCard
                key={routine.id}
                routine={routine}
                nowMinute={nowMinute}
                isCompactLayout={isCompactLayout}
                editingRoutineId={editingRoutineId}
                swipedRoutineId={swipedRoutineId}
                thumbMenuRoutineId={proof.thumbMenuRoutineId}
                newTitle={newTitle}
                newStart={newStart}
                newEnd={newEnd}
                formError={formError}
                setNewTitle={setNewTitle}
                setNewStart={setNewStart}
                setNewEnd={setNewEnd}
                setFormError={setFormError}
                setSwipedRoutineId={setSwipedRoutineId}
                onCertify={proof.openCameraForRoutine}
                onStartEdit={startEditRoutine}
                onCancelEdit={cancelInlineEdit}
                onSubmitEdit={submitRoutineForm}
                onRemove={handleRemoveRoutine}
                onPreviewImage={proof.setPreviewImage}
                onRetakePhoto={proof.retakeRoutinePhoto}
                onStartThumbLongPress={proof.startThumbLongPress}
                onCancelThumbLongPress={proof.cancelThumbLongPress}
                onCloseThumbMenu={() => proof.setThumbMenuRoutineId(null)}
              />
            ))}
          </section>
        </section>

        <AppCard>
          <section style={{ ...styles.addSection }}>
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
              <AddRoutineForm
                newTitle={newTitle}
                setNewTitle={setNewTitle}
                newStart={newStart}
                setNewStart={setNewStart}
                newEnd={newEnd}
                setNewEnd={setNewEnd}
                formError={formError}
                setFormError={setFormError}
                isCompactLayout={isCompactLayout}
                onSubmit={submitRoutineForm}
                onCancel={() => {
                  setFormError('');
                  setNewTitle('');
                  setNewStart('09:00');
                  setNewEnd('10:00');
                  setIsAddFormOpen(false);
                }}
              />
            ) : null}
          </section>
        </AppCard>

        <input
          ref={proof.fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: 'none' }}
          onChange={(event) => void proof.onPickPhotoFile(event)}
        />

        {proof.previewImage ? (
          <ProofImagePreview
            previewImage={proof.previewImage}
            onClose={() => proof.setPreviewImage(null)}
          />
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
  pageSection: { display: 'grid', gap: 18 },
  kpiGrid: { display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 12 },
  kpiGridCompact: { gridTemplateColumns: '1fr' },
  sectionLabel: {
    margin: '0 0 8px',
    fontSize: 12,
    color: 'var(--text-muted)',
    letterSpacing: '0.02em',
  },
  boardSection: { display: 'grid', gap: 10 },
  boardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 8,
  },
  boardHeaderCompact: { flexDirection: 'column', alignItems: 'flex-start' },
  boardTitle: { margin: 0, fontSize: 22 },
  boardMeta: { margin: 0, color: 'var(--text-muted)', fontSize: 12 },
  list: { display: 'flex', flexDirection: 'column', gap: 12 },
  welcomeCard: {
    background: '#18222e',
    border: '1px solid #334050',
    borderRadius: 16,
    padding: 16,
    marginBottom: 0,
    boxShadow: 'var(--ds-shadow-soft)',
  },
  welcomeTitle: { display: 'block', color: '#cfe7ff', fontSize: 14 },
  welcomeDesc: { margin: '6px 0 0', color: '#9fb3c8', fontSize: 12 },
  addSection: {
    background: 'var(--surface-1)',
    border: '1px solid var(--outline)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 0,
    boxShadow: 'var(--ds-shadow-soft)',
    marginTop: 2,
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
  meta: { margin: '6px 0 0', fontSize: 13, color: 'var(--text-muted)' },
};
