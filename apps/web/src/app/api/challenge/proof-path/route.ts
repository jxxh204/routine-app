import { NextResponse } from 'next/server';
import { createAuthedSupabaseFromBearer, getBearerToken } from '@/app/api/_utils/supabase-auth';

export async function POST(request: Request) {
  const token = getBearerToken(request.headers.get('authorization'));
  if (!token) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  const authed = await createAuthedSupabaseFromBearer(token);
  if (!authed.ok) return NextResponse.json({ ok: false, error: authed.error }, { status: 401 });

  const body = (await request.json()) as { dateKey?: string; routineKey?: string; proofImagePath?: string };
  if (!body.dateKey || !body.routineKey || !body.proofImagePath) {
    return NextResponse.json({ ok: false, error: 'bad-request' }, { status: 400 });
  }

  const { error } = await authed.client
    .from('challenge_logs')
    .update({ proof_image_path: body.proofImagePath })
    .eq('user_id', authed.userId)
    .eq('challenge_date', body.dateKey)
    .eq('routine_key', body.routineKey);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
