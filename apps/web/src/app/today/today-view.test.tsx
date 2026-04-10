import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';

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

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: null }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock('@/lib/supabase', () => ({ supabase: null }));
vi.mock('@/lib/proof-image-store', () => ({
  readProofImage: vi.fn().mockResolvedValue(null),
  saveProofImage: vi.fn().mockResolvedValue(undefined),
}));

import { TodayView } from './today-view';

beforeEach(() => {
  vi.stubGlobal('localStorage', fakeStorage());
  vi.stubGlobal('sessionStorage', fakeStorage());
});

afterEach(() => {
  cleanup();
});

describe('TodayView', () => {
  it('renders default routines', () => {
    render(<TodayView />);
    expect(screen.getAllByText('기상 인증').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('식사 인증').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('취침 인증').length).toBeGreaterThanOrEqual(1);
  });

  it('shows completion count', () => {
    render(<TodayView />);
    expect(screen.getAllByText('0/3 완료').length).toBeGreaterThanOrEqual(1);
  });

  it('shows date header', () => {
    render(<TodayView />);
    const headers = screen.getAllByRole('heading', { level: 1 });
    expect(headers.some((h) => /\d+월\s*\d+일/.test(h.textContent ?? ''))).toBe(true);
  });

  it('shows add routine section', () => {
    render(<TodayView />);
    expect(screen.getAllByText('루틴 추가').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('+ 추가').length).toBeGreaterThanOrEqual(1);
  });

  it('opens add form when clicking + 추가', () => {
    render(<TodayView />);
    const addBtns = screen.getAllByText('+ 추가');
    fireEvent.click(addBtns[0]);
    expect(screen.getAllByPlaceholderText('예: 독서 인증').length).toBeGreaterThanOrEqual(1);
  });

  it('validates empty routine name', () => {
    render(<TodayView />);
    const addBtns = screen.getAllByText('+ 추가');
    fireEvent.click(addBtns[0]);
    const buttons = screen.getAllByRole('button');
    const submitBtn = buttons.find((b) => b.textContent?.trim() === '추가');
    fireEvent.click(submitBtn!);
    expect(screen.getAllByText('루틴 이름을 입력해 주세요.').length).toBeGreaterThanOrEqual(1);
  });

  it('adds a custom routine', () => {
    render(<TodayView />);
    const addBtns = screen.getAllByText('+ 추가');
    fireEvent.click(addBtns[0]);
    const inputs = screen.getAllByPlaceholderText('예: 독서 인증');
    fireEvent.change(inputs[0], { target: { value: '독서 인증' } });
    const buttons = screen.getAllByRole('button');
    const submitBtn = buttons.find((b) => b.textContent?.trim() === '추가');
    fireEvent.click(submitBtn!);
    expect(screen.getAllByText('독서 인증').length).toBeGreaterThanOrEqual(1);
  });

  it('shows certification status tags', () => {
    render(<TodayView />);
    const tags = screen.getAllByText(/대기|지금 인증|완료/);
    expect(tags.length).toBeGreaterThanOrEqual(3);
  });
});
