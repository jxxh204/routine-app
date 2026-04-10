import { getAccessToken } from '@/lib/client-auth';

export type FriendChallengeStatus = {
  userId: string;
  nickname: string;
  avatarUrl: string | null;
  routines: Array<{
    routineKey: string;
    doneAt: string | null;
    proofImagePath: string | null;
  }>;
};

/**
 * 오늘 날짜의 accepted 친구들의 인증 현황을 조회한다.
 * blocked 친구는 제외.
 */
export async function getFriendChallengeStatuses(
  dateKey: string,
): Promise<{ ok: true; data: FriendChallengeStatus[] } | { ok: false; error: string }> {
  const token = await getAccessToken();
  if (!token) return { ok: false, error: 'unauthorized' };

  const response = await fetch(`/api/challenge/friends?dateKey=${dateKey}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) return { ok: false, error: `http-${response.status}` };

  const payload = (await response.json()) as {
    ok: boolean;
    data?: FriendChallengeStatus[];
    error?: string;
  };

  if (!payload.ok) return { ok: false, error: payload.error ?? 'unknown' };
  return { ok: true, data: payload.data ?? [] };
}

/**
 * 특정 날짜의 친구 인증 내역 조회 (캘린더용)
 */
export async function getFriendChallengeHistory(
  dateKey: string,
): Promise<{ ok: true; data: FriendChallengeStatus[] } | { ok: false; error: string }> {
  return getFriendChallengeStatuses(dateKey);
}
