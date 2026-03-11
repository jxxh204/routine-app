import { supabase } from '@/lib/supabase';

export default async function TodayPage() {
  const now = new Date();
  const dateLabel = now.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  });

  const dbStatus = supabase ? 'connected (env loaded)' : 'not connected';

  return (
    <main style={{ maxWidth: 520, margin: '0 auto', padding: '40px 20px' }}>
      <h1 style={{ fontSize: 32, marginBottom: 8 }}>오늘 루틴</h1>
      <p style={{ color: '#666', marginBottom: 20 }}>{dateLabel}</p>

      <section
        style={{
          border: '1px solid #e5e7eb',
          borderRadius: 12,
          padding: 16,
          marginBottom: 16,
          background: '#fff',
        }}
      >
        <strong>MVP 상태</strong>
        <ul>
          <li>DB 연결: {dbStatus}</li>
          <li>루틴 목록: 준비중</li>
          <li>완료 체크: 준비중</li>
        </ul>
      </section>

      <section
        style={{
          border: '1px dashed #cbd5e1',
          borderRadius: 12,
          padding: 16,
          background: '#f8fafc',
        }}
      >
        <p style={{ margin: 0 }}>
          다음 단계: groups/routines/routine_logs를 읽어 오늘 루틴 리스트 표시
        </p>
      </section>
    </main>
  );
}
