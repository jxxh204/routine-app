'use client';

import Link from 'next/link';
import { useState, type CSSProperties } from 'react';

import { AuthRequired } from '@/components/auth-required';
import { AppCard, GhostButton, PageShell, SectionHeader } from '@/components/ui/design-system';

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <SectionHeader eyebrow="System" title="설정" />
        <Link href="/today" style={{ color: '#9ed0ff', textDecoration: 'none', marginTop: 8 }}>
          오늘으로
        </Link>
      </div>

      <AppCard>
        <strong>알림 권한 상태</strong>
        <p style={metaStyle}>현재 웹 알림 권한: {permissionLabel(permission)}</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <GhostButton onClick={() => void requestPermission()}>알림 권한 요청</GhostButton>
          <GhostButton onClick={() => { void sendNativeAction('toggle-notification', true); }}>알림 켜기</GhostButton>
          <GhostButton onClick={() => { void sendNativeAction('toggle-notification', false); }}>알림 끄기</GhostButton>
          <GhostButton onClick={() => { void sendNativeAction('open-settings'); }}>시스템 설정 열기</GhostButton>
        </div>
      </AppCard>

      <AppCard>
        <strong>운영 정책</strong>
        <ul style={{ margin: '8px 0 0', paddingLeft: 18, color: '#c4cfda' }}>
          <li>기본 3루틴 + 커스텀 루틴 유지</li>
          <li>루틴 인증 정책: 시간대 기반</li>
          <li>친구 연동 권한: 방장만 루틴 편집</li>
        </ul>
      </AppCard>

      <AppCard>
        <strong>권한/시스템 이동</strong>
        <p style={metaStyle}>iOS WebView 환경에서는 시스템 설정에서 알림 권한을 최종 확인해 주세요.</p>
      </AppCard>
    </PageShell>
    </AuthRequired>
  );
}

function permissionLabel(state: PermissionState) {
  if (state === 'granted') return '허용됨';
  if (state === 'denied') return '거부됨';
  if (state === 'unsupported') return '미지원 브라우저';
  return '미결정';
}

const metaStyle: CSSProperties = {
  margin: '8px 0',
  color: 'var(--text-muted)',
};
