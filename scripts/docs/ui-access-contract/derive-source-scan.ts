import * as fs from 'fs';
import * as path from 'path';
import { EXTRACTED_PATHS, WEB_ADMIN } from '../inventories/paths';
import { collectPageGateSourceFiles } from './extract-page-gate-permissions';

const API_HTTP_METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
export type InferredHttpMethod = (typeof API_HTTP_METHODS)[number];

export interface PermissionEvidenceRow {
  permission: string;
  file: string;
  component?: string;
}

export interface InferredAction {
  actionKey: string;
  label: string;
  permissions: string[];
  evidenceFiles: string[];
}

export interface InferredApiDependency {
  label: string;
  method: InferredHttpMethod;
  path: string;
  permissions: string[];
  authOnly: boolean;
  external: boolean;
  sourceFiles: string[];
}

interface ExtractedApiRow {
  route: string;
  method: string;
  permission: string;
  file: string;
}

function relWebAdmin(absPath: string): string {
  return path.relative(WEB_ADMIN, absPath).replace(/\\/g, '/');
}

function resolveImportToFile(importSpecifier: string, fromFile: string): string | null {
  let base: string;
  if (importSpecifier.startsWith('@features/')) {
    base = path.join(WEB_ADMIN, 'src/features', importSpecifier.slice('@features/'.length));
  } else if (importSpecifier.startsWith('@/')) {
    base = path.join(WEB_ADMIN, importSpecifier.slice(2));
  } else if (importSpecifier.startsWith('@lib/')) {
    base = path.join(WEB_ADMIN, 'lib', importSpecifier.slice('@lib/'.length));
  } else if (importSpecifier.startsWith('.')) {
    base = path.resolve(path.dirname(fromFile), importSpecifier);
  } else {
    return null;
  }

  for (const candidate of [
    base,
    `${base}.tsx`,
    `${base}.ts`,
    path.join(base, 'index.tsx'),
    path.join(base, 'index.ts'),
  ]) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return null;
}

/** Page gate files plus transitive local imports (for API path discovery). */
export function collectRelatedSourceFiles(route: string, maxDepth = 2): string[] {
  const files = new Set(collectPageGateSourceFiles(route));
  const queue = [...files];
  const visited = new Set<string>();

  while (queue.length > 0 && maxDepth > 0) {
    const batch = [...queue];
    queue.length = 0;

    for (const file of batch) {
      const norm = path.normalize(file);
      if (visited.has(norm)) continue;
      visited.add(norm);

      if (!fs.existsSync(file)) continue;
      const content = fs.readFileSync(file, 'utf-8');

      for (const m of content.matchAll(
        /import\s+(?:type\s+)?(?:\{[^}]*\}|\w+)\s+from\s+['"]([^'"]+)['"]/g
      )) {
        const specifier = m[1];
        if (specifier.startsWith('next/') || specifier.startsWith('@ui/')) continue;
        const resolved = resolveImportToFile(specifier, file);
        if (!resolved || files.has(resolved)) continue;

        const rel = relWebAdmin(resolved);
        if (
          !rel.startsWith('src/features/') &&
          !rel.startsWith('app/dashboard/') &&
          !rel.startsWith('app/actions/')
        ) {
          continue;
        }

        files.add(resolved);
        queue.push(resolved);
      }
    }

    maxDepth--;
  }

  return [...files];
}

function loadApiPermissionIndex(): Map<string, { method: string; permission: string }> {
  const index = new Map<string, { method: string; permission: string }>();
  if (!fs.existsSync(EXTRACTED_PATHS.permissions)) return index;

  const data = JSON.parse(fs.readFileSync(EXTRACTED_PATHS.permissions, 'utf-8')) as {
    apis?: ExtractedApiRow[];
  };

  for (const row of data.apis ?? []) {
    if (!row.route?.startsWith('/api/')) continue;
    const existing = index.get(row.route);
    if (!existing) {
      index.set(row.route, { method: row.method ?? 'GET', permission: row.permission });
    }
  }
  return index;
}

function normalizeApiPath(raw: string): string | null {
  let p = raw.trim().replace(/\$\{[^}]+\}/g, '[id]');
  if (!p.startsWith('/')) return null;
  p = p.split('?')[0].replace(/\/+$/, '') || '/';
  if (!p.startsWith('/api/') && !p.startsWith('/tenant-api/')) return null;
  return p;
}

function inferMethodNear(content: string, index: number): InferredHttpMethod {
  const window = content.slice(Math.max(0, index - 120), index + 40);
  for (const method of API_HTTP_METHODS) {
    if (new RegExp(`method:\\s*['"]${method}['"]`, 'i').test(window)) return method;
    if (new RegExp(`\\.${method.toLowerCase()}\\s*\\(`, 'i').test(window)) return method;
  }
  if (/fetch\s*\(/.test(window)) {
    const methodMatch = window.match(/method:\s*['"](GET|POST|PUT|PATCH|DELETE)['"]/i);
    if (methodMatch) return methodMatch[1].toUpperCase() as InferredHttpMethod;
  }
  return 'GET';
}

function lookupApiMeta(
  apiPath: string,
  index: Map<string, { method: string; permission: string }>
): { method: string; permission: string } | undefined {
  const direct = index.get(apiPath);
  if (direct) return direct;

  const suffix = apiPath.split('/').slice(3).join('/');
  for (const [key, value] of index.entries()) {
    const keySuffix = key.split('/').slice(3).join('/');
    if (keySuffix === suffix || key.endsWith(suffix)) return value;
  }
  return undefined;
}

function apiPathLabel(apiPath: string): string {
  const segments = apiPath.replace(/^\/(api|tenant-api)\//, '').split('/').filter(Boolean);
  const tail = segments.slice(-2).join(' ');
  return tail
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function permissionToActionKey(permission: string): string {
  const action = permission.includes(':') ? permission.split(':').slice(1).join(':') : permission;
  const normalized = action
    .replace(/-/g, '_')
    .replace(/^allocate_payment$/, 'allocate')
    .replace(/^credit_note$/, 'credit')
    .replace(/^debit_note$/, 'debit')
    .replace(/^write_off$/, 'writeoff')
    .replace(/^approve_sensitive$/, 'approve');
  return normalized.replace(/[^a-z0-9_]/gi, '_').replace(/_+/g, '_');
}

function permissionToLabel(permission: string): string {
  const action = permission.includes(':') ? permission.split(':').slice(1).join(':') : permission;
  return action
    .split(/[_-]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function inferActionsFromServerActionFiles(
  actionFiles: string[],
  pagePermissions: string[],
  existingActionKeys: string[]
): InferredAction[] {
  const pageSet = new Set(pagePermissions);
  const byPermission = new Map<string, Set<string>>();

  for (const file of actionFiles) {
    if (!fs.existsSync(file)) continue;
    const rel = relWebAdmin(file);
    for (const perm of extractPermissionsFromActionFile(fs.readFileSync(file, 'utf-8'))) {
      if (pageSet.has(perm)) continue;
      const files = byPermission.get(perm) ?? new Set<string>();
      files.add(rel);
      byPermission.set(perm, files);
    }
  }

  const usedKeys = new Set(existingActionKeys);
  const actions: InferredAction[] = [];

  for (const [permission, files] of [...byPermission.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    let actionKey = permissionToActionKey(permission);
    if (usedKeys.has(actionKey)) {
      const resource = permission.split(':')[0] ?? 'action';
      actionKey = `${resource}_${actionKey}`;
    }
    if (usedKeys.has(actionKey)) continue;

    usedKeys.add(actionKey);
    actions.push({
      actionKey,
      label: permissionToLabel(permission),
      permissions: [permission],
      evidenceFiles: [...files].sort(),
    });
  }

  return actions;
}

export function inferActionsFromEvidence(
  evidence: PermissionEvidenceRow[],
  pagePermissions: string[],
  existingActionKeys: string[]
): InferredAction[] {
  const pageSet = new Set(pagePermissions);
  const byPermission = new Map<string, Set<string>>();

  for (const row of evidence) {
    if (pageSet.has(row.permission)) continue;
    if (row.component === 'page_boundary') continue;
    const files = byPermission.get(row.permission) ?? new Set<string>();
    files.add(row.file);
    byPermission.set(row.permission, files);
  }

  const usedKeys = new Set(existingActionKeys);
  const actions: InferredAction[] = [];

  for (const [permission, files] of [...byPermission.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    let actionKey = permissionToActionKey(permission);
    if (usedKeys.has(actionKey)) {
      const resource = permission.split(':')[0] ?? 'action';
      actionKey = `${resource}_${actionKey}`;
    }
    if (usedKeys.has(actionKey)) continue;

    usedKeys.add(actionKey);
    actions.push({
      actionKey,
      label: permissionToLabel(permission),
      permissions: [permission],
      evidenceFiles: [...files].sort(),
    });
  }

  return actions;
}

const PERMISSION_CODE_RE = /^[a-z0-9_]+:[a-z0-9_]+$/;

function isValidPermissionCode(code: string): boolean {
  return PERMISSION_CODE_RE.test(code);
}

/** Permissions enforced inside Next.js server action modules. */
export function extractPermissionsFromActionFile(content: string): string[] {
  const codes = new Set<string>();

  for (const m of content.matchAll(/hasPermissionServer\(\s*['"]([^'"]+)['"]/g)) {
    if (isValidPermissionCode(m[1])) codes.add(m[1]);
  }
  for (const m of content.matchAll(/requirePermission\(\s*['"]([^'"]+)['"]/g)) {
    if (isValidPermissionCode(m[1])) codes.add(m[1]);
  }

  return [...codes].sort();
}

export function collectServerActionFiles(sourceFiles: string[]): string[] {
  const actionFiles = new Set<string>();

  for (const file of sourceFiles) {
    if (!fs.existsSync(file)) continue;
    const content = fs.readFileSync(file, 'utf-8');

    const importPatterns = [
      /import\s+(?:type\s+)?(?:\{[^}]*\}|\w+)\s+from\s+['"](@\/app\/actions\/[^'"]+)['"]/g,
      /import\s*\(\s*['"](@\/app\/actions\/[^'"]+)['"]\s*\)/g,
    ];

    for (const re of importPatterns) {
      re.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = re.exec(content)) !== null) {
        const resolved = resolveImportToFile(match[1], file);
        if (resolved) actionFiles.add(resolved);
      }
    }
  }

  return [...actionFiles].sort();
}

export function inferServerActionDependencies(actionFiles: string[]): InferredApiDependency[] {
  const deps: InferredApiDependency[] = [];

  for (const file of actionFiles) {
    if (!fs.existsSync(file)) continue;
    const content = fs.readFileSync(file, 'utf-8');
    const rel = relWebAdmin(file);
    const modulePath = `/app/actions/${rel.replace(/^app\/actions\//, '').replace(/\.tsx?$/, '')}`;
    const permissions = extractPermissionsFromActionFile(content);
    const hasAuth = /getAuthContext\s*\(/.test(content);

    deps.push({
      label: `Server action: ${path.basename(file).replace(/\.tsx?$/, '')}`,
      method: 'POST',
      path: modulePath,
      permissions,
      authOnly: permissions.length === 0 && hasAuth,
      external: false,
      sourceFiles: [rel],
    });
  }

  return deps.sort((a, b) => a.path.localeCompare(b.path));
}

export function inferApiDependenciesFromSources(
  sourceFiles: string[],
  apiIndex: Map<string, { method: string; permission: string }>
): InferredApiDependency[] {
  const byPath = new Map<string, InferredApiDependency>();

  const pathPatterns = [
    /fetch\s*\(\s*[`'"](\/(?:api|tenant-api)\/[^`'"]+)[`'"]/g,
    /rbacFetch\s*\(\s*[`'"](\/[^`'"]+)[`'"]/g,
    /submitJson\s*\(\s*['"][^'"]+['"]\s*,\s*[`'"](\/api\/[^`'"]+)[`'"]/g,
    /[`'"](\/(?:api|tenant-api)\/[a-zA-Z0-9_./\[\]-]+)[`'"]/g,
    /`(\/(?:api|tenant-api)\/[^`]+)`/g,
  ];

  for (const file of sourceFiles) {
    if (!fs.existsSync(file)) continue;
    const content = fs.readFileSync(file, 'utf-8');
    const rel = relWebAdmin(file);

    for (const re of pathPatterns) {
      re.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = re.exec(content)) !== null) {
        const normalized = normalizeApiPath(match[1]);
        if (!normalized) continue;
        if (normalized.startsWith('/api/auth/')) continue;

        const external = normalized.startsWith('/tenant-api/');
        const meta = lookupApiMeta(normalized, apiIndex);
        const method = (meta?.method ?? inferMethodNear(content, match.index)) as InferredHttpMethod;
        const permissions = meta?.permission ? [meta.permission] : [];

        const existing = byPath.get(normalized);
        if (existing) {
          existing.sourceFiles.push(rel);
          if (permissions.length && !existing.permissions.length) existing.permissions = permissions;
          continue;
        }

        byPath.set(normalized, {
          label: apiPathLabel(normalized),
          method,
          path: normalized,
          permissions,
          authOnly: !permissions.length && !external,
          external,
          sourceFiles: [rel],
        });
      }
    }
  }

  const httpDeps = [...byPath.values()].sort((a, b) => a.path.localeCompare(b.path));
  const actionFiles = collectServerActionFiles(sourceFiles);
  const serverDeps = inferServerActionDependencies(actionFiles);

  const merged = new Map<string, InferredApiDependency>();
  for (const dep of [...httpDeps, ...serverDeps]) {
    const existing = merged.get(dep.path);
    if (!existing) {
      merged.set(dep.path, dep);
      continue;
    }
    existing.sourceFiles.push(...dep.sourceFiles);
    if (dep.permissions.length && !existing.permissions.length) {
      existing.permissions = dep.permissions;
    }
  }

  return [...merged.values()].sort((a, b) => a.path.localeCompare(b.path));
}

export function collectInferenceContext(route: string): {
  sourceFiles: string[];
  actionFiles: string[];
  apiIndex: Map<string, { method: string; permission: string }>;
} {
  const sourceFiles = collectRelatedSourceFiles(route, 2);
  const actionFiles = collectServerActionFiles(sourceFiles);
  return {
    sourceFiles,
    actionFiles,
    apiIndex: loadApiPermissionIndex(),
  };
}
