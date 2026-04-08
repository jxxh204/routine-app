import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockGetSession = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getSession: () => mockGetSession() },
  },
}));

import { sendNudge } from './nudge-api';

describe('sendNudge (client → server API)', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns unauthorized when no session', async () => {
    mockGetSession.mockResolvedValue({ data: { session: null } });
    const result = await sendNudge('target-id', 'wake');
    expect(result).toEqual({ ok: false, error: 'unauthorized' });
  });

  it('calls /api/nudge and returns eventId on success', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'test-token' } },
    });

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ ok: true, eventId: 'evt-123', pushSent: 0, pushResults: [] }),
    });

    const result = await sendNudge('target-id', 'wake');
    expect(result).toEqual({ ok: true, eventId: 'evt-123' });

    expect(globalThis.fetch).toHaveBeenCalledWith('/api/nudge', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({
        Authorization: 'Bearer test-token',
      }),
    }));
  });

  it('returns error from server response', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'test-token' } },
    });

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      json: () => Promise.resolve({ ok: false, error: 'quiet-hours' }),
    });

    const result = await sendNudge('target-id', 'wake');
    expect(result).toEqual({ ok: false, error: 'quiet-hours' });
  });

  it('handles network error gracefully', async () => {
    mockGetSession.mockResolvedValue({
      data: { session: { access_token: 'test-token' } },
    });

    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Failed to fetch'));

    const result = await sendNudge('target-id', 'wake');
    expect(result).toEqual({ ok: false, error: 'Failed to fetch' });
  });
});
