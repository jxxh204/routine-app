"use client";

import { useEffect, useMemo, useState } from 'react';

import { AuthRequired } from '@/components/auth-required';
import { isValidFriendCode, normalizeFriendCode } from '@/lib/friend-code';
import { acceptFriendRequest, listMyFriendRequests, sendFriendRequestByCode, type FriendRequestRow } from '@/lib/friends';

export default function FriendsPage() {
  const [friendCode, setFriendCode] = useState('');
  const [rows, setRows] = useState<FriendRequestRow[]>([]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const normalized = useMemo(() => normalizeFriendCode(friendCode), [friendCode]);
  const canSubmit = isValidFriendCode(normalized);

  const refresh = async () => {
    const res = await listMyFriendRequests();
    if (!res.ok) {
      setMessage('친구 목록을 불러오지 못했어요.');
      return;
    }

    setRows(res.data);
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void refresh();
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  const onSend = async () => {
    if (!canSubmit) return;
    setLoading(true);
    setMessage('');

    const res = await sendFriendRequestByCode(normalized);
    setLoading(false);

    if (!res.ok) {
      setMessage(
        res.error === 'friend-not-found'
          ? '해당 친구 코드를 찾을 수 없어요.'
          : res.error === 'cannot-add-self'
            ? '본인 코드는 추가할 수 없어요.'
            : '친구 요청 전송에 실패했어요.',
      );
      return;
    }

    setFriendCode('');
    setMessage('친구 요청을 보냈어요.');
    await refresh();
  };

  const onAccept = async (id: string) => {
    const res = await acceptFriendRequest(id);
    if (!res.ok) {
      setMessage('요청 수락에 실패했어요.');
      return;
    }

    setMessage('친구 요청을 수락했어요.');
    await refresh();
  };

  return (
    <AuthRequired>
    <main style={{ maxWidth: 720, margin: '0 auto', padding: '32px 20px', color: '#f5f7fa' }}>
      <h1 style={{ margin: 0, fontSize: 28 }}>친구 관리</h1>
      <p style={{ color: '#9aa4af' }}>친구 코드를 입력해 요청을 보내고, 받은 요청을 수락하세요.</p>

      <section style={{ marginTop: 16, border: '1px solid #2b3138', borderRadius: 12, padding: 12 }}>
        <p style={{ marginTop: 0 }}>친구 코드로 요청 보내기</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={friendCode}
            onChange={(e) => setFriendCode(e.target.value)}
            placeholder="예: AB12CD"
            style={{
              flex: 1,
              height: 42,
              borderRadius: 8,
              border: '1px solid #2b3138',
              background: '#11151a',
              color: '#f5f7fa',
              padding: '0 12px',
            }}
          />
          <button
            onClick={() => void onSend()}
            disabled={!canSubmit || loading}
            style={{
              width: 120,
              borderRadius: 8,
              border: '1px solid #2e664d',
              background: '#1f3a2d',
              color: '#7cffb2',
              fontWeight: 700,
            }}
          >
            요청 보내기
          </button>
        </div>
      </section>

      <section style={{ marginTop: 16, border: '1px solid #2b3138', borderRadius: 12, padding: 12 }}>
        <p style={{ marginTop: 0 }}>받은/보낸 요청</p>
        <div style={{ display: 'grid', gap: 8 }}>
          {rows.length === 0 ? (
            <p style={{ color: '#9aa4af' }}>아직 친구 요청이 없어요.</p>
          ) : (
            rows.map((row) => (
              <article key={row.id} style={{ border: '1px solid #303844', borderRadius: 8, padding: 10 }}>
                <div style={{ fontSize: 13, color: '#9aa4af' }}>status: {row.status}</div>
                <div style={{ fontSize: 12, color: '#9aa4af', marginTop: 4 }}>
                  {row.requester_id} → {row.addressee_id}
                </div>
                {row.status === 'pending' ? (
                  <button
                    onClick={() => void onAccept(row.id)}
                    style={{
                      marginTop: 8,
                      borderRadius: 8,
                      border: '1px solid #334050',
                      background: '#1f2a36',
                      color: '#9ed0ff',
                      padding: '6px 10px',
                    }}
                  >
                    수락
                  </button>
                ) : null}
              </article>
            ))
          )}
        </div>
      </section>

      {message ? <p style={{ marginTop: 12, color: '#c4cfda' }}>{message}</p> : null}
    </main>
    </AuthRequired>
  );
}
