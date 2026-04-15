import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { canSendNudge, buildDedupeKey, type NudgeContext } from '@/lib/nudge-engine';
import { buildNudgePayload, sendPush, type PushTarget } from '@/lib/push-sender';
import { nudgeBodySchema } from '@/lib/validation';
import { getServerEnv } from '@/lib/env';

/**
 * POST /api/nudge
 * Body: { targetId, routineKey }
 * Auth: Bearer token (Supabase access token)
 *
 * 서버 사이드 독려 발송:
 * 1. 판정 (nudge-engine)
 * 2. push_events 기록
 * 3. push_tokens 조회 → 발송
 */
export const runtime = 'edge';

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  let supabaseServiceKey: string;
  try {
    supabaseServiceKey = getServerEnv().SUPABASE_SERVICE_ROLE_KEY;
  } catch {
    return NextResponse.json({ ok: false, error: 'server-config-missing' }, { status: 500 });
  }

  if (!supabaseUrl) {
    return NextResponse.json({ ok: false, error: 'server-config-missing' }, { status: 500 });
  }

  // Auth
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const accessToken = authHeader.slice(7);
  const userClient = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '', {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: userData } = await userClient.auth.getUser();
  const senderId = userData.user?.id;
  if (!senderId) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  // Body validation with Zod
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid-body' }, { status: 400 });
  }

  const parsed = nudgeBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'bad-request', details: parsed.error.issues }, { status: 400 });
  }

  const { targetId, routineKey } = parsed.data;

  // Service client for privileged queries
  const admin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const today = new Date();
  const dateKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const currentHour = today.getHours();

  // Gather context
  const [friendshipRes, senderLogRes, targetLogRes, pushPrefsRes, dedupeRes] = await Promise.all([
    admin.from('friendships').select('status')
      .or(`and(requester_id.eq.${senderId},addressee_id.eq.${targetId}),and(requester_id.eq.${targetId},addressee_id.eq.${senderId})`)
      .eq('status', 'accepted').maybeSingle(),
    admin.from('challenge_logs').select('routine_key')
      .eq('user_id', senderId).eq('challenge_date', dateKey).eq('routine_key', routineKey).maybeSingle(),
    admin.from('challenge_logs').select('routine_key')
      .eq('user_id', targetId).eq('challenge_date', dateKey).eq('routine_key', routineKey).maybeSingle(),
    admin.from('user_push_prefs').select('nudge_mode, quiet_hours_start, quiet_hours_end')
      .eq('user_id', targetId).maybeSingle(),
    admin.from('push_events').select('id')
      .eq('dedupe_key', buildDedupeKey(dateKey, senderId, targetId, routineKey)).maybeSingle(),
  ]);

  const ctx: NudgeContext = {
    senderId,
    targetId,
    routineKey,
    date: dateKey,
    senderDoneThisRoutine: Boolean(senderLogRes.data),
    targetDoneThisRoutine: Boolean(targetLogRes.data),
    friendshipStatus: (friendshipRes.data?.status as NudgeContext['friendshipStatus']) ?? 'pending',
    targetNudgeMode: (pushPrefsRes.data?.nudge_mode as NudgeContext['targetNudgeMode']) ?? 'once',
    targetQuietHoursStart: pushPrefsRes.data?.quiet_hours_start ?? 23,
    targetQuietHoursEnd: pushPrefsRes.data?.quiet_hours_end ?? 8,
    currentHour,
    existingDedupeKey: dedupeRes.data?.id ?? null,
  };

  const result = canSendNudge(ctx);
  if (!result.allowed) {
    return NextResponse.json({ ok: false, error: result.reason }, { status: 422 });
  }

  // Record event
  const dedupeKey = buildDedupeKey(dateKey, senderId, targetId, routineKey);
  const { data: event, error: insertError } = await admin.from('push_events').insert({
    event_date: dateKey,
    sender_user_id: senderId,
    target_user_id: targetId,
    routine_key: routineKey,
    event_type: 'nudge_once',
    dedupe_key: dedupeKey,
  }).select('id').single();

  if (insertError) {
    return NextResponse.json({ ok: false, error: insertError.message }, { status: 500 });
  }

  // Get sender nickname for push payload
  const { data: senderProfile } = await admin.from('profiles').select('nickname').eq('user_id', senderId).maybeSingle();
  const senderNickname = senderProfile?.nickname ?? '친구';

  // Get target's push tokens
  const { data: tokens } = await admin.from('push_tokens').select('provider, device_token, platform')
    .eq('user_id', targetId).eq('enabled', true);

  const pushPayload = buildNudgePayload(senderNickname, routineKey);
  const pushResults: Array<{ token: string; result: Awaited<ReturnType<typeof sendPush>> }> = [];

  if (tokens && tokens.length > 0) {
    const pushPromises = tokens.map(async (token) => {
      const target: PushTarget = {
        provider: token.provider as 'apns' | 'fcm',
        deviceToken: token.device_token,
        platform: token.platform as 'ios' | 'android',
      };
      const pushResult = await sendPush(target, pushPayload);
      return { token: token.device_token.slice(0, 8) + '...', result: pushResult };
    });
    pushResults.push(...await Promise.all(pushPromises));
  }

  return NextResponse.json({
    ok: true,
    eventId: event.id,
    pushSent: pushResults.length,
    pushResults,
  });
}
