import * as path from 'path';
import {
  extractRoutePatterns,
  findAccessContractFiles,
  longestRoutePrefix,
} from './access-contract-files';
import { collectDashboardPageRoutes } from './collect-dashboard-routes';

export type ScopeKind = 'full' | 'feature' | 'route';

export interface AccessScope {
  kind: ScopeKind;
  /** Display label, e.g. `marketing` or `/dashboard/help` */
  label: string;
  /** Route prefix(es) defining the scope */
  routePrefixes: string[];
  /** Concrete dashboard page routes in scope */
  routes: string[];
  /** Resolved *-access.ts paths when scope is feature-scoped */
  accessFiles: string[];
}

function normalizeRoute(route: string): string {
  if (!route.startsWith('/')) {
    return route.startsWith('dashboard') ? `/${route}` : `/dashboard/${route}`;
  }
  return route;
}

function featureKeyFromAccessFile(filePath: string): string {
  const rel = filePath.replace(/\\/g, '/');
  const match = rel.match(/src\/features\/(.+)\/access\/[^/]+-access\.ts$/);
  if (!match?.[1]) return path.basename(filePath, '.ts');
  return match[1].replace(/\//g, '-');
}

function uniqueRoutePrefixes(patterns: string[]): string[] {
  const prefixes = new Set<string>();
  for (const pattern of patterns) {
    if (!pattern.startsWith('/dashboard')) continue;
    const parts = pattern.split('/').filter(Boolean);
    if (parts.length >= 2) {
      prefixes.add(`/${parts.slice(0, 2).join('/')}`);
    }
    if (parts.length >= 3 && !parts[2].startsWith('[')) {
      prefixes.add(`/${parts.slice(0, 3).join('/')}`);
    }
    prefixes.add(pattern);
  }
  return [...prefixes].sort();
}

export function listKnownFeatures(): string[] {
  return [...new Set(findAccessContractFiles().map(featureKeyFromAccessFile))].sort();
}

export function resolveAccessFilesForFeature(feature: string): string[] {
  const normalized = feature.toLowerCase();
  return findAccessContractFiles().filter((file) => {
    const key = featureKeyFromAccessFile(file);
    return (
      key === normalized ||
      key.endsWith(`-${normalized}`) ||
      key.replace(/-/g, '/') === normalized.replace(/-/g, '/')
    );
  });
}

export function routePrefixesForFeature(feature: string): string[] {
  const files = resolveAccessFilesForFeature(feature);
  if (!files.length) {
    return [`/dashboard/${feature}`];
  }

  const patterns = files.flatMap(extractRoutePatterns);
  const prefixes = uniqueRoutePrefixes(patterns);
  if (prefixes.length) return prefixes;

  return [`/dashboard/${feature}`];
}

export function routeMatchesScope(route: string, scope: AccessScope): boolean {
  if (scope.kind === 'full') return true;
  return scope.routePrefixes.some(
    (prefix) => route === prefix || route.startsWith(`${prefix}/`)
  );
}

export function filterRoutesByScope(allRoutes: string[], scope: AccessScope): string[] {
  if (scope.kind === 'full') return allRoutes;
  return allRoutes.filter((route) => routeMatchesScope(route, scope)).sort();
}

export function resolveScope(options: { route?: string; feature?: string }): AccessScope {
  const allRoutes = collectDashboardPageRoutes();

  if (options.route && options.feature) {
    throw new Error('Use only one of --route or --feature');
  }

  if (options.route) {
    const prefix = normalizeRoute(options.route);
    const routes = filterRoutesByScope(allRoutes, {
      kind: 'route',
      label: prefix,
      routePrefixes: [prefix],
      routes: [],
      accessFiles: [],
    });
    const accessFiles = findAccessContractFiles().filter((file) =>
      extractRoutePatterns(file).some((p) => longestRoutePrefix(p, prefix) >= 2)
    );
    return {
      kind: 'route',
      label: prefix,
      routePrefixes: [prefix],
      routes,
      accessFiles,
    };
  }

  if (options.feature) {
    const feature = options.feature.toLowerCase();
    const accessFiles = resolveAccessFilesForFeature(feature);
    const routePrefixes = routePrefixesForFeature(feature);
    const scope: AccessScope = {
      kind: 'feature',
      label: feature,
      routePrefixes,
      routes: [],
      accessFiles,
    };
    scope.routes = filterRoutesByScope(allRoutes, scope);
    return scope;
  }

  return {
    kind: 'full',
    label: 'all',
    routePrefixes: [],
    routes: allRoutes,
    accessFiles: findAccessContractFiles(),
  };
}
