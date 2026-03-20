"use client";

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';

import { buildAuthRedirectTarget } from '@/lib/auth-redirect';
import { getSessionWithRecovery } from '@/lib/session-recovery';
import { supabase } from '@/lib/supabase';

import { AuthStatusScreen } from './auth-status-screen';

export function AuthRequired({ children }: { children: ReactNode }) {
  const [checking, setChecking] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let mounted = true;

    const check = async () => {
      if (!supabase) {
        router.replace(buildAuthRedirectTarget(pathname));
        return;
      }

      const session = await getSessionWithRecovery(supabase);
      if (!session) {
        router.replace(buildAuthRedirectTarget(pathname));
        return;
      }

      if (mounted) setChecking(false);
    };

    void check();

    const { data: listener } = supabase?.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') {
        router.replace(buildAuthRedirectTarget(pathname));
      }
    }) ?? { data: { subscription: { unsubscribe: () => undefined } } };

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, [pathname, router]);

  if (checking) {
    return <AuthStatusScreen title="로그인 상태 확인 중..." description="잠시만 기다리면 루틴 화면으로 이동해요." />;
  }

  return <>{children}</>;
}
