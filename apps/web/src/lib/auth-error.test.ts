import { describe, expect, it } from 'vitest';

import { resolveAuthFailureMessage } from './auth-error';

describe('resolveAuthFailureMessage', () => {
  it('취소 케이스를 취소 메시지로 매핑한다', () => {
    expect(resolveAuthFailureMessage('access_denied', null)).toContain('취소');
    expect(resolveAuthFailureMessage('server_error', 'User canceled login')).toContain('취소');
  });

  it('기타 에러는 일반 실패 메시지로 매핑한다', () => {
    expect(resolveAuthFailureMessage('server_error', 'oauth failed')).toContain('실패');
  });

  it('에러 정보가 없으면 빈 문자열을 반환한다', () => {
    expect(resolveAuthFailureMessage(null, null)).toBe('');
  });
});
