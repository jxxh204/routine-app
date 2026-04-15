import { supabase } from '@/lib/supabase';
import type { SocialProvider } from '@/lib/social-auth-policy';

const providerMap: Record<SocialProvider, 'kakao' | 'apple'> = {
  kakao: 'kakao',
  apple: 'apple',
};

export async function startSocialLogin(provider: SocialProvider, redirectTo?: string) {
  if (!supabase) {
    return { ok: false as const, error: 'supabase-client-unavailable' };
  }

  const mapped = providerMap[provider];
  const options = redirectTo ? { redirectTo } : undefined;

  const { error } = await supabase.auth.signInWithOAuth({
    provider: mapped,
    options,
  });

  if (error) {
    return { ok: false as const, error: error.message };
  }

  return { ok: true as const };
}
