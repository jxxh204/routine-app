import type { SocialProvider } from '@/lib/social-auth-policy';

export type SocialOfficialButtonAsset = {
  provider: SocialProvider;
  alt: string;
  width: number;
  height: number;
  kind: 'image' | 'apple-js';
  src?: string;
};

const ASSETS: Record<SocialProvider, SocialOfficialButtonAsset> = {
  kakao: {
    provider: 'kakao',
    alt: '카카오 로그인',
    kind: 'image',
    src: 'https://developers.kakao.com/tool/resource/static/img/button/login/full/ko/kakao_login_large_wide.png',
    width: 300,
    height: 45,
  },
  apple: {
    provider: 'apple',
    alt: 'Sign in with Apple',
    kind: 'apple-js',
    width: 300,
    height: 45,
  },
  google: {
    provider: 'google',
    alt: 'Sign in with Google',
    kind: 'image',
    src: 'https://developers.google.com/identity/images/btn_google_signin_dark_normal_web.png',
    width: 191,
    height: 46,
  },
};

export function getOfficialButtonAsset(provider: SocialProvider): SocialOfficialButtonAsset {
  return ASSETS[provider];
}
