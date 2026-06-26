import * as fs from 'fs';
import * as path from 'path';
import {
  defaultAccessFilePathForRoute,
  extractRoutePatterns,
  readExportConstName,
  resolveAccessFileForRoute,
} from './access-contract-files';

export interface ScaffoldOptions {
  route: string;
  label?: string;
  permissions?: string[];
  dryRun?: boolean;
}

export interface ScaffoldResult {
  created: boolean;
  updated: boolean;
  filePath: string;
  route: string;
  message: string;
}

function routeToLabel(route: string): string {
  const parts = route.split('/').filter(Boolean);
  const last = parts[parts.length - 1] ?? 'Page';
  if (last.startsWith('[')) {
    const prev = parts[parts.length - 2] ?? 'Page';
    return prev
      .split('-')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  }
  return last
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function featureNameFromPath(filePath: string): string {
  const rel = filePath.replace(/\\/g, '/');
  const match = rel.match(/features\/([^/]+)\/access\//);
  return match?.[1] ?? 'feature';
}

function newAccessFileTemplate(feature: string, exportName: string, stub: string): string {
  return `import type { PageAccessContract } from '@/lib/auth/access-contracts';

export const ${exportName}: PageAccessContract[] = [
${stub}
];
`;
}

function buildContractStub(route: string, label: string, permissions: string[]): string {
  const permsBody =
    permissions.length > 0
      ? `      permissions: [${permissions.map((p) => `'${p}'`).join(', ')}],\n      requireAllPermissions: true,`
      : `      permissions: [],\n      // TODO: add permission codes after DB migration`;

  return `  {
    routePattern: '${route}',
    label: '${label.replace(/'/g, "\\'")}',
    page: {
${permsBody}
    },
  },`;
}

function insertContractStub(content: string, stub: string): string {
  const arrayMatch = content.match(/export const \w+_ACCESS_CONTRACTS[^=]*=\s*\[/);
  if (!arrayMatch?.index) {
    throw new Error('Could not find ACCESS_CONTRACTS array in file');
  }

  const closeIdx = content.lastIndexOf('];');
  if (closeIdx < 0) {
    throw new Error('Could not find closing ]; for ACCESS_CONTRACTS array');
  }

  const beforeClose = content.slice(0, closeIdx).trimEnd();
  const needsComma = !beforeClose.endsWith('[') && !beforeClose.endsWith(',');
  const insertion = `${needsComma ? ',' : ''}\n${stub}\n`;
  return `${content.slice(0, closeIdx)}${insertion}${content.slice(closeIdx)}`;
}

/**
 * Add a contract entry to the resolved *-access.ts file when routePattern is missing.
 */
export function scaffoldContractEntry(options: ScaffoldOptions): ScaffoldResult {
  const { route, label, permissions = [], dryRun = false } = options;

  let filePath = resolveAccessFileForRoute(route) ?? defaultAccessFilePathForRoute(route);
  const stub = buildContractStub(route, label ?? routeToLabel(route), permissions);

  if (!fs.existsSync(filePath)) {
    const feature = featureNameFromPath(filePath);
    const exportName = `${feature.replace(/-/g, '_').toUpperCase()}_ACCESS_CONTRACTS`;
    const content = newAccessFileTemplate(feature, exportName, stub);
    if (dryRun) {
      return {
        created: true,
        updated: false,
        filePath,
        route,
        message: `Would create ${filePath}`,
      };
    }
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, content, 'utf-8');
    return {
      created: true,
      updated: true,
      filePath,
      route,
      message: `Created ${filePath} with contract for ${route}`,
    };
  }

  const patterns = extractRoutePatterns(filePath);
  if (patterns.includes(route)) {
    return {
      created: false,
      updated: false,
      filePath,
      route,
      message: `Contract already exists for ${route} in ${filePath}`,
    };
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const next = insertContractStub(content, stub);

  if (dryRun) {
    return {
      created: false,
      updated: true,
      filePath,
      route,
      message: `Would append contract for ${route} to ${filePath}`,
    };
  }

  fs.writeFileSync(filePath, next, 'utf-8');
  return {
    created: false,
    updated: true,
    filePath,
    route,
    message: `Added contract for ${route} to ${filePath}`,
  };
}

export function ensureSingleRouteExport(
  accessFilePath: string,
  route: string,
  dryRun = false
): { added: boolean; exportName: string } {
  const exportName = routeToSingleExportConst(route, accessFilePath);
  const content = fs.readFileSync(accessFilePath, 'utf-8');
  if (content.includes(`export const ${exportName}`)) {
    return { added: false, exportName };
  }

  const arrayConst = readExportConstName(accessFilePath);
  if (!arrayConst) {
    throw new Error(`No ACCESS_CONTRACTS export in ${accessFilePath}`);
  }

  const snippet = `\nexport const ${exportName} =\n  ${arrayConst}.find((contract) => contract.routePattern === '${route}')!\n`;
  const next = content.trimEnd() + snippet;

  if (!dryRun) {
    fs.writeFileSync(accessFilePath, next, 'utf-8');
  }
  return { added: true, exportName };
}

function routeToSingleExportConst(route: string, accessFilePath: string): string {
  const feature = featureNameFromPath(accessFilePath).replace(/-/g, '_').toUpperCase();
  const suffix = route
    .replace(/^\/dashboard\/?/, '')
    .split('/')
    .filter((s) => s && !s.startsWith('['))
    .map((s) => s.replace(/-/g, '_').toUpperCase())
    .join('_');
  return suffix ? `${feature}_${suffix}_ACCESS` : `${feature}_ACCESS`;
}
