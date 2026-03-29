"use client";

import { useEffect, useMemo, useState } from 'react';
import { Button, Input } from 'antd';

import { AuthRequired } from '@/components/auth-required';
import { PageShell } from '@/components/ui';
import { isValidFriendCode, normalizeFriendCode } from '@/lib/friend-code';
import { acceptFriendRequest, listMyFriendRequests, sendFriendRequestByCode, splitFriendRequests, type FriendRequestRow } from '@/lib/friends';
import { ensureMyProfile } from '@/lib/profile-bootstrap';

export default function FriendsPage() {
  const [friendCode, setFriendCode] = useState('');
  const [rows, setRows] = useState<FriendRequestRow[]>([]);
  const [myUserId, setMyUserId] = useState<string>('');
  const [myFriendCode, setMyFriendCode] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const normalized = useMemo(() => normalizeFriendCode(friendCode), [friendCode]);
  const canSubmit = isValidFriendCode(normalized);
  const split = useMemo(() => splitFriendRequests(rows, myUserId), [rows, myUserId]);

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
  };

  useEffect(() => {
    let cancelled = false;
    const doRefresh = async () => {
      const profile = await ensureMyProfile();
      if (cancelled) return;
      if (profile.ok) setMyFriendCode(profile.friendCode);

      const res = await listMyFriendRequests();
      if (cancelled) return;
      if (!res.ok) {
        setMessage('친구 목록을 불러오지 못했어요.');
        return;
      }
      setMyUserId(res.me);
      setRows(res.data);
    };
    void doRefresh();
    return () => { cancelled = true; };
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
        <section className="grid gap-ds-section-gap">
          {/* Header */}
          <div>
            <p className="m-0 text-[11px] font-semibold tracking-[0.08em] text-ds-text-faint uppercase">
              SOCIAL
            </p>
            <h1 className="mt-[2px] mb-0 text-[22px] font-semibold tracking-tight text-ds-text">
              친구 관리
            </h1>
            <p className="mt-1 mb-0 text-[13px] text-ds-text-muted">
              친구 코드를 입력해 요청을 보내고, 받은 요청을 수락하세요.
            </p>
          </div>

          {/* My code */}
          <div className="bg-ds-surface rounded-ds-lg py-ds-card-y px-ds-card-x grid gap-ds-card-gap">
            <p className="m-0 text-[14px] font-semibold text-ds-text">내 친구 코드</p>
            <span className="text-[22px] font-bold tracking-[0.12em] text-ds-accent">
              {myFriendCode || '생성 중...'}
            </span>
          </div>

          {/* Send request */}
          <div className="bg-ds-surface rounded-ds-lg py-ds-card-y px-ds-card-x grid gap-ds-card-gap">
            <p className="m-0 text-[14px] font-semibold text-ds-text">친구 코드로 요청 보내기</p>
            <div className="flex gap-2">
              <Input
                value={friendCode}
                onChange={(e) => setFriendCode(e.target.value)}
                placeholder="예: AB12CD"
                className="flex-1"
              />
              <Button
                type="primary"
                onClick={() => void onSend()}
                disabled={!canSubmit || loading}
                className="shrink-0"
              >
                요청
              </Button>
            </div>
          </div>

          {/* Incoming */}
          <div className="bg-ds-surface rounded-ds-lg py-ds-card-y px-ds-card-x grid gap-ds-card-gap">
            <p className="m-0 text-[14px] font-semibold text-ds-text">받은 요청</p>
            {split.incomingPending.length === 0 ? (
              <p className="m-0 text-ds-text-faint text-[13px]">받은 요청이 없어요.</p>
            ) : (
              <div className="grid gap-ds-inline">
                {split.incomingPending.map((row) => (
                  <div
                    key={row.id}
                    className="flex justify-between items-center bg-ds-surface-strong rounded-ds-md p-[10px_12px]"
                  >
                    <span className="text-[13px] text-ds-text-muted">
                      요청자: {row.requester_id.slice(0, 8)}…
                    </span>
                    <Button
                      size="small"
                      onClick={() => void onAccept(row.id)}
                      className="!bg-ds-accent-soft !text-ds-accent !border-0 !text-[12px] !rounded-ds-sm"
                    >
                      수락
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Outgoing */}
          <div className="bg-ds-surface rounded-ds-lg py-ds-card-y px-ds-card-x grid gap-ds-card-gap">
            <p className="m-0 text-[14px] font-semibold text-ds-text">보낸 요청</p>
            {split.outgoingPending.length === 0 ? (
              <p className="m-0 text-ds-text-faint text-[13px]">보낸 요청이 없어요.</p>
            ) : (
              <div className="grid gap-ds-inline">
                {split.outgoingPending.map((row) => (
                  <div
                    key={row.id}
                    className="flex justify-between items-center bg-ds-surface-strong rounded-ds-md p-[10px_12px]"
                  >
                    <span className="text-[13px] text-ds-text-muted">
                      대상: {row.addressee_id.slice(0, 8)}…
                    </span>
                    <span className="inline-flex items-center h-[22px] rounded-ds-pill px-2 text-[11px] font-medium bg-ds-yellow-soft text-ds-yellow">
                      대기
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Friends list */}
          <div className="bg-ds-surface rounded-ds-lg py-ds-card-y px-ds-card-x grid gap-ds-card-gap">
            <p className="m-0 text-[14px] font-semibold text-ds-text">친구 목록</p>
            {split.accepted.length === 0 ? (
              <p className="m-0 text-ds-text-faint text-[13px]">아직 친구가 없어요.</p>
            ) : (
              <div className="grid gap-ds-inline">
                {split.accepted.map((row) => (
                  <div
                    key={row.id}
                    className="flex items-center gap-ds-card-gap bg-ds-surface-strong rounded-ds-md p-[10px_12px]"
                  >
                    <div className="w-7 h-7 rounded-ds-pill bg-ds-accent-soft shrink-0" />
                    <span className="flex-1 text-[13px] text-ds-text-muted">
                      {(row.requester_id === myUserId ? row.addressee_id : row.requester_id).slice(0, 8)}…
                    </span>
                    <span className="inline-flex items-center h-[22px] rounded-ds-pill px-2 text-[11px] font-medium bg-ds-green-soft text-ds-green">
                      연결됨
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Message */}
          {message ? (
            <p className="m-0 text-[13px] text-ds-accent text-center">{message}</p>
          ) : null}
        </section>
      </PageShell>
    </AuthRequired>
  );
}
