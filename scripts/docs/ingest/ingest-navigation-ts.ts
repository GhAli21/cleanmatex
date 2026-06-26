import * as fs from 'fs';
import type { NavigationEntryRecord } from '../inventories/schema';
import { NAVIGATION_TS } from '../inventories/paths';
import { extractQuotedStrings, extractStringArrayBlock, provenance, slugId, toRepoRelative } from './normalize';
import {
  extractResolvedPermissionArray,
  loadGlobalPermissionRegistry,
  registryForSource,
} from './resolve-permission-constants';

function resolveFeatureFlag(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim();
  if (trimmed.startsWith("'") || trimmed.startsWith('"')) {
    return trimmed.slice(1, -1);
  }
  const flagKeysMatch = trimmed.match(/FLAG_KEYS\.(\w+)/);
  if (flagKeysMatch) {
    return flagKeysMatch[1].toLowerCase();
  }
  return trimmed;
}

function parseNavigationObjectBlock(
  block: string,
  depth: 'section' | 'child',
  permissionRegistry: ReturnType<typeof loadGlobalPermissionRegistry>,
  parentKey?: string
): NavigationEntryRecord | null {
  const keyMatch = block.match(/key:\s*['"]([^'"]+)['"]/);
  const labelMatch = block.match(/label:\s*['"]([^'"]+)['"]/);
  const pathMatch = block.match(/path:\s*['"]([^'"]+)['"]/);

  if (!keyMatch?.[1] || !labelMatch?.[1] || !pathMatch?.[1]) return null;

  const featureFlagRaw = block.match(/featureFlag:\s*([^,\n]+)/)?.[1];
  const roles = extractStringArrayBlock(block, 'roles');

  return {
    id: slugId('nav', `${depth}:${keyMatch[1]}:${pathMatch[1]}`),
    kind: 'navigation_entry',
    key: keyMatch[1],
    label: labelMatch[1],
    path: pathMatch[1],
    depth,
    parentKey,
    permissions: (() => {
      const resolved = extractResolvedPermissionArray(block, 'permissions', permissionRegistry);
      return resolved.length > 0 ? resolved : extractStringArrayBlock(block, 'permissions');
    })(),
    featureFlag: resolveFeatureFlag(featureFlagRaw),
    roles: roles.length > 0 ? roles : undefined,
    provenance: [provenance('navigation-ts', toRepoRelative(NAVIGATION_TS))],
  };
}

export function ingestNavigationTs(): { navigationEntries: NavigationEntryRecord[]; sources: string[] } {
  const content = fs.readFileSync(NAVIGATION_TS, 'utf-8');
  const permissionRegistry = registryForSource(loadGlobalPermissionRegistry(), content);
  const sectionsStart = content.indexOf('export const NAVIGATION_SECTIONS');
  const sectionsContent = sectionsStart >= 0 ? content.slice(sectionsStart) : content;

  const navigationEntries: NavigationEntryRecord[] = [];
  const sectionRe = /\{\s*key:\s*['"][^'"]+['"][\s\S]*?(?=\n\s*\},?\s*\n\s*\{|\n\s*\];)/g;
  let sectionMatch: RegExpExecArray | null;

  while ((sectionMatch = sectionRe.exec(sectionsContent)) !== null) {
    const sectionBlock = sectionMatch[0];
    const section = parseNavigationObjectBlock(sectionBlock, 'section', permissionRegistry);
    if (section) navigationEntries.push(section);

    const childrenMatch = sectionBlock.match(/children:\s*\[([\s\S]*?)\]\s*,?\s*(?:\}|$)/);
    if (!childrenMatch?.[1] || !section) continue;

    const childRe = /\{\s*key:\s*['"][^'"]+['"][\s\S]*?\}/g;
    let childMatch: RegExpExecArray | null;
    while ((childMatch = childRe.exec(childrenMatch[1])) !== null) {
      const child = parseNavigationObjectBlock(childMatch[0], 'child', permissionRegistry, section.key);
      if (child) navigationEntries.push(child);
    }
  }

  return {
    navigationEntries,
    sources: [toRepoRelative(NAVIGATION_TS)],
  };
}
