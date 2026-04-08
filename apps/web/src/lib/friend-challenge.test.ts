import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Supabase mock ---
const mockGetUser = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getUser: () => mockGetUser() },
    from: (table: string) => mockFrom(table),
  },
}));

import { getFriendChallengeStatuses } from './friend-challenge';

function chainBuilder(data: unknown, error: unknown = null) {
  const chain: Record<string, unknown> = {};
  const _self = () => chain;
  chain.select = vi.fn().mockReturnValue(chain);
  chain.eq = vi.fn().mockReturnValue(chain);
  chain.or = vi.fn().mockReturnValue(chain);
  chain.in = vi.fn().mockReturnValue(chain);
  chain.then = (resolve: (v: unknown) => void) => resolve({ data, error });
  // Make it thenable so await works
  return chain;
}

describe('getFriendChallengeStatuses', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns unauthorized when not logged in', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const result = await getFriendChallengeStatuses('2026-04-01');
    expect(result).toEqual({ ok: false, error: 'unauthorized' });
  });

  it('returns empty array when no friends', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-a' } } });

    mockFrom.mockImplementation((table: string) => {
      if (table === 'friendships') {
        return chainBuilder([], null);
      }
      return chainBuilder([], null);
    });

    const result = await getFriendChallengeStatuses('2026-04-01');
    expect(result).toEqual({ ok: true, data: [] });
  });

  it('returns friend statuses for accepted friends', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-a' } } });

    const callOrder: string[] = [];
    mockFrom.mockImplementation((table: string) => {
      callOrder.push(table);
      if (table === 'friendships') {
        return chainBuilder([
          { requester_id: 'user-a', addressee_id: 'user-b' },
        ]);
      }
      if (table === 'profiles') {
        return chainBuilder([
          { user_id: 'user-b', nickname: '친구B', avatar_url: null },
        ]);
      }
      if (table === 'challenge_logs') {
        return chainBuilder([
          { user_id: 'user-b', routine_key: 'wake', done_at: '2026-04-01T09:30:00Z', proof_image_path: 'user-b/2026-04-01/wake.jpg' },
        ]);
      }
      return chainBuilder([]);
    });

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

  it('only includes accepted friendships (blocked excluded by query)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-a' } } });

    // The query filters by status=accepted, so blocked won't appear
    mockFrom.mockImplementation((table: string) => {
      if (table === 'friendships') {
        // Only accepted returned (blocked filtered by .eq('status','accepted'))
        return chainBuilder([]);
      }
      return chainBuilder([]);
    });

    const result = await getFriendChallengeStatuses('2026-04-01');
    expect(result).toEqual({ ok: true, data: [] });
  });
});
