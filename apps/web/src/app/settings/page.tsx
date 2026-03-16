'use client';

import Link from 'next/link';
import { useState, type CSSProperties } from 'react';

type PermissionState = 'default' | 'granted' | 'denied' | 'unsupported';

export default function SettingsPage() {
  const [permission, setPermission] = useState<PermissionState>(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
    return Notification.permission;
  });

  const requestPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    const result = await Notification.requestPermission();
    setPermission(result);
  };

  return (
    <main style={{ minHeight: '100dvh', background: '#11151a', color: '#f5f7fa', padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>설정</h1>
        <Link href="/today" style={{ color: '#9ed0ff', textDecoration: 'none' }}>
          오늘으로
        </Link>
      </div>

      <section style={cardStyle}>
        <strong>알림 권한 상태</strong>
        <p style={metaStyle}>현재 웹 알림 권한: {permissionLabel(permission)}</p>
        <button style={buttonStyle} onClick={() => void requestPermission()}>
          알림 권한 요청
        </button>
      </section>

      <section style={cardStyle}>
        <strong>운영 정책</strong>
        <ul style={{ margin: '8px 0 0', paddingLeft: 18, color: '#c4cfda' }}>
          <li>기본 3루틴 + 커스텀 루틴 유지</li>
          <li>루틴 인증 정책: 시간대 기반</li>
          <li>친구 연동 권한: 방장만 루틴 편집</li>
        </ul>
      </section>

      <section style={cardStyle}>
        <strong>권한/시스템 이동</strong>
        <p style={metaStyle}>iOS WebView 환경에서는 시스템 설정에서 알림 권한을 최종 확인해 주세요.</p>
      </section>
    </main>
  );
}

function permissionLabel(state: PermissionState) {
  if (state === 'granted') return '허용됨';
  if (state === 'denied') return '거부됨';
  if (state === 'unsupported') return '미지원 브라우저';
  return '미결정';
}

const cardStyle: CSSProperties = {
  border: '1px solid #2b3138',
  borderRadius: 12,
  background: '#1b1f23',
  padding: 12,
  marginBottom: 10,
};

const metaStyle: CSSProperties = {
  margin: '8px 0',
  color: '#9aa4af',
};

const buttonStyle: CSSProperties = {
  border: '1px solid #3b4552',
  background: '#2a3038',
  color: '#d0d8e0',
  borderRadius: 8,
  padding: '8px 10px',
  cursor: 'pointer',
};
