/**
 * 푸시 알림 발송 서비스 (서버 전용)
 *
 * APNs/FCM 발송을 추상화.
 * 현재는 이벤트 기록 + 발송 준비 상태까지만 구현.
 * 실제 APNs/FCM 연동은 환경변수 설정 후 활성화.
 */

export type PushPayload = {
  title: string;
  body: string;
  data?: Record<string, string>;
};

export type PushTarget = {
  provider: 'apns' | 'fcm';
  deviceToken: string;
  platform: 'ios' | 'android';
};

export type PushResult =
  | { ok: true; provider: string }
  | { ok: false; error: string };

const ROUTINE_LABELS: Record<string, string> = {
  wake: '기상',
  lunch: '식사',
  sleep: '취침',
};

export function buildNudgePayload(
  senderNickname: string,
  routineKey: string,
): PushPayload {
  const label = ROUTINE_LABELS[routineKey] ?? routineKey;
  return {
    title: '👋 친구가 독려를 보냈어요!',
    body: `${senderNickname}님이 "${label} 인증"을 독려했어요. 지금 인증하러 가볼까요?`,
    data: {
      type: 'nudge',
      routineKey,
    },
  };
}

/**
 * APNs 발송 (Node.js 환경)
 * 환경변수: APNS_KEY_ID, APNS_TEAM_ID, APNS_KEY_PATH, APNS_BUNDLE_ID
 */
export async function sendApns(
  target: PushTarget,
  payload: PushPayload,
): Promise<PushResult> {
  const keyId = process.env.APNS_KEY_ID;
  const teamId = process.env.APNS_TEAM_ID;
  const bundleId = process.env.APNS_BUNDLE_ID;

  if (!keyId || !teamId || !bundleId) {
    return { ok: false, error: 'apns-not-configured' };
  }

  // TODO: JWT 생성 + HTTP/2 POST to api.push.apple.com
  // 현재는 stub — 설정 완료 후 구현
  console.log(`[APNs stub] Would send to ${target.deviceToken}: ${payload.body}`);
  return { ok: false, error: 'apns-stub-not-implemented' };
}

/**
 * FCM 발송
 * 환경변수: FCM_SERVER_KEY 또는 GOOGLE_APPLICATION_CREDENTIALS
 */
export async function sendFcm(
  target: PushTarget,
  payload: PushPayload,
): Promise<PushResult> {
  const serverKey = process.env.FCM_SERVER_KEY;

  if (!serverKey) {
    return { ok: false, error: 'fcm-not-configured' };
  }

  try {
    const response = await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `key=${serverKey}`,
      },
      body: JSON.stringify({
        to: target.deviceToken,
        notification: {
          title: payload.title,
          body: payload.body,
        },
        data: payload.data,
      }),
    });

    if (!response.ok) {
      return { ok: false, error: `fcm-http-${response.status}` };
    }

    return { ok: true, provider: 'fcm' };
  } catch (err) {
    return { ok: false, error: `fcm-error: ${err instanceof Error ? err.message : String(err)}` };
  }
}

/**
 * provider에 따라 적절한 발송 함수 호출
 */
export async function sendPush(
  target: PushTarget,
  payload: PushPayload,
): Promise<PushResult> {
  if (target.provider === 'apns') {
    return sendApns(target, payload);
  }
  return sendFcm(target, payload);
}
