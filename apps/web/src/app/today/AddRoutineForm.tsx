import type { CSSProperties } from 'react';
import { addOneHourHHMM } from '@/lib/routine-time';
import { GhostButton, PrimaryButton } from '@/components/ui';

interface AddRoutineFormProps {
  newTitle: string;
  setNewTitle: (v: string) => void;
  newStart: string;
  setNewStart: (v: string) => void;
  newEnd: string;
  setNewEnd: (v: string) => void;
  formError: string;
  setFormError: (v: string) => void;
  isCompactLayout: boolean;
  onSubmit: () => void;
  onCancel: () => void;
}

export function AddRoutineForm({
  newTitle,
  setNewTitle,
  newStart,
  setNewStart,
  newEnd,
  setNewEnd,
  formError,
  setFormError,
  isCompactLayout,
  onSubmit,
  onCancel,
}: AddRoutineFormProps) {
  return (
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
        <PrimaryButton style={styles.addButtonFull} onClick={onSubmit}>
          추가
        </PrimaryButton>
        <GhostButton style={styles.cancelButton} onClick={onCancel}>
          취소
        </GhostButton>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
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
};
