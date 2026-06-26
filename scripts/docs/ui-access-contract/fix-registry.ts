import * as fs from 'fs';
import * as path from 'path';
import { WEB_ADMIN } from '../inventories/paths';
import {
  findAccessContractFiles,
  readExportConstName,
  toRegistryImportPath,
  toRegistryImportToken,
} from './access-contract-files';

const REGISTRY_PATH = path.join(WEB_ADMIN, 'src/features/access/page-access-registry.ts');

export interface RegistryFixResult {
  fixed: boolean;
  addedImports: string[];
  addedSpreads: string[];
  dryRun: boolean;
}

function parseExistingImports(content: string): Set<string> {
  const tokens = new Set<string>();
  const re = /from '@features\/([^']+)'/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(content)) !== null) {
    tokens.add(match[1]);
  }
  return tokens;
}

function insertImportLine(content: string, importLine: string): string {
  const lines = content.split('\n');
  const lastImportIdx = lines.reduce((idx, line, i) => (line.startsWith('import ') ? i : idx), 0);
  lines.splice(lastImportIdx + 1, 0, importLine);
  return lines.join('\n');
}

function insertSpreadLine(content: string, spreadLine: string): string {
  const arrayStart = content.indexOf('export const PAGE_ACCESS_CONTRACTS');
  if (arrayStart < 0) throw new Error('PAGE_ACCESS_CONTRACTS not found');

  const openBracket = content.indexOf('[', arrayStart);
  const closeBracket = content.indexOf(']', openBracket);
  if (openBracket < 0 || closeBracket < 0) throw new Error('PAGE_ACCESS_CONTRACTS array bounds not found');

  const body = content.slice(openBracket + 1, closeBracket);
  const spreadLines = body
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('...'));

  spreadLines.push(spreadLine.trim());
  spreadLines.sort((a, b) => a.localeCompare(b));

  const indent = '  ';
  const newBody = `\n${spreadLines.map((l) => `${indent}${l}`).join('\n')}\n`;
  return content.slice(0, openBracket + 1) + newBody + content.slice(closeBracket);
}

/**
 * Add missing *-access.ts imports and spreads to page-access-registry.ts.
 */
export function fixRegistryImports(dryRun = false): RegistryFixResult {
  const registryContent = fs.readFileSync(REGISTRY_PATH, 'utf-8');
  const accessFiles = findAccessContractFiles();
  const existing = parseExistingImports(registryContent);

  const addedImports: string[] = [];
  const addedSpreads: string[] = [];
  let content = registryContent;

  for (const file of accessFiles) {
    const token = toRegistryImportToken(file);
    if (existing.has(token)) continue;

    const constName = readExportConstName(file);
    if (!constName) continue;

    const importPath = toRegistryImportPath(file);
    const importLine = `import { ${constName} } from '${importPath}'`;
    addedImports.push(importLine);
    addedSpreads.push(`...${constName},`);
    existing.add(token);
  }

  if (!addedImports.length) {
    return { fixed: false, addedImports, addedSpreads, dryRun };
  }

  for (const importLine of [...addedImports].sort()) {
    content = insertImportLine(content, importLine);
  }
  for (const spreadLine of addedSpreads) {
    content = insertSpreadLine(content, spreadLine);
  }

  if (!dryRun) {
    fs.writeFileSync(REGISTRY_PATH, content, 'utf-8');
  }

  return {
    fixed: true,
    addedImports,
    addedSpreads,
    dryRun,
  };
}

export function getMissingRegistryImports(): string[] {
  const registryContent = fs.readFileSync(REGISTRY_PATH, 'utf-8');
  return findAccessContractFiles()
    .map((file) => toRegistryImportToken(file))
    .filter((token) => !registryContent.includes(token));
}
