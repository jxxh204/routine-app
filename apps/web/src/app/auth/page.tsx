"use client";

import { useMemo, useState } from 'react';

import { getEnabledProviders, type SocialProvider } from '@/lib/social-auth-policy';
import { startSocialLogin } from '@/lib/social-login';

const labels: Record<SocialProvider, string> = {
  kakao: '카카오로 시작',
  apple: 'Apple로 시작',
  google: 'Google로 시작',
};

export default function AuthPage() {
  const [pending, setPending] = useState<SocialProvider | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const providers = useMemo(() => getEnabledProviders('p0'), []);

  const onClickProvider = async (provider: SocialProvider) => {
    setPending(provider);
    setErrorMessage('');

    const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/today` : undefined;
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

          return (
            <button
              key={provider}
              onClick={() => void onClickProvider(provider)}
              disabled={Boolean(pending)}
              style={{
                height: 48,
                borderRadius: 10,
                border: '1px solid #2b3138',
                background: '#1b1f23',
                color: '#f5f7fa',
                fontWeight: 700,
                cursor: pending ? 'default' : 'pointer',
                opacity: pending && !isBusy ? 0.6 : 1,
              }}
            >
              {isBusy ? '처리 중...' : labels[provider]}
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
