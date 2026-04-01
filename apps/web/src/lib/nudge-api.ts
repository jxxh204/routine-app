import { supabase } from '@/lib/supabase';

export type NudgeSendResult =
  | { ok: true; eventId: string }
  | { ok: false; error: string };

/**
 * 독려 발송 — 서버 API(/api/nudge)를 호출한다.
 * 서버에서 판정 + push_events 기록 + 푸시 발송까지 처리.
 */
export async function sendNudge(
  targetId: string,
  routineKey: string,
): Promise<NudgeSendResult> {
  if (!supabase) return { ok: false, error: 'supabase-client-unavailable' };

  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;
  if (!accessToken) return { ok: false, error: 'unauthorized' };

  try {
    const response = await fetch('/api/nudge', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ targetId, routineKey }),
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      return { ok: false, error: data.error ?? `http-${response.status}` };
    }

    return { ok: true, eventId: data.eventId };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'network-error' };
  }
}
