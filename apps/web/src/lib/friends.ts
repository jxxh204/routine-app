import { supabase } from '@/lib/supabase';

export type FriendRequestRow = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: 'pending' | 'accepted' | 'blocked';
  created_at: string;
};

export async function listMyFriendRequests() {
  if (!supabase) return { ok: false as const, error: 'supabase-client-unavailable' };

  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes.user?.id;
  if (!uid) return { ok: false as const, error: 'unauthorized' };

  const { data, error } = await supabase
    .from('friendships')
    .select('*')
    .or(`requester_id.eq.${uid},addressee_id.eq.${uid}`)
    .order('created_at', { ascending: false });

  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, data: (data ?? []) as FriendRequestRow[] };
}

export async function sendFriendRequestByCode(friendCode: string) {
  if (!supabase) return { ok: false as const, error: 'supabase-client-unavailable' };

  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes.user?.id;
  if (!uid) return { ok: false as const, error: 'unauthorized' };

  const { data: target, error: profileError } = await supabase
    .from('profiles')
    .select('user_id')
    .eq('friend_code', friendCode)
    .maybeSingle();

  if (profileError) return { ok: false as const, error: profileError.message };
  if (!target?.user_id) return { ok: false as const, error: 'friend-not-found' };
  if (target.user_id === uid) return { ok: false as const, error: 'cannot-add-self' };

  const payload = {
    requester_id: uid,
    addressee_id: target.user_id,
    status: 'pending',
  };

  const { error } = await supabase.from('friendships').insert(payload);
  if (error) return { ok: false as const, error: error.message };

  return { ok: true as const };
}

export async function acceptFriendRequest(id: string) {
  if (!supabase) return { ok: false as const, error: 'supabase-client-unavailable' };

  const { error } = await supabase
    .from('friendships')
    .update({ status: 'accepted', accepted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'pending');

  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}
