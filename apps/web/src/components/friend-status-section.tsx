'use client';

import { useEffect, useState } from 'react';
import { Card } from 'antd';
import { getFriendChallengeStatuses, type FriendChallengeStatus } from '@/lib/friend-challenge';
import { supabase } from '@/lib/supabase';

const ROUTINE_LABELS: Record<string, string> = {
  wake: '기상',
  lunch: '식사',
  sleep: '취침',
};

function formatDoneTime(doneAt: string | null): string {
  if (!doneAt) return '';
  const d = new Date(doneAt);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function getTodayDateKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

type Props = {
  /** 조회할 루틴 키 목록 (기본 루틴) */
  routineKeys?: string[];
};

export function FriendStatusSection({ routineKeys = ['wake', 'lunch', 'sleep'] }: Props) {
  const [friends, setFriends] = useState<FriendChallengeStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!supabase) {
        setLoggedIn(false);
        setLoading(false);
        return;
      }

      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        setLoggedIn(false);
        setLoading(false);
        return;
      }

      setLoggedIn(true);
      const result = await getFriendChallengeStatuses(getTodayDateKey());
      if (!cancelled && result.ok) {
        setFriends(result.data);
      }
      if (!cancelled) setLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, []);

  // 비로그인 또는 로딩 중이면 표시 안 함
  if (loggedIn === false || loading) return null;
  if (friends.length === 0) return null;

  return (
    <div style={{ marginTop: 20 }}>
      <h3 style={{ fontSize: 15, fontWeight: 600, color: '#555', marginBottom: 10, paddingLeft: 4 }}>
        👥 친구 현황
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {friends.map((friend) => {
          const doneKeys = new Set(friend.routines.map((r) => r.routineKey));
          const doneCount = routineKeys.filter((k) => doneKeys.has(k)).length;

          return (
            <Card
              key={friend.userId}
              size="small"
              style={{
                borderRadius: 12,
                border: '1px solid #f0f0f0',
                boxShadow: 'none',
              }}
              styles={{ body: { padding: '9px 12px' } }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {/* 아바타 */}
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: '#e8e8e8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 14,
                    flexShrink: 0,
                    overflow: 'hidden',
                  }}
                >
                  {friend.avatarUrl ? (
                    <img src={friend.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    '👤'
                  )}
                </div>

                {/* 닉네임 + 진행률 */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 2 }}>
                    {friend.nickname}
                    <span style={{ fontSize: 11, color: '#999', fontWeight: 400, marginLeft: 6 }}>
                      {doneCount}/{routineKeys.length}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {routineKeys.map((key) => {
                      const routine = friend.routines.find((r) => r.routineKey === key);
                      const done = Boolean(routine);
                      const label = ROUTINE_LABELS[key] ?? key;
                      const time = routine ? formatDoneTime(routine.doneAt) : '';

                      return (
                        <span
                          key={key}
                          style={{
                            fontSize: 11,
                            padding: '1px 6px',
                            borderRadius: 6,
                            background: done ? '#e6f7e6' : '#f5f5f5',
                            color: done ? '#389e0d' : '#bbb',
                          }}
                        >
                          {done ? '✓' : '○'} {label}
                          {time && <span style={{ marginLeft: 2, fontSize: 10, color: '#999' }}>{time}</span>}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
