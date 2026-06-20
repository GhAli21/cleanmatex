import { execSync } from 'child_process';
import type { InventoryProvenance } from '../inventories/schema';
import { REPO_ROOT } from '../inventories/paths';

export function slugId(prefix: string, key: string): string {
  const normalized = key.replace(/[^a-zA-Z0-9._/-]+/g, '_').replace(/_+/g, '_');
  return `${prefix}:${normalized}`;
}

export function extractQuotedStrings(value: string): string[] {
  const matches = value.match(/['"]([^'"]+)['"]/g);
  if (!matches) return [];
  return matches.map((m) => m.slice(1, -1));
}

export function extractStringArrayBlock(content: string, field: string): string[] {
  const re = new RegExp(`${field}:\\s*\\[([^\\]]*)\\]`, 'm');
  const match = content.match(re);
  if (!match?.[1]) return [];
  return extractQuotedStrings(match[1]);
}

export function extractBooleanField(content: string, field: string): boolean | undefined {
  const re = new RegExp(`${field}:\\s*(true|false)`);
  const match = content.match(re);
  if (!match?.[1]) return undefined;
  return match[1] === 'true';
}

export function provenance(
  sourceType: string,
  sourcePath: string,
  options?: { extractedAt?: string; line?: number }
): InventoryProvenance {
  return {
    sourceType,
    sourcePath,
    extractedAt: options?.extractedAt,
    line: options?.line,
  };
}

export function resolveGitSha(): string | undefined {
  try {
    return execSync('git rev-parse --short HEAD', {
      cwd: REPO_ROOT,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return undefined;
  }
}

export function toRepoRelative(absolutePath: string): string {
  return absolutePath.replace(/\\/g, '/').replace(`${REPO_ROOT.replace(/\\/g, '/')}/`, '');
}
