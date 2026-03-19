import { describe, expect, it } from 'vitest';

import { getSocialButtonConfig } from './social-button-guideline';

describe('social-button-guideline', () => {
  it('kakao 버튼은 노란색 배경을 사용한다', () => {
    const kakao = getSocialButtonConfig('kakao');
    expect(kakao.label).toBe('카카오로 시작');
    expect(kakao.style.background).toBe('#FEE500');
  });

  it('apple 버튼은 검정 배경을 사용한다', () => {
    const apple = getSocialButtonConfig('apple');
    expect(apple.label).toBe('Apple로 로그인');
    expect(apple.style.background).toBe('#000000');
  });

  it('google 버튼 설정도 제공된다', () => {
    const google = getSocialButtonConfig('google');
    expect(google.label).toBe('Google로 로그인');
    expect(google.style.background).toBe('#FFFFFF');
  });
});
