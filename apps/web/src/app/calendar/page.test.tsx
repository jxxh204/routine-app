import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => '/calendar',
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
vi.mock('@/lib/proof-image-store', () => ({
  readProofImage: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/components/auth-required', () => ({
  AuthRequired: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import CalendarPage from './page';

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
});

describe('CalendarPage', () => {
  it('renders the calendar header', () => {
    render(<CalendarPage />);
    expect(screen.getAllByText('캘린더').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('HISTORY').length).toBeGreaterThanOrEqual(1);
  });

  it('renders weekday headers', () => {
    render(<CalendarPage />);
    for (const day of ['일', '월', '화', '수', '목', '금', '토']) {
      expect(screen.getAllByText(day).length).toBeGreaterThanOrEqual(1);
    }
  });

  it('renders month navigation', () => {
    render(<CalendarPage />);
    expect(screen.getAllByText('←').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('→').length).toBeGreaterThanOrEqual(1);
  });

  it('renders stats', () => {
    render(<CalendarPage />);
    expect(screen.getAllByText('이번 달 완료').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('기록된 날짜').length).toBeGreaterThanOrEqual(1);
  });

  it('shows hint text when no date selected', () => {
    render(<CalendarPage />);
    expect(screen.getAllByText(/캘린더에서 날짜를 선택하면/).length).toBeGreaterThanOrEqual(1);
  });

  it('has back link to today', () => {
    render(<CalendarPage />);
    const links = screen.getAllByText('오늘으로');
    const link = links.find((el) => el.closest('a'));
    expect(link?.closest('a')).toHaveAttribute('href', '/today');
  });
});
