import { NextResponse } from 'next/server';
import { createAuthedSupabaseFromBearer, getBearerToken } from '@/app/api/_utils/supabase-auth';

export async function GET(request: Request) {
  const token = getBearerToken(request.headers.get('authorization'));
  if (!token) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  const authed = await createAuthedSupabaseFromBearer(token);
  if (!authed.ok) return NextResponse.json({ ok: false, error: authed.error }, { status: 401 });

  const url = new URL(request.url);
  const dateKey = url.searchParams.get('dateKey');
  if (!dateKey) return NextResponse.json({ ok: false, error: 'bad-request' }, { status: 400 });

  const { data: friendships, error: friendError } = await authed.client
    .from('friendships')
    .select('requester_id, addressee_id')
    .eq('status', 'accepted')
    .or(`requester_id.eq.${authed.userId},addressee_id.eq.${authed.userId}`);

  if (friendError) return NextResponse.json({ ok: false, error: friendError.message }, { status: 500 });
  if (!friendships || friendships.length === 0) return NextResponse.json({ ok: true, data: [] });

  const friendIds = friendships.map((f) => (f.requester_id === authed.userId ? f.addressee_id : f.requester_id));

  const { data: profiles, error: profileError } = await authed.client
    .from('profiles')
    .select('user_id, nickname, avatar_url')
    .in('user_id', friendIds);

  if (profileError) return NextResponse.json({ ok: false, error: profileError.message }, { status: 500 });

  const { data: logs, error: logError } = await authed.client
    .from('challenge_logs')
    .select('user_id, routine_key, done_at, proof_image_path')
    .in('user_id', friendIds)
    .eq('challenge_date', dateKey);

  if (logError) return NextResponse.json({ ok: false, error: logError.message }, { status: 500 });

  const profileMap = new Map((profiles ?? []).map((p) => [p.user_id, p]));
  const logsByUser = new Map<string, typeof logs>();

  for (const log of logs ?? []) {
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
