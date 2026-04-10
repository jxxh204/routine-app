import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

export function getBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  if (!authHeader.startsWith('Bearer ')) return null;
  return authHeader.slice('Bearer '.length);
}

export async function createAuthedSupabaseFromBearer(token: string) {
  const client = createClient(supabaseUrl, supabaseAnon, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });

  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return { ok: false as const, error: 'unauthorized' };

  return { ok: true as const, client, userId: data.user.id };
}
