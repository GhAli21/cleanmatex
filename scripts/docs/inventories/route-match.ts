/**
 * Route pattern matching — mirrors web-admin/lib/auth/access-contracts.ts
 */

export function normalizePath(value: string): string {
  if (!value) return '/';
  if (value === '/') return '/';
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function matchesRoutePattern(routePattern: string, pathname: string): boolean {
  const normalizedPattern = normalizePath(routePattern);
  const normalizedPathname = normalizePath(pathname);
  const patternSegments = normalizedPattern.split('/').filter(Boolean);
  const regexSegments = patternSegments.map((segment) => {
    if (segment.startsWith('[') && segment.endsWith(']')) {
      return '[^/]+';
    }
    return escapeRegex(segment);
  });
  const routeRegex = new RegExp(`^/${regexSegments.join('/')}$`);
  return routeRegex.test(normalizedPathname);
}

export function findContractForPath<T extends { routePattern: string }>(
  contracts: T[],
  pathname: string
): T | null {
  return contracts.find((c) => matchesRoutePattern(c.routePattern, pathname)) ?? null;
}

export function isDynamicSegment(segment: string): boolean {
  return segment.startsWith('[') && segment.endsWith(']');
}

export function isStaticBeforeDynamic(staticRoute: string, dynamicRoute: string): boolean {
  const staticSegs = normalizePath(staticRoute).split('/').filter(Boolean);
  const dynamicSegs = normalizePath(dynamicRoute).split('/').filter(Boolean);
  if (staticSegs.length !== dynamicSegs.length) return false;

  for (let i = 0; i < staticSegs.length; i++) {
    const sDyn = isDynamicSegment(staticSegs[i]);
    const dDyn = isDynamicSegment(dynamicSegs[i]);

    if (!sDyn && !dDyn && staticSegs[i] !== dynamicSegs[i]) {
      return false;
    }

    if (!sDyn && dDyn) {
      const prefixMatch = staticSegs.slice(0, i).every((seg, j) => seg === dynamicSegs[j]);
      return prefixMatch;
    }
  }

  return false;
}
