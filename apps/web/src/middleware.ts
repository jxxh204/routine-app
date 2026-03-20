import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_PATH_PREFIXES = ['/auth', '/_next', '/favicon.ico'];

function isPublicPath(pathname: string) {
  if (pathname === '/' || pathname === '/auth') return true;
  return PUBLIC_PATH_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function hasSupabaseSessionCookie(req: NextRequest) {
  return req.cookies
    .getAll()
    .some((cookie) => cookie.name.startsWith('sb-') && cookie.name.includes('-auth-token'));
}

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  if (!hasSupabaseSessionCookie(req)) {
    const next = pathname + search;
    const redirectUrl = req.nextUrl.clone();
    redirectUrl.pathname = '/auth';
    redirectUrl.search = `?next=${encodeURIComponent(next)}`;
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api).*)'],
};
