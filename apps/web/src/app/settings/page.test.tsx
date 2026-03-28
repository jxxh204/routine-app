import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => '/settings',
}));

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock('@/lib/supabase', () => ({ supabase: null }));
vi.mock('@/lib/session-recovery', () => ({
  getSessionWithRecovery: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/components/auth-required', () => ({
  AuthRequired: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import SettingsPage from './page';

beforeEach(() => {
  // no-op
});

describe('SettingsPage', () => {
  it('renders settings header', () => {
    render(<SettingsPage />);
    expect(screen.getAllByText('설정').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('SYSTEM').length).toBeGreaterThanOrEqual(1);
  });

  it('renders notification card', () => {
    render(<SettingsPage />);
    expect(screen.getAllByText('알림').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('권한 상태').length).toBeGreaterThanOrEqual(1);
  });

  it('renders policy card', () => {
    render(<SettingsPage />);
    expect(screen.getAllByText('운영 정책').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/기본 3루틴/).length).toBeGreaterThanOrEqual(1);
  });

  it('renders system info card', () => {
    render(<SettingsPage />);
    expect(screen.getAllByText('시스템 안내').length).toBeGreaterThanOrEqual(1);
  });

  it('has notification action buttons', () => {
    render(<SettingsPage />);
    expect(screen.getAllByText('권한 요청').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('켜기').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('끄기').length).toBeGreaterThanOrEqual(1);
  });

  it('has back link to today', () => {
    render(<SettingsPage />);
    const links = screen.getAllByText('오늘으로');
    const link = links.find((el) => el.closest('a'));
    expect(link?.closest('a')).toHaveAttribute('href', '/today');
  });
});
