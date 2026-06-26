import * as fs from 'fs';
import * as path from 'path';
import { WEB_ADMIN } from '../inventories/paths';
import { routeToPageFile } from './access-contract-files';

/** Join resource + action the same way as `useHasPermission` / extract-permissions. */
export function joinPermissionCode(resource: string, action: string): string {
  if (resource.includes(':') && !action) return resource;
  if (action) return `${resource}:${action}`;
  return resource;
}

/**
 * Collect permission codes and gate markers from page / client source.
 * Used by wire audit; mirrors `scripts/docs/extract-permissions.ts` hook patterns.
 */
export function extractPermissionCodesFromSource(content: string): Set<string> {
  const codes = new Set<string>();

  const arrayRe = /permissions=\{?\[([^\]]+)\]/g;
  let match: RegExpExecArray | null;
  while ((match = arrayRe.exec(content)) !== null) {
    for (const m of match[1].matchAll(/['"]([^'"]+)['"]/g)) {
      codes.add(m[1]);
    }
  }

  for (const m of content.matchAll(/useHasPermissionCode\(\s*['"]([^'"]+)['"]/g)) {
    codes.add(m[1]);
  }

  for (const m of content.matchAll(
    /useHasPermission\s*\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\s*\)/g
  )) {
    codes.add(joinPermissionCode(m[1], m[2]));
  }

  for (const m of content.matchAll(/useHasPermission\s*\(\s*['"]([^'"]+)['"]\s*\)/g)) {
    codes.add(m[1]);
  }

  const hookArrayRe = /useHas(?:Any|All)Permissions?\s*\(\s*\[([^\]]+)\]/g;
  while ((match = hookArrayRe.exec(content)) !== null) {
    for (const m of match[1].matchAll(/['"]([^'"]+)['"]/g)) {
      codes.add(m[1]);
    }
  }

  for (const m of content.matchAll(
    /<RequirePermission[\s\S]*?resource=\{?['"]([^'"]+)['"]\}?[\s\S]*?action=\{?['"]([^'"]+)['"]\}?/g
  )) {
    codes.add(joinPermissionCode(m[1], m[2]));
  }

  for (const m of content.matchAll(
    /<RequirePermission[\s\S]*?action=\{?['"]([^'"]+)['"]\}?[\s\S]*?resource=\{?['"]([^'"]+)['"]\}?/g
  )) {
    codes.add(joinPermissionCode(m[2], m[1]));
  }

  for (const m of content.matchAll(/requirePermission\(\s*['"]([^'"]+)['"]/g)) {
    codes.add(m[1]);
  }

  for (const m of content.matchAll(/requirePermission\(\s*([A-Z_][A-Z0-9_.]*)/g)) {
    if (!m[1].includes('.')) codes.add(`__const__:${m[1]}`);
  }

  if (content.includes('RequireAnyPermission')) {
    codes.add('__has_require_any__');
  }

  return codes;
}

export function sourceReferencesContractPermissions(content: string): boolean {
  return content.includes('.page.permissions');
}

function resolveImportToFile(importSpecifier: string, fromFile: string): string | null {
  let base: string;

  if (importSpecifier.startsWith('@features/')) {
    base = path.join(WEB_ADMIN, 'src/features', importSpecifier.slice('@features/'.length));
  } else if (importSpecifier.startsWith('@/')) {
    base = path.join(WEB_ADMIN, importSpecifier.slice(2));
  } else if (importSpecifier.startsWith('.')) {
    base = path.resolve(path.dirname(fromFile), importSpecifier);
  } else {
    return null;
  }

  const candidates = [
    base,
    `${base}.tsx`,
    `${base}.ts`,
    path.join(base, 'index.tsx'),
    path.join(base, 'index.ts'),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }

  return null;
}

function isFeatureUiImport(specifier: string): boolean {
  if (specifier.startsWith('@features/')) return true;
  if (specifier.startsWith('@/src/features/')) return true;
  return false;
}

/**
 * Page route files plus one-hop feature UI imports (e.g. client components).
 * Golden path still prefers gates on `page.tsx`; this avoids false wire failures on thin pages.
 */
export function collectPageGateSourceFiles(route: string): string[] {
  const pageFile = routeToPageFile(route);
  const files = new Set<string>();

  if (fs.existsSync(pageFile)) files.add(pageFile);

  const routeDir = path.dirname(pageFile);
  if (fs.existsSync(routeDir)) {
    for (const entry of fs.readdirSync(routeDir, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith('.tsx')) {
        files.add(path.join(routeDir, entry.name));
      }
    }
  }

  const initial = [...files];
  for (const file of initial) {
    const content = fs.readFileSync(file, 'utf-8');
    for (const m of content.matchAll(
      /import\s+(?:type\s+)?(?:\{[^}]*\}|\w+)\s+from\s+['"]([^'"]+)['"]/g
    )) {
      const specifier = m[1];
      if (!isFeatureUiImport(specifier)) continue;
      const resolved = resolveImportToFile(specifier, file);
      if (resolved) files.add(resolved);
    }
  }

  return [...files];
}
