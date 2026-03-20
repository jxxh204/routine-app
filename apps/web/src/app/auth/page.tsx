"use client";

import { Suspense, useEffect, useMemo, useState } from 'react';

import { useRouter, useSearchParams } from 'next/navigation';

import { AppleOfficialButton } from '@/app/auth/apple-official-button';
import { AppCard, GhostButton, PageShell, SectionHeader, StatCard } from '@/components/ui';
import { resolvePostLoginPath } from '@/lib/auth-redirect';
import { AUTH_ENTRY_FEEDBACK_KEY, AUTH_MOCK_LOGIN_KEY } from '@/lib/auth-entry-feedback';
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

  const onClickProvider = async (provider: SocialProvider) => {
    setPending(provider);
    setErrorMessage('');
    setIsRedirecting(false);

    const nextPath = resolvePostLoginPath(searchParams.get('next'));

    if (provider === 'kakao' && typeof window !== 'undefined') {
      window.localStorage.setItem(AUTH_MOCK_LOGIN_KEY, '1');
      window.sessionStorage.setItem(AUTH_ENTRY_FEEDBACK_KEY, '1');
      router.replace(nextPath);
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

  return (
    <PageShell narrow>
      <AppCard>
        <SectionHeader
          eyebrow="ROUTINE APP"
          title="카카오 로그인"
          description="로그인하고 바로 루틴앱으로 접속해요."
        />

        <div style={{ marginTop: 12 }}>
          <StatCard
            label="상태"
            value={isRedirecting ? '로그인 완료 · 이동 중' : isResolvingSession ? '로그인 상태 확인 중' : '로그인 대기'}
          />
        </div>

        <section style={{ marginTop: 22, display: 'grid', gap: 10 }}>
          {providers.map((provider) => {
            const isBusy = pending === provider;
            const asset = getOfficialButtonAsset(provider);

            if (isBusy) {
              return (
                <div
                  key={provider}
                  style={{
                    width: asset.width,
                    height: asset.height,
                    borderRadius: 10,
                    border: '1px solid var(--outline)',
                    display: 'grid',
                    placeItems: 'center',
                    color: 'var(--text-muted)',
                    background: 'var(--surface-1)',
                    fontWeight: 700,
                    margin: '0 auto',
                  }}
                >
                  카카오 로그인 처리 중...
                </div>
              );
            }

            if (asset.kind === 'apple-js') {
              if (!appleConfigured) {
                return (
                  <div
                    key={provider}
                    style={{
                      width: asset.width,
                      height: asset.height,
                      margin: '0 auto',
                      borderRadius: 10,
                      border: '1px dashed var(--outline)',
                      color: 'var(--text-muted)',
                      display: 'grid',
                      placeItems: 'center',
                      fontSize: 12,
                    }}
                  >
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
                <div
                  key={provider}
                  style={{
                    width: asset.width,
                    height: asset.height,
                    margin: '0 auto',
                    borderRadius: 10,
                    border: '1px dashed var(--outline)',
                    color: 'var(--text-muted)',
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: 12,
                  }}
                >
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
                  style={{ display: 'block' }}
                  onError={() => setAssetUnavailable((prev) => ({ ...prev, [provider]: true }))}
                />
              </button>
            );
          })}
        </section>

        {errorMessage || queryErrorMessage ? (
          <div style={{ marginTop: 14, display: 'grid', gap: 8 }}>
            <p style={{ margin: 0, color: '#ffb7b2', fontSize: 13 }}>{errorMessage || queryErrorMessage}</p>
            <GhostButton
              onClick={() => {
                setErrorMessage('');
                setPending(null);
                setIsResolvingSession(false);
                setIsRedirecting(false);
                const nextPath = resolvePostLoginPath(searchParams.get('next'));
                router.replace(`/auth?next=${encodeURIComponent(nextPath)}`);
              }}
              style={{ width: 'fit-content' }}
            >
              다시 시도하기
            </GhostButton>
          </div>
        ) : null}
      </AppCard>
    </PageShell>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={null}>
      <AuthPageContent />
    </Suspense>
  );
}
