#!/usr/bin/env npx tsx
/**
 * Extract permission usage from web-admin codebase.
 * Output: JSON and/or append to PERMISSIONS_BY_SCREEN / PERMISSIONS_BY_API
 * Run: npm run docs:extract-permissions (from web-admin)
 */

import * as fs from 'fs';
import * as path from 'path';

const WEB_ADMIN = path.resolve(__dirname, '../../web-admin');
const DOCS = path.resolve(__dirname, '../../docs/platform/permissions');

interface ScreenPermission {
  file: string;
  route?: string;
  permission: string;
  component: string;
  line: number;
}

interface ApiPermission {
  file: string;
  method: string;
  route: string;
  permission: string;
  line: number;
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

// RequirePermission, useHasPermission, requirePermission patterns
const PERM_PATTERNS = [
  /RequirePermission\s+[^>]*permission[s]?=["']([^"']+)["']/g,
  /useHasPermission\s*\(\s*["']([^"']+)["']/g,
  /requirePermission\s*\(\s*["']([^"']+)["']/g,
  /RequireAnyPermission\s+[^>]*permissions=["']([^"']+)["']/g,
  /useHasAnyPermission\s*\(\s*\[([^\]]+)\]/g,
];

function extractFromFile(filePath: string, content: string, relativePath: string) {
  const lines = content.split('\n');
  const isApi = relativePath.includes('app/api') && relativePath.endsWith('route.ts');

  for (const pattern of PERM_PATTERNS) {
    let m;
    const re = new RegExp(pattern.source, pattern.flags);
    while ((m = re.exec(content)) !== null) {
      const lineNum = content.slice(0, m.index).split('\n').length;
      const perm = m[1]?.trim?.() || m[0];
      if (isApi) {
        const route = relativePath.replace(/\/route\.ts$/, '').replace(/\\/g, '/');
        const method = /export\s+(async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)/.test(content)
          ? (content.match(/export\s+(?:async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE)/)?.[1] ?? 'GET')
          : 'GET';
        apiResults.push({ file: relativePath, method, route, permission: perm, line: lineNum });
      } else {
        const route = relativePath.replace(/^app\/dashboard/, '/dashboard').replace(/\/page\.tsx$/, '').replace(/\\/g, '/');
        screenResults.push({ file: relativePath, route, permission: perm, component: 'RequirePermission/useHasPermission', line: lineNum });
      }
    }
  }
}

function main() {
  for (const file of walkDir(path.join(WEB_ADMIN, 'app'), '.tsx')) {
    const content = fs.readFileSync(file, 'utf-8');
    const rel = path.relative(WEB_ADMIN, file);
    extractFromFile(file, content, rel);
  }
  for (const file of walkDir(path.join(WEB_ADMIN, 'app'), '.ts')) {
    const content = fs.readFileSync(file, 'utf-8');
    const rel = path.relative(WEB_ADMIN, file);
    extractFromFile(file, content, rel);
  }
  for (const file of walkDir(path.join(WEB_ADMIN, 'src'), '.tsx')) {
    const content = fs.readFileSync(file, 'utf-8');
    const rel = path.relative(WEB_ADMIN, file);
    extractFromFile(file, content, rel);
  }
  for (const file of walkDir(path.join(WEB_ADMIN, 'lib'), '.ts')) {
    const content = fs.readFileSync(file, 'utf-8');
    const rel = path.relative(WEB_ADMIN, file);
    extractFromFile(file, content, rel);
  }

  const output = {
    extractedAt: new Date().toISOString(),
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
