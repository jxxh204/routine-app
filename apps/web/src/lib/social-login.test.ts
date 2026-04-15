import { beforeEach, describe, expect, it, vi } from 'vitest';

const signInWithOAuth = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithOAuth,
    },
  },
}));

describe('startSocialLogin', () => {
  beforeEach(() => {
    signInWithOAuth.mockReset();
  });

  it('kakao provider로 oauth를 시작한다', async () => {
    signInWithOAuth.mockResolvedValue({ error: null });
    const { startSocialLogin } = await import('./social-login');

    const result = await startSocialLogin('kakao', 'https://example.com/callback');

    expect(result.ok).toBe(true);
    expect(signInWithOAuth).toHaveBeenCalledWith({
      provider: 'kakao',
      options: { redirectTo: 'https://example.com/callback', scopes: 'profile_nickname profile_image' },
    });
  });

  it('oauth 오류를 반환한다', async () => {
    signInWithOAuth.mockResolvedValue({ error: { message: 'oauth-failed' } });
    const { startSocialLogin } = await import('./social-login');

    const result = await startSocialLogin('apple');

    expect(result).toEqual({ ok: false, error: 'oauth-failed' });
  });
});
