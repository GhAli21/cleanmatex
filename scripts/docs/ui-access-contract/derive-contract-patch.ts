import * as fs from 'fs';
import * as path from 'path';
import { WEB_ADMIN } from '../inventories/paths';
import { apiPathsEquivalent } from './derive-contract-stale';
import type { InferredAction, InferredApiDependency } from './derive-source-scan';

function escapeRouteInRegex(route: string): string {
  return route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function getRouteBlock(content: string, route: string): { block: string; start: number; end: number } | null {
  const routeEscaped = escapeRouteInRegex(route);
  const routeMatch = content.match(
    new RegExp(`\\{\\s*routePattern:\\s*['"]${routeEscaped}['"]`)
  );
  if (!routeMatch?.index) return null;

  const braceStart = content.indexOf('{', routeMatch.index);
  if (braceStart < 0) return null;

  let depth = 0;
  for (let i = braceStart; i < content.length; i++) {
    if (content[i] === '{') depth++;
    else if (content[i] === '}') {
      depth--;
      if (depth === 0) {
        let end = i + 1;
        if (content[end] === ',') end++;
        return {
          block: content.slice(braceStart, end),
          start: braceStart,
          end,
        };
      }
    }
  }
  return null;
}

export function extractExistingActionKeys(block: string): string[] {
  const actionsMatch = block.match(/actions:\s*\{/);
  if (!actionsMatch?.index) return [];

  const keys: string[] = [];
  const actionsSection = block.slice(actionsMatch.index);
  const keyRe = /\n\s*(\/\/\s*)?(\w+):\s*\{/g;
  let m: RegExpExecArray | null;
  while ((m = keyRe.exec(actionsSection)) !== null) {
    if (m[1]) continue;
    keys.push(m[2]);
  }
  return keys;
}

export function extractExistingApiPaths(block: string): string[] {
  const paths: string[] = [];
  const apiStart = block.indexOf('apiDependencies:');
  if (apiStart < 0) return paths;
  const apiSection = block.slice(apiStart);
  const pathRe = /path:\s*['"]([^'"]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = pathRe.exec(apiSection)) !== null) {
    paths.push(m[1]);
  }
  return paths;
}

function buildActionEntry(action: InferredAction): string {
  const perms = action.permissions.map((p) => `'${p}'`).join(', ');
  return `      ${action.actionKey}: {
        label: '${action.label.replace(/'/g, "\\'")}',
        requirement: {
          permissions: [${perms}],
          requireAllPermissions: true,
        },
      },`;
}

function buildApiDependencyEntry(dep: InferredApiDependency): string {
  const lines = [
    `      {`,
    `        label: '${dep.label.replace(/'/g, "\\'")}',`,
    `        method: '${dep.method}',`,
    `        path: '${dep.path}',`,
  ];

  if (dep.path.startsWith('/app/actions/')) {
    lines.push(
      `        notes: ['Next.js server action module (not an HTTP /api route). Permissions inferred from action file or auth-only via session.'],`
    );
    if (dep.permissions.length) {
      lines.push(`        requirement: {`);
      lines.push(`          permissions: [${dep.permissions.map((p) => `'${p}'`).join(', ')}],`);
      lines.push(`          requireAllPermissions: true,`);
      lines.push(`        },`);
    }
  } else if (dep.external) {
    lines.push(
      `        notes: ['Platform API (${dep.path}); permission enforcement may be upstream — verify manually.'],`
    );
  } else if (dep.authOnly) {
    lines.push(
      `        notes: ['Auth-only route inferred from code; no requirePermission found in local API inventory.'],`
    );
  } else if (dep.permissions.length) {
    lines.push(`        requirement: {`);
    lines.push(`          permissions: [${dep.permissions.map((p) => `'${p}'`).join(', ')}],`);
    lines.push(`          requireAllPermissions: true,`);
    lines.push(`        },`);
  }

  lines.push(`      },`);
  return lines.join('\n');
}

function insertBeforeRouteBlockClose(block: string, insertion: string): string {
  let depth = 0;
  let closeBrace = -1;
  for (let i = 0; i < block.length; i++) {
    if (block[i] === '{') depth++;
    else if (block[i] === '}') {
      depth--;
      if (depth === 0) closeBrace = i;
    }
  }
  if (closeBrace < 0) return block;

  const before = block.slice(0, closeBrace).trimEnd();
  const needsComma = !before.endsWith(',');
  return `${before}${needsComma ? ',' : ''}\n${insertion}\n${block.slice(closeBrace)}`;
}

function mergeActionsIntoBlock(block: string, actions: InferredAction[]): string {
  if (!actions.length) return block;

  const existingKeys = new Set(extractExistingActionKeys(block));
  const toAdd = actions.filter((a) => !existingKeys.has(a.actionKey));
  if (!toAdd.length) return block;

  const entries = toAdd.map(buildActionEntry).join('\n');

  if (/actions:\s*\{/.test(block)) {
    return block.replace(/actions:\s*\{/, `actions: {\n${entries}`);
  }

  return insertBeforeRouteBlockClose(block, `    actions: {\n${entries}\n    },`);
}

function mergeApiDependenciesIntoBlock(block: string, deps: InferredApiDependency[]): string {
  if (!deps.length) return block;

  const existingPaths = extractExistingApiPaths(block);
  const toAdd = deps.filter(
    (d) => !existingPaths.some((existing) => apiPathsEquivalent(existing, d.path))
  );
  if (!toAdd.length) return block;

  const entries = toAdd.map(buildApiDependencyEntry).join('\n');

  if (/apiDependencies:\s*\[/.test(block)) {
    return block.replace(/apiDependencies:\s*\[/, `apiDependencies: [\n${entries}`);
  }

  return insertBeforeRouteBlockClose(block, `    apiDependencies: [\n${entries}\n    ],`);
}

function findObjectEntrySpan(
  block: string,
  keyPattern: RegExp
): { start: number; end: number; indent: string } | null {
  const match = keyPattern.exec(block);
  if (!match || match.index == null) return null;

  const braceStart = block.indexOf('{', match.index);
  if (braceStart < 0) return null;

  let depth = 0;
  for (let i = braceStart; i < block.length; i++) {
    if (block[i] === '{') depth++;
    else if (block[i] === '}') {
      depth--;
      if (depth === 0) {
        let end = i + 1;
        if (block[end] === ',') end++;
        const lineStart = block.lastIndexOf('\n', match.index) + 1;
        const indent = block.slice(lineStart, match.index).match(/^\s*/)?.[0] ?? '      ';
        return { start: lineStart, end, indent };
      }
    }
  }
  return null;
}

function commentLines(text: string, indent: string, prefix: string): string {
  return text
    .split('\n')
    .map((line, idx) => {
      if (!line.trim()) return line;
      if (idx === 0) return `${indent}// ${prefix}\n${indent}// ${line.trimStart()}`;
      return `${indent}// ${line.trimStart()}`;
    })
    .join('\n');
}

function commentStaleAction(block: string, actionKey: string): string {
  const span = findObjectEntrySpan(block, new RegExp(`\\n(\\s*)${actionKey}:\\s*\\{`));
  if (!span) return block;

  const entry = block.slice(span.start, span.end);
  if (entry.trimStart().startsWith('//')) return block;

  const commented = commentLines(
    entry,
    span.indent,
    `[derive-stale ${new Date().toISOString().slice(0, 10)}] No matching permission gate in scanned UI — commented for review`
  );
  return block.slice(0, span.start) + commented + block.slice(span.end);
}

function commentStaleApiEntry(block: string, apiPath: string): string {
  const apiStart = block.indexOf('apiDependencies:');
  if (apiStart < 0) return block;
  const apiSection = block.slice(apiStart);
  const pathNeedle = `path: '${apiPath}'`;
  const altNeedle = `path: "${apiPath}"`;
  const pathIdx = apiSection.indexOf(pathNeedle);
  const pathIdx2 = apiSection.indexOf(altNeedle);
  const relIdx = pathIdx >= 0 ? pathIdx : pathIdx2;
  if (relIdx < 0) return block;

  const absPathIdx = apiStart + relIdx;
  const objStart = block.lastIndexOf('{', absPathIdx);
  if (objStart < 0) return block;

  let depth = 0;
  for (let i = objStart; i < block.length; i++) {
    if (block[i] === '{') depth++;
    else if (block[i] === '}') {
      depth--;
      if (depth === 0) {
        let end = i + 1;
        if (block[end] === ',') end++;
        const lineStart = block.lastIndexOf('\n', objStart) + 1;
        const indent = block.slice(lineStart, objStart).match(/^\s*/)?.[0] ?? '      ';
        const entry = block.slice(lineStart, end);
        if (entry.trimStart().startsWith('//')) return block;
        const commented = commentLines(
          entry,
          indent,
          `[derive-stale ${new Date().toISOString().slice(0, 10)}] API path not found in scanned page/feature code — commented for review`
        );
        return block.slice(0, lineStart) + commented + block.slice(end);
      }
    }
  }
  return block;
}

function appendRouteNotes(block: string, notes: string[]): string {
  if (!notes.length) return block;

  const newNotes = notes.map((n) => `      '${n.replace(/'/g, "\\'")}',`).join('\n');

  if (/notes:\s*\[/.test(block)) {
    return block.replace(/notes:\s*\[/, `notes: [\n${newNotes}`);
  }
  return insertBeforeRouteBlockClose(block, `    notes: [\n${newNotes}\n    ],`);
}

export interface StalePruneOptions {
  staleActionKeys: string[];
  staleApiPaths: string[];
  deriveNotes: string[];
}

export function patchExtendedContractFields(
  filePath: string,
  route: string,
  actions: InferredAction[],
  apiDeps: InferredApiDependency[],
  dryRun: boolean,
  stale?: StalePruneOptions
): { actionsPatched: boolean; apiPatched: boolean; stalePatched: boolean } {
  const absPath = filePath.startsWith(WEB_ADMIN) ? filePath : path.join(WEB_ADMIN, filePath);
  if (!fs.existsSync(absPath)) {
    return { actionsPatched: false, apiPatched: false, stalePatched: false };
  }

  const content = fs.readFileSync(absPath, 'utf-8');
  const routeBlock = getRouteBlock(content, route);
  if (!routeBlock) {
    return { actionsPatched: false, apiPatched: false, stalePatched: false };
  }

  let block = routeBlock.block;
  const beforeActions = block;

  block = mergeActionsIntoBlock(block, actions);
  const afterActions = block;

  block = mergeApiDependenciesIntoBlock(block, apiDeps);
  const afterApi = block;

  let stalePatched = false;
  if (stale) {
    for (const key of stale.staleActionKeys) {
      const next = commentStaleAction(block, key);
      if (next !== block) {
        block = next;
        stalePatched = true;
      }
    }
    for (const apiPath of stale.staleApiPaths) {
      const next = commentStaleApiEntry(block, apiPath);
      if (next !== block) {
        block = next;
        stalePatched = true;
      }
    }
    if (stale.deriveNotes.length) {
      const withNotes = appendRouteNotes(block, stale.deriveNotes);
      if (withNotes !== block) {
        block = withNotes;
        stalePatched = true;
      }
    }
  }

  if (block === routeBlock.block) {
    return {
      actionsPatched: afterActions !== beforeActions,
      apiPatched: afterApi !== afterActions,
      stalePatched: false,
    };
  }

  const next = content.slice(0, routeBlock.start) + block + content.slice(routeBlock.end);

  if (!dryRun) {
    fs.writeFileSync(absPath, next, 'utf-8');
  }

  return {
    actionsPatched: afterActions !== beforeActions,
    apiPatched: afterApi !== afterActions,
    stalePatched,
  };
}

export function readContractActionKeysFromFile(filePath: string, route: string): string[] {
  const absPath = filePath.startsWith(WEB_ADMIN) ? filePath : path.join(WEB_ADMIN, filePath);
  if (!fs.existsSync(absPath)) return [];
  const routeBlock = getRouteBlock(fs.readFileSync(absPath, 'utf-8'), route);
  return routeBlock ? extractExistingActionKeys(routeBlock.block) : [];
}

export function readContractApiPathsFromFile(filePath: string, route: string): string[] {
  const absPath = filePath.startsWith(WEB_ADMIN) ? filePath : path.join(WEB_ADMIN, filePath);
  if (!fs.existsSync(absPath)) return [];
  const routeBlock = getRouteBlock(fs.readFileSync(absPath, 'utf-8'), route);
  return routeBlock ? extractExistingApiPaths(routeBlock.block) : [];
}

export function readContractActionMetaFromFile(
  filePath: string,
  route: string
): { actionKey: string; permissions: string[] }[] {
  const absPath = filePath.startsWith(WEB_ADMIN) ? filePath : path.join(WEB_ADMIN, filePath);
  if (!fs.existsSync(absPath)) return [];
  const routeBlock = getRouteBlock(fs.readFileSync(absPath, 'utf-8'), route);
  if (!routeBlock) return [];

  const results: { actionKey: string; permissions: string[] }[] = [];
  for (const key of extractExistingActionKeys(routeBlock.block)) {
    const span = findObjectEntrySpan(routeBlock.block, new RegExp(`\\n\\s*${key}:\\s*\\{`));
    if (!span) continue;
    const chunk = routeBlock.block.slice(span.start, span.end);
    const perms = [...chunk.matchAll(/permissions:\s*\[([^\]]+)\]/g)].flatMap((m) =>
      [...m[1].matchAll(/['"]([^'"]+)['"]/g)].map((p) => p[1])
    );
    results.push({ actionKey: key, permissions: [...new Set(perms)] });
  }
  return results;
}
