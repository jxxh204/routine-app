import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

const mockReplace = vi.fn();
const mockPathname = '/today';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
  usePathname: () => mockPathname,
}));

vi.mock('@/lib/auth-redirect', () => ({
  buildAuthRedirectTarget: (path: string) => `/auth?next=${path}`,
}));

vi.mock('@/lib/session-recovery', () => ({
  getSessionWithRecovery: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  },
}));

vi.mock('@/components/auth-status-screen', () => ({
  AuthStatusScreen: ({ title }: { title: string }) => <div data-testid="auth-status">{title}</div>,
}));

import { AuthRequired } from './auth-required';
import { getSessionWithRecovery } from '@/lib/session-recovery';

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
  vi.clearAllMocks();
  vi.stubGlobal('localStorage', fakeStorage());
});

describe('AuthRequired', () => {
  it('shows loading screen initially', () => {
    vi.mocked(getSessionWithRecovery).mockReturnValue(new Promise(() => {})); // never resolves
    render(<AuthRequired><div>Protected</div></AuthRequired>);
    expect(screen.getByTestId('auth-status')).toHaveTextContent('로그인 상태 확인 중...');
  });

  it('requires valid session (no mock bypass)', async () => {
    vi.mocked(getSessionWithRecovery).mockResolvedValue(null);
    render(<AuthRequired><div>Protected Content</div></AuthRequired>);
    await vi.waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/auth?next=/today');
    });
  });

  it('renders children when session exists', async () => {
    vi.mocked(getSessionWithRecovery).mockResolvedValue({ user: {} } as never);
    render(<AuthRequired><div>Authed</div></AuthRequired>);
    expect(await screen.findByText('Authed')).toBeInTheDocument();
  });

  it('redirects to auth when no session', async () => {
    vi.mocked(getSessionWithRecovery).mockResolvedValue(null);
    render(<AuthRequired><div>Protected</div></AuthRequired>);

    await vi.waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/auth?next=/today');
    });
  });
});
