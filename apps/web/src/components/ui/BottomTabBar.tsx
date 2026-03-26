'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const tabs = [
  { label: '오늘', emoji: '✓', href: '/today' },
  { label: '캘린더', emoji: '📅', href: '/calendar' },
  { label: '친구', emoji: '👥', href: '/friends' },
  { label: '설정', emoji: '⚙️', href: '/settings' },
] as const;

export function BottomTabBar() {
  const pathname = usePathname();

  if (pathname?.startsWith('/auth')) return null;

  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 16,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        gap: 6,
        padding: '6px 8px',
        background: '#10141d',
        border: '1px solid #2a3240',
        borderRadius: 999,
        zIndex: 9999,
      }}
    >
      {tabs.map((tab) => {
        const isActive = pathname === tab.href || pathname?.startsWith(tab.href + '/');
        return (
          <Link
            key={tab.href}
            href={tab.href}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
              padding: '8px 16px',
              borderRadius: 999,
              textDecoration: 'none',
              fontSize: 11,
              fontWeight: 600,
              transition: 'all 0.15s ease',
              ...(isActive
                ? {
                    background: '#2f1e11',
                    border: '1px solid #6b421f',
                    color: '#ffb278',
                  }
                : {
                    background: 'transparent',
                    border: '1px solid transparent',
                    color: '#a6afbb',
                  }),
            }}
          >
            <span style={{ fontSize: 18 }}>{tab.emoji}</span>
            <span>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
