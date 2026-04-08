'use client';

import { useEffect, useState } from 'react';
import { getFriendChallengeHistory, type FriendChallengeStatus } from '@/lib/friend-challenge';
import { supabase } from '@/lib/supabase';

const ROUTINE_LABELS: Record<string, string> = {
  wake: '기상',
  lunch: '식사',
  sleep: '취침',
};

function formatTime(doneAt: string | null): string {
  if (!doneAt) return '';
  const d = new Date(doneAt);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

type Props = {
  dateKey: string | null;
};

export function FriendCalendarDetail({ dateKey }: Props) {
  const [friends, setFriends] = useState<FriendChallengeStatus[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!dateKey || !supabase) {
        setFriends([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      const result = await getFriendChallengeHistory(dateKey);
      if (!cancelled) {
        if (result.ok) setFriends(result.data);
        setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [dateKey]);

  if (!dateKey || loading) return null;
  if (friends.length === 0) return null;

  // 인증 기록이 있는 친구만 표시
  const friendsWithLogs = friends.filter((f) => f.routines.length > 0);
  if (friendsWithLogs.length === 0) return null;

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#555', marginBottom: 8 }}>
        👥 친구 인증
      </div>
      {friendsWithLogs.map((friend) => (
        <div
          key={friend.userId}
          style={{
            marginBottom: 10,
            padding: '8px 10px',
            background: '#fafafa',
            borderRadius: 8,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
            {friend.nickname}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {friend.routines.map((r) => (
              <div
                key={r.routineKey}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 11,
                  color: '#389e0d',
                }}
              >
                {r.proofImagePath && (
                  <ProofThumb path={r.proofImagePath} />
                )}
                <span>✓ {ROUTINE_LABELS[r.routineKey] ?? r.routineKey}</span>
                {r.doneAt && (
                  <span style={{ color: '#999', fontSize: 10 }}>{formatTime(r.doneAt)}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ProofThumb({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase || !path) return;

    supabase.storage
      .from('proof-images')
      .createSignedUrl(path, 300)
      .then(({ data }) => {
        if (data?.signedUrl) setUrl(data.signedUrl);
      });
  }, [path]);

  if (!url) return null;

  return (
    <img
      src={url}
      alt="인증"
      style={{
        width: 20,
        height: 20,
        borderRadius: 4,
        objectFit: 'cover',
      }}
    />
  );
}
