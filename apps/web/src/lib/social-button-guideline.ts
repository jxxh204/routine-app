import type { CSSProperties } from 'react';

import type { SocialProvider } from '@/lib/social-auth-policy';

export type SocialButtonConfig = {
  label: string;
  style: CSSProperties;
};

const baseStyle: CSSProperties = {
  height: 48,
  borderRadius: 10,
  fontWeight: 700,
  cursor: 'pointer',
  border: '1px solid transparent',
};

export function getSocialButtonConfig(provider: SocialProvider): SocialButtonConfig {
  if (provider === 'kakao') {
    return {
      label: '카카오로 시작',
      style: {
        ...baseStyle,
        background: '#FEE500',
        color: '#191919',
        borderColor: '#F2D800',
      },
    };
  }

  if (provider === 'apple') {
    return {
      label: 'Apple로 로그인',
      style: {
        ...baseStyle,
        background: '#000000',
        color: '#FFFFFF',
        borderColor: '#2A2A2A',
      },
    };
  }

  return {
    label: 'Google로 로그인',
    style: {
      ...baseStyle,
      background: '#FFFFFF',
      color: '#1F1F1F',
      borderColor: '#DADCE0',
    },
  };
}
