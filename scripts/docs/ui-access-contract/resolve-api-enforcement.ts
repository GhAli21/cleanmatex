import type { ApiAccessEnforcement } from '../../../web-admin/lib/auth/access-contracts';

export interface ParsedApiDependency {
  path: string;
  enforcement: ApiAccessEnforcement;
  permissions: string[];
  notes: string[];
}

/** Strip query string for Next.js app router file resolution. */
export function normalizeApiDependencyPath(apiPath: string): string {
  const withoutQuery = apiPath.split('?')[0] ?? apiPath;
  return withoutQuery.trim();
}

function isExternalApiPath(apiPath: string): boolean {
  const normalized = normalizeApiDependencyPath(apiPath);
  return (
    normalized.startsWith('/tenant-api/') ||
    normalized.includes('app/actions/') ||
    normalized.startsWith('app/actions/')
  );
}

function notesIndicateAuthOnly(notes: string[]): boolean {
  const text = notes.join(' ').toLowerCase();
  return text.includes('auth-only') || text.includes('auth only');
}

function notesIndicateExternal(notes: string[]): boolean {
  const text = notes.join(' ').toLowerCase();
  return (
    text.includes('platform api') ||
    text.includes('external') ||
    text.includes('verify manually') ||
    text.includes('upstream')
  );
}

export function inferApiEnforcement(input: {
  path: string;
  enforcement?: ApiAccessEnforcement;
  permissions?: string[];
  notes?: string[];
}): ApiAccessEnforcement {
  if (input.enforcement) return input.enforcement;
  if (isExternalApiPath(input.path)) return 'external';
  if ((input.permissions?.length ?? 0) > 0) return 'permission';
  if (notesIndicateExternal(input.notes ?? [])) return 'external';
  if (notesIndicateAuthOnly(input.notes ?? [])) return 'auth_only';
  // No declared RBAC requirement → session + tenant tier (not permission).
  return 'auth_only';
}

/** True when route uses RBAC middleware or session auth with unauthorized response. */
export function routeContentSatisfiesEnforcement(
  content: string,
  enforcement: ApiAccessEnforcement
): boolean {
  if (enforcement === 'external') return true;

  const hasRequirePermission = content.includes('requirePermission');
  const hasSessionAuth =
    /getUser\s*\(/.test(content) &&
    (/Unauthorized/i.test(content) || /status:\s*401/.test(content));
  const hasAuthHelper =
    content.includes('requireAuth') ||
    content.includes('getAuthContext') ||
    content.includes('getTenantIdFromSession') ||
    content.includes('validateCSRF');

  if (enforcement === 'permission') {
    return hasRequirePermission;
  }

  return hasRequirePermission || hasSessionAuth || hasAuthHelper;
}

export function extractNotesFromDependencyEntry(entry: string): string[] {
  const notes: string[] = [];
  const stringNoteRe = /notes:\s*\[([\s\S]*?)\]/g;
  let match: RegExpExecArray | null;
  while ((match = stringNoteRe.exec(entry)) !== null) {
    const inner = match[1];
    const itemRe = /['"]([^'"]+)['"]/g;
    let item: RegExpExecArray | null;
    while ((item = itemRe.exec(inner)) !== null) {
      notes.push(item[1]);
    }
  }
  return notes;
}

export function extractPermissionsFromDependencyEntry(entry: string): string[] {
  const reqMatch = entry.match(/requirement:\s*\{([\s\S]*?)\}/);
  if (!reqMatch?.[1]) return [];
  const permissions: string[] = [];
  const permRe = /permissions:\s*\[([\s\S]*?)\]/;
  const permBlock = reqMatch[1].match(permRe);
  if (!permBlock?.[1]) return [];
  const itemRe = /['"]([^'"]+)['"]/g;
  let item: RegExpExecArray | null;
  while ((item = itemRe.exec(permBlock[1])) !== null) {
    permissions.push(item[1]);
  }
  return permissions;
}

export function splitApiDependencyObjects(arrayBody: string): string[] {
  const entries: string[] = [];
  let depth = 0;
  let start = -1;

  for (let i = 0; i < arrayBody.length; i++) {
    const ch = arrayBody[i];
    if (ch === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0 && start >= 0) {
        entries.push(arrayBody.slice(start, i + 1));
        start = -1;
      }
    }
  }

  return entries;
}

export function parseApiDependencyEntry(entry: string): ParsedApiDependency | null {
  const pathMatch = entry.match(/path:\s*['"]([^'"]+)['"]/);
  if (!pathMatch?.[1]) return null;

  const enforcementMatch = entry.match(
    /enforcement:\s*['"](permission|auth_only|external)['"]/
  );
  const notes = extractNotesFromDependencyEntry(entry);
  const permissions = extractPermissionsFromDependencyEntry(entry);

  const path = pathMatch[1];
  const enforcement = inferApiEnforcement({
    path,
    enforcement: enforcementMatch?.[1] as ApiAccessEnforcement | undefined,
    permissions,
    notes,
  });

  return { path, enforcement, permissions, notes };
}
