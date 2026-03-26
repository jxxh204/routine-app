import type { CSSProperties } from 'react';

interface ProgressBarProps {
  doneCount: number;
  totalCount: number;
  progress: number;
}

export function ProgressBar({ doneCount, totalCount, progress }: ProgressBarProps) {
  return (
    <section style={styles.progressCard}>
      <p style={styles.sectionLabel}>프로그레스 {doneCount}/{totalCount}</p>
      <div style={styles.progressTrack}>
        <div style={{ ...styles.progressFill, width: `${progress}%` }} />
      </div>
    </section>
  );
}

const styles: Record<string, CSSProperties> = {
  progressCard: {
    background: 'var(--surface-1)',
    border: '1px solid var(--outline)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 0,
    boxShadow: 'var(--ds-shadow-soft)',
  },
  sectionLabel: {
    margin: '0 0 8px',
    fontSize: 12,
    color: 'var(--text-muted)',
    letterSpacing: '0.02em',
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
};
