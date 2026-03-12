#!/usr/bin/env npx tsx
/**
 * Scan all web-admin/app/api/**/route.ts files.
 * Detect: requirePermission, requireTenantAuth, getAuthContext, custom getAuthContext
 * Output: API_AUTH_AUDIT.md — routes with explicit permission vs auth-only vs none
 * Flag routes that may need permission checks added.
 * Run: npm run docs:extract-api-auth-audit (from web-admin)
 */

import * as fs from 'fs';
import * as path from 'path';

const WEB_ADMIN = path.resolve(__dirname, '../../web-admin');
const DOCS = path.resolve(__dirname, '../../docs/platform/permissions');

interface RouteAudit {
  route: string;
  file: string;
  methods: string[];
  hasRequirePermission: boolean;
  hasRequireTenantAuth: boolean;
  hasGetAuthContext: boolean;
  hasCustomAuth: boolean;
  authType: 'permission' | 'tenant_auth' | 'auth_only' | 'none' | 'custom';
  needsReview?: boolean;
}

const results: RouteAudit[] = [];

function* findRouteFiles(dir: string): Generator<string> {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      yield* findRouteFiles(full);
    } else if (e.name === 'route.ts') {
      yield full;
    }
  }
}

function auditFile(filePath: string) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const relativePath = path.relative(path.join(WEB_ADMIN, 'app'), filePath).replace(/\\/g, '/');
  const route = '/' + relativePath.replace(/\/route\.ts$/, '').replace(/\//g, '/');

  const hasRequirePermission = /requirePermission\s*\(/.test(content);
  const hasRequireTenantAuth = /requireTenantAuth\s*\(/.test(content);
  const hasGetAuthContext = /getAuthContext\s*\(/.test(content);
  const hasCustomAuth = /getAuthContext|createClient|getUser/.test(content) && !hasRequirePermission && !hasRequireTenantAuth;

  const methods: string[] = [];
  for (const m of ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']) {
    if (new RegExp(`export\\s+(?:async\\s+)?function\\s+${m}\\s*\\(`).test(content)) methods.push(m);
  }
  if (methods.length === 0) methods.push('(unknown)');

  let authType: RouteAudit['authType'] = 'none';
  if (hasRequirePermission) authType = 'permission';
  else if (hasRequireTenantAuth) authType = 'tenant_auth';
  else if (hasGetAuthContext || hasCustomAuth) authType = 'auth_only';

  const needsReview = authType === 'auth_only' || authType === 'none';

  results.push({
    route,
    file: relativePath,
    methods,
    hasRequirePermission,
    hasRequireTenantAuth,
    hasGetAuthContext,
    hasCustomAuth,
    authType,
    needsReview: needsReview && authType !== 'permission',
  });
}

function main() {
  const apiDir = path.join(WEB_ADMIN, 'app', 'api');
  if (!fs.existsSync(apiDir)) {
    console.log('No app/api directory found');
    return;
  }

  for (const file of findRouteFiles(apiDir)) {
    auditFile(file);
  }

  const md: string[] = [
    '# API Auth Audit',
    '',
    'Generated: ' + new Date().toISOString(),
    '',
    '| Route | Methods | Auth Type | requirePermission | requireTenantAuth | getAuthContext | Needs Review |',
    '|-------|---------|-----------|-------------------|------------------|----------------|--------------|',
  ];

  for (const r of results.sort((a, b) => a.route.localeCompare(b.route))) {
    md.push(
      `| ${r.route} | ${r.methods.join(', ')} | ${r.authType} | ${r.hasRequirePermission} | ${r.hasRequireTenantAuth} | ${r.hasGetAuthContext} | ${r.needsReview ?? false} |`
    );
  }

  md.push('');
  md.push('## Legend');
  md.push('- **permission**: Uses requirePermission middleware');
  md.push('- **tenant_auth**: Uses requireTenantAuth');
  md.push('- **auth_only**: Uses getAuthContext only (no explicit permission check)');
  md.push('- **none**: No obvious auth check');
  md.push('- **Needs Review**: Route may need permission checks added');

  const outPath = path.join(DOCS, 'API_AUTH_AUDIT.md');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, md.join('\n'), 'utf-8');

  const needsReviewCount = results.filter((r) => r.needsReview).length;
  console.log(`Audited ${results.length} API routes, ${needsReviewCount} need review`);
  console.log(`Output: ${outPath}`);
}

main();
