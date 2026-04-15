export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { createAuthedSupabaseFromBearer, getBearerToken } from '@/app/api/_utils/supabase-auth';
import { friendRequestBodySchema } from '@/lib/validation';

export async function GET(request: Request) {
  const token = getBearerToken(request.headers.get('authorization'));
  if (!token) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  const authed = await createAuthedSupabaseFromBearer(token);
  if (!authed.ok) return NextResponse.json({ ok: false, error: authed.error }, { status: 401 });

  const { data, error } = await authed.client
    .from('friendships')
    .select('*')
    .or(`requester_id.eq.${authed.userId},addressee_id.eq.${authed.userId}`)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, me: authed.userId, data: data ?? [] });
}

export async function POST(request: Request) {
  const token = getBearerToken(request.headers.get('authorization'));
  if (!token) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  const authed = await createAuthedSupabaseFromBearer(token);
  if (!authed.ok) return NextResponse.json({ ok: false, error: authed.error }, { status: 401 });

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid-json' }, { status: 400 });
  }

  const parsed = friendRequestBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'bad-request', details: parsed.error.issues }, { status: 400 });
  }

  const { friendCode } = parsed.data;

  const { data: target, error: profileError } = await authed.client
    .from('profiles')
    .select('user_id')
    .eq('friend_code', friendCode)
    .maybeSingle();

  if (profileError) return NextResponse.json({ ok: false, error: profileError.message }, { status: 500 });
  if (!target?.user_id) return NextResponse.json({ ok: false, error: 'friend-not-found' }, { status: 404 });
  if (target.user_id === authed.userId) return NextResponse.json({ ok: false, error: 'cannot-add-self' }, { status: 400 });

  const { error } = await authed.client.from('friendships').insert({
    requester_id: authed.userId,
    addressee_id: target.user_id,
    status: 'pending',
  });

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
