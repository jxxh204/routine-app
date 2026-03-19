export type SocialProvider = 'kakao' | 'apple' | 'google';

export type SocialAuthPolicy = {
  p0: SocialProvider[];
  p1: SocialProvider[];
};

export const SOCIAL_AUTH_POLICY: SocialAuthPolicy = {
  p0: ['kakao', 'apple'],
  p1: ['google'],
};

export function isP0Provider(provider: SocialProvider) {
  return SOCIAL_AUTH_POLICY.p0.includes(provider);
}

export function getEnabledProviders(stage: 'p0' | 'p1'): SocialProvider[] {
  if (stage === 'p0') return [...SOCIAL_AUTH_POLICY.p0];
  return [...SOCIAL_AUTH_POLICY.p0, ...SOCIAL_AUTH_POLICY.p1];
}
