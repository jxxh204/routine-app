import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/client-auth', () => ({
  getAccessToken: vi.fn(),
}));

import { getAccessToken } from '@/lib/client-auth';
import { getFriendChallengeStatuses } from './friend-challenge';

describe('getFriendChallengeStatuses', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('returns unauthorized when not logged in', async () => {
    vi.mocked(getAccessToken).mockResolvedValue(null);
    const result = await getFriendChallengeStatuses('2026-04-01');
    expect(result).toEqual({ ok: false, error: 'unauthorized' });
  });

  it('returns empty array when no friends', async () => {
    vi.mocked(getAccessToken).mockResolvedValue('token');
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, data: [] }),
    } as Response);

    const result = await getFriendChallengeStatuses('2026-04-01');
    expect(result).toEqual({ ok: true, data: [] });
  });

  it('returns friend statuses for accepted friends', async () => {
    vi.mocked(getAccessToken).mockResolvedValue('token');
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        data: [
          {
            userId: 'user-b',
            nickname: '친구B',
            avatarUrl: null,
            routines: [
              { routineKey: 'wake', doneAt: '2026-04-01T09:30:00Z', proofImagePath: 'user-b/2026-04-01/wake.jpg' },
            ],
          },
        ],
      }),
    } as Response);

    const result = await getFriendChallengeStatuses('2026-04-01');
    expect(result).toEqual({
      ok: true,
      data: [
        {
          userId: 'user-b',
          nickname: '친구B',
          avatarUrl: null,
          routines: [
            { routineKey: 'wake', doneAt: '2026-04-01T09:30:00Z', proofImagePath: 'user-b/2026-04-01/wake.jpg' },
          ],
        },
      ],
    });
  });

  it('returns http error when api fails', async () => {
    vi.mocked(getAccessToken).mockResolvedValue('token');
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 500 } as Response);

    const result = await getFriendChallengeStatuses('2026-04-01');
    expect(result).toEqual({ ok: false, error: 'http-500' });
  });
});
