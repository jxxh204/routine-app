"use client";

import { useEffect, useId } from 'react';

declare global {
  interface Window {
    AppleID?: {
      auth?: {
        init?: (config: Record<string, unknown>) => void;
      };
    };
  }
}

type Props = {
  width: number;
  height: number;
  onPress: () => void;
  onUnavailable?: () => void;
};

export function AppleOfficialButton({ width, height, onPress, onUnavailable }: Props) {
  const baseId = useId().replace(/[:]/g, '');
  const mountId = `appleid-signin-${baseId}`;

  useEffect(() => {
    const scriptId = 'appleid-signin-sdk';

    const init = () => {
      const clientId = process.env.NEXT_PUBLIC_APPLE_SERVICE_ID;
      const redirectURI = typeof window !== 'undefined' ? `${window.location.origin}/today` : undefined;

      if (!clientId || !redirectURI || !window.AppleID?.auth?.init) {
        onUnavailable?.();
        return;
      }

      window.AppleID.auth.init({
        clientId,
        redirectURI,
        scope: 'name email',
        usePopup: true,
      });
    };

    if (document.getElementById(scriptId)) {
      init();
      return;
    }

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = 'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js';
    script.async = true;
    script.onload = init;
    document.head.appendChild(script);
  }, [onUnavailable]);

  return (
    <div style={{ position: 'relative', width, height }}>
      <div
        id={mountId}
        data-color="black"
        data-border="false"
        data-type="sign in"
        data-width={String(width)}
        data-height={String(height)}
        style={{ width, height }}
      />

      <button
        aria-label="Sign in with Apple"
        onClick={onPress}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
        }}
      />
    </div>
  );
}
