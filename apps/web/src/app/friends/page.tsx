"use client";

import { useEffect, useMemo, useState, type CSSProperties } from 'react';

import { AuthRequired } from '@/components/auth-required';
import { GhostButton, PageShell, PrimaryButton } from '@/components/ui';
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

  // ✅ Simplified: useEffect already runs after paint, setTimeout(0) was redundant
  useEffect(() => {
    void refresh();
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
        <section style={styles.page}>
          {/* Header */}
          <div>
            <p style={styles.eyebrow}>SOCIAL</p>
            <h1 style={styles.title}>친구 관리</h1>
            <p style={styles.desc}>친구 코드를 입력해 요청을 보내고, 받은 요청을 수락하세요.</p>
          </div>

          {/* My code */}
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <p style={styles.cardTitle}>내 친구 코드</p>
            </div>
            <span style={styles.codeDisplay}>{myFriendCode || '생성 중...'}</span>
          </div>

          {/* Send request */}
          <div style={styles.card}>
            <p style={styles.cardTitle}>친구 코드로 요청 보내기</p>
            <div style={styles.inputRow}>
              <input
                className="routine-title-input"
                value={friendCode}
                onChange={(e) => setFriendCode(e.target.value)}
                placeholder="예: AB12CD"
                style={styles.input}
              />
              <PrimaryButton
                onClick={() => void onSend()}
                disabled={!canSubmit || loading}
                style={styles.sendBtn}
              >
                요청
              </PrimaryButton>
            </div>
          </div>

          {/* Incoming */}
          <div style={styles.card}>
            <p style={styles.cardTitle}>받은 요청</p>
            {split.incomingPending.length === 0 ? (
              <p style={styles.emptyText}>받은 요청이 없어요.</p>
            ) : (
              <div style={styles.listWrap}>
                {split.incomingPending.map((row) => (
                  <div key={row.id} style={styles.requestItem}>
                    <span style={styles.requestLabel}>요청자: {row.requester_id.slice(0, 8)}…</span>
                    <GhostButton onClick={() => void onAccept(row.id)} style={styles.acceptBtn}>수락</GhostButton>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Outgoing */}
          <div style={styles.card}>
            <p style={styles.cardTitle}>보낸 요청</p>
            {split.outgoingPending.length === 0 ? (
              <p style={styles.emptyText}>보낸 요청이 없어요.</p>
            ) : (
              <div style={styles.listWrap}>
                {split.outgoingPending.map((row) => (
                  <div key={row.id} style={styles.requestItem}>
                    <span style={styles.requestLabel}>대상: {row.addressee_id.slice(0, 8)}…</span>
                    <span style={styles.pendingBadge}>대기</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Friends list */}
          <div style={styles.card}>
            <p style={styles.cardTitle}>친구 목록</p>
            {split.accepted.length === 0 ? (
              <p style={styles.emptyText}>아직 친구가 없어요.</p>
            ) : (
              <div style={styles.listWrap}>
                {split.accepted.map((row) => (
                  <div key={row.id} style={styles.friendItem}>
                    <div style={styles.friendAvatar} />
                    <span style={styles.friendId}>
                      {(row.requester_id === myUserId ? row.addressee_id : row.requester_id).slice(0, 8)}…
                    </span>
                    <span style={styles.friendBadge}>연결됨</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Message */}
          {message ? <p style={styles.messageText}>{message}</p> : null}
        </section>
      </PageShell>
    </AuthRequired>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    display: 'grid',
    gap: 12,
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
  desc: {
    margin: '4px 0 0',
    fontSize: 13,
    color: 'var(--ds-color-text-muted)',
  },
  card: {
    background: 'var(--ds-color-surface)',
    borderRadius: 'var(--ds-radius-lg)',
    padding: '14px 16px',
    display: 'grid',
    gap: 10,
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    margin: 0,
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--ds-color-text)',
  },
  codeDisplay: {
    fontSize: 22,
    fontWeight: 700,
    letterSpacing: '0.12em',
    color: 'var(--ds-color-accent)',
  },
  inputRow: {
    display: 'flex',
    gap: 8,
  },
  input: {
    flex: 1,
    height: 40,
    borderRadius: 'var(--ds-radius-sm)',
    border: '1px solid var(--ds-color-border-strong)',
    background: 'var(--ds-color-bg)',
    color: 'var(--ds-color-text)',
    padding: '0 12px',
    fontSize: 14,
    boxSizing: 'border-box' as const,
  },
  sendBtn: {
    flexShrink: 0,
    padding: '0 16px',
    height: 40,
  },
  emptyText: {
    margin: 0,
    color: 'var(--ds-color-text-faint)',
    fontSize: 13,
  },
  listWrap: {
    display: 'grid',
    gap: 6,
  },
  requestItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    background: 'var(--ds-color-surface-strong)',
    borderRadius: 'var(--ds-radius-md)',
    padding: '10px 12px',
  },
  requestLabel: {
    fontSize: 13,
    color: 'var(--ds-color-text-muted)',
  },
  acceptBtn: {
    fontSize: 12,
    padding: '5px 10px',
    background: 'var(--ds-color-accent-soft)',
    color: 'var(--ds-color-accent)',
    borderRadius: 'var(--ds-radius-sm)',
  },
  pendingBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    height: 22,
    borderRadius: 'var(--ds-radius-pill)',
    padding: '0 8px',
    fontSize: 11,
    fontWeight: 500,
    background: 'var(--ds-color-yellow-soft)',
    color: 'var(--ds-color-yellow)',
  },
  friendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    background: 'var(--ds-color-surface-strong)',
    borderRadius: 'var(--ds-radius-md)',
    padding: '10px 12px',
  },
  friendAvatar: {
    width: 28,
    height: 28,
    borderRadius: 'var(--ds-radius-pill)',
    background: 'var(--ds-color-accent-soft)',
    flexShrink: 0,
  },
  friendId: {
    flex: 1,
    fontSize: 13,
    color: 'var(--ds-color-text-muted)',
  },
  friendBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    height: 22,
    borderRadius: 'var(--ds-radius-pill)',
    padding: '0 8px',
    fontSize: 11,
    fontWeight: 500,
    background: 'var(--ds-color-green-soft)',
    color: 'var(--ds-color-green)',
  },
  messageText: {
    margin: 0,
    fontSize: 13,
    color: 'var(--ds-color-accent)',
    textAlign: 'center',
  },
};
