"use client";

import { Suspense, useEffect, useMemo, useState } from 'react';

import { useRouter, useSearchParams } from 'next/navigation';

import { AppleOfficialButton } from '@/app/auth/apple-official-button';
import { resolvePostLoginPath } from '@/lib/auth-redirect';
import { ensureMyProfile } from '@/lib/profile-bootstrap';
import { getOfficialButtonAsset } from '@/lib/social-official-button-assets';
import { getEnabledProviders, type SocialProvider } from '@/lib/social-auth-policy';
import { startSocialLogin } from '@/lib/social-login';
import { supabase } from '@/lib/supabase';

function AuthPageContent() {
  const [pending, setPending] = useState<SocialProvider | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const router = useRouter();
  const searchParams = useSearchParams();
  const [assetUnavailable, setAssetUnavailable] = useState<Record<SocialProvider, boolean>>({
    kakao: false,
    apple: false,
    google: false,
  });
  const providers = useMemo(() => getEnabledProviders('p0'), []);
  const appleConfigured = Boolean(process.env.NEXT_PUBLIC_APPLE_SERVICE_ID);

  useEffect(() => {
    const client = supabase;
    if (!client) return;

    const target = resolvePostLoginPath(searchParams.get('next'));

    const check = async () => {
      const { data } = await client.auth.getSession();
      if (data.session) {
        await ensureMyProfile();
        router.replace(target);
      }
    };

    void check();
  }, [router, searchParams]);

  const onClickProvider = async (provider: SocialProvider) => {
    setPending(provider);
    setErrorMessage('');

    const nextPath = resolvePostLoginPath(searchParams.get('next'));
    const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}${nextPath}` : undefined;
    const result = await startSocialLogin(provider, redirectTo);

    if (!result.ok) {
      setErrorMessage('로그인에 실패했어요. 다시 시도해 주세요.');
      setPending(null);
    }
  };

  return (
    <main style={{ maxWidth: 420, margin: '0 auto', padding: '56px 20px', color: '#f5f7fa' }}>
      <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800 }}>루틴 챌린지 시작</h1>
      <p style={{ marginTop: 8, color: '#9aa4af', fontSize: 14 }}>친구와 루틴을 공유하려면 로그인이 필요해요.</p>

      <section style={{ marginTop: 24, display: 'grid', gap: 10 }}>
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
                  border: '1px solid #2b3138',
                  display: 'grid',
                  placeItems: 'center',
                  color: '#9aa4af',
                  background: '#1b1f23',
                  fontWeight: 700,
                  margin: '0 auto',
                }}
              >
                처리 중...
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
                    border: '1px dashed #4b5563',
                    color: '#9aa4af',
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
                  border: '1px dashed #4b5563',
                  color: '#9aa4af',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: 12,
                }}
              >
                공식 버튼 로드 실패
              </div>
            );
          }

          return (
            <button
              key={provider}
              onClick={() => void onClickProvider(provider)}
              disabled={Boolean(pending)}
              aria-label={asset.alt}
              style={{
                padding: 0,
                border: 'none',
                background: 'transparent',
                opacity: pending ? 0.6 : 1,
                cursor: pending ? 'default' : 'pointer',
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

      {errorMessage ? (
        <p style={{ marginTop: 12, color: '#ff9ba8', fontSize: 13 }}>{errorMessage}</p>
      ) : null}
    </main>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={null}>
      <AuthPageContent />
    </Suspense>
  );
}
