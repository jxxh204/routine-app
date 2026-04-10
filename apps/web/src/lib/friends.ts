import { getAccessToken } from '@/lib/client-auth';

export type FriendRequestRow = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: 'pending' | 'accepted' | 'blocked';
  created_at: string;
};

export function splitFriendRequests(rows: FriendRequestRow[], me: string) {
  const incomingPending = rows.filter((row) => row.status === 'pending' && row.addressee_id === me);
  const outgoingPending = rows.filter((row) => row.status === 'pending' && row.requester_id === me);
  const accepted = rows.filter((row) => row.status === 'accepted');

  return { incomingPending, outgoingPending, accepted };
}

async function getAuthHeader() {
  const token = await getAccessToken();
  if (!token) return null;
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export async function listMyFriendRequests() {
  const headers = await getAuthHeader();
  if (!headers) return { ok: false as const, error: 'unauthorized' };

  const response = await fetch('/api/friends/requests', { headers });
  const payload = (await response.json()) as { ok: boolean; me?: string; data?: FriendRequestRow[]; error?: string };

  if (!payload.ok) return { ok: false as const, error: payload.error ?? `http-${response.status}` };
  return { ok: true as const, me: payload.me ?? '', data: payload.data ?? [] };
}

export async function sendFriendRequestByCode(friendCode: string) {
  const headers = await getAuthHeader();
  if (!headers) return { ok: false as const, error: 'unauthorized' };

  const response = await fetch('/api/friends/requests', {
    method: 'POST',
    headers,
    body: JSON.stringify({ friendCode }),
  });

  const payload = (await response.json()) as { ok: boolean; error?: string };
  if (!payload.ok) return { ok: false as const, error: payload.error ?? `http-${response.status}` };
  return { ok: true as const };
}

export async function acceptFriendRequest(id: string) {
  const headers = await getAuthHeader();
  if (!headers) return { ok: false as const, error: 'unauthorized' };

  const response = await fetch(`/api/friends/requests/${id}/accept`, {
    method: 'POST',
    headers,
  });

  const payload = (await response.json()) as { ok: boolean; error?: string };
  if (!payload.ok) return { ok: false as const, error: payload.error ?? `http-${response.status}` };
  return { ok: true as const };
}
