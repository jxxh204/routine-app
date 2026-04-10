import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/client-auth', () => ({
  getAccessToken: vi.fn(),
}));

import { getAccessToken } from '@/lib/client-auth';
import { ensureMyProfile } from './profile-bootstrap';

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', vi.fn());
});

describe('ensureMyProfile', () => {
  it('returns error when user is not authenticated', async () => {
    vi.mocked(getAccessToken).mockResolvedValue(null);

    const result = await ensureMyProfile();
    expect(result).toEqual({ ok: false, error: 'unauthorized' });
  });

  it('returns existing profile if found', async () => {
    vi.mocked(getAccessToken).mockResolvedValue('token');
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, friendCode: 'ABC123' }),
    } as Response);

    const result = await ensureMyProfile();
    expect(result).toEqual({ ok: true, friendCode: 'ABC123' });
  });

  it('returns api error payload', async () => {
    vi.mocked(getAccessToken).mockResolvedValue('token');
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      json: async () => ({ ok: false, error: 'db error' }),
    } as Response);

    const result = await ensureMyProfile();
    expect(result).toEqual({ ok: false, error: 'db error' });
  });
});
