import { describe, expect, it, vi } from 'vitest';

import { applyMockLogin, resolveAuthEntryMode } from '@/lib/auth-entry-mode';

describe('resolveAuthEntryMode', () => {
  it('returns social for kakao by default', () => {
    expect(resolveAuthEntryMode('kakao')).toBe('social');
  });

  it('returns mock for kakao only when explicitly enabled', () => {
    const prev = process.env.NEXT_PUBLIC_AUTH_KAKAO_MODE;
    process.env.NEXT_PUBLIC_AUTH_KAKAO_MODE = 'mock';
    expect(resolveAuthEntryMode('kakao')).toBe('mock');
    process.env.NEXT_PUBLIC_AUTH_KAKAO_MODE = prev;
  });

  it('returns social for non-kakao providers', () => {
    expect(resolveAuthEntryMode('apple')).toBe('social');
    expect(resolveAuthEntryMode('google')).toBe('social');
  });
});

describe('applyMockLogin', () => {
  it('redirects to target path even when storage availability differs by environment', () => {
    const replace = vi.fn();

    expect(() => applyMockLogin('/today', replace)).not.toThrow();
    expect(replace).toHaveBeenCalledWith('/today');
  });
});
