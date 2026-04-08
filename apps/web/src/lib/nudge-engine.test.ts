import { describe, it, expect } from 'vitest';
import { canSendNudge, type NudgeContext } from './nudge-engine';

function base(): NudgeContext {
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

describe('canSendNudge', () => {
  it('allows nudge when all conditions met', () => {
    expect(canSendNudge(base())).toEqual({ allowed: true });
  });

  it('blocks when sender has not done the routine', () => {
    const ctx = { ...base(), senderDoneThisRoutine: false };
    expect(canSendNudge(ctx)).toEqual({ allowed: false, reason: 'sender-not-done' });
  });

  it('blocks when target already done', () => {
    const ctx = { ...base(), targetDoneThisRoutine: true };
    expect(canSendNudge(ctx)).toEqual({ allowed: false, reason: 'target-already-done' });
  });

  it('blocks when not accepted friends', () => {
    const ctx = { ...base(), friendshipStatus: 'blocked' as const };
    expect(canSendNudge(ctx)).toEqual({ allowed: false, reason: 'not-friends' });
  });

  it('blocks when target nudge is off', () => {
    const ctx = { ...base(), targetNudgeMode: 'off' as const };
    expect(canSendNudge(ctx)).toEqual({ allowed: false, reason: 'nudge-disabled' });
  });

  it('blocks during quiet hours (same day range)', () => {
    // quiet 23~8, current hour = 2 → blocked
    const ctx = { ...base(), currentHour: 2 };
    expect(canSendNudge(ctx)).toEqual({ allowed: false, reason: 'quiet-hours' });
  });

  it('blocks during quiet hours (at boundary start)', () => {
    const ctx = { ...base(), currentHour: 23 };
    expect(canSendNudge(ctx)).toEqual({ allowed: false, reason: 'quiet-hours' });
  });

  it('allows just outside quiet hours end', () => {
    const ctx = { ...base(), currentHour: 8 };
    expect(canSendNudge(ctx)).toEqual({ allowed: true });
  });

  it('blocks when dedupe key exists', () => {
    const ctx = { ...base(), existingDedupeKey: 'some-key' };
    expect(canSendNudge(ctx)).toEqual({ allowed: false, reason: 'already-sent' });
  });

  it('handles non-overnight quiet hours (e.g. 13~15)', () => {
    const ctx = { ...base(), targetQuietHoursStart: 13, targetQuietHoursEnd: 15, currentHour: 14 };
    expect(canSendNudge(ctx)).toEqual({ allowed: false, reason: 'quiet-hours' });
  });

  it('allows outside non-overnight quiet hours', () => {
    const ctx = { ...base(), targetQuietHoursStart: 13, targetQuietHoursEnd: 15, currentHour: 16 };
    expect(canSendNudge(ctx)).toEqual({ allowed: true });
  });
});
