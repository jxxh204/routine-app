/**
 * 친구 연동 통합 회귀 테스트
 * 설계서 §8-6: 전체 플로우 검증
 */
import { describe, it, expect } from 'vitest';

// --- friends.ts 단위 ---
import { splitFriendRequests, type FriendRequestRow } from './friends';

// --- nudge-engine.ts 단위 ---
import { canSendNudge, buildDedupeKey, type NudgeContext } from './nudge-engine';

// --- calendar-history.ts 단위 ---
import { parseHistoryEntries, toDateKey } from './calendar-history';

describe('친구 연동 통합 회귀', () => {
  describe('친구 요청 → 수락 → 상태 분류', () => {
    const rows: FriendRequestRow[] = [
      { id: '1', requester_id: 'me', addressee_id: 'friend-a', status: 'accepted', created_at: '2026-04-01' },
      { id: '2', requester_id: 'friend-b', addressee_id: 'me', status: 'pending', created_at: '2026-04-01' },
      { id: '3', requester_id: 'me', addressee_id: 'friend-c', status: 'blocked', created_at: '2026-04-01' },
    ];

    it('accepted 친구만 accepted에 포함', () => {
      const result = splitFriendRequests(rows, 'me');
      expect(result.accepted).toHaveLength(1);
      expect(result.accepted[0].addressee_id).toBe('friend-a');
    });

    it('pending 받은 요청 분류', () => {
      const result = splitFriendRequests(rows, 'me');
      expect(result.incomingPending).toHaveLength(1);
      expect(result.incomingPending[0].requester_id).toBe('friend-b');
    });

    it('blocked는 어떤 카테고리에도 포함되지 않음', () => {
      const result = splitFriendRequests(rows, 'me');
      const allIds = [...result.accepted, ...result.incomingPending, ...result.outgoingPending].map((r) => r.id);
      expect(allIds).not.toContain('3');
    });
  });

  describe('독려 전체 플로우', () => {
    function baseCtx(): NudgeContext {
      return {
        senderId: 'user-a',
        targetId: 'user-b',
        routineKey: 'wake',
        date: '2026-04-01',
        senderDoneThisRoutine: true,
        targetDoneThisRoutine: false,
        friendshipStatus: 'accepted',
        targetNudgeMode: 'once',
        targetQuietHoursStart: 23,
        targetQuietHoursEnd: 8,
        currentHour: 10,
        existingDedupeKey: null,
      };
    }

    it('정상 플로우: 내가 완료 → 친구 미완료 → 독려 허용', () => {
      expect(canSendNudge(baseCtx()).allowed).toBe(true);
    });

    it('독려 후 dedupe로 중복 차단', () => {
      const key = buildDedupeKey('2026-04-01', 'user-a', 'user-b', 'wake');
      const ctx = { ...baseCtx(), existingDedupeKey: key };
      expect(canSendNudge(ctx)).toEqual({ allowed: false, reason: 'already-sent' });
    });

    it('친구가 인증 완료하면 독려 불가', () => {
      const ctx = { ...baseCtx(), targetDoneThisRoutine: true };
      expect(canSendNudge(ctx).allowed).toBe(false);
    });

    it('자정 넘긴 quiet hours에서도 정확히 차단', () => {
      // 23:00~08:00, 현재 01시
      const ctx = { ...baseCtx(), currentHour: 1 };
      expect(canSendNudge(ctx)).toEqual({ allowed: false, reason: 'quiet-hours' });
    });
  });

  describe('캘린더 히스토리 파싱 회귀', () => {
    it('완료된 항목만 파싱', () => {
      const entries = [
        { key: 'prefix:2026-04-01', value: JSON.stringify([
          { id: 'wake', doneByMe: true, doneAt: '09:30' },
          { id: 'lunch', doneByMe: false },
        ]) },
      ];
      const result = parseHistoryEntries(entries, 'prefix:');
      expect(result).toHaveLength(1);
      expect(result[0].items).toHaveLength(1);
      expect(result[0].items[0].id).toBe('wake');
    });

    it('malformed JSON 무시', () => {
      const entries = [
        { key: 'prefix:2026-04-01', value: 'not-json' },
      ];
      const result = parseHistoryEntries(entries, 'prefix:');
      expect(result).toHaveLength(0);
    });

    it('toDateKey 정확성', () => {
      const d = new Date(2026, 3, 1); // April 1
      expect(toDateKey(d)).toBe('2026-04-01');
    });
  });

  describe('dedupe key 형식 일관성', () => {
    it('동일 입력 → 동일 key', () => {
      const k1 = buildDedupeKey('2026-04-01', 'a', 'b', 'wake');
      const k2 = buildDedupeKey('2026-04-01', 'a', 'b', 'wake');
      expect(k1).toBe(k2);
    });

    it('다른 루틴 → 다른 key', () => {
      const k1 = buildDedupeKey('2026-04-01', 'a', 'b', 'wake');
      const k2 = buildDedupeKey('2026-04-01', 'a', 'b', 'lunch');
      expect(k1).not.toBe(k2);
    });

    it('다른 날짜 → 다른 key', () => {
      const k1 = buildDedupeKey('2026-04-01', 'a', 'b', 'wake');
      const k2 = buildDedupeKey('2026-04-02', 'a', 'b', 'wake');
      expect(k1).not.toBe(k2);
    });
  });
});
