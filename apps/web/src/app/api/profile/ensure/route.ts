export const runtime = 'edge';

import { NextResponse } from 'next/server';
import { createAuthedSupabaseFromBearer, getBearerToken } from '@/app/api/_utils/supabase-auth';

function makeFriendCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const randomBytes = new Uint8Array(6);
  crypto.getRandomValues(randomBytes);
  let out = '';
  for (let i = 0; i < 6; i += 1) out += chars[randomBytes[i] % chars.length];
  return out;
}

export async function POST(request: Request) {
  const token = getBearerToken(request.headers.get('authorization'));
  if (!token) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  const authed = await createAuthedSupabaseFromBearer(token);
  if (!authed.ok) return NextResponse.json({ ok: false, error: authed.error }, { status: 401 });

  const user = (await authed.client.auth.getUser(token)).data.user;
  if (!user) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  const { data: existing, error: readError } = await authed.client
    .from('profiles')
    .select('user_id, friend_code')
    .eq('user_id', authed.userId)
    .maybeSingle();

  if (readError) return NextResponse.json({ ok: false, error: readError.message }, { status: 500 });
  if (existing?.user_id) return NextResponse.json({ ok: true, friendCode: existing.friend_code });

  const nickname = (user.user_metadata?.nickname as string | undefined)
    ?? (user.user_metadata?.name as string | undefined)
    ?? (user.email ? user.email.split('@')[0] : '루틴유저');

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const friendCode = makeFriendCode();
    const { error: insertError } = await authed.client.from('profiles').insert({
      user_id: authed.userId,
      nickname,
      friend_code: friendCode,
    });

    if (!insertError) return NextResponse.json({ ok: true, friendCode });
    if (!insertError.message.toLowerCase().includes('duplicate')) {
      return NextResponse.json({ ok: false, error: insertError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: false, error: 'friend-code-generation-failed' }, { status: 500 });
}
