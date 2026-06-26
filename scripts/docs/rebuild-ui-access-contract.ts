#!/usr/bin/env npx tsx
/**
 * UI access contract workflow — scaffold contracts, register modules, audit/fix gates, sync inventories.
 *
 * Scope: full (default), --feature=marketing, or --route=/dashboard/help
 */

import { execSync } from 'child_process';
import * as path from 'path';
import { ingestAccessContractsTs } from './ingest/ingest-access-contracts-ts';
import { findContractForPath } from './inventories/route-match';
import { auditWire } from './ui-access-contract/audit-wire';
import { buildCheckReport, printCheckReport } from './ui-access-contract/check-report';
import { fixRegistryImports } from './ui-access-contract/fix-registry';
import { printRouteContract } from './ui-access-contract/print-route-contract';
import { listKnownFeatures, resolveScope } from './ui-access-contract/resolve-scope';
import { scaffoldContractEntry } from './ui-access-contract/scaffold-contract';
import { validateRegistryImports } from './ui-access-contract/validate-registry';
import { printWireIssues, wireFix, wireFixScope } from './ui-access-contract/wire-fix';
import {
  applyDeriveProposals,
  deriveRoutes,
  printDeriveReport,
} from './ui-access-contract/derive-contract';

const REPO_ROOT = path.resolve(__dirname, '../..');

type Command =
  | 'check'
  | 'sync'
  | 'full'
  | 'validate'
  | 'show'
  | 'scaffold'
  | 'register'
  | 'audit-wire'
  | 'wire'
  | 'refresh'
  | 'derive'
  | 'features';

interface ParsedArgs {
  command: Command;
  route?: string;
  feature?: string;
  label?: string;
  permissions: string[];
  dryRun: boolean;
  fix: boolean;
  syncAfter: boolean;
  wire: boolean;
  verbose: boolean;
  json: boolean;
  apply: boolean;
  force: boolean;
  refreshExtract: boolean;
  pruneStale: boolean;
}

function parseArgs(): ParsedArgs {
  const argv = process.argv.slice(2);
  const routeArg = argv.find((a) => a.startsWith('--route='));
  const featureArg = argv.find((a) => a.startsWith('--feature='));
  const labelArg = argv.find((a) => a.startsWith('--label='));
  const permsArg = argv.find((a) => a.startsWith('--permissions='));

  const route = routeArg?.slice('--route='.length);
  const feature = featureArg?.slice('--feature='.length);
  const label = labelArg?.slice('--label='.length);
  const permissions = permsArg
    ? permsArg
        .slice('--permissions='.length)
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean)
    : [];

  const positional = argv.filter((a) => !a.startsWith('--'));
  const command = (positional[0] ?? 'check') as Command;

  return {
    command,
    route,
    feature,
    label,
    permissions,
    dryRun: argv.includes('--dry-run'),
    fix: argv.includes('--fix'),
    syncAfter: argv.includes('--sync'),
    wire: argv.includes('--wire'),
    verbose: argv.includes('--verbose'),
    json: argv.includes('--json'),
    apply: argv.includes('--apply'),
    force: argv.includes('--force'),
    refreshExtract: argv.includes('--refresh-extract'),
    pruneStale: argv.includes('--prune-stale'),
  };
}

function resolveArgsScope(args: ParsedArgs) {
  try {
    return resolveScope({ route: args.route, feature: args.feature });
  } catch (err) {
    console.error(`[ui-access-contract] ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

function run(cmd: string) {
  console.log(`[ui-access-contract] ${cmd}`);
  execSync(cmd, { cwd: REPO_ROOT, stdio: 'inherit', encoding: 'utf-8' });
}

function runPlatformInventories(subcommand: string) {
  run(`npx tsx scripts/docs/rebuild-platform-info-inventories.ts ${subcommand}`);
}

function printHelp() {
  console.log(`
UI Access Contract orchestrator

Scope (pick one):
  (none)                  All dashboard routes (full)
  --feature=marketing     Feature module + its route prefixes
  --route=/dashboard/...  Single route tree

Usage:
  npm run check:ui-access-contract
  npm run check:ui-access-contract -- --feature=marketing --wire --verbose
  npm run check:ui-access-contract -- --route=/dashboard/help --wire
  npm run sync:ui-access-contract
  npm run rebuild:ui-access-contract
  npm run wire:ui-access-contract -- --feature=marketing --fix --dry-run

Commands:
  check        Detailed status report (coverage, registry, optional wire)
  sync         check (full) → ingest → reconcile → generate-views
  full         sync → extract-delta → full platform rebuild
  validate     check (full) + platform-inventories validate
  show         Print parsed contract JSON for --route=...
  features     List known --feature= keys

  scaffold     Add contract stub(s) — --route or --feature
  register     Register *-access.ts in page-access-registry.ts (--fix)
  audit-wire   Runtime gate report for scope (--wire implied)
  wire         Audit or --fix gates for scope
  refresh      scaffold → register --fix → wire --fix for scope
  derive       Reverse-engineer page.permissions from code (dry-run default; --apply to merge)

Flags:
  --feature=NAME             Feature scope (marketing, settings, core, orders, …)
  --route=/dashboard/...     Route scope
  --label="Page title"       Contract label for scaffold
  --permissions=code:read    Page permissions for scaffold
  --fix                      Apply registry / wire fixes
  --apply                    Apply derive proposals to *-access.ts (merge-safe; use with derive)
  --force                    derive --apply: replace page.permissions with inferred set on conflict
  --prune-stale              derive --apply: comment stale actions/apiDependencies not found in code
  --refresh-extract          Run docs:extract-permissions before derive
  --dry-run                  Preview without writing
  --sync                     After refresh, run sync pipeline
  --wire                     Include runtime gate audit in check
  --verbose                  Show all routes in check report (not only issues)
  --json                     Machine-readable check report
`);
}

function runFullCheck(): number {
  return cmdCheck({
    command: 'check',
    permissions: [],
    dryRun: false,
    fix: false,
    syncAfter: false,
    wire: false,
    verbose: false,
    json: false,
    apply: false,
    force: false,
    refreshExtract: false,
    pruneStale: false,
  });
}

function routesMissingContracts(routes: string[]): string[] {
  const { accessContracts } = ingestAccessContractsTs();
  return routes.filter((route) => !findContractForPath(accessContracts, route));
}

function cmdCheck(args: ParsedArgs): number {
  const scope = resolveArgsScope(args);
  const report = buildCheckReport(scope, args.wire);
  printCheckReport(report, { verbose: args.verbose, json: args.json });

  if (report.summary.overall === 'fail') return 1;
  if (report.summary.overall === 'warn' && !args.verbose) {
    console.log('[ui-access-contract] check passed with warnings (use --verbose for all routes)');
  } else if (report.summary.overall === 'pass') {
    console.log('[ui-access-contract] check passed');
  } else {
    console.log('[ui-access-contract] check completed with warnings');
  }
  return report.summary.overall === 'fail' ? 1 : 0;
}

function cmdFeatures(): number {
  const features = listKnownFeatures();
  console.log('[ui-access-contract] Known --feature= values:');
  for (const f of features) console.log(`  - ${f}`);
  return 0;
}

function cmdScaffold(args: ParsedArgs): number {
  const scope = resolveArgsScope(args);

  if (scope.kind === 'full') {
    console.error('[ui-access-contract] scaffold requires --route or --feature');
    return 1;
  }

  if (scope.kind === 'route' && !args.route) {
    console.error('[ui-access-contract] scaffold requires --route=/dashboard/...');
    return 1;
  }

  const targets =
    scope.kind === 'route'
      ? routesMissingContracts(
          scope.routes.includes(scope.routePrefixes[0])
            ? [scope.routePrefixes[0]]
            : scope.routes.slice(0, 1)
        )
      : routesMissingContracts(scope.routes);

  if (!targets.length) {
    console.log('[ui-access-contract] scaffold: all routes in scope already have contracts');
    return 0;
  }

  for (const route of targets) {
    const result = scaffoldContractEntry({
      route,
      label: args.label,
      permissions: args.permissions,
      dryRun: args.dryRun,
    });
    console.log(`[ui-access-contract] ${result.message}`);
  }
  return 0;
}

function cmdRegister(args: ParsedArgs): number {
  const scope = resolveArgsScope(args);
  const registry = validateRegistryImports();

  const missing =
    scope.kind === 'full'
      ? registry.missingImports
      : registry.missingImports.filter((token) =>
          scope.accessFiles.some((file) => file.replace(/\\/g, '/').includes(token.replace(/-access$/, '')))
        );

  if (!missing.length) {
    console.log('[ui-access-contract] registry: all in-scope *-access.ts modules registered');
    return 0;
  }

  console.warn('[ui-access-contract] Missing registry imports:');
  for (const m of missing) console.warn(`  - ${m}`);

  if (!args.fix) {
    console.warn('[ui-access-contract] Run with --fix to add imports to page-access-registry.ts');
    return 1;
  }

  const result = fixRegistryImports(args.dryRun);
  if (!result.fixed) {
    console.log('[ui-access-contract] registry: nothing to fix');
    return 0;
  }

  for (const line of result.addedImports) console.log(`[ui-access-contract] + ${line}`);
  for (const line of result.addedSpreads) console.log(`[ui-access-contract] + ${line}`);
  console.log(
    args.dryRun
      ? '[ui-access-contract] registry: dry-run complete'
      : '[ui-access-contract] registry: updated page-access-registry.ts'
  );
  return 0;
}

function cmdAuditWire(args: ParsedArgs): number {
  const scope = resolveArgsScope(args);
  const result = auditWire({ scope });
  console.log(`[ui-access-contract] Wire audit: ${result.routesAudited} route(s) in scope`);
  printWireIssues(result.issues);
  return result.passed ? 0 : 1;
}

function cmdWire(args: ParsedArgs): number {
  const scope = resolveArgsScope(args);

  if (scope.kind === 'full' && !args.fix) {
    return cmdAuditWire(args);
  }

  if (!args.fix) {
    return cmdAuditWire(args);
  }

  const routesWithIssues = auditWire({ scope }).issues
    .filter((i) => i.fixable && i.kind === 'PAGE_GATE_MISSING')
    .map((i) => {
      const match = scope.routes.find((r) => r === i.route || r.startsWith(`${i.route}/`));
      return match ?? i.route;
    });

  const routesToFix = [...new Set(routesWithIssues.length ? routesWithIssues : scope.routes)];

  const { messages } = wireFixScope(routesToFix, args.dryRun);
  for (const msg of messages) console.log(`[ui-access-contract] ${msg}`);

  const audit = auditWire({ scope });
  printWireIssues(audit.issues);
  return audit.passed ? 0 : 1;
}

function cmdDerive(args: ParsedArgs): number {
  if (args.apply && !args.route && !args.feature && !args.force) {
    console.error(
      '[ui-access-contract] derive --apply requires --route or --feature (or --force for full scope)'
    );
    return 1;
  }

  const scope = resolveArgsScope(args);
  const proposals = deriveRoutes(scope.routes, {
    refreshExtract: args.refreshExtract,
    apply: args.apply,
    force: args.force,
    dryRun: args.dryRun,
  });

  printDeriveReport(proposals, { json: args.json, verbose: args.verbose });

  if (!args.apply) {
    const actionable = proposals.filter(
      (p) =>
        (p.applyAction !== 'noop' && p.applyAction !== 'skip_no_inference') ||
        p.inferredActions.some((a) => !p.contractActionKeys.includes(a.actionKey)) ||
        p.inferredApiDependencies.some((d) => !p.contractApiPaths.includes(d.path))
    );
    console.log(
      `[ui-access-contract] derive dry-run: ${actionable.length} route(s) with proposals (use --apply to merge)`
    );
    return 0;
  }

  const applyResults = applyDeriveProposals(proposals, {
    dryRun: args.dryRun,
    force: args.force,
    pruneStale: args.pruneStale,
  });

  let applied = 0;
  for (const r of applyResults) {
    console.log(`[ui-access-contract] ${r.route}: ${r.message}`);
    if (r.applied) applied++;
  }

  if (!args.dryRun && applied > 0) {
    const registerCode = cmdRegister({ ...args, fix: true });
    if (registerCode !== 0) return registerCode;
  }

  console.log(`[ui-access-contract] derive apply: ${applied} route(s) updated`);
  return 0;
}

function cmdRefresh(args: ParsedArgs): number {
  if (!args.route && !args.feature) {
    console.error('[ui-access-contract] refresh requires --route or --feature');
    return 1;
  }

  const scaffoldCode = cmdScaffold(args);
  if (scaffoldCode !== 0) return scaffoldCode;

  const registerCode = cmdRegister({ ...args, fix: true });
  if (registerCode !== 0 && !args.dryRun) return registerCode;

  const wireCode = cmdWire({ ...args, fix: true });
  if (wireCode !== 0 && !args.dryRun && !args.syncAfter) return wireCode;

  if (args.syncAfter && !args.dryRun) {
    return cmdSync();
  }

  return wireCode;
}

function cmdSync(): number {
  const checkCode = runFullCheck();
  if (checkCode !== 0) return checkCode;

  runPlatformInventories('ingest');
  runPlatformInventories('reconcile');
  runPlatformInventories('generate-views');
  console.log('[ui-access-contract] sync complete — inventories refreshed from *-access.ts');
  return 0;
}

function cmdFull(): number {
  const checkCode = runFullCheck();
  if (checkCode !== 0) return checkCode;

  runPlatformInventories('extract-delta');
  runPlatformInventories('full');
  run('npm run check:platform-info-inventories');
  console.log('[ui-access-contract] full pipeline complete');
  return 0;
}

function cmdValidate(): number {
  const checkCode = runFullCheck();
  if (checkCode !== 0) return checkCode;

  run('npm run check:platform-info-inventories');
  console.log('[ui-access-contract] validate complete');
  return 0;
}

function main() {
  const args = parseArgs();

  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    printHelp();
    return;
  }

  if (args.route && args.feature) {
    console.error('[ui-access-contract] Use only one of --route or --feature');
    process.exit(1);
  }

  let exitCode = 0;

  switch (args.command) {
    case 'features':
      exitCode = cmdFeatures();
      break;
    case 'show':
      if (!args.route) {
        console.error('[ui-access-contract] show requires --route=/dashboard/...');
        exitCode = 1;
      } else {
        printRouteContract(args.route);
        exitCode = process.exitCode ?? 0;
      }
      break;
    case 'scaffold':
      exitCode = cmdScaffold(args);
      break;
    case 'register':
      exitCode = cmdRegister(args);
      break;
    case 'audit-wire':
      exitCode = cmdAuditWire(args);
      break;
    case 'wire':
      exitCode = cmdWire(args);
      break;
    case 'refresh':
      exitCode = cmdRefresh(args);
      break;
    case 'derive':
      exitCode = cmdDerive(args);
      break;
    case 'sync':
      exitCode = cmdSync();
      break;
    case 'full':
      exitCode = cmdFull();
      break;
    case 'validate':
      exitCode = cmdValidate();
      break;
    case 'check':
    default:
      exitCode = cmdCheck(args);
      break;
  }

  process.exit(exitCode);
}

main();
