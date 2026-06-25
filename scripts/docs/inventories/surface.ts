/**
 * Infer inventory surface from web-admin relative file path.
 */

export type ExtractSurface =
  | 'screen'
  | 'api'
  | 'service'
  | 'server_action'
  | 'navigation'
  | 'hook'
  | 'workflow'
  | 'middleware'
  | 'unknown';

export function normalizeRelativePath(relativePath: string): string {
  return relativePath.replace(/\\/g, '/');
}

export function inferSurfaceFromRelativePath(relativePath: string): ExtractSurface {
  const p = normalizeRelativePath(relativePath);

  if (p === 'config/navigation.ts') return 'navigation';
  if (p.includes('app/api') && p.endsWith('route.ts')) return 'api';
  if (p.includes('middleware') && p.endsWith('.ts')) return 'middleware';
  if (p.includes('/hooks/')) return 'hook';
  if (p.includes('/services/') || p.startsWith('lib/services/')) return 'service';
  if (p.includes('app/dashboard') || p.includes('src/features/')) return 'screen';
  if (p.includes('/actions/') || /\/actions\.ts$/.test(p)) return 'server_action';
  if (p.includes('workflow')) return 'workflow';
  if (p.startsWith('lib/')) return 'service';
  return 'unknown';
}

export function routeFromDashboardPage(relativePath: string): string | undefined {
  const p = normalizeRelativePath(relativePath);
  if (!p.startsWith('app/dashboard')) return undefined;
  return p.replace(/^app\/dashboard/, '/dashboard').replace(/\/page\.tsx$/, '');
}

export function apiRouteFromPath(relativePath: string): string | undefined {
  const p = normalizeRelativePath(relativePath);
  if (!p.includes('app/api') || !p.endsWith('route.ts')) return undefined;
  return p.replace(/^app/, '').replace(/\/route\.ts$/, '');
}
