export function buildAuthRedirectTarget(pathname: string | null | undefined) {
  const next = pathname && pathname.startsWith('/') ? pathname : '/today';
  return `/auth?next=${encodeURIComponent(next)}`;
}

export function resolvePostLoginPath(nextParam: string | null | undefined) {
  if (!nextParam) return '/today';
  if (!nextParam.startsWith('/')) return '/today';
  if (nextParam.startsWith('//')) return '/today';
  return nextParam;
}
