'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button, Switch } from 'antd';

import { AuthRequired } from '@/components/auth-required';
import { PageShell } from '@/components/ui';

type PermissionState = 'default' | 'granted' | 'denied' | 'unsupported';

function sendNativeAction(action: 'open-settings' | 'request-notification-permission' | 'toggle-notification', enabled?: boolean) {
  if (typeof window === 'undefined') return false;

  const bridge = (window as Window & { ReactNativeWebView?: { postMessage: (msg: string) => void } }).ReactNativeWebView;
  if (!bridge?.postMessage) return false;

  bridge.postMessage(
    JSON.stringify({
      source: 'routine-web',
      type: 'native-action',
      action,
      enabled,
    }),
  );

  return true;
}

export default function SettingsPage() {
  const [permission, setPermission] = useState<PermissionState>(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
    return Notification.permission;
  });
  const [notificationEnabled, setNotificationEnabled] = useState(true);

  const requestPermission = async () => {
    if (sendNativeAction('request-notification-permission')) return;

    if (typeof window === 'undefined' || !('Notification' in window)) return;
    const result = await Notification.requestPermission();
    setPermission(result);
  };

  const handleToggle = (checked: boolean) => {
    setNotificationEnabled(checked);
    void sendNativeAction('toggle-notification', checked);
  };

  return (
    <AuthRequired>
      <PageShell>
        <section className="grid gap-ds-section-gap">
          {/* Header */}
          <div className="flex justify-between items-center">
            <div>
              <p className="m-0 text-[11px] font-semibold tracking-[0.08em] text-ds-text-faint uppercase">
                SYSTEM
              </p>
              <h1 className="mt-ds-tight mb-0 text-[22px] font-semibold tracking-tight text-ds-text">
                설정
              </h1>
            </div>
            <Link href="/today" className="text-ds-accent no-underline text-[13px] font-medium">
              오늘으로
            </Link>
          </div>

          {/* Notification */}
          <div className="bg-ds-surface rounded-ds-lg pad-card grid gap-ds-card-gap">
            <p className="m-0 text-[14px] font-semibold text-ds-text">알림</p>

            {/* Toggle */}
            <div className="flex justify-between items-center">
              <span className="text-[13px] text-ds-text-muted">알림 받기</span>
              <Switch
                checked={notificationEnabled}
                onChange={handleToggle}
                size="small"
              />
            </div>

            {/* Permission status */}
            <div className="flex justify-between items-center">
              <span className="text-[13px] text-ds-text-muted">권한 상태</span>
              <span
                className={`
                  inline-flex items-center h-[22px] rounded-ds-pill px-2 text-[11px] font-medium
                  ${permission === 'granted'
                    ? 'bg-ds-green-soft text-ds-green'
                    : permission === 'denied'
                      ? 'bg-ds-pink-soft text-ds-pink'
                      : 'bg-ds-gray-soft text-ds-gray'
                  }
                `}
              >
                {permissionLabel(permission)}
              </span>
            </div>

            {/* Actions */}
            <div className="flex gap-ds-inline flex-wrap">
              <Button
                size="small"
                onClick={() => void requestPermission()}
                className="!bg-ds-surface-strong !text-ds-text-muted !border-0 !text-[12px] !font-medium"
              >
                권한 요청
              </Button>
              <Button
                size="small"
                onClick={() => { void sendNativeAction('open-settings'); }}
                className="!bg-ds-surface-strong !text-ds-text-muted !border-0 !text-[12px] !font-medium"
              >
                시스템 설정
              </Button>
            </div>
          </div>
        </section>
      </PageShell>
    </AuthRequired>
  );
}

function permissionLabel(state: PermissionState) {
  if (state === 'granted') return '허용됨';
  if (state === 'denied') return '거부됨';
  if (state === 'unsupported') return '미지원';
  return '미결정';
}
