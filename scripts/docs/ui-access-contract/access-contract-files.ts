import * as fs from 'fs';
import * as path from 'path';
import { ACCESS_CONTRACTS_DIR, WEB_ADMIN } from '../inventories/paths';

/** Exact dashboard routes → feature folder name (highest priority). */
const EXACT_ROUTE_FEATURE: Record<string, string> = {
  '/dashboard': 'dashboard',
};

/** First path segment after /dashboard → feature folder name. */
const SEGMENT_FEATURE_OVERRIDES: Record<string, string> = {
  internal_fin: 'billing',
  preparation: 'orders',
  processing: 'orders',
  assembly: 'orders',
  qa: 'orders',
  ready: 'orders',
  packing: 'orders',
  delivery: 'orders',
  receipts: 'orders',
  subscription: 'tenant-admin',
};

export function findAccessContractFiles(dir: string = ACCESS_CONTRACTS_DIR): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findAccessContractFiles(full));
    } else if (entry.name.endsWith('-access.ts')) {
      results.push(full);
    }
  }

  return results;
}

export function toRegistryImportToken(filePath: string): string {
  const rel = filePath.replace(/\\/g, '/');
  const match = rel.match(/src\/features\/(.+\/access\/[^/]+)-access\.ts$/);
  if (match?.[1]) {
    return `${match[1]}-access`;
  }
  return path.basename(filePath, '.ts');
}

export function toRegistryImportPath(filePath: string): string {
  const token = toRegistryImportToken(filePath);
  return `@features/${token}`;
}

export function readExportConstName(filePath: string): string | null {
  const content = fs.readFileSync(filePath, 'utf-8');
  const match = content.match(/export const (\w+_ACCESS_CONTRACTS)\s*:/);
  return match?.[1] ?? null;
}

export function extractRoutePatterns(filePath: string): string[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const cleaned = content
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
  const patterns: string[] = [];
  const re = /routePattern:\s*['"]([^'"]+)['"]/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(cleaned)) !== null) {
    patterns.push(match[1]);
  }
  return patterns;
}

export function routeToPageFile(route: string): string {
  const segments = route.replace(/^\/dashboard\/?/, '').split('/').filter(Boolean);
  return path.join(WEB_ADMIN, 'app', 'dashboard', ...segments, 'page.tsx');
}

export function routeToSingleExportName(route: string): string {
  const segments = route
    .replace(/^\/dashboard\/?/, '')
    .split('/')
    .filter((s) => s && !s.startsWith('['));
  const base = segments.length ? segments.join('_') : 'dashboard';
  return `${base.replace(/-/g, '_').toUpperCase()}_ACCESS`;
}

export function longestRoutePrefix(a: string, b: string): number {
  const aParts = a.split('/').filter(Boolean);
  const bParts = b.split('/').filter(Boolean);
  let shared = 0;
  for (let i = 0; i < Math.min(aParts.length, bParts.length); i++) {
    if (aParts[i] !== bParts[i]) break;
    shared++;
  }
  return shared;
}

export function scoreAccessFileForRoute(filePath: string, route: string): number {
  const patterns = extractRoutePatterns(filePath);
  if (!patterns.length) return 0;
  return Math.max(...patterns.map((p) => longestRoutePrefix(p, route)));
}

function featureFolderToAccessPath(feature: string): string {
  return path.join(WEB_ADMIN, 'src', 'features', feature, 'access', `${feature}-access.ts`);
}

function findAccessFileByFeature(feature: string, files: string[]): string | null {
  const normalized = feature.replace(/-/g, '[-_]');
  return (
    files.find((f) => {
      const rel = f.replace(/\\/g, '/');
      return new RegExp(`/features/${normalized}/access/`).test(rel);
    }) ?? null
  );
}

function resolveFeatureForRoute(route: string): string | null {
  const normalized = route.replace(/\/$/, '') || '/dashboard';
  if (EXACT_ROUTE_FEATURE[normalized]) {
    return EXACT_ROUTE_FEATURE[normalized];
  }

  const segment = route.split('/').filter(Boolean)[1];
  if (!segment) {
    return 'core';
  }

  return SEGMENT_FEATURE_OVERRIDES[segment] ?? segment;
}

export function resolveAccessFileForRoute(route: string): string | null {
  const files = findAccessContractFiles();
  let bestFile: string | null = null;
  let bestScore = 0;

  for (const file of files) {
    const score = scoreAccessFileForRoute(file, route);
    if (score > bestScore) {
      bestScore = score;
      bestFile = file;
    }
  }

  if (bestScore >= 2) return bestFile;

  const feature = resolveFeatureForRoute(route);
  if (feature === 'core') {
    return files.find((f) => f.replace(/\\/g, '/').includes('/core/access/core-access')) ?? null;
  }

  const byFolder = findAccessFileByFeature(feature, files);
  if (byFolder) return byFolder;

  if (route.includes('/internal_fin/vouchers')) {
    return files.find((f) => f.replace(/\\/g, '/').includes('/finance/vouchers/access/')) ?? null;
  }

  return null;
}

export function defaultAccessFilePathForRoute(route: string): string {
  const feature = resolveFeatureForRoute(route) ?? 'core';
  return featureFolderToAccessPath(feature);
}
