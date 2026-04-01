import { describe, it, expect } from 'vitest';
import { buildNudgePayload } from './push-sender';

describe('buildNudgePayload', () => {
  it('builds correct title and body for known routine', () => {
    const payload = buildNudgePayload('재환', 'wake');
    expect(payload.title).toBe('👋 친구가 독려를 보냈어요!');
    expect(payload.body).toContain('재환');
    expect(payload.body).toContain('기상 인증');
  });

  it('uses routine key as label for custom routine', () => {
    const payload = buildNudgePayload('친구', 'custom-run');
    expect(payload.body).toContain('custom-run');
  });

  it('includes data with type and routineKey', () => {
    const payload = buildNudgePayload('A', 'lunch');
    expect(payload.data).toEqual({ type: 'nudge', routineKey: 'lunch' });
  });
});
