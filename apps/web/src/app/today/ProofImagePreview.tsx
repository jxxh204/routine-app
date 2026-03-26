import type { CSSProperties } from 'react';
import { GhostButton } from '@/components/ui';

interface ProofImagePreviewProps {
  previewImage: string;
  onClose: () => void;
}

export function ProofImagePreview({ previewImage, onClose }: ProofImagePreviewProps) {
  return (
    <section style={styles.previewOverlay} onClick={onClose}>
      <div style={styles.previewCard} onClick={(event) => event.stopPropagation()}>
        <img src={previewImage} alt="인증 사진 확대" style={styles.previewImage} />
        <GhostButton style={styles.previewCloseButton} onClick={onClose}>닫기</GhostButton>
      </div>
    </section>
  );
}

const styles: Record<string, CSSProperties> = {
  previewOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(8, 10, 14, 0.78)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    zIndex: 30,
  },
  previewCard: {
    width: '100%',
    maxWidth: 560,
    borderRadius: 14,
    border: '1px solid #2f3a46',
    background: '#11151a',
    padding: 10,
  },
  previewImage: {
    width: '100%',
    maxHeight: '70vh',
    borderRadius: 10,
    objectFit: 'contain',
    background: '#000',
  },
  previewCloseButton: {
    marginTop: 10,
    width: '100%',
    border: '1px solid #3b4552',
    background: '#2a3038',
    color: '#d0d8e0',
    borderRadius: 8,
    padding: '8px 12px',
    cursor: 'pointer',
  },
};
