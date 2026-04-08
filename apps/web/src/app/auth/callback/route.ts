import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'edge';

/**
 * OAuth PKCE 콜백 라우트
 * Supabase가 redirect하면 여기서 code → session 교환 후 /auth?next=... 로 리다이렉트
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/today';

  if (!code) {
    return NextResponse.redirect(new URL(`/auth?error=missing_code&next=${encodeURIComponent(next)}`, origin));
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.redirect(new URL(`/auth?error=config_missing&next=${encodeURIComponent(next)}`, origin));
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { flowType: 'pkce', autoRefreshToken: false, persistSession: false },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(
      new URL(`/auth?error=exchange_failed&error_description=${encodeURIComponent(error.message)}&next=${encodeURIComponent(next)}`, origin),
    );
  }

  // 교환 성공 → /auth 로 리다이렉트 (auth 페이지가 세션 감지 후 next로 이동)
  return NextResponse.redirect(new URL(`/auth?next=${encodeURIComponent(next)}`, origin));
}
