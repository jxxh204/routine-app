import { AUTH_ENTRY_FEEDBACK_KEY, AUTH_MOCK_LOGIN_KEY } from '@/lib/auth-entry-feedback';
import type { SocialProvider } from '@/lib/social-auth-policy';

export type AuthEntryMode = 'mock' | 'social';

export function resolveAuthEntryMode(provider: SocialProvider): AuthEntryMode {
  if (provider === 'kakao') return 'mock';
  return 'social';
}

export function applyMockLogin(nextPath: string, replace: (path: string) => void) {
  if (typeof window !== 'undefined') {
    const local = window.localStorage as { setItem?: (k: string, v: string) => void } | undefined;
    const session = window.sessionStorage as { setItem?: (k: string, v: string) => void } | undefined;

    if (typeof local?.setItem === 'function') {
      local.setItem(AUTH_MOCK_LOGIN_KEY, '1');
    }

    if (typeof session?.setItem === 'function') {
      session.setItem(AUTH_ENTRY_FEEDBACK_KEY, '1');
    }
  }

  replace(nextPath);
}
