import * as fs from 'fs';
import * as path from 'path';
import { ingestAccessContractsTs } from '../ingest/ingest-access-contracts-ts';
import { findContractForPath } from '../inventories/route-match';
import { WEB_ADMIN } from '../inventories/paths';
import { collectDashboardPageRoutes } from './collect-dashboard-routes';
import {
  collectPageGateSourceFiles,
  extractPermissionCodesFromSource,
  sourceReferencesContractPermissions,
} from './extract-page-gate-permissions';
import type { AccessScope } from './resolve-scope';
import {
  normalizeApiDependencyPath,
  parseApiDependencyEntry,
  routeContentSatisfiesEnforcement,
  splitApiDependencyObjects,
} from './resolve-api-enforcement';

export type WireIssueKind =
  | 'PAGE_GATE_MISSING'
  | 'PAGE_PERMISSION_GAP'
  | 'API_GATE_MISSING'
  | 'API_NOT_LOCAL';

export interface WireIssue {
  kind: WireIssueKind;
  route: string;
  detail: string;
  file?: string;
  fixable: boolean;
}

const PAGE_GATE_PATTERNS =
  'RequireAnyPermission, RequirePermission, useHasPermissionCode, useHasPermission, useHasAnyPermission, or .page.permissions';

function apiPathToRouteFile(apiPath: string): string | null {
  const normalized = normalizeApiDependencyPath(apiPath);
  if (!normalized.startsWith('/api/')) return null;
  const rel = normalized.replace(/^\/api/, 'app/api');
  return path.join(WEB_ADMIN, rel, 'route.ts');
}

function extractApiDependenciesFromContractSource(
  sourceContent: string,
  pattern: string
): ReturnType<typeof parseApiDependencyEntry>[] {
  const routeEscaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const routeBlock = sourceContent.match(
    new RegExp(`routePattern:\\s*['"]${routeEscaped}['"][\\s\\S]*?apiDependencies:\\s*\\[([\\s\\S]*?)\\]`)
  );
  if (!routeBlock?.[1]) return [];

  return splitApiDependencyObjects(routeBlock[1])
    .map((entry) => parseApiDependencyEntry(entry))
    .filter((dep): dep is NonNullable<typeof dep> => dep !== null);
}

export interface AuditWireOptions {
  route?: string;
  routes?: string[];
  scope?: AccessScope;
}

export interface AuditWireResult {
  issues: WireIssue[];
  passed: boolean;
  routesAudited: number;
}

function auditSingleRoute(
  route: string,
  contract: ReturnType<typeof findContractForPath>,
  issues: WireIssue[]
): void {
  if (!contract) {
    issues.push({
      kind: 'PAGE_GATE_MISSING',
      route,
      detail: 'No access contract found — run scaffold first',
      fixable: true,
    });
    return;
  }

  const pattern = contract.routePattern;
  const pagePerms = contract.page.permissions ?? [];
  const pageFiles = collectPageGateSourceFiles(route);

  if (!pageFiles.length) {
    issues.push({
      kind: 'PAGE_GATE_MISSING',
      route: pattern,
      detail: 'No page.tsx found for route',
      fixable: false,
    });
    return;
  }

  const wiredCodes = new Set<string>();
  for (const file of pageFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    for (const code of extractPermissionCodesFromSource(content)) {
      wiredCodes.add(code);
    }
  }

  const hasPageGate =
    wiredCodes.has('__has_require_any__') ||
    pagePerms.some((p) => wiredCodes.has(p)) ||
    pageFiles.some((f) => sourceReferencesContractPermissions(fs.readFileSync(f, 'utf-8')));

  if (pagePerms.length > 0 && !hasPageGate) {
    issues.push({
      kind: 'PAGE_GATE_MISSING',
      route: pattern,
      detail: `Expected page gate for [${pagePerms.join(', ')}] — no ${PAGE_GATE_PATTERNS} match`,
      file: pageFiles[0],
      fixable: true,
    });
  } else if (pagePerms.length > 0) {
    const missing = pagePerms.filter(
      (p) =>
        !wiredCodes.has(p) &&
        !pageFiles.some((f) => sourceReferencesContractPermissions(fs.readFileSync(f, 'utf-8')))
    );
    if (missing.length && !wiredCodes.has('__has_require_any__')) {
      issues.push({
        kind: 'PAGE_PERMISSION_GAP',
        route: pattern,
        detail: `Contract permissions not referenced in page source: [${missing.join(', ')}]`,
        file: pageFiles[0],
        fixable: false,
      });
    }
  }

  if (!contract.apiDependencyCount) return;

  const sourceFile = path.join(WEB_ADMIN, contract.sourceFile.replace(/^web-admin\//, ''));
  const sourceContent = fs.existsSync(sourceFile) ? fs.readFileSync(sourceFile, 'utf-8') : '';
  const apiDeps = extractApiDependenciesFromContractSource(sourceContent, pattern);

  for (const dep of apiDeps) {
    const apiPath = dep.path;
    const enforcement = dep.enforcement;

    if (enforcement === 'external' || !apiPathToRouteFile(apiPath)) {
      issues.push({
        kind: 'API_NOT_LOCAL',
        route: pattern,
        detail: `apiDependency ${apiPath} (${enforcement}) — verify platform API gate manually`,
        fixable: false,
      });
      continue;
    }

    const routeFile = apiPathToRouteFile(apiPath);
    if (!routeFile || !fs.existsSync(routeFile)) {
      issues.push({
        kind: 'API_GATE_MISSING',
        route: pattern,
        detail: `apiDependency ${apiPath} — route file missing: ${routeFile ?? '(unresolved)'}`,
        file: routeFile ?? undefined,
        fixable: false,
      });
      continue;
    }

    const apiContent = fs.readFileSync(routeFile, 'utf-8');
    if (routeContentSatisfiesEnforcement(apiContent, enforcement)) {
      continue;
    }

    const expected =
      enforcement === 'auth_only'
        ? 'session auth (getUser + 401) or requirePermission'
        : 'requirePermission';

    issues.push({
      kind: 'API_GATE_MISSING',
      route: pattern,
      detail: `apiDependency ${apiPath} [${enforcement}] — expected ${expected} in ${path.relative(WEB_ADMIN, routeFile)}`,
      file: routeFile,
      fixable: enforcement === 'permission',
    });
  }
}

/**
 * Compare declarative contract vs runtime gates on page.tsx (and imported feature UI) and local API routes.
 */
export function auditWire(options: AuditWireOptions = {}): AuditWireResult {
  const { accessContracts } = ingestAccessContractsTs();
  const issues: WireIssue[] = [];

  let routesToAudit: string[] = [];

  if (options.routes?.length) {
    routesToAudit = options.routes;
  } else if (options.scope) {
    routesToAudit = options.scope.routes;
  } else if (options.route) {
    const all = collectDashboardPageRoutes();
    routesToAudit = all.filter(
      (r) => r === options.route || r.startsWith(`${options.route}/`)
    );
    if (!routesToAudit.includes(options.route)) {
      routesToAudit.unshift(options.route);
    }
  } else {
    routesToAudit = accessContracts
      .filter((c) => c.routePattern.startsWith('/dashboard'))
      .map((c) => c.routePattern);
  }

  routesToAudit = [...new Set(routesToAudit)].sort();

  for (const route of routesToAudit) {
    const contract = findContractForPath(accessContracts, route);
    auditSingleRoute(route, contract, issues);
  }

  return {
    issues,
    passed: issues.length === 0,
    routesAudited: routesToAudit.length,
  };
}

export function auditWireForScope(scope: AccessScope): AuditWireResult {
  return auditWire({ scope });
}
