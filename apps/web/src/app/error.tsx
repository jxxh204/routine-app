'use client';

import type { CSSProperties } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <p style={styles.icon}>⚠️</p>
        <h2 style={styles.title}>문제가 발생했어요</h2>
        <p style={styles.desc}>
          {error.message || '예상치 못한 오류가 발생했습니다.'}
        </p>
        <button style={styles.button} onClick={reset}>
          다시 시도
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, CSSProperties> = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '60vh',
    padding: 20,
  },
  card: {
    background: 'var(--ds-color-surface, #f5f5f7)',
    borderRadius: 16,
    padding: '32px 24px',
    textAlign: 'center',
    maxWidth: 340,
    width: '100%',
  },
  icon: {
    fontSize: 32,
    margin: '0 0 8px',
  },
  title: {
    margin: '0 0 8px',
    fontSize: 18,
    fontWeight: 600,
    color: 'var(--ds-color-text, #1d1d1f)',
  },
  desc: {
    margin: '0 0 16px',
    fontSize: 13,
    color: 'var(--ds-color-text-muted, #86868b)',
    lineHeight: 1.5,
  },
  button: {
    border: 'none',
    background: 'var(--ds-color-accent, #0284c7)',
    color: '#fff',
    borderRadius: 8,
    padding: '10px 24px',
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
  },
};
