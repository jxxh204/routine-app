import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/client-auth', () => ({
  getAccessToken: vi.fn().mockResolvedValue('token'),
}));

// Mock supabase before importing module
const mockUpload = vi.fn();
const mockUpdate = vi.fn();
const mockCreateSignedUrl = vi.fn();
const mockGetUser = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getUser: () => mockGetUser() },
    storage: {
      from: () => ({
        upload: (...args: unknown[]) => mockUpload(...args),
        createSignedUrl: (...args: unknown[]) => mockCreateSignedUrl(...args),
      }),
    },
    from: () => ({
      update: () => ({
        eq: () => ({
          eq: () => ({
            eq: () => mockUpdate(),
          }),
        }),
      }),
    }),
  },
}));

describe('proof-image-upload', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true } as Response));
  });

  it('uploadProofImage uploads blob and updates challenge_logs', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-123' } } });
    mockUpload.mockResolvedValue({ error: null });
    mockUpdate.mockResolvedValue({ error: null });

    const { uploadProofImage } = await import('./proof-image-upload');

    const dataUrl = 'data:image/jpeg;base64,/9j/4AAQ';
    const result = await uploadProofImage('2026-03-31', 'wake', dataUrl);

    expect(result).toBe('user-123/2026-03-31/wake.jpg');
    expect(mockUpload).toHaveBeenCalledOnce();
  });

  it('returns null when supabase user is not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    const { uploadProofImage } = await import('./proof-image-upload');
    const result = await uploadProofImage('2026-03-31', 'wake', 'data:image/jpeg;base64,abc');

    expect(result).toBeNull();
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it('getProofImageUrl returns signed URL', async () => {
    mockCreateSignedUrl.mockResolvedValue({
      data: { signedUrl: 'https://example.com/signed' },
      error: null,
    });

    const { getProofImageUrl } = await import('./proof-image-upload');
    const url = await getProofImageUrl('user-123/2026-03-31/wake.jpg');

    expect(url).toBe('https://example.com/signed');
  });
});
