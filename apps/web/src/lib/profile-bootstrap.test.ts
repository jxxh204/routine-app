import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock supabase before importing the module under test
const mockGetUser = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockMaybeSingle = vi.fn();
const mockInsert = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getUser: (...args: unknown[]) => mockGetUser(...args) },
    from: () => ({
      select: (...args: unknown[]) => {
        mockSelect(...args);
        return {
          eq: (...eqArgs: unknown[]) => {
            mockEq(...eqArgs);
            return { maybeSingle: () => mockMaybeSingle() };
          },
        };
      },
      insert: (...args: unknown[]) => mockInsert(...args),
    }),
  },
}));

import { ensureMyProfile } from './profile-bootstrap';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ensureMyProfile', () => {
  it('returns error when user is not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const result = await ensureMyProfile();
    expect(result).toEqual({ ok: false, error: 'unauthorized' });
  });

  it('returns existing profile if found', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'u1', user_metadata: {}, email: 'a@b.com' } },
    });
    mockMaybeSingle.mockResolvedValue({
      data: { user_id: 'u1', friend_code: 'ABC123' },
      error: null,
    });

    const result = await ensureMyProfile();
    expect(result).toEqual({ ok: true, friendCode: 'ABC123' });
  });

  it('returns error on read failure', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'u1', user_metadata: {}, email: 'a@b.com' } },
    });
    mockMaybeSingle.mockResolvedValue({
      data: null,
      error: { message: 'db error' },
    });

    const result = await ensureMyProfile();
    expect(result).toEqual({ ok: false, error: 'db error' });
  });

  it('creates a new profile when none exists', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'u1', user_metadata: { nickname: '테스터' }, email: 'a@b.com' } },
    });
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockInsert.mockResolvedValue({ error: null });

    const result = await ensureMyProfile();
    expect(result.ok).toBe(true);
    expect(result).toHaveProperty('friendCode');
    expect(mockInsert).toHaveBeenCalledTimes(1);

    const insertArg = mockInsert.mock.calls[0][0];
    expect(insertArg.user_id).toBe('u1');
    expect(insertArg.nickname).toBe('테스터');
    expect(insertArg.friend_code).toMatch(/^[A-Z0-9]{6}$/);
  });

  it('uses email prefix as nickname fallback', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'u1', user_metadata: {}, email: 'hello@test.com' } },
    });
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockInsert.mockResolvedValue({ error: null });

    await ensureMyProfile();
    expect(mockInsert.mock.calls[0][0].nickname).toBe('hello');
  });

  it('uses default nickname when no metadata or email', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'u1', user_metadata: {} } },
    });
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockInsert.mockResolvedValue({ error: null });

    await ensureMyProfile();
    expect(mockInsert.mock.calls[0][0].nickname).toBe('루틴유저');
  });

  it('retries on duplicate friend_code up to 5 times', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'u1', user_metadata: {}, email: 'a@b.com' } },
    });
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockInsert.mockResolvedValue({ error: { message: 'duplicate key value' } });

    const result = await ensureMyProfile();
    expect(result).toEqual({ ok: false, error: 'friend-code-generation-failed' });
    expect(mockInsert).toHaveBeenCalledTimes(5);
  });

  it('returns error on non-duplicate insert failure', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'u1', user_metadata: {}, email: 'a@b.com' } },
    });
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockInsert.mockResolvedValue({ error: { message: 'connection refused' } });

    const result = await ensureMyProfile();
    expect(result).toEqual({ ok: false, error: 'connection refused' });
    expect(mockInsert).toHaveBeenCalledTimes(1);
  });
});
