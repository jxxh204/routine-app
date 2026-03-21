"use client";

import { Suspense, useEffect, useMemo, useState, type CSSProperties } from 'react';

import { useRouter, useSearchParams } from 'next/navigation';

import { AppleOfficialButton } from '@/app/auth/apple-official-button';
import { AppCard, GhostButton, PageShell, SectionHeader, StatCard } from '@/components/ui';
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

  return (
    <PageShell narrow>
      <section style={{ display: 'grid', gap: 14 }}>
        <AppCard>
          <section style={{ display: 'grid', gap: 18 }}>
            <SectionHeader
              eyebrow="ROUTINE APP"
              title="3초 로그인"
              description="카카오로 바로 들어가서 오늘 인증부터 시작해요."
            />

            <div style={{ display: 'grid', gap: 10 }}>
              <div style={featureRowStyle}><span>1</span><p>로그인 후 자동으로 오늘 화면 이동</p></div>
              <div style={featureRowStyle}><span>2</span><p>인증 내역은 즉시 저장</p></div>
              <div style={featureRowStyle}><span>3</span><p>친구 진행 상태와 함께 확인</p></div>
            </div>

            <StatCard
              label="상태"
              value={isRedirecting ? '로그인 완료 · 이동 중' : isResolvingSession ? '로그인 상태 확인 중' : '로그인 대기'}
            />
          </section>
        </AppCard>

        <AppCard>
          <section style={{ display: 'grid', gap: 14 }}>
            <h2 style={{ margin: 0, fontSize: 18 }}>시작하기</h2>

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
                      borderRadius: 12,
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

            <GhostButton
              onClick={continueWithMockLogin}
              disabled={Boolean(pending) || isResolvingSession || isRedirecting}
              style={{ width: '100%' }}
            >
              로그인 없이 계속하기 (임시)
            </GhostButton>

            {errorMessage || queryErrorMessage ? (
              <div style={{ marginTop: 2, display: 'grid', gap: 8 }}>
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
          </section>
        </AppCard>
      </section>
    </PageShell>
  );
}

const featureRowStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '24px 1fr',
  alignItems: 'center',
  gap: 10,
  padding: '8px 10px',
  borderRadius: 10,
  background: 'rgba(255,255,255,0.02)',
  border: '1px solid var(--outline)',
};

export default function AuthPage() {
  return (
    <Suspense fallback={null}>
      <AuthPageContent />
    </Suspense>
  );
}
