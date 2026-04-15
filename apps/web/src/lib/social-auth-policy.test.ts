import { describe, expect, it } from 'vitest';

import { getEnabledProviders, isP0Provider } from './social-auth-policy';

describe('social-auth-policy', () => {
  it('P0 provider는 카카오/애플만 활성화한다', () => {
    expect(getEnabledProviders('p0')).toEqual(['kakao', 'apple']);
  });

  it('P1 단계에서도 현재는 카카오/애플만 유지한다', () => {
    expect(getEnabledProviders('p1')).toEqual(['kakao', 'apple']);
  });

  it('P0 포함 여부 판정을 제공한다', () => {
    expect(isP0Provider('kakao')).toBe(true);
    expect(isP0Provider('apple')).toBe(true);
  });
});
