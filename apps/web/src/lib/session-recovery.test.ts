import { describe, expect, it, vi } from 'vitest';

import { getSessionWithRecovery } from './session-recovery';

describe('getSessionWithRecovery', () => {
  it('재시도 중 세션이 생기면 반환한다', async () => {
    const getSession = vi
      .fn()
      .mockResolvedValueOnce({ data: { session: null } })
      .mockResolvedValueOnce({ data: { session: { user: { id: 'u1' } } } });

    const session = await getSessionWithRecovery({ auth: { getSession } }, 3, 0);

    expect(session?.user?.id).toBe('u1');
    expect(getSession).toHaveBeenCalledTimes(2);
  });

  it('끝까지 없으면 null을 반환한다', async () => {
    const getSession = vi.fn().mockResolvedValue({ data: { session: null } });

    const session = await getSessionWithRecovery({ auth: { getSession } }, 3, 0);

    expect(session).toBeNull();
    expect(getSession).toHaveBeenCalledTimes(3);
  });
});
