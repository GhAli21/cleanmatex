import * as fs from 'fs';
import * as path from 'path';
import type { AccessContractActionRecord, AccessContractRecord } from '../inventories/schema';
import { ACCESS_CONTRACTS_DIR } from '../inventories/paths';
import {
  extractBooleanField,
  extractStringArrayBlock,
  provenance,
  slugId,
  toRepoRelative,
} from './normalize';
import {
  extractResolvedPermissionArray,
  loadGlobalPermissionRegistry,
  registryForSource,
  type PermissionRegistry,
} from './resolve-permission-constants';

function stripComments(content: string): string {
  return content
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
}

function extractPermissionArray(
  block: string,
  field: string,
  registry: PermissionRegistry
): string[] {
  const resolved = extractResolvedPermissionArray(block, field, registry);
  if (resolved.length > 0) return resolved;
  return extractStringArrayBlock(block, field);
}

function extractActionsBlock(
  block: string,
  registry: PermissionRegistry
): AccessContractActionRecord[] {
  const actionsMatch = block.match(/actions:\s*\{([\s\S]*?)\n\s*\},?\s*(?:apiDependencies|notes|\})/);
  if (!actionsMatch?.[1]) return [];

  const actions: AccessContractActionRecord[] = [];
  const actionRe = /(\w+):\s*\{[\s\S]*?label:\s*['"]([^'"]+)['"][\s\S]*?requirement:\s*\{([\s\S]*?)\}/g;
  let match: RegExpExecArray | null;

  while ((match = actionRe.exec(actionsMatch[1])) !== null) {
    const requirementBlock = match[3];
    actions.push({
      actionKey: match[1],
      label: match[2],
      permissions: extractPermissionArray(requirementBlock, 'permissions', registry),
      permissionPrefixes: extractStringArrayBlock(requirementBlock, 'permissionPrefixes'),
      featureFlags: extractStringArrayBlock(requirementBlock, 'featureFlags'),
      workflowRoles: extractStringArrayBlock(requirementBlock, 'workflowRoles'),
      tenantRoles: extractStringArrayBlock(requirementBlock, 'tenantRoles'),
    });
  }

  return actions;
}

function countApiDependencies(block: string): number {
  const apiBlock = block.match(/apiDependencies:\s*\[([\s\S]*?)\]/);
  if (!apiBlock?.[1]) return 0;
  return (apiBlock[1].match(/path:\s*['"][^'"]+['"]/g) ?? []).length;
}

function extractPageBlock(contractBlock: string, fileContent: string): string | null {
  const inline = contractBlock.match(/page:\s*\{([\s\S]*?)\}/);
  if (inline) return inline[1] ?? '';

  const ref = contractBlock.match(/page:\s*([A-Z][A-Z0-9_]*)/);
  if (!ref?.[1]) return null;

  const constRe = new RegExp(`const ${ref[1]}\\s*=\\s*\\{([\\s\\S]*?)\\}\\s*as const`);
  const match = fileContent.match(constRe);
  return match?.[1] ?? null;
}

function parseAccessContractBlocks(
  content: string,
  sourceFile: string,
  globalRegistry: PermissionRegistry
): AccessContractRecord[] {
  const registry = registryForSource(globalRegistry, content);
  const cleaned = stripComments(content);
  const contracts: AccessContractRecord[] = [];
  const routeRe = /routePattern:\s*['"]([^'"]+)['"][\s\S]*?(?=routePattern:|$)/g;
  let match: RegExpExecArray | null;

  while ((match = routeRe.exec(cleaned)) !== null) {
    const block = match[0];
    const routePattern = match[1];
    const labelMatch = block.match(/label:\s*['"]([^'"]+)['"]/);
    const pageBlock = extractPageBlock(block, cleaned);

    if (!labelMatch?.[1] || pageBlock === null) continue;
    const relPath = toRepoRelative(sourceFile);

    contracts.push({
      id: slugId('access_contract', routePattern),
      kind: 'access_contract',
      routePattern,
      label: labelMatch[1],
      sourceFile: relPath,
      page: {
        permissions: extractPermissionArray(pageBlock, 'permissions', registry),
        permissionPrefixes: extractStringArrayBlock(pageBlock, 'permissionPrefixes'),
        featureFlags: extractStringArrayBlock(pageBlock, 'featureFlags'),
        workflowRoles: extractStringArrayBlock(pageBlock, 'workflowRoles'),
        tenantRoles: extractStringArrayBlock(pageBlock, 'tenantRoles'),
        requireAllPermissions: extractBooleanField(pageBlock, 'requireAllPermissions'),
        requireAllFeatureFlags: extractBooleanField(pageBlock, 'requireAllFeatureFlags'),
      },
      actions: extractActionsBlock(block, registry),
      apiDependencyCount: countApiDependencies(block),
      provenance: [provenance('access-contract-ts', relPath)],
    });
  }

  return contracts;
}

function findAccessContractFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...findAccessContractFiles(full));
    } else if (entry.name.endsWith('-access.ts')) {
      results.push(full);
    }
  }

  return results;
}

export function ingestAccessContractsTs(): { accessContracts: AccessContractRecord[]; sources: string[] } {
  const globalRegistry = loadGlobalPermissionRegistry();
  const files = findAccessContractFiles(ACCESS_CONTRACTS_DIR);
  const accessContracts: AccessContractRecord[] = [];
  const sources: string[] = [];

  for (const file of files) {
    const rel = toRepoRelative(file);
    sources.push(rel);
    const content = fs.readFileSync(file, 'utf-8');
    accessContracts.push(...parseAccessContractBlocks(content, file, globalRegistry));
  }

  return { accessContracts, sources };
}
