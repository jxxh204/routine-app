'use client';

import Link from 'next/link';
import { useState, type CSSProperties } from 'react';

import { AuthRequired } from '@/components/auth-required';
import { PageShell } from '@/components/ui';

type PermissionState = 'default' | 'granted' | 'denied' | 'unsupported';

function sendNativeAction(action: 'open-settings' | 'request-notification-permission' | 'toggle-notification', enabled?: boolean) {
  if (typeof window === 'undefined') return false;

  const bridge = (window as Window & { ReactNativeWebView?: { postMessage: (msg: string) => void } }).ReactNativeWebView;
  if (!bridge?.postMessage) return false;

  bridge.postMessage(
    JSON.stringify({
      source: 'routine-web',
      type: 'native-action',
      action,
      enabled,
    }),
  );

  return true;
}

export default function SettingsPage() {
  const [permission, setPermission] = useState<PermissionState>(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
    return Notification.permission;
  });

  const requestPermission = async () => {
    if (sendNativeAction('request-notification-permission')) return;

    if (typeof window === 'undefined' || !('Notification' in window)) return;
    const result = await Notification.requestPermission();
    setPermission(result);
  };

  return (
    <AuthRequired>
      <PageShell>
        <section style={styles.page}>
          {/* Header */}
          <div style={styles.header}>
            <div>
              <p style={styles.eyebrow}>SYSTEM</p>
              <h1 style={styles.title}>설정</h1>
            </div>
            <Link href="/today" style={styles.backLink}>
              오늘으로
            </Link>
          </div>

          {/* Notification */}
          <div style={styles.card}>
            <p style={styles.cardTitle}>알림</p>
            <div style={styles.statusRow}>
              <span style={styles.statusLabel}>권한 상태</span>
              <span style={{
                ...styles.statusBadge,
                ...(permission === 'granted' ? styles.badgeGranted : permission === 'denied' ? styles.badgeDenied : styles.badgeDefault),
              }}>
                {permissionLabel(permission)}
              </span>
            </div>
            <div style={styles.buttonGroup}>
              <button style={styles.actionButton} onClick={() => void requestPermission()}>권한 요청</button>
              <button style={styles.actionButton} onClick={() => { void sendNativeAction('toggle-notification', true); }}>켜기</button>
              <button style={styles.actionButton} onClick={() => { void sendNativeAction('toggle-notification', false); }}>끄기</button>
              <button style={styles.actionButton} onClick={() => { void sendNativeAction('open-settings'); }}>시스템 설정</button>
            </div>
          </div>

          {/* Policy */}
          <div style={styles.card}>
            <p style={styles.cardTitle}>운영 정책</p>
            <div style={styles.policyList}>
              <div style={styles.policyItem}>
                <span style={styles.policyDot} />
                <span style={styles.policyText}>기본 3루틴 + 커스텀 루틴 유지</span>
              </div>
              <div style={styles.policyItem}>
                <span style={styles.policyDot} />
                <span style={styles.policyText}>루틴 인증 정책: 시간대 기반</span>
              </div>
              <div style={styles.policyItem}>
                <span style={styles.policyDot} />
                <span style={styles.policyText}>친구 연동 권한: 방장만 루틴 편집</span>
              </div>
            </div>
          </div>

          {/* Info */}
          <div style={styles.card}>
            <p style={styles.cardTitle}>시스템 안내</p>
            <p style={styles.infoText}>iOS WebView 환경에서는 시스템 설정에서 알림 권한을 최종 확인해 주세요.</p>
          </div>
        </section>
      </PageShell>
    </AuthRequired>
  );
}

function permissionLabel(state: PermissionState) {
  if (state === 'granted') return '허용됨';
  if (state === 'denied') return '거부됨';
  if (state === 'unsupported') return '미지원';
  return '미결정';
}

const styles: Record<string, CSSProperties> = {
  page: {
    display: 'grid',
    gap: 12,
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  eyebrow: {
    margin: 0,
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.08em',
    color: 'var(--ds-color-text-faint)',
    textTransform: 'uppercase' as const,
  },
  title: {
    margin: '2px 0 0',
    fontSize: 22,
    fontWeight: 600,
    letterSpacing: '-0.02em',
    color: 'var(--ds-color-text)',
  },
  backLink: {
    color: 'var(--ds-color-accent)',
    textDecoration: 'none',
    fontSize: 13,
    fontWeight: 500,
  },
  card: {
    background: 'var(--ds-color-surface)',
    borderRadius: 'var(--ds-radius-lg)',
    padding: '14px 16px',
    display: 'grid',
    gap: 10,
  },
  cardTitle: {
    margin: 0,
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--ds-color-text)',
  },
  statusRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: 13,
    color: 'var(--ds-color-text-muted)',
  },
  statusBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    height: 22,
    borderRadius: 'var(--ds-radius-pill)',
    padding: '0 8px',
    fontSize: 11,
    fontWeight: 500,
  },
  badgeGranted: {
    background: 'var(--ds-color-green-soft)',
    color: 'var(--ds-color-green)',
  },
  badgeDenied: {
    background: 'var(--ds-color-pink-soft)',
    color: 'var(--ds-color-pink)',
  },
  badgeDefault: {
    background: 'var(--ds-color-gray-soft)',
    color: 'var(--ds-color-gray)',
  },
  buttonGroup: {
    display: 'flex',
    gap: 6,
    flexWrap: 'wrap',
  },
  actionButton: {
    border: 'none',
    background: 'var(--ds-color-surface-strong)',
    color: 'var(--ds-color-text-muted)',
    borderRadius: 'var(--ds-radius-sm)',
    padding: '7px 12px',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 500,
    transition: 'opacity 0.15s ease',
  },
  policyList: {
    display: 'grid',
    gap: 6,
  },
  policyItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  policyDot: {
    width: 5,
    height: 5,
    borderRadius: 'var(--ds-radius-pill)',
    background: 'var(--ds-color-accent)',
    flexShrink: 0,
  },
  policyText: {
    fontSize: 13,
    color: 'var(--ds-color-text-muted)',
  },
  infoText: {
    margin: 0,
    fontSize: 13,
    color: 'var(--ds-color-text-faint)',
    lineHeight: 1.5,
  },
};
