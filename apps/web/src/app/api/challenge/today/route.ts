import { NextResponse } from 'next/server';
import { createAuthedSupabaseFromBearer, getBearerToken } from '@/app/api/_utils/supabase-auth';

function getTodayDateKey() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export async function GET(request: Request) {
  const token = getBearerToken(request.headers.get('authorization'));
  if (!token) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  const buddyUserId = request.headers.get('x-buddy-user-id') || null;

  const authed = await createAuthedSupabaseFromBearer(token);
  if (!authed.ok) return NextResponse.json({ ok: false, error: authed.error }, { status: 401 });

  const dateKey = getTodayDateKey();

  const { data: myRows, error: myError } = await authed.client
    .from('challenge_logs')
    .select('routine_key, done_at, proof_image_path')
    .eq('user_id', authed.userId)
    .eq('challenge_date', dateKey);

  if (myError) return NextResponse.json({ ok: false, error: myError.message }, { status: 500 });

  let buddyRows: Array<{ routine_key: string }> = [];
  if (buddyUserId) {
    const { data, error } = await authed.client
      .from('challenge_logs')
      .select('routine_key')
      .eq('user_id', buddyUserId)
      .eq('challenge_date', dateKey);

    if (!error && data) buddyRows = data;
  }

  return NextResponse.json({ ok: true, data: { myRows: myRows ?? [], buddyRows } });
}
