import type { CSSProperties } from 'react';

export default function SettingsLoading() {
  return (
    <div style={styles.shell}>
      <div style={styles.headerRow}>
        <div>
          <div style={{ ...styles.skeleton, width: 52, height: 12 }} />
          <div style={{ ...styles.skeleton, width: 48, height: 24, marginTop: 4 }} />
        </div>
        <div style={{ ...styles.skeleton, width: 56, height: 16 }} />
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} style={styles.card}>
          <div style={{ ...styles.skeleton, width: 80, height: 16 }} />
          <div style={{ ...styles.skeleton, width: '100%', height: 12, marginTop: 8 }} />
          <div style={{ ...styles.skeleton, width: '70%', height: 12, marginTop: 4 }} />
        </div>
      ))}
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  shell: { display: 'grid', gap: 12, padding: '16px 20px' },
  headerRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  card: {
    background: 'var(--ds-color-surface, #f5f5f7)',
    borderRadius: 12,
    padding: '14px 16px',
  },
  skeleton: {
    background: 'var(--ds-color-surface-strong, #e5e5ea)',
    borderRadius: 6,
    height: 16,
    animation: 'pulse 1.5s ease-in-out infinite',
  },
};
