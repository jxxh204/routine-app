'use client';

import { BottomTabBar } from './ui';

export function ClientShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <BottomTabBar />
    </>
  );
}
