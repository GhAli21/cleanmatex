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
  if (!candidate || !candidate.startsWith('/dashboard/') || candidate.startsWith('//')) {
    return fallback
  }

  return candidate
}
