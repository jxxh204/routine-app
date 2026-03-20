import type { CSSProperties } from 'react';

type AuthStatusScreenProps = {
  title: string;
  description?: string;
};

export function AuthStatusScreen({ title, description }: AuthStatusScreenProps) {
  return (
    <main style={styles.page}>
      <section style={styles.card}>
        <p style={styles.badge}>ROUTINE APP</p>
        <h1 style={styles.title}>{title}</h1>
        {description ? <p style={styles.description}>{description}</p> : null}
      </section>
    </main>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    minHeight: '100dvh',
    display: 'grid',
    placeItems: 'center',
    padding: '24px 20px',
    background: '#0f1115',
    color: '#f5f7fa',
  },
  card: {
    width: '100%',
    maxWidth: 420,
    borderRadius: 20,
    border: '1px solid #2b3138',
    background: 'linear-gradient(180deg, #1b1f23 0%, #15191f 100%)',
    padding: '24px 20px',
    boxShadow: '0 18px 44px rgba(0, 0, 0, 0.35)',
  },
  badge: {
    margin: 0,
    fontSize: 12,
    color: '#9aa4af',
    letterSpacing: 1.2,
  },
  title: {
    margin: '10px 0 0',
    fontSize: 22,
    lineHeight: 1.25,
    fontWeight: 800,
  },
  description: {
    margin: '8px 0 0',
    color: '#b8c1cc',
    fontSize: 14,
  },
};
