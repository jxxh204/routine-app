import { describe, expect, it } from 'vitest';

import { buildAuthRedirectTarget, resolvePostLoginPath } from './auth-redirect';

describe('auth-redirect', () => {
  it('현재 경로를 auth next 파라미터로 인코딩한다', () => {
    expect(buildAuthRedirectTarget('/friends')).toBe('/auth?next=%2Ffriends');
  });

  it('잘못된 경로면 today로 폴백한다', () => {
    expect(buildAuthRedirectTarget(undefined)).toBe('/auth?next=%2Ftoday');
    expect(resolvePostLoginPath('http://evil.com')).toBe('/today');
    expect(resolvePostLoginPath('//evil.com')).toBe('/today');
  });

  it('정상 next 경로면 그대로 사용한다', () => {
    expect(resolvePostLoginPath('/calendar')).toBe('/calendar');
  });
});
