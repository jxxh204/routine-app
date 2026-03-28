import type { CSSProperties } from 'react';

export default function CalendarLoading() {
  return (
    <div style={styles.shell}>
      <div style={styles.headerRow}>
        <div>
          <div style={{ ...styles.skeleton, width: 60, height: 12 }} />
          <div style={{ ...styles.skeleton, width: 80, height: 24, marginTop: 4 }} />
        </div>
        <div style={{ ...styles.skeleton, width: 56, height: 16 }} />
      </div>
      <div style={styles.statRow}>
        <div style={styles.statCard}>
          <div style={{ ...styles.skeleton, width: 32, height: 22 }} />
          <div style={{ ...styles.skeleton, width: 64, height: 12, marginTop: 4 }} />
        </div>
        <div style={styles.statCard}>
          <div style={{ ...styles.skeleton, width: 32, height: 22 }} />
          <div style={{ ...styles.skeleton, width: 64, height: 12, marginTop: 4 }} />
        </div>
      </div>
      <div style={styles.calendarCard}>
        {Array.from({ length: 5 }).map((_, row) => (
          <div key={row} style={styles.gridRow}>
            {Array.from({ length: 7 }).map((__, col) => (
              <div key={col} style={{ ...styles.skeleton, width: 36, height: 36, borderRadius: 8 }} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  shell: { display: 'grid', gap: 16, padding: '16px 20px' },
  headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  statRow: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 },
  statCard: {
    background: 'var(--ds-color-surface, #f5f5f7)',
    borderRadius: 10,
    padding: '10px 12px',
  },
  calendarCard: {
    background: 'var(--ds-color-surface, #f5f5f7)',
    borderRadius: 12,
    padding: 12,
    display: 'grid',
    gap: 6,
  },
  gridRow: { display: 'flex', gap: 6, justifyContent: 'space-between' },
  skeleton: {
    background: 'var(--ds-color-surface-strong, #e5e5ea)',
    borderRadius: 6,
    height: 16,
    animation: 'pulse 1.5s ease-in-out infinite',
  },
};
