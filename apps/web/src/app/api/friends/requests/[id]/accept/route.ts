import { NextResponse } from 'next/server';
import { createAuthedSupabaseFromBearer, getBearerToken } from '@/app/api/_utils/supabase-auth';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const token = getBearerToken(request.headers.get('authorization'));
  if (!token) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  const authed = await createAuthedSupabaseFromBearer(token);
  if (!authed.ok) return NextResponse.json({ ok: false, error: authed.error }, { status: 401 });

  const { id } = await params;

  const { error } = await authed.client
    .from('friendships')
    .update({ status: 'accepted', accepted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'pending')
    .eq('addressee_id', authed.userId);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
