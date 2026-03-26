import type { CSSProperties } from 'react';
import { PrimaryButton } from '@/components/ui';
import type { Routine } from './types';

interface QuickActionCardProps {
  availableNowRoutines: Routine[];
  nextAvailableRoutine: Routine;
  onCertify: (id: string) => void;
}

export function QuickActionCard({ availableNowRoutines, nextAvailableRoutine, onCertify }: QuickActionCardProps) {
  return (
    <section style={styles.quickActionCard}>
      <p style={styles.quickActionTitle}>지금 인증 가능한 루틴 {availableNowRoutines.length}개</p>
      <p style={styles.quickActionDesc}>{nextAvailableRoutine.title}부터 바로 인증하세요.</p>
      <PrimaryButton style={styles.quickActionButton} onClick={() => void onCertify(nextAvailableRoutine.id)}>
        지금 인증하기
      </PrimaryButton>
    </section>
  );
}

const styles: Record<string, CSSProperties> = {
  quickActionCard: {
    background: 'var(--surface-1)',
    border: '1px solid #2e664d',
    borderRadius: 16,
    padding: 14,
    marginTop: 2,
    boxShadow: 'var(--ds-shadow-soft)',
  },
  quickActionTitle: {
    margin: 0,
    fontSize: 14,
    fontWeight: 700,
    color: '#d8ffe8',
  },
  quickActionDesc: {
    margin: '4px 0 10px',
    fontSize: 12,
    color: 'var(--text-muted)',
  },
  quickActionButton: {
    width: '100%',
    borderRadius: 10,
    padding: '10px 12px',
  },
};
