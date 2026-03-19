import { describe, expect, it } from 'vitest';

import { getOfficialButtonAsset } from './social-official-button-assets';

describe('social-official-button-assets', () => {
  it('kakao 공식 버튼 에셋 URL을 제공한다', () => {
    const asset = getOfficialButtonAsset('kakao');
    expect(asset.src).toContain('developers.kakao.com');
    expect(asset.alt).toBe('카카오 로그인');
  });

  it('apple 공식 버튼은 JS 렌더 모드를 사용한다', () => {
    const asset = getOfficialButtonAsset('apple');
    expect(asset.kind).toBe('apple-js');
    expect(asset.alt).toBe('Sign in with Apple');
  });

  it('google 공식 버튼 에셋 URL을 제공한다', () => {
    const asset = getOfficialButtonAsset('google');
    expect(asset.src).toContain('developers.google.com');
    expect(asset.alt).toBe('Sign in with Google');
  });
});
