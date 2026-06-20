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

function stripComments(content: string): string {
  return content
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/[^\n]*/g, '');
}

function extractActionsBlock(block: string): AccessContractActionRecord[] {
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
      permissions: extractStringArrayBlock(requirementBlock, 'permissions'),
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

function parseAccessContractBlocks(content: string, sourceFile: string): AccessContractRecord[] {
  const cleaned = stripComments(content);
  const contracts: AccessContractRecord[] = [];
  const routeRe = /routePattern:\s*['"]([^'"]+)['"][\s\S]*?(?=routePattern:|$)/g;
  let match: RegExpExecArray | null;

  while ((match = routeRe.exec(cleaned)) !== null) {
    const block = match[0];
    const routePattern = match[1];
    const labelMatch = block.match(/label:\s*['"]([^'"]+)['"]/);
    const pageMatch = block.match(/page:\s*\{([\s\S]*?)\}/);

    if (!labelMatch?.[1] || !pageMatch) continue;

    const pageBlock = pageMatch[1] ?? '';
    const relPath = toRepoRelative(sourceFile);

    contracts.push({
      id: slugId('access_contract', routePattern),
      kind: 'access_contract',
      routePattern,
      label: labelMatch[1],
      sourceFile: relPath,
      page: {
        permissions: extractStringArrayBlock(pageBlock, 'permissions'),
        permissionPrefixes: extractStringArrayBlock(pageBlock, 'permissionPrefixes'),
        featureFlags: extractStringArrayBlock(pageBlock, 'featureFlags'),
        workflowRoles: extractStringArrayBlock(pageBlock, 'workflowRoles'),
        tenantRoles: extractStringArrayBlock(pageBlock, 'tenantRoles'),
        requireAllPermissions: extractBooleanField(pageBlock, 'requireAllPermissions'),
        requireAllFeatureFlags: extractBooleanField(pageBlock, 'requireAllFeatureFlags'),
      },
      actions: extractActionsBlock(block),
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
  const files = findAccessContractFiles(ACCESS_CONTRACTS_DIR);
  const accessContracts: AccessContractRecord[] = [];
  const sources: string[] = [];

  for (const file of files) {
    const rel = toRepoRelative(file);
    sources.push(rel);
    const content = fs.readFileSync(file, 'utf-8');
    accessContracts.push(...parseAccessContractBlocks(content, file));
  }

  return { accessContracts, sources };
}
