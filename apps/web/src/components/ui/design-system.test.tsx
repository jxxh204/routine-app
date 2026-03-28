import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PageShell, AppCard, GhostButton, PrimaryButton, StatCard, SectionHeader } from './design-system';

describe('PageShell', () => {
  it('renders children', () => {
    render(<PageShell>Hello</PageShell>);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('applies narrow class when narrow prop is true', () => {
    const { container } = render(<PageShell narrow>Content</PageShell>);
    expect(container.querySelector('.ds-page-shell--narrow')).toBeTruthy();
  });

  it('does not apply narrow class by default', () => {
    const { container } = render(<PageShell>Content</PageShell>);
    expect(container.querySelector('.ds-page-shell--narrow')).toBeNull();
  });
});

describe('AppCard', () => {
  it('renders children in a section', () => {
    render(<AppCard>Card Content</AppCard>);
    const el = screen.getByText('Card Content');
    expect(el.closest('section')).toBeTruthy();
  });

  it('applies custom className', () => {
    const { container } = render(<AppCard className="custom">Content</AppCard>);
    expect(container.querySelector('.ds-app-card.custom')).toBeTruthy();
  });
});

describe('GhostButton', () => {
  it('renders as a button with ghost class', () => {
    render(<GhostButton>Click</GhostButton>);
    const btn = screen.getByRole('button', { name: 'Click' });
    expect(btn.className).toContain('ds-btn--ghost');
  });
});

describe('PrimaryButton', () => {
  it('renders as a button with primary class', () => {
    render(<PrimaryButton>Submit</PrimaryButton>);
    const btn = screen.getByRole('button', { name: 'Submit' });
    expect(btn.className).toContain('ds-btn--primary');
  });
});

describe('StatCard', () => {
  it('renders label and value', () => {
    render(<StatCard label="완료" value="5" />);
    expect(screen.getByText('완료')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });
});

describe('SectionHeader', () => {
  it('renders title', () => {
    render(<SectionHeader title="My Title" />);
    expect(screen.getByText('My Title')).toBeInTheDocument();
  });

  it('renders eyebrow and description when provided', () => {
    render(<SectionHeader eyebrow="SUB" title="Title" description="Desc" />);
    expect(screen.getByText('SUB')).toBeInTheDocument();
    expect(screen.getByText('Desc')).toBeInTheDocument();
  });

  it('omits eyebrow and description when not provided', () => {
    const { container } = render(<SectionHeader title="Title" />);
    expect(container.querySelectorAll('.ds-section-header__eyebrow')).toHaveLength(0);
    expect(container.querySelectorAll('.ds-section-header__description')).toHaveLength(0);
  });
});
