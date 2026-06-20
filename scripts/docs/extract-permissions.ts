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

const PERM_PATTERNS = [
  /RequirePermission\s+[^>]*permission[s]?=["']([^"']+)["']/g,
  /useHasPermission\s*\(\s*["']([^"']+)["']/g,
  /requirePermission\s*\(\s*["']([^"']+)["']/g,
  /RequireAnyPermission\s+[^>]*permissions=["']([^"']+)["']/g,
  /useHasAnyPermission\s*\(\s*\[([^\]]+)\]/g,
  /hasPermissionServer\s*\(\s*[^,]+,\s*["']([^"']+)["']/g,
];

function extractFromFile(_filePath: string, content: string, relativePath: string) {
  const rel = normalizeRelativePath(relativePath);
  const surface = inferSurfaceFromRelativePath(rel);
  const isApi = surface === 'api';

  for (const pattern of PERM_PATTERNS) {
    let m: RegExpExecArray | null;
    const re = new RegExp(pattern.source, pattern.flags);
    while ((m = re.exec(content)) !== null) {
      const lineNum = content.slice(0, m.index).split('\n').length;
      const perm = m[1]?.trim?.() || m[0];

      if (isApi) {
        const route = apiRouteFromPath(rel) ?? rel.replace(/\/route\.ts$/, '');
        const method =
          content.match(/export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)/)?.[1] ?? 'GET';
        apiResults.push({
          file: rel,
          method,
          route,
          permission: perm,
          line: lineNum,
          surface: 'api',
        });
      } else {
        screenResults.push({
          file: rel,
          route: routeFromDashboardPage(rel) ?? rel,
          permission: perm,
          component: 'RequirePermission/useHasPermission',
          line: lineNum,
          surface,
        });
      }
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
    schemaVersion: 2,
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
