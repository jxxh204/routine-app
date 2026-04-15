"use client";

import { Suspense, useEffect, useMemo, useState } from 'react';
import { Button } from 'antd';

import { useRouter, useSearchParams } from 'next/navigation';

import { AppleOfficialButton } from '@/app/auth/apple-official-button';
import { PageShell } from '@/components/ui';
import { resolvePostLoginPath } from '@/lib/auth-redirect';
import { AUTH_ENTRY_FEEDBACK_KEY } from '@/lib/auth-entry-feedback';
import { resolveAuthFailureMessage } from '@/lib/auth-error';
import { ensureMyProfile } from '@/lib/profile-bootstrap';
import { getSessionWithRecovery } from '@/lib/session-recovery';
import { getOfficialButtonAsset } from '@/lib/social-official-button-assets';
import { getEnabledProviders, type SocialProvider } from '@/lib/social-auth-policy';
import { startSocialLogin } from '@/lib/social-login';
import { supabase } from '@/lib/supabase';

const AUTH_NEXT_STORAGE_KEY = 'routine-auth-next';

const providerLabel: Record<SocialProvider, string> = {
  kakao: '카카오',
  apple: 'Apple',
};

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
  });
  const providers = useMemo(() => getEnabledProviders('p0'), []);
  const appleConfigured = Boolean(process.env.NEXT_PUBLIC_APPLE_SERVICE_ID ?? process.env.NEXT_PUBLIC_APPLE_CLIENT_ID);
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

    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(AUTH_NEXT_STORAGE_KEY, nextPath);
    }

    const callbackPath = `/auth/callback?next=${encodeURIComponent(nextPath)}`;
    const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}${callbackPath}` : undefined;
    const result = await startSocialLogin(provider, redirectTo);

    if (!result.ok) {
      const isCancel = result.error.toLowerCase().includes('cancel') || result.error.toLowerCase().includes('closed');
      setErrorMessage(isCancel ? '로그인이 취소되었어요. 원하시면 다시 시도해 주세요.' : '로그인에 실패했어요. 다시 시도해 주세요.');
      setPending(null);
    }
  };

  const isBusy = Boolean(pending) || isResolvingSession || isRedirecting;

  const renderAppleFallbackButton = () => (
    <button
      type="button"
      onClick={() => void onClickProvider('apple')}
      disabled={isBusy}
      aria-label="Apple로 로그인"
      className="w-[300px] h-[45px] mx-auto rounded-ds-sm border border-[#000000] bg-[#000000] text-[#ffffff] grid grid-cols-[24px_1fr] items-center px-[12px]"
      style={{
        opacity: isBusy ? 0.6 : 1,
        cursor: isBusy ? 'default' : 'pointer',
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M16.365 12.927c-.02-2.234 1.824-3.305 1.907-3.356-1.043-1.522-2.662-1.732-3.24-1.755-1.379-.14-2.691.812-3.391.812-.701 0-1.786-.792-2.938-.771-1.511.022-2.907.88-3.683 2.229-1.575 2.729-.402 6.777 1.131 8.993.749 1.081 1.642 2.297 2.813 2.255 1.127-.045 1.551-.729 2.912-.729 1.361 0 1.742.729 2.934.706 1.215-.02 1.983-1.102 2.727-2.187.858-1.252 1.21-2.463 1.23-2.526-.026-.012-2.361-.907-2.382-3.671zM14.232 6.425c.62-.752 1.039-1.799.924-2.842-.893.036-1.973.595-2.613 1.347-.574.663-1.076 1.727-.94 2.748.994.077 2.01-.508 2.629-1.253z" />
      </svg>
      <span className="text-[17px] font-medium tracking-tight text-center pr-[20px]">Apple로 로그인</span>
    </button>
  );

  return (
    <PageShell narrow>
      <section className="grid gap-ds-section-gap pt-[60px] pb-10">
        {/* Hero */}
        <div className="text-center grid gap-ds-inline">
          <p className="m-0 text-[11px] font-semibold tracking-[0.08em] text-ds-accent uppercase">
            ROUTINE APP
          </p>
          <h1 className="m-0 text-[26px] font-bold tracking-tight leading-[1.25] text-ds-text">
            {isRedirecting ? '로그인 완료!' : isResolvingSession ? '로그인 상태 확인 중...' : '오늘도 루틴 시작'}
          </h1>
          <p className="mt-1 mb-0 text-[14px] text-ds-text-muted leading-normal">
            {isRedirecting
              ? '잠시만 기다리면 루틴 화면으로 이동해요.'
              : '소셜 로그인으로 빠르게 시작하고 오늘 인증부터 진행하세요.'}
          </p>
        </div>

        {/* Login buttons */}
        <div className="grid gap-ds-card-gap">
          {providers.map((provider) => {
            const isProviderBusy = pending === provider;
            const asset = getOfficialButtonAsset(provider);

            if (isProviderBusy) {
              return (
                <div
                  key={provider}
                  className="w-[300px] h-[45px] rounded-ds-sm border border-ds-border grid place-items-center text-ds-text-muted bg-ds-surface font-medium text-[13px] mx-auto"
                >
                  {providerLabel[provider]} 로그인 처리 중...
                </div>
              );
            }

            if (asset.kind === 'apple-js') {
              if (!appleConfigured || assetUnavailable.apple) {
                return <div key={provider}>{renderAppleFallbackButton()}</div>;
              }

              return (
                <div key={provider} className="mx-auto" style={{ opacity: pending ? 0.6 : 1 }}>
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
                  className="w-[300px] h-[45px] mx-auto rounded-ds-sm border border-dashed border-ds-border text-ds-text-faint grid place-items-center text-[12px]"
                >
                  {providerLabel[provider]} 버튼 로드 실패
                </div>
              );
            }

            return (
              <button
                key={provider}
                onClick={() => void onClickProvider(provider)}
                disabled={isBusy}
                aria-label={asset.alt}
                className="p-0 border-0 bg-transparent w-fit mx-auto"
                style={{
                  opacity: isBusy ? 0.6 : 1,
                  cursor: isBusy ? 'default' : 'pointer',
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={asset.src}
                  alt={asset.alt}
                  width={asset.width}
                  height={asset.height}
                  className="block rounded-ds-sm"
                  onError={() => setAssetUnavailable((prev) => ({ ...prev, [provider]: true }))}
                />
              </button>
            );
          })}

          {/* 로그인 없이 계속하기 제거: 소셜 로그인 필수 */}
        </div>

        {/* Error */}
        {errorMessage || queryErrorMessage ? (
          <div className="grid gap-2 bg-ds-pink-soft rounded-ds-md pad-card">
            <p className="m-0 text-ds-pink text-[13px]">
              {errorMessage || queryErrorMessage}
            </p>
            <Button
              type="text"
              size="small"
              onClick={() => {
                setErrorMessage('');
                setPending(null);
                setIsResolvingSession(false);
                setIsRedirecting(false);
                const nextPath = resolvePostLoginPath(searchParams.get('next'));
                router.replace(`/auth?next=${encodeURIComponent(nextPath)}`);
              }}
              className="!w-fit !text-[12px] !text-ds-accent"
            >
              다시 시도
            </Button>
          </div>
        ) : null}

        {/* Features */}
        <div className="grid gap-ds-card-gap">
          {[
            { num: '1', text: '로그인 후 자동으로 오늘 화면 이동' },
            { num: '2', text: '인증 내역은 즉시 저장' },
            { num: '3', text: '친구 진행 상태와 함께 확인' },
          ].map((feature) => (
            <div
              key={feature.num}
              className="grid grid-cols-[28px_1fr] items-center gap-2 pad-item rounded-ds-sm bg-ds-surface"
            >
              <span className="w-[22px] h-[22px] rounded-ds-pill bg-ds-accent-soft text-ds-accent grid place-items-center text-[11px] font-semibold">
                {feature.num}
              </span>
              <p className="m-0 text-[13px] text-ds-text-muted">
                {feature.text}
              </p>
            </div>
          ))}
        </div>
      </section>
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
