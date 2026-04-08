/**
 * 독려(nudge) 발송 판정 엔진
 *
 * 설계서 §4.2 기준:
 * 1. sender가 해당 루틴 완료인가?
 * 2. target이 동일 date/routine 미완료인가?
 * 3. sender-target이 accepted인가?
 * 4. target 설정이 off가 아닌가?
 * 5. 현재 시각이 target quiet hours 밖인가?
 * 6. dedupe_key 미존재인가?
 */

export type NudgeContext = {
  senderId: string;
  targetId: string;
  routineKey: string;
  date: string;
  senderDoneThisRoutine: boolean;
  targetDoneThisRoutine: boolean;
  friendshipStatus: 'pending' | 'accepted' | 'blocked';
  targetNudgeMode: 'off' | 'once' | 'twice';
  targetQuietHoursStart: number; // 0-23
  targetQuietHoursEnd: number;   // 0-23
  currentHour: number;           // 0-23
  existingDedupeKey: string | null;
};

export type NudgeResult =
  | { allowed: true }
  | { allowed: false; reason: string };

function isInQuietHours(start: number, end: number, current: number): boolean {
  if (start === end) return false;

  // Overnight range (e.g., 23~8)
  if (start > end) {
    return current >= start || current < end;
  }

  // Same-day range (e.g., 13~15)
  return current >= start && current < end;
}

export function canSendNudge(ctx: NudgeContext): NudgeResult {
  if (!ctx.senderDoneThisRoutine) {
    return { allowed: false, reason: 'sender-not-done' };
  }

  if (ctx.targetDoneThisRoutine) {
    return { allowed: false, reason: 'target-already-done' };
  }

  if (ctx.friendshipStatus !== 'accepted') {
    return { allowed: false, reason: 'not-friends' };
  }

  if (ctx.targetNudgeMode === 'off') {
    return { allowed: false, reason: 'nudge-disabled' };
  }

  if (isInQuietHours(ctx.targetQuietHoursStart, ctx.targetQuietHoursEnd, ctx.currentHour)) {
    return { allowed: false, reason: 'quiet-hours' };
  }

  if (ctx.existingDedupeKey) {
    return { allowed: false, reason: 'already-sent' };
  }

  return { allowed: true };
}

/**
 * dedupe key 생성: {date}:{sender}:{target}:{routine}:{eventType}
 */
export function buildDedupeKey(
  date: string,
  senderId: string,
  targetId: string,
  routineKey: string,
  eventType: 'nudge_once' | 'nudge_lastcall' = 'nudge_once',
): string {
  return `${date}:${senderId}:${targetId}:${routineKey}:${eventType}`;
}
