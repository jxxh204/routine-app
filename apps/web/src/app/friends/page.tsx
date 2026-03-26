"use client";

import { useEffect, useMemo, useState } from 'react';

import { AuthRequired } from '@/components/auth-required';
import { AppCard, GhostButton, PageShell, PrimaryButton, SectionHeader } from '@/components/ui';
import { isValidFriendCode, normalizeFriendCode } from '@/lib/friend-code';
import { acceptFriendRequest, listMyFriendRequests, sendFriendRequestByCode, splitFriendRequests, type FriendRequestRow } from '@/lib/friends';
import { ensureMyProfile } from '@/lib/profile-bootstrap';
import { supabase } from '@/lib/supabase';

type NicknameMap = Record<string, string>;

async function fetchNicknames(userIds: string[]): Promise<NicknameMap> {
  if (!supabase || userIds.length === 0) return {};
  const unique = [...new Set(userIds)];
  const { data } = await supabase
    .from('profiles')
    .select('user_id, nickname, friend_code')
    .in('user_id', unique);
  const map: NicknameMap = {};
  for (const row of data ?? []) {
    map[row.user_id] = row.nickname || row.friend_code?.slice(0, 4) || '알 수 없음';
  }
  return map;
}

export default function FriendsPage() {
  const [friendCode, setFriendCode] = useState('');
  const [rows, setRows] = useState<FriendRequestRow[]>([]);
  const [myUserId, setMyUserId] = useState<string>('');
  const [myFriendCode, setMyFriendCode] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [nicknames, setNicknames] = useState<NicknameMap>({});

  const normalized = useMemo(() => normalizeFriendCode(friendCode), [friendCode]);
  const canSubmit = isValidFriendCode(normalized);
  const split = useMemo(() => splitFriendRequests(rows, myUserId), [rows, myUserId]);

  const displayName = (userId: string) => nicknames[userId] || userId.slice(0, 4);

  const refresh = async () => {
    const profile = await ensureMyProfile();
    if (profile.ok) {
      setMyFriendCode(profile.friendCode);
    }

    const res = await listMyFriendRequests();
    if (!res.ok) {
      setMessage('친구 목록을 불러오지 못했어요.');
      return;
    }

    setMyUserId(res.me);
    setRows(res.data);

    const allIds = res.data.flatMap((r) => [r.requester_id, r.addressee_id]);
    const names = await fetchNicknames(allIds);
    setNicknames(names);
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
    <PageShell>
      <SectionHeader eyebrow="Social" title="친구 관리" description="친구 코드를 입력해 요청을 보내고, 받은 요청을 수락하세요." />

      <AppCard>
        <p style={{ marginTop: 0, fontWeight: 600 }}>친구 코드로 요청 보내기</p>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={friendCode}
            onChange={(e) => setFriendCode(e.target.value)}
            placeholder="예: AB12CD"
            style={{
              flex: 1,
              height: 42,
              borderRadius: 8,
              border: '1px solid var(--outline)',
              background: 'var(--surface-2)',
              color: 'var(--foreground)',
              padding: '0 12px',
            }}
          />
          <PrimaryButton
            onClick={() => void onSend()}
            disabled={!canSubmit || loading}
            style={{ width: 120 }}
          >
            요청 보내기
          </PrimaryButton>
        </div>
      </AppCard>

      <AppCard>
        <p style={{ marginTop: 0, fontWeight: 600 }}>내 친구 코드</p>
        <strong style={{ letterSpacing: 1, fontSize: 18 }}>{myFriendCode || '생성 중...'}</strong>
      </AppCard>

      <AppCard>
        <p style={{ marginTop: 0, fontWeight: 600 }}>받은 요청</p>
        <div style={{ display: 'grid', gap: 8 }}>
          {split.incomingPending.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>받은 요청이 없어요.</p>
          ) : (
            split.incomingPending.map((row, idx) => (
              <article key={row.id} style={{ border: '1px solid var(--outline)', borderRadius: 8, padding: 10 }}>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  친구 요청 #{idx + 1} · <strong style={{ color: 'var(--foreground)' }}>{displayName(row.requester_id)}</strong>
                </div>
                <GhostButton
                  onClick={() => void onAccept(row.id)}
                  style={{ marginTop: 8 }}
                >
                  수락
                </GhostButton>
              </article>
            ))
          )}
        </div>
      </AppCard>

      <AppCard>
        <p style={{ marginTop: 0, fontWeight: 600 }}>보낸 요청</p>
        <div style={{ display: 'grid', gap: 8 }}>
          {split.outgoingPending.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>보낸 요청이 없어요.</p>
          ) : (
            split.outgoingPending.map((row) => (
              <article key={row.id} style={{ border: '1px solid var(--outline)', borderRadius: 8, padding: 10 }}>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  <strong style={{ color: 'var(--foreground)' }}>{displayName(row.addressee_id)}</strong> · 대기중
                </div>
              </article>
            ))
          )}
        </div>
      </AppCard>

      <AppCard>
        <p style={{ marginTop: 0, fontWeight: 600 }}>친구 목록</p>
        <div style={{ display: 'grid', gap: 8 }}>
          {split.accepted.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>아직 친구가 없어요.</p>
          ) : (
            split.accepted.map((row) => {
              const friendId = row.requester_id === myUserId ? row.addressee_id : row.requester_id;
              return (
                <article key={row.id} style={{ border: '1px solid var(--outline)', borderRadius: 8, padding: 10 }}>
                  <div style={{ fontSize: 13 }}>
                    {displayName(friendId)}
                  </div>
                </article>
              );
            })
          )}
        </div>
      </AppCard>

      {message ? <p style={{ marginTop: 12, color: 'var(--text-muted)' }}>{message}</p> : null}
    </PageShell>
    </AuthRequired>
  );
}
