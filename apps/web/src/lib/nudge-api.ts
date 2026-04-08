import { supabase } from '@/lib/supabase';
import { canSendNudge, buildDedupeKey, type NudgeContext } from './nudge-engine';

export type NudgeSendResult =
  | { ok: true; eventId: string }
  | { ok: false; error: string };

/**
 * 독려를 보낸다: 판정 → push_events 기록
 * (실제 APNs/FCM 발송은 서버 함수에서 처리 — 이번 PR은 이벤트 기록까지)
 */
export async function sendNudge(
  targetId: string,
  routineKey: string,
): Promise<NudgeSendResult> {
  if (!supabase) return { ok: false, error: 'supabase-client-unavailable' };

  const { data: userData } = await supabase.auth.getUser();
  const senderId = userData.user?.id;
  if (!senderId) return { ok: false, error: 'unauthorized' };

  const today = new Date();
  const dateKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const currentHour = today.getHours();

  // 1. friendship 확인
  const { data: friendship } = await supabase
    .from('friendships')
    .select('status')
    .or(`and(requester_id.eq.${senderId},addressee_id.eq.${targetId}),and(requester_id.eq.${targetId},addressee_id.eq.${senderId})`)
    .maybeSingle();

  // 2. sender의 해당 루틴 완료 여부
  const { data: senderLog } = await supabase
    .from('challenge_logs')
    .select('routine_key')
    .eq('user_id', senderId)
    .eq('challenge_date', dateKey)
    .eq('routine_key', routineKey)
    .maybeSingle();

  // 3. target의 해당 루틴 완료 여부
  const { data: targetLog } = await supabase
    .from('challenge_logs')
    .select('routine_key')
    .eq('user_id', targetId)
    .eq('challenge_date', dateKey)
    .eq('routine_key', routineKey)
    .maybeSingle();

  // 4. target push 설정
  const { data: pushPrefs } = await supabase
    .from('user_push_prefs')
    .select('nudge_mode, quiet_hours_start, quiet_hours_end')
    .eq('user_id', targetId)
    .maybeSingle();

  // 5. dedupe 확인
  const dedupeKey = buildDedupeKey(dateKey, senderId, targetId, routineKey);
  const { data: existingEvent } = await supabase
    .from('push_events')
    .select('id')
    .eq('dedupe_key', dedupeKey)
    .maybeSingle();

  // 6. 판정
  const ctx: NudgeContext = {
    senderId,
    targetId,
    routineKey,
    date: dateKey,
    senderDoneThisRoutine: Boolean(senderLog),
    targetDoneThisRoutine: Boolean(targetLog),
    friendshipStatus: (friendship?.status as NudgeContext['friendshipStatus']) ?? 'pending',
    targetNudgeMode: (pushPrefs?.nudge_mode as NudgeContext['targetNudgeMode']) ?? 'once',
    targetQuietHoursStart: pushPrefs?.quiet_hours_start ?? 23,
    targetQuietHoursEnd: pushPrefs?.quiet_hours_end ?? 8,
    currentHour,
    existingDedupeKey: existingEvent?.id ?? null,
  };

  const result = canSendNudge(ctx);
  if (!result.allowed) {
    return { ok: false, error: result.reason };
  }

  // 7. push_events 기록
  const { data: inserted, error: insertError } = await supabase
    .from('push_events')
    .insert({
      event_date: dateKey,
      sender_user_id: senderId,
      target_user_id: targetId,
      routine_key: routineKey,
      event_type: 'nudge_once',
      dedupe_key: dedupeKey,
    })
    .select('id')
    .single();

  if (insertError) return { ok: false, error: insertError.message };

  return { ok: true, eventId: inserted.id };
}
