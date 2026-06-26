import * as fs from 'fs';
import * as path from 'path';
import { ingestAccessContractsTs } from '../ingest/ingest-access-contracts-ts';
import { findContractForPath } from '../inventories/route-match';
import { WEB_ADMIN } from '../inventories/paths';
import { auditWire, type WireIssue } from './audit-wire';
import { routeToPageFile } from './access-contract-files';
import { ensureSingleRouteExport } from './scaffold-contract';

export interface WireFixOptions {
  route: string;
  dryRun?: boolean;
  fixPage?: boolean;
  fixApi?: boolean;
}

export interface WireFixResult {
  pageFixed: boolean;
  apiFixed: string[];
  exportAdded: boolean;
  messages: string[];
}

function apiPathToRouteFile(apiPath: string): string | null {
  if (!apiPath.startsWith('/api/')) return null;
  const rel = apiPath.replace(/^\/api/, 'app/api');
  return path.join(WEB_ADMIN, rel, 'route.ts');
}

function extractApiPathsFromAccessFile(sourceFile: string, route: string): string[] {
  const full = path.join(WEB_ADMIN, sourceFile.replace(/^web-admin\//, ''));
  if (!fs.existsSync(full)) return [];
  const content = fs.readFileSync(full, 'utf-8');
  const routeEscaped = route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const block = content.match(
    new RegExp(`routePattern:\\s*['"]${routeEscaped}['"][\\s\\S]*?apiDependencies:\\s*\\[([\\s\\S]*?)\\]`)
  );
  if (!block?.[1]) return [];
  return [...block[1].matchAll(/path:\s*['"]([^'"]+)['"]/g)].map((m) => m[1]);
}

function extractPagePermissionsFromAccessFile(sourceFile: string, route: string): string[] {
  const full = path.join(WEB_ADMIN, sourceFile.replace(/^web-admin\//, ''));
  if (!fs.existsSync(full)) return [];
  const content = fs.readFileSync(full, 'utf-8');
  const routeBlock = content.match(
    new RegExp(`routePattern:\\s*['"]${route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"][\\s\\S]*?page:\\s*\\{([\\s\\S]*?)\\}`)
  );
  if (!routeBlock?.[1]) return [];
  const perms = routeBlock[1].match(/permissions:\s*\[([^\]]*)\]/);
  if (!perms?.[1]) return [];
  return [...perms[1].matchAll(/['"]([^'"]+)['"]/g)].map((m) => m[1]);
}

function fixApiRoute(routeFile: string, permission: string, dryRun: boolean): boolean {
  let content = fs.readFileSync(routeFile, 'utf-8');
  if (content.includes('requirePermission')) return false;

  if (!content.includes("from '@/lib/middleware/require-permission'")) {
    const firstImport = content.indexOf('import ');
    const importLine = "import { requirePermission } from '@/lib/middleware/require-permission'\n";
    if (firstImport >= 0) {
      const lineEnd = content.indexOf('\n', firstImport);
      content = content.slice(0, lineEnd + 1) + importLine + content.slice(lineEnd + 1);
    } else {
      content = importLine + content;
    }
  }

  const handlerRe = /export async function (GET|POST|PATCH|PUT|DELETE)\([^)]*\)\s*\{/;
  const handlerMatch = handlerRe.exec(content);
  if (!handlerMatch?.index) return false;

  const insertAt = handlerMatch.index + handlerMatch[0].length;
  const guard = `\n  const authCheck = await requirePermission('${permission}')(request)\n  if (authCheck) return authCheck\n`;
  content = content.slice(0, insertAt) + guard + content.slice(insertAt);

  if (!dryRun) {
    fs.writeFileSync(routeFile, content, 'utf-8');
  }
  return true;
}

function fixPageGate(
  pageFile: string,
  route: string,
  accessFile: string,
  exportName: string,
  dryRun: boolean
): boolean {
  let content = fs.readFileSync(pageFile, 'utf-8');
  if (content.includes('RequireAnyPermission')) return false;

  const importPath = accessFile
    .replace(/\\/g, '/')
    .match(/src\/features\/(.+)/)?.[1];
  if (!importPath) return false;

  const featureImport = `@features/${importPath.replace(/\.ts$/, '')}`;
  const requireImport = `import { RequireAnyPermission } from '@features/auth/ui/RequirePermission'`;
  const accessImport = `import { ${exportName} } from '${featureImport}'`;

  if (!content.includes(requireImport)) {
    const lastImport = content.lastIndexOf('\nimport ');
    const insertPos = lastImport >= 0 ? content.indexOf('\n', lastImport + 1) + 1 : 0;
    content = `${content.slice(0, insertPos)}${requireImport}\n${accessImport}\n${content.slice(insertPos)}`;
  }

  const defaultFnRe = /export default async function (\w+)\([^)]*\)\s*\{|export default function (\w+)\([^)]*\)\s*\{/;
  const fnMatch = defaultFnRe.exec(content);
  if (!fnMatch?.index) return false;

  const returnIdx = content.indexOf('return (', fnMatch.index);
  const returnBare = content.indexOf('return <', fnMatch.index);

  if (returnIdx >= 0 && (returnBare < 0 || returnIdx < returnBare)) {

  const openParen = content.indexOf('(', returnIdx);
  let depth = 0;
  let closeIdx = -1;
  for (let i = openParen; i < content.length; i++) {
    if (content[i] === '(') depth++;
    else if (content[i] === ')') {
      depth--;
      if (depth === 0) {
        closeIdx = i;
        break;
      }
    }
  }
  if (closeIdx < 0) return false;

  const inner = content.slice(openParen + 1, closeIdx).trim();
  const wrapped = `(\n    <RequireAnyPermission permissions={${exportName}.page.permissions ?? []}>\n      ${inner}\n    </RequireAnyPermission>\n  )`;
  content = content.slice(0, openParen) + wrapped + content.slice(closeIdx + 1);
  } else if (returnBare >= 0) {
    const jsxStart = returnBare + 'return '.length;
    let jsxEnd = content.indexOf(';', jsxStart);
    if (jsxEnd < 0) jsxEnd = content.indexOf('\n', jsxStart);
    if (jsxEnd < 0) return false;
    const inner = content.slice(jsxStart, jsxEnd).trim();
    const wrapped = `(\n    <RequireAnyPermission permissions={${exportName}.page.permissions ?? []}>\n      ${inner}\n    </RequireAnyPermission>\n  )`;
    content = content.slice(0, returnBare) + `return ${wrapped}` + content.slice(jsxEnd);
  } else {
    return false;
  }

  if (!dryRun) {
    fs.writeFileSync(pageFile, content, 'utf-8');
  }
  return true;
}

/**
 * Apply safe runtime gate fixes for a single route (page + local API).
 */
export function wireFix(options: WireFixOptions): WireFixResult {
  const { route, dryRun = false, fixPage = true, fixApi = true } = options;
  const messages: string[] = [];
  const apiFixed: string[] = [];
  let pageFixed = false;
  let exportAdded = false;

  const audit = auditWire({ route });
  const fixable = audit.issues.filter((i) => i.fixable);

  if (!fixable.length) {
    messages.push(`No fixable wire issues for ${route}`);
    return { pageFixed, apiFixed, exportAdded, messages };
  }

  const { accessContracts } = ingestAccessContractsTs();
  const contract = findContractForPath(accessContracts, route);
  if (!contract) {
    messages.push(`No contract for ${route}`);
    return { pageFixed, apiFixed, exportAdded, messages };
  }

  const accessFileAbs = path.join(WEB_ADMIN, contract.sourceFile.replace(/^web-admin\//, ''));

  if (fixPage && fixable.some((i) => i.kind === 'PAGE_GATE_MISSING')) {
    const { added, exportName } = ensureSingleRouteExport(accessFileAbs, route, dryRun);
    exportAdded = added;
    if (added) messages.push(`Added ${exportName} export to access file`);

    const pageFile = routeToPageFile(route);
    if (fs.existsSync(pageFile)) {
      const didFix = fixPageGate(pageFile, route, contract.sourceFile, exportName, dryRun);
      if (didFix) {
        pageFixed = true;
        messages.push(dryRun ? `Would wrap ${pageFile} with RequireAnyPermission` : `Wrapped ${pageFile}`);
      } else {
        messages.push(`Could not auto-wrap ${pageFile} — add RequireAnyPermission manually`);
      }
    }
  }

  if (fixApi) {
    const perms = extractPagePermissionsFromAccessFile(contract.sourceFile, route);
    const fallbackPerm = perms[0] ?? 'TODO_PERMISSION';
    const apiPaths = extractApiPathsFromAccessFile(contract.sourceFile, route);

    for (const apiPath of apiPaths) {
      const routeFile = apiPathToRouteFile(apiPath);
      if (!routeFile || !fs.existsSync(routeFile)) continue;
      const content = fs.readFileSync(routeFile, 'utf-8');
      if (content.includes('requirePermission')) continue;

      const didFix = fixApiRoute(routeFile, fallbackPerm, dryRun);
      if (didFix) {
        apiFixed.push(apiPath);
        messages.push(
          dryRun
            ? `Would add requirePermission('${fallbackPerm}') to ${apiPath}`
            : `Added requirePermission to ${apiPath}`
        );
      }
    }
  }

  return { pageFixed, apiFixed, exportAdded, messages };
}

export function wireFixScope(
  routes: string[],
  dryRun = false
): { results: WireFixResult[]; messages: string[] } {
  const messages: string[] = [];
  const results: WireFixResult[] = [];
  for (const route of routes) {
    const result = wireFix({ route, dryRun });
    results.push(result);
    for (const msg of result.messages) {
      messages.push(`[${route}] ${msg}`);
    }
  }
  return { results, messages };
}

export function printWireIssues(issues: WireIssue[]): void {
  if (!issues.length) {
    console.log('[ui-access-contract] wire audit: no issues');
    return;
  }
  for (const issue of issues) {
    const fixTag = issue.fixable ? ' [fixable]' : '';
    const fileTag = issue.file ? ` (${issue.file})` : '';
    console.warn(`[ui-access-contract] ${issue.kind}${fixTag}: ${issue.route} — ${issue.detail}${fileTag}`);
  }
}
