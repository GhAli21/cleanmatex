import { ingestAccessContractsTs } from '../ingest/ingest-access-contracts-ts';
import { findContractForPath } from '../inventories/route-match';
import { auditWire } from './audit-wire';
import type { AccessScope } from './resolve-scope';
import { validateRegistryImports } from './validate-registry';
import * as path from 'path';
import { WEB_ADMIN } from '../inventories/paths';

export type CheckStatus = 'pass' | 'fail' | 'warn' | 'skip';

export interface RouteCheckRow {
  route: string;
  contract: CheckStatus;
  contractLabel?: string;
  contractSource?: string;
  pageGate: CheckStatus;
  apiGate: CheckStatus;
  notes: string[];
}

export interface CheckReport {
  scope: AccessScope;
  summary: {
    routesInScope: number;
    contractsOk: number;
    contractsMissing: number;
    pageGateOk: number;
    pageGateMissing: number;
    pageGateNa: number;
    apiGateOk: number;
    apiGateMissing: number;
    apiGateNa: number;
    apiExternal: number;
    registryOk: boolean;
    registryMissing: string[];
    duplicatePatterns: string[];
    orphanContracts: string[];
    overall: CheckStatus;
  };
  rows: RouteCheckRow[];
}

function statusIcon(status: CheckStatus): string {
  switch (status) {
    case 'pass':
      return 'OK';
    case 'fail':
      return 'FAIL';
    case 'warn':
      return 'WARN';
    case 'skip':
      return '—';
  }
}

export function buildCheckReport(scope: AccessScope, includeWire: boolean): CheckReport {
  const { accessContracts } = ingestAccessContractsTs();
  const registry = validateRegistryImports();

  const contractPatterns = new Set<string>();
  const duplicatePatterns: string[] = [];
  for (const contract of accessContracts) {
    if (contractPatterns.has(contract.routePattern)) {
      duplicatePatterns.push(contract.routePattern);
    }
    contractPatterns.add(contract.routePattern);
  }

  const scopedDuplicates =
    scope.kind === 'full'
      ? duplicatePatterns
      : duplicatePatterns.filter((pattern) =>
          scope.routePrefixes.some(
            (prefix) => pattern === prefix || pattern.startsWith(`${prefix}/`)
          )
        );

  const matchedPatterns = new Set(
    scope.routes
      .map((route) => findContractForPath(accessContracts, route)?.routePattern)
      .filter((value): value is string => Boolean(value))
  );

  const orphanContracts =
    scope.kind === 'full'
      ? accessContracts
          .map((c) => c.routePattern)
          .filter((pattern) => !matchedPatterns.has(pattern) && pattern.startsWith('/dashboard'))
      : accessContracts
          .map((c) => c.routePattern)
          .filter(
            (pattern) =>
              pattern.startsWith('/dashboard') &&
              scope.routePrefixes.some(
                (prefix) => pattern === prefix || pattern.startsWith(`${prefix}/`)
              ) &&
              !matchedPatterns.has(pattern)
          );

  const wire = includeWire ? auditWire({ scope }) : { issues: [], passed: true, routesAudited: 0 };

  const scopedRegistryMissing =
    scope.kind === 'full'
      ? registry.missingImports
      : registry.missingImports.filter((token) =>
          scope.accessFiles.some((file) => {
            const rel = file.replace(/\\/g, '/');
            return rel.includes(token.replace(/-access$/, ''));
          })
        );

  const rows: RouteCheckRow[] = [];

  for (const route of scope.routes) {
    const contract = findContractForPath(accessContracts, route);
    const notes: string[] = [];

    const contractStatus: CheckStatus = contract ? 'pass' : 'fail';
    if (!contract) {
      notes.push('missing contract');
    }

    let pageGate: CheckStatus = 'skip';
    let apiGate: CheckStatus = 'skip';

    if (includeWire) {
      const pattern = contract?.routePattern ?? route;

      const pageIssues = wire.issues.filter(
        (i) =>
          i.route === pattern &&
          (i.kind === 'PAGE_GATE_MISSING' || i.kind === 'PAGE_PERMISSION_GAP')
      );

      if (!contract) {
        pageGate = 'fail';
      } else if (!(contract.page.permissions ?? []).length) {
        pageGate = 'skip';
      } else if (pageIssues.some((i) => i.kind === 'PAGE_GATE_MISSING')) {
        pageGate = 'fail';
        notes.push(pageIssues.find((i) => i.kind === 'PAGE_GATE_MISSING')!.detail);
      } else if (pageIssues.some((i) => i.kind === 'PAGE_PERMISSION_GAP')) {
        pageGate = 'warn';
        notes.push(pageIssues[0].detail);
      } else {
        pageGate = 'pass';
      }

      const apiIssues = wire.issues.filter(
        (i) =>
          i.route === pattern &&
          (i.kind === 'API_GATE_MISSING' || i.kind === 'API_NOT_LOCAL')
      );

      if (!contract?.apiDependencyCount) {
        apiGate = 'skip';
      } else if (apiIssues.some((i) => i.kind === 'API_GATE_MISSING')) {
        apiGate = 'fail';
        notes.push(apiIssues.find((i) => i.kind === 'API_GATE_MISSING')!.detail);
      } else if (apiIssues.some((i) => i.kind === 'API_NOT_LOCAL')) {
        apiGate = 'warn';
        notes.push('external API — verify manually');
      } else {
        apiGate = 'pass';
      }
    }

    rows.push({
      route,
      contract: contractStatus,
      contractLabel: contract?.label,
      contractSource: contract?.sourceFile,
      pageGate,
      apiGate,
      notes,
    });
  }

  const contractsOk = rows.filter((r) => r.contract === 'pass').length;
  const contractsMissing = rows.filter((r) => r.contract === 'fail').length;
  const pageGateOk = rows.filter((r) => r.pageGate === 'pass').length;
  const pageGateMissing = rows.filter((r) => r.pageGate === 'fail').length;
  const pageGateNa = rows.filter((r) => r.pageGate === 'skip').length;
  const apiGateOk = rows.filter((r) => r.apiGate === 'pass').length;
  const apiGateMissing = rows.filter((r) => r.apiGate === 'fail').length;
  const apiGateNa = rows.filter((r) => r.apiGate === 'skip').length;
  const apiExternal = rows.filter((r) => r.apiGate === 'warn').length;

  const hasFailures =
    contractsMissing > 0 ||
    scopedDuplicates.length > 0 ||
    scopedRegistryMissing.length > 0 ||
    (includeWire && (pageGateMissing > 0 || apiGateMissing > 0));

  const hasWarnings =
    orphanContracts.length > 0 ||
    apiExternal > 0 ||
    rows.some((r) => r.pageGate === 'warn');

  const overall: CheckStatus = hasFailures ? 'fail' : hasWarnings ? 'warn' : 'pass';

  return {
    scope,
    summary: {
      routesInScope: scope.routes.length,
      contractsOk,
      contractsMissing,
      pageGateOk,
      pageGateMissing,
      pageGateNa,
      apiGateOk,
      apiGateMissing,
      apiGateNa,
      apiExternal,
      registryOk: scopedRegistryMissing.length === 0,
      registryMissing: scopedRegistryMissing,
      duplicatePatterns: scopedDuplicates,
      orphanContracts,
      overall,
    },
    rows,
  };
}

export function printCheckReport(report: CheckReport, options: { verbose?: boolean; json?: boolean } = {}): void {
  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  const { scope, summary, rows } = report;
  const scopeLabel =
    scope.kind === 'full'
      ? 'all dashboard routes'
      : scope.kind === 'feature'
        ? `feature "${scope.label}" (${scope.routePrefixes.join(', ')})`
        : `route ${scope.label}`;

  console.log('');
  console.log('═'.repeat(72));
  console.log(' UI Access Contract — Check Report');
  console.log('═'.repeat(72));
  console.log(` Scope:        ${scopeLabel}`);
  console.log(` Routes:       ${summary.routesInScope}`);
  if (scope.accessFiles.length) {
    console.log(
      ` Access files: ${scope.accessFiles.map((f) => path.relative(WEB_ADMIN, f)).join(', ')}`
    );
  }
  console.log('');

  console.log(' Coverage');
  console.log(`   Contracts OK:       ${summary.contractsOk}`);
  console.log(`   Missing contract:   ${summary.contractsMissing}${summary.contractsMissing ? '  ← FAIL' : ''}`);
  if (summary.duplicatePatterns.length) {
    console.log(`   Duplicate patterns: ${summary.duplicatePatterns.length}  ← FAIL`);
    for (const p of summary.duplicatePatterns) console.log(`     - ${p}`);
  }
  if (summary.orphanContracts.length) {
    console.log(`   Orphan contracts:   ${summary.orphanContracts.length}  ← WARN`);
    for (const p of summary.orphanContracts.slice(0, 10)) console.log(`     - ${p}`);
    if (summary.orphanContracts.length > 10) {
      console.log(`     ... +${summary.orphanContracts.length - 10} more`);
    }
  }
  console.log('');

  console.log(' Registry');
  if (summary.registryOk) {
    console.log('   Status:             OK — all in-scope *-access.ts modules registered');
  } else {
    console.log('   Status:             FAIL — missing imports in page-access-registry.ts');
    for (const m of summary.registryMissing) console.log(`     - ${m}`);
    console.log('   Fix: npm run register:ui-access-contract -- --fix');
  }
  console.log('');

  const wireChecked = rows.some((r) => r.pageGate !== 'skip' || r.apiGate !== 'skip');
  if (wireChecked) {
    console.log(' Wire (runtime gates)');
    console.log(`   Page gate OK:        ${summary.pageGateOk}`);
    console.log(`   Page gate missing:   ${summary.pageGateMissing}${summary.pageGateMissing ? '  ← FAIL' : ''}`);
    console.log(`   Page gate N/A:       ${summary.pageGateNa}`);
    console.log(`   API gate OK:         ${summary.apiGateOk}`);
    console.log(`   API gate missing:    ${summary.apiGateMissing}${summary.apiGateMissing ? '  ← FAIL' : ''}`);
    console.log(`   API external/manual: ${summary.apiExternal}`);
    console.log('');
  }

  const problemRows = rows.filter(
    (r) =>
      r.contract !== 'pass' ||
      r.pageGate === 'fail' ||
      r.pageGate === 'warn' ||
      r.apiGate === 'fail' ||
      r.apiGate === 'warn'
  );
  const displayRows = options.verbose ? rows : problemRows;

  if (displayRows.length) {
    console.log(options.verbose ? ' Route details (all)' : ' Route details (issues only)');
    console.log(' ' + '-'.repeat(70));
    console.log(` ${'ROUTE'.padEnd(42)} ${'CONTRACT'.padEnd(10)} ${'PAGE'.padEnd(8)} API`);
    console.log(' ' + '-'.repeat(70));
    for (const row of displayRows) {
      const routeCol = row.route.slice(0, 42).padEnd(42);
      console.log(
        ` ${routeCol} ${statusIcon(row.contract).padEnd(10)} ${statusIcon(row.pageGate).padEnd(8)} ${statusIcon(row.apiGate)}`
      );
      if (row.contractLabel) console.log(`   label: ${row.contractLabel}`);
      if (row.contractSource) console.log(`   contract: ${row.contractSource}`);
      for (const note of row.notes) {
        console.log(`   ↳ ${note}`);
      }
    }
    console.log('');
  } else if (!options.verbose) {
    console.log(' Route details: all routes in scope passed');
    console.log('');
  }

  console.log('─'.repeat(72));
  console.log(` Overall: ${summary.overall.toUpperCase()}`);
  console.log('─'.repeat(72));
  console.log('');
}
