'use client';

import Link from 'next/link';

export default function SettingsPage() {
  return (
    <main style={{ minHeight: '100dvh', background: '#11151a', color: '#f5f7fa', padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <h1 style={{ margin: 0, fontSize: 22 }}>설정</h1>
        <Link href="/today" style={{ color: '#9ed0ff', textDecoration: 'none' }}>
          오늘으로
        </Link>
      </div>

      <section style={{ border: '1px solid #2b3138', borderRadius: 12, background: '#1b1f23', padding: 12 }}>
        <p style={{ marginTop: 0, color: '#9aa4af' }}>웹뷰 통일 1차 설정 페이지입니다.</p>
        <ul style={{ margin: 0, paddingLeft: 18, color: '#c4cfda' }}>
          <li>알림 권한/시간 정책은 모바일 셸 설정과 동기화 예정</li>
          <li>계정/친구 연동 설정은 후속 PR에서 연결</li>
        </ul>
      </section>
    </main>
  );
}
