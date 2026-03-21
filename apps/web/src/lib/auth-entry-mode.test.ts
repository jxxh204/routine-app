import { describe, expect, it, vi } from 'vitest';

import { applyMockLogin, resolveAuthEntryMode } from '@/lib/auth-entry-mode';

describe('resolveAuthEntryMode', () => {
  it('returns mock for kakao provider', () => {
    expect(resolveAuthEntryMode('kakao')).toBe('mock');
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
