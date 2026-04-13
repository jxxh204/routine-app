import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
  useSearchParams: () => ({
    get: () => null,
    has: () => false,
  }),
}));

vi.mock('@/lib/supabase', () => ({ supabase: null }));
vi.mock('@/lib/session-recovery', () => ({
  getSessionWithRecovery: vi.fn().mockResolvedValue(null),
}));
vi.mock('@/lib/profile-bootstrap', () => ({
  ensureMyProfile: vi.fn().mockResolvedValue({ ok: true }),
}));
vi.mock('@/lib/social-login', () => ({
  startSocialLogin: vi.fn(),
}));
vi.mock('@/lib/social-auth-policy', () => ({
  getEnabledProviders: () => ['kakao'],
}));
vi.mock('@/lib/social-official-button-assets', () => ({
  getOfficialButtonAsset: () => ({
    kind: 'image',
    src: '/kakao.png',
    alt: '카카오 로그인',
    width: 300,
    height: 45,
  }),
}));
// social auth only: no auth-entry-mode mock
vi.mock('@/lib/auth-error', () => ({
  resolveAuthFailureMessage: () => null,
}));
vi.mock('@/lib/auth-redirect', () => ({
  resolvePostLoginPath: (v: string | null) => v ?? '/today',
}));
vi.mock('@/app/auth/apple-official-button', () => ({
  AppleOfficialButton: () => null,
}));

import AuthPage from './page';

const fakeStorage = () => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = value; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
    get length() { return Object.keys(store).length; },
    key: (i: number) => Object.keys(store)[i] ?? null,
  };
};

beforeEach(() => {
  vi.stubGlobal('localStorage', fakeStorage());
  vi.stubGlobal('sessionStorage', fakeStorage());
});

describe('AuthPage', () => {
  it('renders hero section', () => {
    render(<AuthPage />);
    expect(screen.getAllByText('ROUTINE APP').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('오늘도 루틴 시작').length).toBeGreaterThanOrEqual(1);
  });

  it('renders login description', () => {
    render(<AuthPage />);
    expect(screen.getAllByText(/카카오로 3초 만에 로그인/).length).toBeGreaterThanOrEqual(1);
  });

  it('does not render guest login bypass', () => {
    render(<AuthPage />);
    expect(screen.queryByText('로그인 없이 계속하기')).toBeNull();
  });

  it('renders feature list', () => {
    render(<AuthPage />);
    expect(screen.getAllByText('로그인 후 자동으로 오늘 화면 이동').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('인증 내역은 즉시 저장').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('친구 진행 상태와 함께 확인').length).toBeGreaterThanOrEqual(1);
  });

  it('renders kakao login button', () => {
    render(<AuthPage />);
    const buttons = screen.getAllByRole('button', { name: '카카오 로그인' });
    expect(buttons.length).toBeGreaterThanOrEqual(1);
  });
});
