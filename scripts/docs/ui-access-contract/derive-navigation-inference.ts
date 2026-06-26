import { ingestNavigationTs } from '../ingest/ingest-navigation-ts';
import type { NavigationEntryRecord } from '../inventories/schema';
import { normalizePath } from '../inventories/route-match';

/** Longest matching navigation entry for a dashboard route (parent paths included). */
export function findNavigationEntryForRoute(route: string): NavigationEntryRecord | null {
  const { navigationEntries } = ingestNavigationTs();
  const normalized = normalizePath(route);

  let best: NavigationEntryRecord | null = null;
  let bestLen = 0;

  for (const entry of navigationEntries) {
    const entryPath = normalizePath(entry.path);
    if (!entryPath.startsWith('/dashboard')) continue;
    const matches =
      normalized === entryPath || normalized.startsWith(`${entryPath}/`);
    if (!matches) continue;
    if (entryPath.length > bestLen) {
      best = entry;
      bestLen = entryPath.length;
    }
  }

  return best;
}

export function navigationEvidenceForRoute(route: string): {
  permissions: string[];
  featureFlag?: string;
  label?: string;
  sourcePath: string;
} | null {
  const entry = findNavigationEntryForRoute(route);
  if (!entry?.permissions?.length && !entry?.featureFlag) return null;
  return {
    permissions: entry?.permissions ?? [],
    featureFlag: entry?.featureFlag,
    label: entry?.label,
    sourcePath: 'web-admin/config/navigation.ts',
  };
}
