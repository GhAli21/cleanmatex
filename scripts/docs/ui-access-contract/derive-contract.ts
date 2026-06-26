import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { ingestAccessContractsTs } from '../ingest/ingest-access-contracts-ts';
import { findContractForPath } from '../inventories/route-match';
import { EXTRACTED_PATHS, REPO_ROOT, WEB_ADMIN } from '../inventories/paths';
import { routeFromDashboardPage } from '../inventories/surface';
import {
  collectPageGateSourceFiles,
  extractPermissionCodesFromSource,
} from './extract-page-gate-permissions';
import {
  defaultAccessFilePathForRoute,
  resolveAccessFileForRoute,
} from './access-contract-files';
import type { AccessContractRecord } from '../inventories/schema';
import { scaffoldContractEntry } from './scaffold-contract';
import {
  collectInferenceContext,
  inferActionsFromEvidence,
  inferActionsFromServerActionFiles,
  inferApiDependenciesFromSources,
  type InferredAction,
  type InferredApiDependency,
} from './derive-source-scan';
import { navigationEvidenceForRoute } from './derive-navigation-inference';
import {
  patchExtendedContractFields,
  readContractActionKeysFromFile,
  readContractApiPathsFromFile,
  readContractActionMetaFromFile,
  type StalePruneOptions,
} from './derive-contract-patch';
import {
  buildPermissionConflictNote,
  buildStaleSummaryNote,
  findStaleActionKeys,
  findStaleApiPaths,
} from './derive-contract-stale';
import { extractPermissionsFromActionFile } from './derive-source-scan';

const PERMISSION_CODE_RE = /^[a-z0-9_]+:[a-z0-9_]+$/;

export type DeriveApplyAction =
  | 'create'
  | 'fill_empty'
  | 'merge_missing'
  | 'conflict'
  | 'noop'
  | 'skip_no_inference';

export interface PermissionEvidence {
  permission: string;
  source: 'wire_scan' | 'extract_json' | 'navigation';
  file: string;
  line?: number;
  component?: string;
}

export interface DeriveRouteProposal {
  route: string;
  label: string;
  accessFilePath: string;
  missingContract: boolean;
  inferredPagePermissions: string[];
  contractPagePermissions: string[];
  actionPermissionsInCode: string[];
  evidence: PermissionEvidence[];
  applyAction: DeriveApplyAction;
  applyPermissions: string[];
  inferredActions: InferredAction[];
  contractActionKeys: string[];
  inferredApiDependencies: InferredApiDependency[];
  contractApiPaths: string[];
  staleActionKeys: string[];
  staleApiPaths: string[];
  serverActionPaths: string[];
  inferredFeatureFlags: string[];
  messages: string[];
}

export interface DeriveOptions {
  refreshExtract?: boolean;
  apply?: boolean;
  force?: boolean;
  dryRun?: boolean;
  pruneStale?: boolean;
}

interface ExtractedScreen {
  file: string;
  route?: string;
  permission: string;
  component: string;
  line: number;
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

function isValidPermissionCode(code: string): boolean {
  return PERMISSION_CODE_RE.test(code);
}

function sortedUnique(codes: Iterable<string>): string[] {
  return [...new Set(codes)].filter(isValidPermissionCode).sort();
}

function relWebAdmin(absPath: string): string {
  return path.relative(WEB_ADMIN, absPath).replace(/\\/g, '/');
}

export function ensureExtractedPermissions(refresh: boolean): void {
  if (refresh || !fs.existsSync(EXTRACTED_PATHS.permissions)) {
    console.log('[derive] Running docs:extract-permissions...');
    execSync('npm run docs:extract-permissions', {
      cwd: REPO_ROOT,
      stdio: 'inherit',
      encoding: 'utf-8',
    });
  }
}

function loadExtractedScreens(): ExtractedScreen[] {
  if (!fs.existsSync(EXTRACTED_PATHS.permissions)) return [];
  const data = JSON.parse(fs.readFileSync(EXTRACTED_PATHS.permissions, 'utf-8')) as {
    screens?: ExtractedScreen[];
  };
  return data.screens ?? [];
}

function collectWireEvidence(route: string): PermissionEvidence[] {
  const evidence: PermissionEvidence[] = [];
  const gateFiles = collectPageGateSourceFiles(route);
  const pageFile = path.join(
    WEB_ADMIN,
    'app',
    'dashboard',
    ...route.replace(/^\/dashboard\/?/, '').split('/').filter(Boolean),
    'page.tsx'
  );
  const routeDir = path.dirname(pageFile);

  for (const file of gateFiles) {
    const content = fs.readFileSync(file, 'utf-8');
    const codes = extractPermissionCodesFromSource(content);
    const rel = relWebAdmin(file);
    const isPageBoundary = file === pageFile || path.dirname(file) === routeDir;

    for (const code of codes) {
      if (!isValidPermissionCode(code)) continue;
      evidence.push({
        permission: code,
        source: 'wire_scan',
        file: rel,
        component: isPageBoundary ? 'page_boundary' : 'imported_ui',
      });
    }
  }

  return evidence;
}

function collectExtractEvidence(route: string, gateFileRels: Set<string>): PermissionEvidence[] {
  const evidence: PermissionEvidence[] = [];

  for (const screen of loadExtractedScreens()) {
    const screenRoute = screen.route ?? routeFromDashboardPage(screen.file);
    const matchesRoute = screenRoute === route;
    const matchesGateFile = gateFileRels.has(screen.file.replace(/\\/g, '/'));

    if (!matchesRoute && !matchesGateFile) continue;
    if (!isValidPermissionCode(screen.permission)) continue;

    evidence.push({
      permission: screen.permission,
      source: 'extract_json',
      file: screen.file,
      line: screen.line,
      component: screen.component,
    });
  }

  return evidence;
}

function contractActionPermissions(contract: AccessContractRecord | null): string[] {
  if (!contract?.actions?.length) return [];
  const codes: string[] = [];
  for (const action of contract.actions) {
    codes.push(...(action.permissions ?? []));
  }
  return sortedUnique(codes);
}

function decideApplyAction(
  missingContract: boolean,
  contractPerms: string[],
  inferredPerms: string[],
  force: boolean
): { action: DeriveApplyAction; applyPermissions: string[]; messages: string[] } {
  const messages: string[] = [];

  if (inferredPerms.length === 0) {
    return { action: 'skip_no_inference', applyPermissions: [], messages: ['No inferable page permissions in code'] };
  }

  if (missingContract) {
    return { action: 'create', applyPermissions: inferredPerms, messages: ['Would create new contract block'] };
  }

  if (contractPerms.length === 0) {
    return {
      action: 'fill_empty',
      applyPermissions: inferredPerms,
      messages: ['Contract page.permissions is empty — would fill from code'],
    };
  }

  const contractSet = new Set(contractPerms);
  const missingInContract = inferredPerms.filter((p) => !contractSet.has(p));
  const extraInContract = contractPerms.filter((p) => !inferredPerms.includes(p));

  if (missingInContract.length === 0 && extraInContract.length === 0) {
    return { action: 'noop', applyPermissions: contractPerms, messages: ['Contract matches inferred page permissions'] };
  }

  if (missingInContract.length > 0 && extraInContract.length === 0) {
    return {
      action: 'merge_missing',
      applyPermissions: sortedUnique([...contractPerms, ...missingInContract]),
      messages: [`Would add missing permissions: [${missingInContract.join(', ')}]`],
    };
  }

  if (force) {
    return {
      action: 'merge_missing',
      applyPermissions: inferredPerms,
      messages: [
        `--force: would replace page.permissions with inferred set`,
        extraInContract.length ? `Contract-only (not in code): [${extraInContract.join(', ')}]` : '',
      ].filter(Boolean),
    };
  }

  messages.push(`Contract: [${contractPerms.join(', ')}]`);
  messages.push(`Inferred: [${inferredPerms.join(', ')}]`);
  if (missingInContract.length) messages.push(`In code, not in contract: [${missingInContract.join(', ')}]`);
  if (extraInContract.length) messages.push(`In contract, not inferred at page boundary: [${extraInContract.join(', ')}]`);

  return { action: 'conflict', applyPermissions: contractPerms, messages };
}

/**
 * Infer page.permissions for a route from wire scan + extracted-permissions.json.
 */
export function deriveRouteProposal(route: string, force = false): DeriveRouteProposal {
  const { accessContracts } = ingestAccessContractsTs();
  const contract = findContractForPath(accessContracts, route);
  const accessFilePath =
    contract?.sourceFile?.replace(/^web-admin\//, '') ??
    relWebAdmin(resolveAccessFileForRoute(route) ?? defaultAccessFilePathForRoute(route));

  const gateFiles = collectPageGateSourceFiles(route);
  const gateFileRels = new Set(gateFiles.map(relWebAdmin));

  const wireEvidence = collectWireEvidence(route);
  const extractEvidence = collectExtractEvidence(route, gateFileRels);
  const navMeta = navigationEvidenceForRoute(route);
  const navEvidence: PermissionEvidence[] = (navMeta?.permissions ?? []).map((permission) => ({
    permission,
    source: 'navigation',
    file: navMeta!.sourcePath,
    component: 'navigation_entry',
  }));
  const evidence = [...wireEvidence, ...extractEvidence, ...navEvidence];

  const allInferred = sortedUnique(evidence.map((e) => e.permission));
  const actionPermsInContract = contractActionPermissions(contract);
  const actionSet = new Set(actionPermsInContract);
  const contractPagePermissions = sortedUnique(contract?.page?.permissions ?? []);

  const pageFileRel = relWebAdmin(
    path.join(
      WEB_ADMIN,
      'app',
      'dashboard',
      ...route.replace(/^\/dashboard\/?/, '').split('/').filter(Boolean),
      'page.tsx'
    )
  );
  const routeDirPrefix = pageFileRel.replace(/\/page\.tsx$/, '');

  const pageBoundaryPerms = sortedUnique(
    evidence
      .filter(
        (e) =>
          e.component === 'page_boundary' ||
          e.file === pageFileRel ||
          (e.file.startsWith(`${routeDirPrefix}/`) && !e.file.includes('/src/features/'))
      )
      .map((e) => e.permission)
  );

  const navigationPagePerms = sortedUnique(
    evidence.filter((e) => e.source === 'navigation').map((e) => e.permission)
  );

  const featureUiPerms = sortedUnique(
    evidence.filter((e) => e.file.includes('src/features/')).map((e) => e.permission)
  );

  const inferredPagePermissions =
    pageBoundaryPerms.length > 0
      ? pageBoundaryPerms
      : navigationPagePerms.length > 0
        ? navigationPagePerms
        : featureUiPerms.length > 0 && contractPagePermissions.length > 0
          ? contractPagePermissions
          : allInferred.filter((p) => !actionSet.has(p));

  const inferredFeatureFlags = navMeta?.featureFlag ? [navMeta.featureFlag] : [];

  const actionPermissionsInCode = sortedUnique(
    featureUiPerms.filter((p) => !inferredPagePermissions.includes(p))
  );
  const { action, applyPermissions, messages } = decideApplyAction(
    !contract,
    contractPagePermissions,
    inferredPagePermissions,
    force
  );

  const absAccessPath = path.join(WEB_ADMIN, accessFilePath.replace(/^web-admin\//, ''));
  const contractActionKeys = contract
    ? (contract.actions?.map((a) => a.actionKey) ?? readContractActionKeysFromFile(absAccessPath, route))
    : readContractActionKeysFromFile(absAccessPath, route);

  const contractApiPaths = contract
    ? [] // filled from file parse for accuracy
    : [];
  const parsedApiPaths = readContractApiPathsFromFile(absAccessPath, route);

  const { sourceFiles, actionFiles, apiIndex } = collectInferenceContext(route);
  const inferredActionsFromUi = inferActionsFromEvidence(
    evidence,
    inferredPagePermissions.length ? inferredPagePermissions : contractPagePermissions,
    contractActionKeys
  );
  const inferredActionsFromServer = inferActionsFromServerActionFiles(
    actionFiles,
    inferredPagePermissions.length ? inferredPagePermissions : contractPagePermissions,
    [...contractActionKeys, ...inferredActionsFromUi.map((a) => a.actionKey)]
  );
  const inferredActions = [...inferredActionsFromUi, ...inferredActionsFromServer];
  const inferredApiDependencies = inferApiDependenciesFromSources(sourceFiles, apiIndex);

  const finalContractApiPaths = parsedApiPaths.length ? parsedApiPaths : contractApiPaths;

  const serverActionPaths = inferredApiDependencies
    .filter((d) => d.path.startsWith('/app/actions/'))
    .map((d) => d.path);

  const codePermissions = new Set(allInferred);
  for (const actionFile of actionFiles) {
    if (!fs.existsSync(actionFile)) continue;
    for (const p of extractPermissionsFromActionFile(fs.readFileSync(actionFile, 'utf-8'))) {
      codePermissions.add(p);
    }
  }

  const contractActionMeta = readContractActionMetaFromFile(absAccessPath, route);
  const inferredActionKeySet = new Set(inferredActions.map((a) => a.actionKey));
  const staleActionKeys = findStaleActionKeys(contractActionMeta, codePermissions, inferredActionKeySet);
  const staleApiPaths = findStaleApiPaths(
    finalContractApiPaths,
    inferredApiDependencies.map((d) => d.path)
  );

  if (navigationPagePerms.length) {
    messages.push(`Navigation permissions: [${navigationPagePerms.join(', ')}]`);
  }
  if (inferredFeatureFlags.length) {
    messages.push(`Navigation featureFlags: [${inferredFeatureFlags.join(', ')}]`);
  }
  if (inferredActions.length) {
    messages.push(
      `Inferred ${inferredActions.length} action(s): ${inferredActions.map((a) => a.actionKey).join(', ')}`
    );
  }
  if (inferredApiDependencies.length) {
    messages.push(
      `Inferred ${inferredApiDependencies.length} API path(s): ${inferredApiDependencies.map((d) => d.path).join(', ')}`
    );
  }
  if (serverActionPaths.length) {
    messages.push(`Server action module(s): ${serverActionPaths.join(', ')}`);
  }
  if (staleActionKeys.length) {
    messages.push(`Stale action(s) in contract (not in code): ${staleActionKeys.join(', ')}`);
  }
  if (staleApiPaths.length) {
    messages.push(`Stale API(s) in contract (not in code): ${staleApiPaths.join(', ')}`);
  }

  return {
    route,
    label: contract?.label ?? routeToLabel(route),
    accessFilePath,
    missingContract: !contract,
    inferredPagePermissions,
    contractPagePermissions,
    actionPermissionsInCode,
    evidence,
    applyAction: action,
    applyPermissions,
    inferredActions,
    contractActionKeys,
    inferredApiDependencies,
    contractApiPaths: finalContractApiPaths,
    staleActionKeys,
    staleApiPaths,
    serverActionPaths,
    inferredFeatureFlags,
    messages,
  };
}

export function deriveRoutes(routes: string[], options: DeriveOptions = {}): DeriveRouteProposal[] {
  if (options.refreshExtract) {
    ensureExtractedPermissions(true);
  } else {
    ensureExtractedPermissions(false);
  }

  return routes.map((route) => deriveRouteProposal(route, options.force ?? false));
}

function buildStalePruneOptions(
  proposal: DeriveRouteProposal,
  pruneStale: boolean,
  force: boolean
): StalePruneOptions | undefined {
  const deriveNotes: string[] = [];

  if (proposal.applyAction === 'conflict' && !force) {
    const conflictNote = buildPermissionConflictNote(
      proposal.contractPagePermissions,
      proposal.inferredPagePermissions
    );
    if (conflictNote) deriveNotes.push(conflictNote);
  }

  if (!pruneStale) {
    return deriveNotes.length ? { staleActionKeys: [], staleApiPaths: [], deriveNotes } : undefined;
  }

  const staleNote = buildStaleSummaryNote(proposal.staleActionKeys, proposal.staleApiPaths);
  if (staleNote) deriveNotes.push(staleNote);

  return {
    staleActionKeys: proposal.staleActionKeys,
    staleApiPaths: proposal.staleApiPaths,
    deriveNotes,
  };
}

function escapeRouteInRegex(route: string): string {
  return route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function patchPageFromDerive(
  filePath: string,
  route: string,
  permissions: string[],
  featureFlags: string[],
  dryRun: boolean
): boolean {
  const absPath = filePath.startsWith(WEB_ADMIN) ? filePath : path.join(WEB_ADMIN, filePath);
  if (!fs.existsSync(absPath)) return false;

  let content = fs.readFileSync(absPath, 'utf-8');
  const routeEscaped = escapeRouteInRegex(route);
  const blockRe = new RegExp(
    `(routePattern:\\s*['"]${routeEscaped}['"][\\s\\S]*?page:\\s*\\{)([\\s\\S]*?)(\\n\\s*\\},)`,
    'm'
  );
  const match = content.match(blockRe);
  if (!match) return false;

  let pageInner = match[2];
  const permsLiteral = permissions.map((p) => `'${p}'`).join(', ');
  const permsBlock = `permissions: [${permsLiteral}],\n      requireAllPermissions: true,`;

  if (/permissions:\s*\[/.test(pageInner)) {
    pageInner = pageInner.replace(/permissions:\s*\[[^\]]*\],?/, permsBlock);
    pageInner = pageInner.replace(/\/\/ TODO: add permission codes after DB migration\n?\s*/g, '');
  } else {
    pageInner = `\n      ${permsBlock}${pageInner}`;
  }

  if (featureFlags.length) {
    const flagsLiteral = featureFlags.map((f) => `'${f}'`).join(', ');
    const flagsBlock = `featureFlags: [${flagsLiteral}],\n      requireAllFeatureFlags: true,`;
    if (/featureFlags:\s*\[/.test(pageInner)) {
      pageInner = pageInner.replace(/featureFlags:\s*\[[^\]]*\],?/, flagsBlock);
    } else {
      pageInner = pageInner.replace(
        /requireAllPermissions:\s*true,?/,
        `requireAllPermissions: true,\n      ${flagsBlock}`
      );
    }
  }

  const next = content.replace(blockRe, `$1${pageInner}$3`);
  if (next === content) return false;

  if (!dryRun) {
    fs.writeFileSync(absPath, next, 'utf-8');
  }
  return true;
}

export interface ApplyDeriveResult {
  route: string;
  applied: boolean;
  message: string;
}

export function applyDeriveProposals(
  proposals: DeriveRouteProposal[],
  options: Pick<DeriveOptions, 'dryRun' | 'force' | 'pruneStale'> = {}
): ApplyDeriveResult[] {
  const results: ApplyDeriveResult[] = [];
  const dryRun = options.dryRun ?? false;
  const pruneStale = options.pruneStale ?? false;
  const force = options.force ?? false;

  for (const proposal of proposals) {
    const {
      route,
      applyAction,
      applyPermissions,
      accessFilePath,
      label,
      inferredActions,
      inferredApiDependencies,
      missingContract,
      inferredFeatureFlags,
    } = proposal;

    const absPath = path.join(WEB_ADMIN, accessFilePath.replace(/^web-admin\//, ''));
    const parts: string[] = [];
    const staleOpts = buildStalePruneOptions(proposal, pruneStale, force);

    if (applyAction === 'noop' || applyAction === 'skip_no_inference' || applyAction === 'conflict') {
      if (
        !missingContract &&
        (inferredActions.length || inferredApiDependencies.length || staleOpts)
      ) {
        const ext = patchExtendedContractFields(
          absPath,
          route,
          inferredActions,
          inferredApiDependencies,
          dryRun,
          staleOpts
        );
        if (ext.actionsPatched) parts.push('actions');
        if (ext.apiPatched) parts.push('apiDependencies');
        if (ext.stalePatched) parts.push('stale/comments');
      }

      if (parts.length) {
        results.push({
          route,
          applied: true,
          message: dryRun
            ? `Would update ${parts.join(' + ')} in ${accessFilePath}`
            : `Updated ${parts.join(' + ')} in ${accessFilePath}`,
        });
        continue;
      }

      results.push({
        route,
        applied: false,
        message:
          applyAction === 'conflict'
            ? `Skipped page.permissions (conflict) — use --force; no actions/api to add`
            : proposal.messages[0] ?? applyAction,
      });
      continue;
    }

    if (applyAction === 'create') {
      const result = scaffoldContractEntry({
        route,
        label,
        permissions: applyPermissions,
        dryRun,
      });
      if (!dryRun && (result.created || result.updated)) {
        patchExtendedContractFields(
          absPath,
          route,
          inferredActions,
          inferredApiDependencies,
          false,
          buildStalePruneOptions(proposal, pruneStale, force)
        );
        parts.push('contract', 'actions/api');
      } else if (dryRun) {
        parts.push('contract stub');
        if (inferredActions.length) parts.push(`${inferredActions.length} actions`);
        if (inferredApiDependencies.length) parts.push(`${inferredApiDependencies.length} APIs`);
      }
      results.push({
        route,
        applied: result.created || result.updated,
        message: dryRun ? `Would create ${accessFilePath} (${parts.join(', ')})` : result.message,
      });
      continue;
    }

    const patched = patchPageFromDerive(
      absPath,
      route,
      applyPermissions,
      inferredFeatureFlags,
      dryRun
    );
    if (patched) parts.push('page.permissions');

    const ext = patchExtendedContractFields(
      absPath,
      route,
      inferredActions,
      inferredApiDependencies,
      dryRun,
      staleOpts
    );
    if (ext.actionsPatched) parts.push('actions');
    if (ext.apiPatched) parts.push('apiDependencies');
    if (ext.stalePatched) parts.push('stale/comments');

    results.push({
      route,
      applied: patched || ext.actionsPatched || ext.apiPatched || ext.stalePatched,
      message:
        parts.length > 0
          ? dryRun
            ? `Would update ${parts.join(' + ')} in ${accessFilePath}`
            : `Updated ${parts.join(' + ')} in ${accessFilePath}`
          : `Failed to patch ${accessFilePath}`,
    });
  }

  return results;
}

export function printDeriveReport(
  proposals: DeriveRouteProposal[],
  options: { json?: boolean; verbose?: boolean } = {}
): void {
  if (options.json) {
    console.log(JSON.stringify(proposals, null, 2));
    return;
  }

  const interesting = options.verbose
    ? proposals
    : proposals.filter(
        (p) =>
          p.applyAction !== 'noop' ||
          p.inferredActions.length > 0 ||
          p.inferredApiDependencies.length > 0
      );

  console.log('\n════════════════════════════════════════════════════════════════════════');
  console.log(' UI Access Contract — Derive Report (code → contract proposal)');
  console.log('════════════════════════════════════════════════════════════════════════');
  console.log(` Routes: ${proposals.length}  |  Shown: ${interesting.length}${options.verbose ? ' (verbose)' : ''}`);
  console.log('');

  if (!interesting.length) {
    console.log(' All routes in scope match inferred page permissions (or no inference).');
    console.log('────────────────────────────────────────────────────────────────────────\n');
    return;
  }

  for (const p of interesting) {
    console.log(` ${p.route}`);
    console.log(`   contract file: ${p.accessFilePath}`);
    console.log(`   action:        ${p.applyAction}`);
    console.log(`   contract:      [${p.contractPagePermissions.join(', ') || '—'}]`);
    console.log(`   inferred:      [${p.inferredPagePermissions.join(', ') || '—'}]`);
    if (p.actionPermissionsInCode.length) {
      console.log(`   action-like:   [${p.actionPermissionsInCode.join(', ')}]`);
    }
    if (p.inferredActions.length) {
      for (const a of p.inferredActions) {
        const exists = p.contractActionKeys.includes(a.actionKey) ? ' (exists)' : ' (new)';
        console.log(`   action${exists}:      ${a.actionKey} → [${a.permissions.join(', ')}]`);
      }
    }
    if (p.inferredApiDependencies.length) {
      for (const d of p.inferredApiDependencies) {
        const exists = p.contractApiPaths.some((cp) => cp === d.path) ? ' (exists)' : ' (new)';
        const perm = d.permissions.length ? d.permissions.join(', ') : d.authOnly ? 'auth-only' : 'external';
        const kind = d.path.startsWith('/app/actions/') ? 'server-action' : 'api';
        console.log(`   ${kind}${exists}:    ${d.method} ${d.path} → ${perm}`);
      }
    }
    if (p.staleActionKeys.length) {
      console.log(`   stale actions: ${p.staleActionKeys.join(', ')} (use --prune-stale --apply to comment)`);
    }
    if (p.staleApiPaths.length) {
      console.log(`   stale apis:    ${p.staleApiPaths.join(', ')} (use --prune-stale --apply to comment)`);
    }
    for (const msg of p.messages) {
      console.log(`   ↳ ${msg}`);
    }
    console.log('');
  }

  console.log('────────────────────────────────────────────────────────────────────────\n');
}
