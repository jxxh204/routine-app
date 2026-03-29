'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/today', label: '오늘', icon: '📋' },
  { href: '/calendar', label: '캘린더', icon: '📅' },
  { href: '/friends', label: '친구', icon: '👥' },
  { href: '/settings', label: '설정', icon: '⚙️' },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  // auth 페이지와 루트에서는 숨김
  if (pathname === '/auth' || pathname === '/') return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-20 bg-ds-bg border-t border-ds-border">
      <div className="max-w-[420px] mx-auto flex justify-around items-center h-[56px]">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                flex flex-col items-center gap-[2px] no-underline
                transition-colors duration-150
                ${isActive ? 'text-ds-accent' : 'text-ds-text-faint'}
              `}
            >
              <span className="text-[18px] leading-none">{item.icon}</span>
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
