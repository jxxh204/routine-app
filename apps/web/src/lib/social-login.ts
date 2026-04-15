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
  const options = {
    ...(redirectTo ? { redirectTo } : {}),
    ...(mapped === 'kakao' ? { scopes: 'profile_nickname profile_image' } : {}),
  };

  const { error } = await supabase.auth.signInWithOAuth({
    provider: mapped,
    options: Object.keys(options).length > 0 ? options : undefined,
  });

  if (error) {
    return { ok: false as const, error: error.message };
  }

  return { ok: true as const };
}
