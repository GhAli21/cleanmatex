import * as fs from 'fs';
import * as path from 'path';
import { ACCESS_CONTRACTS_DIR, WEB_ADMIN } from '../inventories/paths';
import { extractQuotedStrings } from './normalize';

/** Map of export name → { MEMBER → permission code string }. */
export type PermissionRegistry = Map<string, Record<string, string>>;

const PERMISSIONS_CONST_RE =
  /export const (\w+_PERMISSIONS)\s*=\s*\{([\s\S]*?)\}\s*(?:as const)?/g;

const PERMISSION_MEMBER_RE = /(\w+):\s*['"]([^'"]+)['"]/g;

const PERMISSION_REF_RE = /\b(\w+_PERMISSIONS)\.(\w+)\b/g;

function parsePermissionObjectBody(body: string): Record<string, string> {
  const members: Record<string, string> = {};
  let match: RegExpExecArray | null;
  PERMISSION_MEMBER_RE.lastIndex = 0;
  while ((match = PERMISSION_MEMBER_RE.exec(body)) !== null) {
    members[match[1]] = match[2];
  }
  return members;
}

/** Parse `export const *_PERMISSIONS = { ... }` blocks from TypeScript source. */
export function parsePermissionObjectsFromSource(content: string): PermissionRegistry {
  const registry: PermissionRegistry = new Map();
  let match: RegExpExecArray | null;
  PERMISSIONS_CONST_RE.lastIndex = 0;
  while ((match = PERMISSIONS_CONST_RE.exec(content)) !== null) {
    registry.set(match[1], parsePermissionObjectBody(match[2]));
  }
  return registry;
}

function mergeRegistries(...registries: PermissionRegistry[]): PermissionRegistry {
  const merged: PermissionRegistry = new Map();
  for (const registry of registries) {
    for (const [name, members] of registry) {
      merged.set(name, { ...(merged.get(name) ?? {}), ...members });
    }
  }
  return merged;
}

function collectPermissionTsFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith('.ts'))
    .map((name) => path.join(dir, name));
}

function collectAccessContractFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectAccessContractFiles(full));
    } else if (entry.name.endsWith('-access.ts')) {
      results.push(full);
    }
  }
  return results;
}

/** Load all global `*_PERMISSIONS` maps from lib/constants/permissions and *-access.ts exports. */
export function loadGlobalPermissionRegistry(): PermissionRegistry {
  const registries: PermissionRegistry[] = [];

  for (const file of collectPermissionTsFiles(path.join(WEB_ADMIN, 'lib/constants/permissions'))) {
    registries.push(parsePermissionObjectsFromSource(fs.readFileSync(file, 'utf-8')));
  }

  for (const file of collectAccessContractFiles(ACCESS_CONTRACTS_DIR)) {
    registries.push(parsePermissionObjectsFromSource(fs.readFileSync(file, 'utf-8')));
  }

  return mergeRegistries(...registries);
}

export function registryForSource(
  globalRegistry: PermissionRegistry,
  sourceContent: string
): PermissionRegistry {
  return mergeRegistries(globalRegistry, parsePermissionObjectsFromSource(sourceContent));
}

export function resolvePermissionRef(
  registry: PermissionRegistry,
  objectName: string,
  member: string
): string | undefined {
  return registry.get(objectName)?.[member];
}

/**
 * Extract permission codes from `field: ['literal', OBJ.MEMBER, ...]`.
 * Resolves `*_PERMISSIONS.*` via registry; keeps string literals as-is.
 */
export function extractResolvedPermissionArray(
  content: string,
  field: string,
  registry: PermissionRegistry
): string[] {
  const re = new RegExp(`${field}:\\s*\\[([^\\]]*)\\]`, 'm');
  const match = content.match(re);
  if (!match?.[1]) return [];

  const inner = match[1];
  const resolved = new Set<string>();

  for (const literal of extractQuotedStrings(inner)) {
    resolved.add(literal);
  }

  let refMatch: RegExpExecArray | null;
  PERMISSION_REF_RE.lastIndex = 0;
  while ((refMatch = PERMISSION_REF_RE.exec(inner)) !== null) {
    const code = resolvePermissionRef(registry, refMatch[1], refMatch[2]);
    if (code) resolved.add(code);
  }

  return [...resolved];
}
