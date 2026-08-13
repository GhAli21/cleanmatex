/** Routes that are intentionally accessible without an authenticated session. */
const PUBLIC_ROUTES = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/auth/callback',
  '/auth/confirm',
  '/logout',
  '/terms',
  '/privacy',
  '/public',
  '/track',
] as const;

/**
 * Matches a route itself or one of its child segments without exposing
 * lookalike prefixes such as `/tracker` when `/track` is public.
 *
 * @param pathname Request pathname to evaluate.
 * @param route Public route root.
 * @returns Whether the pathname is the route or a child route.
 */
function matchesRouteBoundary(pathname: string, route: string): boolean {
  return pathname === route || pathname.startsWith(`${route}/`);
}

/**
 * Resolves whether a page request may proceed without authentication.
 *
 * @param pathname Request pathname from Next.js.
 * @returns Whether the pathname belongs to the anonymous route surface.
 * @example
 * isPublicRoutePath('/track/opaque-token'); // true
 */
export function isPublicRoutePath(pathname: string): boolean {
  return (
    pathname === '/' ||
    PUBLIC_ROUTES.some((route) => matchesRouteBoundary(pathname, route))
  );
}
