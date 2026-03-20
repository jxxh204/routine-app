import type { ButtonHTMLAttributes, PropsWithChildren } from 'react';

type PageShellProps = PropsWithChildren<{ narrow?: boolean }>;

type SectionHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
};

type AppCardProps = PropsWithChildren<{ className?: string }>;

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement>;

type StatCardProps = {
  label: string;
  value: string;
};

export function PageShell({ children, narrow = false }: PageShellProps) {
  return (
    <main className={`ds-page-shell${narrow ? ' ds-page-shell--narrow' : ''}`}>
      <div className="ds-page-shell__inner">{children}</div>
    </main>
  );
}

export function SectionHeader({ eyebrow, title, description }: SectionHeaderProps) {
  return (
    <header className="ds-section-header">
      {eyebrow ? <p className="ds-section-header__eyebrow">{eyebrow}</p> : null}
      <h1 className="ds-section-header__title">{title}</h1>
      {description ? <p className="ds-section-header__description">{description}</p> : null}
    </header>
  );
}

export function AppCard({ children, className }: AppCardProps) {
  return <section className={`ds-app-card${className ? ` ${className}` : ''}`}>{children}</section>;
}

export function PrimaryButton({ className, ...props }: ButtonProps) {
  return <button className={`ds-btn ds-btn--primary${className ? ` ${className}` : ''}`} {...props} />;
}

export function GhostButton({ className, ...props }: ButtonProps) {
  return <button className={`ds-btn ds-btn--ghost${className ? ` ${className}` : ''}`} {...props} />;
}

export function StatCard({ label, value }: StatCardProps) {
  return (
    <div className="ds-stat-card">
      <span className="ds-stat-card__label">{label}</span> <span className="ds-stat-card__value">{value}</span>
    </div>
  );
}
