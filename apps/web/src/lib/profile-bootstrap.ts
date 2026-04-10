import { getAccessToken } from '@/lib/client-auth';

export async function ensureMyProfile() {
  const token = await getAccessToken();
  if (!token) return { ok: false as const, error: 'unauthorized' };

  const response = await fetch('/api/profile/ensure', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });

  const payload = (await response.json()) as { ok: boolean; friendCode?: string; error?: string };
  if (!payload.ok) return { ok: false as const, error: payload.error ?? 'unknown' };
  return { ok: true as const, friendCode: payload.friendCode };
}
