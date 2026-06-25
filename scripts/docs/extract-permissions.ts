#!/usr/bin/env npx tsx
/**
 * Extract permission usage from web-admin codebase.
 * Output: JSON with surface tagging (screen, api, service, hook, …)
 * Run: npm run docs:extract-permissions
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  apiRouteFromPath,
  inferSurfaceFromRelativePath,
  normalizeRelativePath,
  routeFromDashboardPage,
  type ExtractSurface,
} from './inventories/surface';

const WEB_ADMIN = path.resolve(__dirname, '../../web-admin');
const DOCS = path.resolve(__dirname, '../../docs/platform/permissions');

/** Hook definition files — skip to avoid matching JSDoc examples. */
const SKIP_FILES = new Set([
  'lib/hooks/use-has-permission.ts',
  'lib/hooks/usePermissions.ts',
]);

interface ScreenPermission {
  file: string;
  route?: string;
  permission: string;
  component: string;
  line: number;
  surface: ExtractSurface;
}

interface ApiPermission {
  file: string;
  method: string;
  route: string;
  permission: string;
  line: number;
  surface: ExtractSurface;
}

const screenResults: ScreenPermission[] = [];
const apiResults: ApiPermission[] = [];

function* walkDir(dir: string, ext: string): Generator<string> {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!['node_modules', '.next', '__tests__'].includes(e.name)) {
        yield* walkDir(full, ext);
      }
    } else if (e.name.endsWith(ext)) {
      yield full;
    }
  }
}

function lineAt(content: string, index: number): number {
  return content.slice(0, index).split('\n').length;
}

function joinPermissionCode(resource: string, action: string): string {
  if (resource.includes(':') && !action) return resource;
  if (action) return `${resource}:${action}`;
  return resource;
}

function pushScreen(
  rel: string,
  surface: ExtractSurface,
  permission: string,
  component: string,
  line: number
): void {
  screenResults.push({
    file: rel,
    route: routeFromDashboardPage(rel) ?? rel,
    permission,
    component,
    line,
    surface,
  });
}

function pushApi(rel: string, permission: string, line: number, content: string): void {
  const route = apiRouteFromPath(rel) ?? rel.replace(/\/route\.ts$/, '');
  const method =
    content.match(/export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)/)?.[1] ?? 'GET';
  apiResults.push({
    file: rel,
    method,
    route,
    permission,
    line,
    surface: 'api',
  });
}

function extractFromFile(_filePath: string, content: string, relativePath: string) {
  const rel = normalizeRelativePath(relativePath);
  if (SKIP_FILES.has(rel)) return;

  const surface = inferSurfaceFromRelativePath(rel);
  const isApi = surface === 'api';

  const record = (permission: string, component: string, index: number) => {
    const line = lineAt(content, index);
    if (isApi) {
      pushApi(rel, permission, line, content);
    } else {
      pushScreen(rel, surface, permission, component, line);
    }
  };

  // useHasPermission(resource, action) → resource:action
  const twoArgUseHas = /useHasPermission\s*\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = twoArgUseHas.exec(content)) !== null) {
    record(joinPermissionCode(m[1], m[2]), 'useHasPermission', m.index);
  }

  // useHasPermission('resource:action') single-arg full code
  const singleArgUseHas = /useHasPermission\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((m = singleArgUseHas.exec(content)) !== null) {
    record(m[1], 'useHasPermission', m.index);
  }

  // useHasPermissionCode('resource:action')
  const useHasCode = /useHasPermissionCode\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
  while ((m = useHasCode.exec(content)) !== null) {
    record(m[1], 'useHasPermissionCode', m.index);
  }

  // <RequirePermission resource="orders" action="create" />
  const requirePermJsx =
    /<RequirePermission\b[^>]*\bresource=["']([^"']+)["'][^>]*\baction=["']([^"']+)["'][^>]*>/g;
  while ((m = requirePermJsx.exec(content)) !== null) {
    record(joinPermissionCode(m[1], m[2]), 'RequirePermission', m.index);
  }
  const requirePermJsxReversed =
    /<RequirePermission\b[^>]*\baction=["']([^"']+)["'][^>]*\bresource=["']([^"']+)["'][^>]*>/g;
  while ((m = requirePermJsxReversed.exec(content)) !== null) {
    record(joinPermissionCode(m[2], m[1]), 'RequirePermission', m.index);
  }

  const singlePatterns: { re: RegExp; component: string }[] = [
    { re: /RequirePermission\s+[^>]*permission[s]?=["']([^"']+)["']/g, component: 'RequirePermission' },
    { re: /requirePermission\s*\(\s*["']([^"']+)["']/g, component: 'requirePermission' },
    { re: /RequireAnyPermission\s+[^>]*permissions=["']([^"']+)["']/g, component: 'RequireAnyPermission' },
    { re: /hasPermissionServer\s*\(\s*[^,]+,\s*["']([^"']+)["']/g, component: 'hasPermissionServer' },
  ];

  for (const { re, component } of singlePatterns) {
    while ((m = re.exec(content)) !== null) {
      record(m[1]?.trim() ?? m[0], component, m.index);
    }
  }

  // useHasAnyPermission([['orders', 'read'], ...])
  const anyPerm = /useHasAnyPermission\s*\(\s*\[([\s\S]*?)\]\s*\)/g;
  while ((m = anyPerm.exec(content)) !== null) {
    const block = m[1];
    const pairRe = /\[\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]\s*\]/g;
    let pair: RegExpExecArray | null;
    while ((pair = pairRe.exec(block)) !== null) {
      record(joinPermissionCode(pair[1], pair[2]), 'useHasAnyPermission', m.index);
    }
  }
}

function main() {
  for (const dir of ['app', 'src', 'lib']) {
    const base = path.join(WEB_ADMIN, dir);
    if (!fs.existsSync(base)) continue;
    for (const ext of ['.tsx', '.ts']) {
      for (const file of walkDir(base, ext)) {
        const content = fs.readFileSync(file, 'utf-8');
        const rel = path.relative(WEB_ADMIN, file);
        extractFromFile(file, content, rel);
      }
    }
  }

  const output = {
    extractedAt: new Date().toISOString(),
    schemaVersion: 3,
    screens: screenResults,
    apis: apiResults,
  };

  const outPath = path.join(DOCS, 'extracted-permissions.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2), 'utf-8');

  console.log(`Extracted ${screenResults.length} screen permissions, ${apiResults.length} API permissions`);
  console.log(`Output: ${outPath}`);
}

main();
