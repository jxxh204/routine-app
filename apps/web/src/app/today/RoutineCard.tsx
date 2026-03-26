import { type CSSProperties, type TouchEvent, useState } from 'react';
import { addOneHourHHMM, isInTimeWindow, minuteToHHMM, formatTimeRangeLabel } from '@/lib/routine-time';
import { GhostButton, PrimaryButton } from '@/components/ui';
import type { Routine } from './types';

interface RoutineCardProps {
  routine: Routine;
  nowMinute: number;
  isCompactLayout: boolean;
  editingRoutineId: string | null;
  swipedRoutineId: string | null;
  thumbMenuRoutineId: string | null;
  newTitle: string;
  newStart: string;
  newEnd: string;
  formError: string;
  setNewTitle: (v: string) => void;
  setNewStart: (v: string) => void;
  setNewEnd: (v: string) => void;
  setFormError: (v: string) => void;
  setSwipedRoutineId: (id: string | null) => void;
  onCertify: (id: string) => void;
  onStartEdit: (id: string) => void;
  onCancelEdit: () => void;
  onSubmitEdit: () => void;
  onRemove: (id: string) => void;
  onPreviewImage: (url: string | null) => void;
  onRetakePhoto: (id: string) => void;
  onStartThumbLongPress: (id: string) => void;
  onCancelThumbLongPress: () => void;
  onCloseThumbMenu: () => void;
}

export function RoutineCard({
  routine,
  nowMinute,
  isCompactLayout,
  editingRoutineId,
  swipedRoutineId,
  thumbMenuRoutineId,
  newTitle,
  newStart,
  newEnd,
  formError,
  setNewTitle,
  setNewStart,
  setNewEnd,
  setFormError,
  setSwipedRoutineId,
  onCertify,
  onStartEdit,
  onCancelEdit,
  onSubmitEdit,
  onRemove,
  onPreviewImage,
  onRetakePhoto,
  onStartThumbLongPress,
  onCancelThumbLongPress,
  onCloseThumbMenu,
}: RoutineCardProps) {
  const inWindow = isInTimeWindow(nowMinute, routine.startMinute, routine.endMinute);
  const isEditing = editingRoutineId === routine.id;
  const canCertify = inWindow && !routine.doneByMe && !isEditing;

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    event.currentTarget.dataset.startX = String(event.touches[0]?.clientX ?? 0);
    event.currentTarget.dataset.startY = String(event.touches[0]?.clientY ?? 0);
  };

  const handleTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const startX = Number(event.currentTarget.dataset.startX ?? 0);
    const startY = Number(event.currentTarget.dataset.startY ?? 0);
    const endX = event.changedTouches[0]?.clientX ?? startX;
    const endY = event.changedTouches[0]?.clientY ?? startY;

    const deltaX = startX - endX;
    const deltaY = startY - endY;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    const isHorizontalSwipe = absX > 48 && absX > absY * 1.4;
    if (!isHorizontalSwipe) return;

    if (deltaX > 0) {
      setSwipedRoutineId(routine.id);
      return;
    }

    setSwipedRoutineId(null);
  };

  const card = (
    <article
      className="routine-card-surface"
      onClick={canCertify ? () => void onCertify(routine.id) : undefined}
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
              <GhostButton style={styles.inlineCancelButton} onClick={onCancelEdit}>취소</GhostButton>
              <PrimaryButton style={styles.inlineSaveButton} onClick={onSubmitEdit}>저장</PrimaryButton>
            </div>
          </div>
        ) : (
          <>
            <p style={styles.meta}>인증 시간: {routine.timeRangeLabel}</p>
            {routine.proofImage ? (
              <div
                style={styles.thumbWrap}
                onContextMenu={(event) => event.preventDefault()}
                onTouchStart={() => onStartThumbLongPress(routine.id)}
                onTouchEnd={onCancelThumbLongPress}
                onTouchCancel={onCancelThumbLongPress}
                onMouseDown={() => onStartThumbLongPress(routine.id)}
                onMouseUp={onCancelThumbLongPress}
                onMouseLeave={onCancelThumbLongPress}
                onClick={() => {
                  if (thumbMenuRoutineId === routine.id) return;
                  onPreviewImage(routine.proofImage ?? null);
                }}
              >
                <img src={routine.proofImage} alt={`${routine.title} 인증 사진`} style={styles.thumbImage} />
                {thumbMenuRoutineId === routine.id ? (
                  <div style={styles.thumbMenu}>
                    <PrimaryButton style={styles.thumbMenuButton} onClick={() => onRetakePhoto(routine.id)}>다시찍기</PrimaryButton>
                    <GhostButton style={styles.thumbMenuCancel} onClick={onCloseThumbMenu}>닫기</GhostButton>
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
      className="routine-card-surface"
      style={styles.swipeWrap}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="routine-card-surface" style={styles.actionWrap}>
        <GhostButton style={styles.editButton} onClick={() => onStartEdit(routine.id)}>수정</GhostButton>
        {!routine.isDefault ? (
          <GhostButton style={styles.deleteButton} onClick={() => onRemove(routine.id)}>삭제</GhostButton>
        ) : null}
      </div>
      {card}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
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
  itemSwiped: { transform: 'translateX(-152px)' },
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
  itemClickable: { cursor: 'pointer' },
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
  itemBody: { width: '100%' },
  inlineEditWrap: { display: 'grid', gap: 8 },
  inlineEditActions: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 8,
    marginTop: 14,
  },
  inlineSaveButton: { width: '100%' },
  inlineCancelButton: { width: '100%' },
  itemTitle: { margin: 0, fontSize: 15, fontWeight: 600 },
  meta: { margin: '6px 0 0', fontSize: 13, color: 'var(--text-muted)' },
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
  timeFieldLabelCompact: { fontSize: 11 },
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
  inputTimeCompact: { padding: '6px 8px', fontSize: 14 },
  formError: { margin: 0, color: '#ffb7b2', fontSize: 12 },
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
};
