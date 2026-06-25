#!/usr/bin/env npx tsx
/**
 * Reconcile declarative inventories (access contracts, navigation) vs code scans.
 * Emits DRIFT_REPORT.md, GENERATED_UNDOCUMENTED.md, GENERATED_ORPHANS.md
 */

import * as fs from 'fs';
import * as path from 'path';
import type { AccessContractRecord, NavigationEntryRecord, PlatformInfoInventory } from './inventories/schema';
import type { DriftItem, KnownExceptionsFile, ReconcileResult } from './inventories/drift-types';
import {
  findContractForPath,
  matchesRoutePattern,
} from './inventories/route-match';
import {
  DRIFT_REPORT,
  GENERATED_ORPHANS,
  GENERATED_UNDOCUMENTED,
  INVENTORIES_DIR,
  INVENTORY_OUTPUT,
  KNOWN_EXCEPTIONS,
  WEB_ADMIN,
} from './inventories/paths';
import { syncWebAdminInventoryRuntimeCopy } from './inventories/sync-runtime-copy';

function slugDriftId(kind: string, key: string): string {
  return `${kind}:${key.replace(/[^a-zA-Z0-9._/-]+/g, '_')}`;
}

function collectPageRoutes(): string[] {
  const routes: string[] = [];
  const dashboardDir = path.join(WEB_ADMIN, 'app', 'dashboard');

  const walk = (dir: string, prefix: string) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full, `${prefix}/${entry.name}`);
      } else if (entry.name === 'page.tsx') {
        routes.push(prefix || '/dashboard');
      }
    }
  };

  walk(dashboardDir, '/dashboard');
  return routes.sort();
}

function contractMatchesAnyPage(
  contract: AccessContractRecord,
  pageRoutes: string[]
): boolean {
  return pageRoutes.some((route) => matchesRoutePattern(contract.routePattern, route));
}

function arraysEqualIgnoreOrder(a: string[] = [], b: string[] = []): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a].sort();
  const sb = [...b].sort();
  return sa.every((v, i) => v === sb[i]);
}

function checkMissingContracts(
  pageRoutes: string[],
  contracts: AccessContractRecord[]
): DriftItem[] {
  const items: DriftItem[] = [];
  for (const route of pageRoutes) {
    if (!findContractForPath(contracts, route)) {
      items.push({
        id: slugDriftId('missing_contract', route),
        kind: 'missing_contract',
        severity: 'error',
        message: `Dashboard page route has no access contract: ${route}`,
        path: route,
      });
    }
  }
  return items;
}

function checkOrphanContracts(
  pageRoutes: string[],
  contracts: AccessContractRecord[]
): DriftItem[] {
  const items: DriftItem[] = [];
  for (const contract of contracts) {
    if (!contract.routePattern.startsWith('/dashboard')) continue;
    if (!contractMatchesAnyPage(contract, pageRoutes)) {
      items.push({
        id: slugDriftId('orphan_contract', contract.routePattern),
        kind: 'orphan_contract',
        severity: 'warn',
        message: `Access contract has no matching dashboard page: ${contract.routePattern}`,
        path: contract.routePattern,
        details: { sourceFile: contract.sourceFile },
      });
    }
  }
  return items;
}

function checkDuplicateRoutePatterns(contracts: AccessContractRecord[]): DriftItem[] {
  const seen = new Map<string, AccessContractRecord>();
  const items: DriftItem[] = [];

  for (const contract of contracts) {
    const existing = seen.get(contract.routePattern);
    if (existing) {
      items.push({
        id: slugDriftId('duplicate_route_pattern', contract.routePattern),
        kind: 'duplicate_route_pattern',
        severity: 'error',
        message: `Duplicate routePattern: ${contract.routePattern}`,
        path: contract.routePattern,
        details: {
          firstSource: existing.sourceFile,
          duplicateSource: contract.sourceFile,
        },
      });
    } else {
      seen.set(contract.routePattern, contract);
    }
  }
  return items;
}

function normalizeFlagKey(raw?: string): string | undefined {
  if (!raw) return undefined;
  return raw.toLowerCase().replace(/-/g, '_');
}

function checkNavContractParity(
  navigationEntries: NavigationEntryRecord[],
  contracts: AccessContractRecord[]
): DriftItem[] {
  const items: DriftItem[] = [];

  for (const nav of navigationEntries) {
    if (!nav.path.startsWith('/dashboard')) continue;
    const contract = findContractForPath(contracts, nav.path);
    if (!contract) {
      items.push({
        id: slugDriftId('nav_missing_contract', nav.path),
        kind: 'nav_missing_contract',
        severity: 'warn',
        message: `Navigation entry has no resolving access contract: ${nav.path}`,
        path: nav.path,
        details: { navKey: nav.key },
      });
      continue;
    }

    const navPerms = nav.permissions ?? [];
    const contractPerms = contract.page.permissions ?? [];
    if (navPerms.length > 0 && contractPerms.length > 0 && !arraysEqualIgnoreOrder(navPerms, contractPerms)) {
      items.push({
        id: slugDriftId('nav_contract_permission_mismatch', nav.path),
        kind: 'nav_contract_permission_mismatch',
        severity: 'warn',
        message: `Navigation permissions differ from contract for ${nav.path}`,
        path: nav.path,
        details: {
          navPermissions: navPerms,
          contractPermissions: contractPerms,
        },
      });
    }

    const navFlag = normalizeFlagKey(nav.featureFlag);
    const contractFlags = (contract.page.featureFlags ?? []).map((f) => normalizeFlagKey(f) ?? f);
    if (navFlag && contractFlags.length > 0 && !contractFlags.includes(navFlag)) {
      items.push({
        id: slugDriftId('nav_contract_feature_flag_mismatch', nav.path),
        kind: 'nav_contract_feature_flag_mismatch',
        severity: 'warn',
        message: `Navigation featureFlag "${nav.featureFlag}" not in contract page flags for ${nav.path}`,
        path: nav.path,
        details: {
          navFeatureFlag: nav.featureFlag ?? '',
          contractFeatureFlags: contract.page.featureFlags ?? [],
        },
      });
    }

    if (navFlag && contractFlags.length === 0) {
      items.push({
        id: slugDriftId('nav_contract_feature_flag_mismatch', `${nav.path}:missing_in_contract`),
        kind: 'nav_contract_feature_flag_mismatch',
        severity: 'warn',
        message: `Navigation requires featureFlag "${nav.featureFlag}" but contract has no page.featureFlags for ${nav.path}`,
        path: nav.path,
        details: { navFeatureFlag: nav.featureFlag },
      });
    }
  }

  return items;
}

export function reconcileInventory(inventory: PlatformInfoInventory): ReconcileResult {
  const pageRoutes = collectPageRoutes();
  const contracts = inventory.accessContracts;

  const driftItems = [
    ...checkMissingContracts(pageRoutes, contracts),
    ...checkDuplicateRoutePatterns(contracts),
    ...checkNavContractParity(inventory.navigationEntries, contracts),
    ...checkOrphanContracts(pageRoutes, contracts),
  ];

  const errors = driftItems.filter((d) => d.severity === 'error').length;
  const warnings = driftItems.filter((d) => d.severity === 'warn').length;

  return {
    driftItems,
    generatedAt: new Date().toISOString(),
    counts: { errors, warnings, total: driftItems.length },
  };
}

function mdTable(headers: string[], rows: string[][]): string {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((r) => `| ${r.join(' | ')} |`),
  ].join('\n');
}

function writeDriftReport(result: ReconcileResult, known: KnownExceptionsFile): void {
  const knownIds = new Set(known.exceptions.map((e) => e.id));
  const newDrift = result.driftItems.filter((d) => !knownIds.has(d.id));
  const suppressed = result.driftItems.filter((d) => knownIds.has(d.id));

  const sections: string[] = [
    '# DRIFT REPORT',
    '',
    '> **Do not edit by hand.** Regenerate with `npm run rebuild:platform-info-inventories`.',
    '',
    `Generated: ${result.generatedAt}`,
    '',
    '## Summary',
    '',
    mdTable(
      ['Metric', 'Count'],
      [
        ['Total drift items', String(result.counts.total)],
        ['Errors', String(result.counts.errors)],
        ['Warnings', String(result.counts.warnings)],
        ['Known exceptions (suppressed)', String(suppressed.length)],
        ['New drift (not in allowlist)', String(newDrift.length)],
      ]
    ),
    '',
  ];

  if (newDrift.length > 0) {
    sections.push('## New drift (action required)');
    sections.push('');
    sections.push(
      mdTable(
        ['ID', 'Severity', 'Kind', 'Path', 'Message'],
        newDrift.map((d) => [d.id, d.severity, d.kind, d.path ?? '—', d.message])
      )
    );
    sections.push('');
  }

  if (suppressed.length > 0) {
    sections.push('## Known exceptions (suppressed)');
    sections.push('');
    sections.push(
      mdTable(
        ['ID', 'Severity', 'Kind', 'Path', 'Reason'],
        suppressed.map((d) => {
          const reason = known.exceptions.find((e) => e.id === d.id)?.reason ?? '—';
          return [d.id, d.severity, d.kind, d.path ?? '—', reason];
        })
      )
    );
    sections.push('');
  }

  if (result.driftItems.length === 0) {
    sections.push('No drift detected.');
    sections.push('');
  }

  fs.mkdirSync(INVENTORIES_DIR, { recursive: true });
  fs.writeFileSync(DRIFT_REPORT, sections.join('\n'), 'utf-8');
}

function writeUndocumented(result: ReconcileResult): void {
  const items = result.driftItems.filter(
    (d) => d.kind === 'missing_contract' || d.kind === 'nav_missing_contract'
  );
  const content = [
    '# GENERATED Undocumented Routes',
    '',
    '> Routes in code/navigation without matching access contract coverage.',
    '',
    mdTable(
      ['Path', 'Kind', 'Message'],
      items.length
        ? items.map((d) => [d.path ?? '—', d.kind, d.message])
        : [['—', '—', 'None']]
    ),
    '',
  ].join('\n');
  fs.writeFileSync(GENERATED_UNDOCUMENTED, content, 'utf-8');
}

function writeOrphans(result: ReconcileResult): void {
  const items = result.driftItems.filter((d) => d.kind === 'orphan_contract');
  const content = [
    '# GENERATED Orphan Contracts',
    '',
    '> Access contracts with no matching dashboard page.tsx route.',
    '',
    mdTable(
      ['Route pattern', 'Source file', 'Message'],
      items.length
        ? items.map((d) => [
            d.path ?? '—',
            String(d.details?.sourceFile ?? '—'),
            d.message,
          ])
        : [['—', '—', 'None']]
    ),
    '',
  ].join('\n');
  fs.writeFileSync(GENERATED_ORPHANS, content, 'utf-8');
}

export function loadKnownExceptions(): KnownExceptionsFile {
  if (!fs.existsSync(KNOWN_EXCEPTIONS)) {
    return { schemaVersion: 1, description: 'Baseline allowlist for delta-only CI', exceptions: [] };
  }
  return JSON.parse(fs.readFileSync(KNOWN_EXCEPTIONS, 'utf-8')) as KnownExceptionsFile;
}

export function validateNewDrift(result: ReconcileResult, known: KnownExceptionsFile): {
  newDrift: DriftItem[];
  passed: boolean;
} {
  const knownIds = new Set(known.exceptions.map((e) => e.id));
  const newDrift = result.driftItems.filter((d) => !knownIds.has(d.id));
  return { newDrift, passed: newDrift.length === 0 };
}

export function embedDriftInInventory(
  inventoryPath: string,
  result: ReconcileResult,
  known: KnownExceptionsFile
): void {
  const inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf-8')) as PlatformInfoInventory;
  const knownIds = new Set(known.exceptions.map((e) => e.id));
  const newDrift = result.driftItems.filter((d) => !knownIds.has(d.id));

  inventory.driftItems = result.driftItems.map((d) => ({
    id: d.id,
    kind: d.kind,
    severity: d.severity,
    message: d.message,
    path: d.path,
    isKnownException: knownIds.has(d.id),
  }));
  inventory.driftCounts = {
    errors: result.counts.errors,
    warnings: result.counts.warnings,
    total: result.counts.total,
    newDrift: newDrift.length,
  };

  fs.writeFileSync(inventoryPath, JSON.stringify(inventory, null, 2), 'utf-8');
  syncWebAdminInventoryRuntimeCopy(inventoryPath);
}

export function runReconcile(inventoryPath = INVENTORY_OUTPUT): ReconcileResult {
  if (!fs.existsSync(inventoryPath)) {
    throw new Error(`Inventory not found: ${inventoryPath}`);
  }
  const inventory = JSON.parse(fs.readFileSync(inventoryPath, 'utf-8')) as PlatformInfoInventory;
  const known = loadKnownExceptions();
  const result = reconcileInventory(inventory);

  writeDriftReport(result, known);
  writeUndocumented(result);
  writeOrphans(result);
  embedDriftInInventory(inventoryPath, result, known);

  console.log(`[reconcile] drift: ${result.counts.total} (${result.counts.errors} errors, ${result.counts.warnings} warnings)`);
  console.log(`[reconcile] wrote: ${DRIFT_REPORT}`);

  return result;
}

function main(): void {
  runReconcile();
}

if (require.main === module) {
  main();
}
