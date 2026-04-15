import { NextResponse, type NextRequest } from 'next/server';

import { resolvePostLoginPath } from '@/lib/auth-redirect';

export const runtime = 'edge';

/**
 * OAuth callback pass-through
 * Supabase JS client가 /auth 페이지에서 PKCE code 교환을 수행할 수 있도록
 * code/error 파라미터를 그대로 전달해준다.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');
  const next = resolvePostLoginPath(searchParams.get('next'));

  const redirect = new URL(`/auth?next=${encodeURIComponent(next)}`, origin);

  if (error) {
    redirect.searchParams.set('error', error);
    if (errorDescription) redirect.searchParams.set('error_description', errorDescription);
    return NextResponse.redirect(redirect);
  }

  if (!code) {
    redirect.searchParams.set('error', 'missing_code');
    return NextResponse.redirect(redirect);
  }

  redirect.searchParams.set('code', code);
  return NextResponse.redirect(redirect);
}
