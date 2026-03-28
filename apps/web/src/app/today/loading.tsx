import type { CSSProperties } from 'react';

export default function TodayLoading() {
  return (
    <div style={styles.shell}>
      <div style={styles.headerRow}>
        <div style={{ ...styles.skeleton, width: 140, height: 24 }} />
        <div style={{ ...styles.skeleton, width: 60, height: 16 }} />
      </div>
      <div style={{ ...styles.skeleton, width: '100%', height: 3 }} />
      {[1, 2, 3].map((i) => (
        <div key={i} style={styles.card}>
          <div style={styles.cardRow}>
            <div style={{ ...styles.skeleton, width: 100, height: 16 }} />
            <div style={{ ...styles.skeleton, width: 56, height: 22, borderRadius: 999 }} />
          </div>
          <div style={{ ...styles.skeleton, width: 140, height: 12, marginTop: 4 }} />
        </div>
      ))}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  shell: { display: 'grid', gap: 16, padding: '16px 20px' },
  headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  card: {
    background: 'var(--ds-color-surface, #f5f5f7)',
    borderRadius: 12,
    padding: '12px 14px',
  },
  cardRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  skeleton: {
    background: 'var(--ds-color-surface-strong, #e5e5ea)',
    borderRadius: 6,
    height: 16,
    animation: 'pulse 1.5s ease-in-out infinite',
  },
};
