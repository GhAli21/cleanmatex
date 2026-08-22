/**
 * Resolves a same-application return target without allowing an external redirect.
 *
 * @param candidate Query-string value supplied by the navigation source.
 * @param fallback Internal route used when the source is missing or unsafe.
 * @returns A dashboard-relative navigation target.
 *
 * @example
 * resolveSafeDashboardReturnUrl('/dashboard/workboard?page=2', '/dashboard/processing')
 */
export function resolveSafeDashboardReturnUrl(candidate: string | null | undefined, fallback: string): string {
  if (!candidate || !candidate.startsWith('/') || candidate.startsWith('//')) {
    return fallback
  }

  try {
    // URL normalizes dot segments and backslashes before the dashboard boundary
    // check, so a syntactically internal path cannot escape to another surface.
    const applicationOrigin = 'https://cleanmatex.internal'
    const target = new URL(candidate, applicationOrigin)
    if (target.origin !== applicationOrigin || !target.pathname.startsWith('/dashboard/')) {
      return fallback
    }

    return `${target.pathname}${target.search}${target.hash}`
  } catch {
    return fallback
  }
}
