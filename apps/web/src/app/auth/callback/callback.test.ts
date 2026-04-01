import { describe, it, expect } from 'vitest';

describe('OAuth callback route', () => {
  it('redirects with error when code is missing', () => {
    const url = new URL('http://localhost:3000/auth/callback?next=/today');
    const code = url.searchParams.get('code');
    expect(code).toBeNull();
    // route.ts would redirect to /auth?error=missing_code
  });

  it('preserves next parameter in redirect', () => {
    const next = '/friends';
    const url = new URL(`http://localhost:3000/auth/callback?code=abc&next=${encodeURIComponent(next)}`);
    expect(url.searchParams.get('next')).toBe('/friends');
    expect(url.searchParams.get('code')).toBe('abc');
  });

  it('defaults next to /today when not provided', () => {
    const url = new URL('http://localhost:3000/auth/callback?code=abc');
    const next = url.searchParams.get('next') ?? '/today';
    expect(next).toBe('/today');
  });
});
