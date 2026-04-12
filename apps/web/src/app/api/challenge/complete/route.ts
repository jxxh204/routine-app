export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { createAuthedSupabaseFromBearer, getBearerToken } from '@/app/api/_utils/supabase-auth';
import { getDateKeyInKST, parseIsoDate } from '@/app/api/_utils/date-key';

export async function POST(request: Request) {
  const token = getBearerToken(request.headers.get('authorization'));
  if (!token) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  const authed = await createAuthedSupabaseFromBearer(token);
  if (!authed.ok) return NextResponse.json({ ok: false, error: authed.error }, { status: 401 });

  const body = (await request.json()) as { routineKey?: string; doneAtIso?: string };
  if (!body.routineKey || !body.doneAtIso) {
    return NextResponse.json({ ok: false, error: 'bad-request' }, { status: 400 });
  }

  const doneAt = parseIsoDate(body.doneAtIso);
  if (!doneAt) {
    return NextResponse.json({ ok: false, error: 'invalid-doneAtIso' }, { status: 400 });
  }

  const challengeDate = getDateKeyInKST(doneAt);

  const { data, error } = await authed.client
    .from('challenge_logs')
    .upsert(
      {
        user_id: authed.userId,
        challenge_date: challengeDate,
        routine_key: body.routineKey,
        done_at: doneAt.toISOString(),
      },
      {
        onConflict: 'user_id,challenge_date,routine_key',
      },
    )
    .select('challenge_date, routine_key, done_at')
    .single();

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json(
    { ok: true, data },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}
