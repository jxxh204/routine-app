export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { createAuthedSupabaseFromBearer, getBearerToken } from '@/app/api/_utils/supabase-auth';
import { dateKeySchema } from '@/lib/validation';

export async function GET(request: Request) {
  const token = getBearerToken(request.headers.get('authorization'));
  if (!token) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  const authed = await createAuthedSupabaseFromBearer(token);
  if (!authed.ok) return NextResponse.json({ ok: false, error: authed.error }, { status: 401 });

  const url = new URL(request.url);
  const dateKey = url.searchParams.get('dateKey');

  const dateKeyParsed = dateKeySchema.safeParse(dateKey);
  if (!dateKeyParsed.success) {
    return NextResponse.json({ ok: false, error: 'bad-request' }, { status: 400 });
  }

  const { data: friendships, error: friendError } = await authed.client
    .from('friendships')
    .select('requester_id, addressee_id')
    .eq('status', 'accepted')
    .or(`requester_id.eq.${authed.userId},addressee_id.eq.${authed.userId}`);

  if (friendError) return NextResponse.json({ ok: false, error: friendError.message }, { status: 500 });
  if (!friendships || friendships.length === 0) return NextResponse.json({ ok: true, data: [] });

  const friendIds = friendships.map((f) => (f.requester_id === authed.userId ? f.addressee_id : f.requester_id));

  // profiles + challenge_logs 를 병렬로 조회 (기존 3회 순차 → 2회 병렬)
  const [profilesRes, logsRes] = await Promise.all([
    authed.client
      .from('profiles')
      .select('user_id, nickname, avatar_url')
      .in('user_id', friendIds),
    authed.client
      .from('challenge_logs')
      .select('user_id, routine_key, done_at, proof_image_path')
      .in('user_id', friendIds)
      .eq('challenge_date', dateKeyParsed.data),
  ]);

  if (profilesRes.error) return NextResponse.json({ ok: false, error: profilesRes.error.message }, { status: 500 });
  if (logsRes.error) return NextResponse.json({ ok: false, error: logsRes.error.message }, { status: 500 });

  const profiles = profilesRes.data ?? [];
  const logs = logsRes.data ?? [];

  const profileMap = new Map(profiles.map((p) => [p.user_id, p]));
  const logsByUser = new Map<string, typeof logs>();

  for (const log of logs) {
    const arr = logsByUser.get(log.user_id) ?? [];
    arr.push(log);
    logsByUser.set(log.user_id, arr);
  }

  const result = friendIds.map((fid) => {
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

  return NextResponse.json({ ok: true, data: result });
}
