import { supabase } from '@/lib/supabase';

function makeFriendCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

export async function ensureMyProfile() {
  if (!supabase) return { ok: false as const, error: 'supabase-client-unavailable' };

  const { data: userRes } = await supabase.auth.getUser();
  const user = userRes.user;
  if (!user) return { ok: false as const, error: 'unauthorized' };

  const { data: existing, error: readError } = await supabase
    .from('profiles')
    .select('user_id, friend_code')
    .eq('user_id', user.id)
    .maybeSingle();

  if (readError) return { ok: false as const, error: readError.message };
  if (existing?.user_id) return { ok: true as const, friendCode: existing.friend_code };

  const nickname = (user.user_metadata?.nickname as string | undefined)
    ?? (user.user_metadata?.name as string | undefined)
    ?? (user.email ? user.email.split('@')[0] : '루틴유저');

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const friendCode = makeFriendCode();
    const { error: insertError } = await supabase.from('profiles').insert({
      user_id: user.id,
      nickname,
      friend_code: friendCode,
    });

    if (!insertError) return { ok: true as const, friendCode };
    if (!insertError.message.toLowerCase().includes('duplicate')) {
      return { ok: false as const, error: insertError.message };
    }
  }

  return { ok: false as const, error: 'friend-code-generation-failed' };
}
