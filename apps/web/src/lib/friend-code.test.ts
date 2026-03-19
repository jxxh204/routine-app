import { describe, expect, it } from 'vitest';

import { isValidFriendCode, normalizeFriendCode } from './friend-code';

describe('friend-code', () => {
  it('친구 코드를 대문자로 정규화한다', () => {
    expect(normalizeFriendCode(' ab12cd ')).toBe('AB12CD');
  });

  it('6~8자의 영숫자 코드를 허용한다', () => {
    expect(isValidFriendCode('AB12CD')).toBe(true);
    expect(isValidFriendCode('AB12CD34')).toBe(true);
  });

  it('형식이 틀리면 거부한다', () => {
    expect(isValidFriendCode('ABC')).toBe(false);
    expect(isValidFriendCode('AB12-CD')).toBe(false);
  });
});
