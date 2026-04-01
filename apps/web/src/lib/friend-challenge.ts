import { supabase } from '@/lib/supabase';

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
  if (!supabase) return { ok: false, error: 'supabase-client-unavailable' };

  const { data: userData } = await supabase.auth.getUser();
  const uid = userData.user?.id;
  if (!uid) return { ok: false, error: 'unauthorized' };

  // 1. accepted 친구 목록 조회
  const { data: friendships, error: friendError } = await supabase
    .from('friendships')
    .select('requester_id, addressee_id')
    .eq('status', 'accepted')
    .or(`requester_id.eq.${uid},addressee_id.eq.${uid}`);

  if (friendError) return { ok: false, error: friendError.message };
  if (!friendships || friendships.length === 0) return { ok: true, data: [] };

  const friendIds = friendships.map((f) =>
    f.requester_id === uid ? f.addressee_id : f.requester_id,
  );

  // 2. 친구 프로필 조회
  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('user_id, nickname, avatar_url')
    .in('user_id', friendIds);

  if (profileError) return { ok: false, error: profileError.message };

  // 3. 친구들의 오늘 challenge_logs 조회
  const { data: logs, error: logError } = await supabase
    .from('challenge_logs')
    .select('user_id, routine_key, done_at, proof_image_path')
    .in('user_id', friendIds)
    .eq('challenge_date', dateKey);

  if (logError) return { ok: false, error: logError.message };

  // 4. 조합
  const profileMap = new Map(
    (profiles ?? []).map((p) => [p.user_id, p]),
  );

  const logsByUser = new Map<string, typeof logs>();
  for (const log of logs ?? []) {
    const arr = logsByUser.get(log.user_id) ?? [];
    arr.push(log);
    logsByUser.set(log.user_id, arr);
  }

  const result: FriendChallengeStatus[] = friendIds.map((fid) => {
    const profile = profileMap.get(fid);
    const userLogs = logsByUser.get(fid) ?? [];
    return {
      userId: fid,
      nickname: profile?.nickname ?? '알 수 없음',
      avatarUrl: profile?.avatar_url ?? null,
      routines: userLogs.map((l) => ({
        routineKey: l.routine_key,
        doneAt: l.done_at,
        proofImagePath: l.proof_image_path,
      })),
    };
  });

  return { ok: true, data: result };
}

/**
 * 특정 날짜의 친구 인증 내역 조회 (캘린더용)
 */
export async function getFriendChallengeHistory(
  dateKey: string,
): Promise<{ ok: true; data: FriendChallengeStatus[] } | { ok: false; error: string }> {
  return getFriendChallengeStatuses(dateKey);
}
