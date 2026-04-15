import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** JWT는 3개의 base64url 세그먼트로 구성 (header.payload.signature) */
const JWT_PATTERN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

export function getBearerToken(authHeader: string | null): string | null {
  if (!authHeader) return null;
  if (!authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice('Bearer '.length).trim();
  if (!token || !JWT_PATTERN.test(token)) return null;
  return token;
}

export async function createAuthedSupabaseFromBearer(token: string) {
  if (!supabaseUrl || !supabaseAnon) {
    return { ok: false as const, error: 'server-config-missing' };
  }

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
