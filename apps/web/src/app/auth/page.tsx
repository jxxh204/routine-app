"use client";

import { Suspense, useEffect, useMemo, useState, type CSSProperties } from 'react';

import { useRouter, useSearchParams } from 'next/navigation';

import { AppleOfficialButton } from '@/app/auth/apple-official-button';
import { AppCard, GhostButton, PageShell, PrimaryButton, StatCard } from '@/components/ui';
import { resolvePostLoginPath } from '@/lib/auth-redirect';
import { AUTH_ENTRY_FEEDBACK_KEY } from '@/lib/auth-entry-feedback';
import { applyMockLogin, resolveAuthEntryMode } from '@/lib/auth-entry-mode';
import { resolveAuthFailureMessage } from '@/lib/auth-error';
import { ensureMyProfile } from '@/lib/profile-bootstrap';
import { getSessionWithRecovery } from '@/lib/session-recovery';
import { getOfficialButtonAsset } from '@/lib/social-official-button-assets';
import { getEnabledProviders, type SocialProvider } from '@/lib/social-auth-policy';
import { startSocialLogin } from '@/lib/social-login';
import { supabase } from '@/lib/supabase';

const AUTH_NEXT_STORAGE_KEY = 'routine-auth-next';

function AuthPageContent() {
  const [pending, setPending] = useState<SocialProvider | null>(null);
  const [isResolvingSession, setIsResolvingSession] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const router = useRouter();
  const searchParams = useSearchParams();
  const [assetUnavailable, setAssetUnavailable] = useState<Record<SocialProvider, boolean>>({
    kakao: false,
    apple: false,
    google: false,
  });
  const providers = useMemo(() => getEnabledProviders('p0').filter((provider) => provider === 'kakao'), []);
  const appleConfigured = Boolean(process.env.NEXT_PUBLIC_APPLE_SERVICE_ID);
  const queryErrorMessage = useMemo(
    () => resolveAuthFailureMessage(searchParams.get('error'), searchParams.get('error_description')),
    [searchParams],
  );

  useEffect(() => {
    const client = supabase;
    if (!client) return;

    const queryNext = resolvePostLoginPath(searchParams.get('next'));
    const storedNext =
      typeof window !== 'undefined'
        ? resolvePostLoginPath(window.sessionStorage.getItem(AUTH_NEXT_STORAGE_KEY))
        : '/today';

    const target = queryNext !== '/today' ? queryNext : storedNext;
    if (queryErrorMessage) {
      return;
    }

    const check = async () => {
      setIsResolvingSession(true);
      const session = await getSessionWithRecovery(client);
      if (session) {
        setIsRedirecting(true);
        await ensureMyProfile();
        if (typeof window !== 'undefined') {
          window.sessionStorage.setItem(AUTH_ENTRY_FEEDBACK_KEY, '1');
          window.sessionStorage.removeItem(AUTH_NEXT_STORAGE_KEY);
        }
        router.replace(target);
        return;
      }

      if (searchParams.has('code')) {
        setErrorMessage('로그인 정보를 확인하지 못했어요. 다시 시도해 주세요.');
        setPending(null);
      }

      setIsResolvingSession(false);
    };

    void check();

    const { data: listener } = client.auth.onAuthStateChange((event, session) => {
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session) {
        setIsRedirecting(true);
        void ensureMyProfile().then(() => {
          if (typeof window !== 'undefined') {
            window.sessionStorage.setItem(AUTH_ENTRY_FEEDBACK_KEY, '1');
            window.sessionStorage.removeItem(AUTH_NEXT_STORAGE_KEY);
          }
          router.replace(target);
        });
      }
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, [queryErrorMessage, router, searchParams]);

  const continueWithMockLogin = () => {
    const nextPath = resolvePostLoginPath(searchParams.get('next'));
    applyMockLogin(nextPath, router.replace);
  };

  const onClickProvider = async (provider: SocialProvider) => {
    setPending(provider);
    setErrorMessage('');
    setIsRedirecting(false);

    const nextPath = resolvePostLoginPath(searchParams.get('next'));

    if (resolveAuthEntryMode(provider) === 'mock') {
      continueWithMockLogin();
      return;
    }

    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(AUTH_NEXT_STORAGE_KEY, nextPath);
    }

    const callbackPath = `/auth?next=${encodeURIComponent(nextPath)}`;
    const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}${callbackPath}` : undefined;
    const result = await startSocialLogin(provider, redirectTo);

    if (!result.ok) {
      const isCancel = result.error.toLowerCase().includes('cancel') || result.error.toLowerCase().includes('closed');
      setErrorMessage(isCancel ? '로그인이 취소되었어요. 원하시면 다시 시도해 주세요.' : '로그인에 실패했어요. 다시 시도해 주세요.');
      setPending(null);
    }
  };

  const statusText = isRedirecting
    ? '로그인 완료 · 이동 중'
    : isResolvingSession
      ? '로그인 상태 확인 중...'
      : '로그인 대기';

  return (
    <PageShell narrow>
      <section style={styles.page}>
        {/* Hero */}
        <div style={styles.hero}>
          <p style={styles.eyebrow}>ROUTINE APP</p>
          <h1 style={styles.heroTitle}>
            {isRedirecting ? '로그인 완료!' : isResolvingSession ? '로그인 상태 확인 중...' : '오늘도 루틴 시작'}
          </h1>
          <p style={styles.heroDesc}>
            {isRedirecting
              ? '잠시만 기다리면 루틴 화면으로 이동해요.'
              : '카카오로 3초 만에 로그인하고 오늘 인증부터 시작하세요.'}
          </p>
        </div>

        {/* Login buttons */}
        <div style={styles.loginSection}>
          {providers.map((provider) => {
            const isBusy = pending === provider;
            const asset = getOfficialButtonAsset(provider);

            if (isBusy) {
              return (
                <div key={provider} style={styles.busyButton}>
                  카카오 로그인 처리 중...
                </div>
              );
            }

            if (asset.kind === 'apple-js') {
              if (!appleConfigured) {
                return (
                  <div key={provider} style={styles.unavailableButton}>
                    Apple 로그인 설정 필요
                  </div>
                );
              }

              return (
                <div key={provider} style={{ margin: '0 auto', opacity: pending ? 0.6 : 1 }}>
                  <AppleOfficialButton
                    width={asset.width}
                    height={asset.height}
                    onPress={() => void onClickProvider(provider)}
                    onUnavailable={() => setAssetUnavailable((prev) => ({ ...prev, apple: true }))}
                  />
                </div>
              );
            }

            if (assetUnavailable[provider]) {
              return (
                <div key={provider} style={styles.unavailableButton}>
                  카카오 버튼 로드 실패
                </div>
              );
            }

            return (
              <button
                key={provider}
                onClick={() => void onClickProvider(provider)}
                disabled={Boolean(pending) || isResolvingSession || isRedirecting}
                aria-label={asset.alt}
                style={{
                  padding: 0,
                  border: 'none',
                  background: 'transparent',
                  opacity: pending || isResolvingSession || isRedirecting ? 0.6 : 1,
                  cursor: pending || isResolvingSession || isRedirecting ? 'default' : 'pointer',
                  width: 'fit-content',
                  margin: '0 auto',
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={asset.src}
                  alt={asset.alt}
                  width={asset.width}
                  height={asset.height}
                  style={{ display: 'block', borderRadius: 'var(--ds-radius-sm)' }}
                  onError={() => setAssetUnavailable((prev) => ({ ...prev, [provider]: true }))}
                />
              </button>
            );
          })}

          <GhostButton
            onClick={continueWithMockLogin}
            disabled={Boolean(pending) || isResolvingSession || isRedirecting}
            style={styles.guestButton}
          >
            로그인 없이 계속하기
          </GhostButton>
        </div>

        {/* Error */}
        {errorMessage || queryErrorMessage ? (
          <div style={styles.errorWrap}>
            <p style={styles.errorText}>{errorMessage || queryErrorMessage}</p>
            <GhostButton
              onClick={() => {
                setErrorMessage('');
                setPending(null);
                setIsResolvingSession(false);
                setIsRedirecting(false);
                const nextPath = resolvePostLoginPath(searchParams.get('next'));
                router.replace(`/auth?next=${encodeURIComponent(nextPath)}`);
              }}
              style={styles.retryButton}
            >
              다시 시도
            </GhostButton>
          </div>
        ) : null}

        {/* Features */}
        <div style={styles.features}>
          <div style={styles.featureRow}><span style={styles.featureNum}>1</span><p style={styles.featureText}>로그인 후 자동으로 오늘 화면 이동</p></div>
          <div style={styles.featureRow}><span style={styles.featureNum}>2</span><p style={styles.featureText}>인증 내역은 즉시 저장</p></div>
          <div style={styles.featureRow}><span style={styles.featureNum}>3</span><p style={styles.featureText}>친구 진행 상태와 함께 확인</p></div>
        </div>
      </section>
    </PageShell>
  );
}

const styles: Record<string, CSSProperties> = {
  page: {
    display: 'grid',
    gap: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  hero: {
    textAlign: 'center',
    display: 'grid',
    gap: 6,
  },
  eyebrow: {
    margin: 0,
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.08em',
    color: 'var(--ds-color-accent)',
    textTransform: 'uppercase' as const,
  },
  heroTitle: {
    margin: 0,
    fontSize: 26,
    fontWeight: 700,
    letterSpacing: '-0.02em',
    color: 'var(--ds-color-text)',
    lineHeight: 1.25,
  },
  heroDesc: {
    margin: '4px 0 0',
    fontSize: 14,
    color: 'var(--ds-color-text-muted)',
    lineHeight: 1.5,
  },
  loginSection: {
    display: 'grid',
    gap: 10,
  },
  busyButton: {
    width: 300,
    height: 45,
    borderRadius: 'var(--ds-radius-sm)',
    border: '1px solid var(--ds-color-border)',
    display: 'grid',
    placeItems: 'center',
    color: 'var(--ds-color-text-muted)',
    background: 'var(--ds-color-surface)',
    fontWeight: 500,
    fontSize: 13,
    margin: '0 auto',
  },
  unavailableButton: {
    width: 300,
    height: 45,
    margin: '0 auto',
    borderRadius: 'var(--ds-radius-sm)',
    border: '1px dashed var(--ds-color-border)',
    color: 'var(--ds-color-text-faint)',
    display: 'grid',
    placeItems: 'center',
    fontSize: 12,
  },
  guestButton: {
    width: '100%',
    maxWidth: 300,
    margin: '0 auto',
    fontSize: 13,
  },
  errorWrap: {
    display: 'grid',
    gap: 8,
    background: 'var(--ds-color-pink-soft)',
    borderRadius: 'var(--ds-radius-md)',
    padding: '12px 14px',
  },
  errorText: {
    margin: 0,
    color: 'var(--ds-color-pink)',
    fontSize: 13,
  },
  retryButton: {
    width: 'fit-content',
    fontSize: 12,
  },
  features: {
    display: 'grid',
    gap: 6,
  },
  featureRow: {
    display: 'grid',
    gridTemplateColumns: '28px 1fr',
    alignItems: 'center',
    gap: 8,
    padding: '10px 12px',
    borderRadius: 'var(--ds-radius-sm)',
    background: 'var(--ds-color-surface)',
  },
  featureNum: {
    width: 22,
    height: 22,
    borderRadius: 'var(--ds-radius-pill)',
    background: 'var(--ds-color-accent-soft)',
    color: 'var(--ds-color-accent)',
    display: 'grid',
    placeItems: 'center',
    fontSize: 11,
    fontWeight: 600,
  },
  featureText: {
    margin: 0,
    fontSize: 13,
    color: 'var(--ds-color-text-muted)',
  },
};

export default function AuthPage() {
  return (
    <Suspense fallback={null}>
      <AuthPageContent />
    </Suspense>
  );
}
