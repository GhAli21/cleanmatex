import { findAccessContractFiles, toRegistryImportToken } from './access-contract-files';
import * as fs from 'fs';
import * as path from 'path';
import { WEB_ADMIN } from '../inventories/paths';

export interface RegistryImportResult {
  accessFiles: string[];
  missingImports: string[];
  passed: boolean;
}

/**
 * Every *-access.ts under features/ should be imported by page-access-registry.ts
 */
export function validateRegistryImports(): RegistryImportResult {
  const registryPath = path.join(WEB_ADMIN, 'src/features/access/page-access-registry.ts');
  const registryContent = fs.readFileSync(registryPath, 'utf-8');
  const accessFiles = findAccessContractFiles();

  const missingImports = accessFiles
    .map((file) => toRegistryImportToken(file))
    .filter((token) => !registryContent.includes(token));

  return {
    accessFiles: accessFiles.map((f) => f.replace(/\\/g, '/')),
    missingImports,
    passed: missingImports.length === 0,
  };
}
