import { ingestAccessContractsTs } from '../ingest/ingest-access-contracts-ts';
import { findContractForPath } from '../inventories/route-match';
import { collectDashboardPageRoutes } from './collect-dashboard-routes';

export interface AccessContractCoverageResult {
  pageRoutes: string[];
  missingRoutes: string[];
  orphanContracts: string[];
  duplicateRoutePatterns: string[];
  passed: boolean;
}

export function validateAccessContractCoverage(routeFilter?: string): AccessContractCoverageResult {
  const { accessContracts } = ingestAccessContractsTs();
  const pageRoutes = collectDashboardPageRoutes();

  const scopedRoutes = routeFilter
    ? pageRoutes.filter((route) => route === routeFilter || route.startsWith(`${routeFilter}/`))
    : pageRoutes;

  const missingRoutes = scopedRoutes.filter(
    (route) => !findContractForPath(accessContracts, route)
  );

  const contractPatterns = new Set<string>();
  const duplicateRoutePatterns: string[] = [];
  for (const contract of accessContracts) {
    if (contractPatterns.has(contract.routePattern)) {
      duplicateRoutePatterns.push(contract.routePattern);
    }
    contractPatterns.add(contract.routePattern);
  }

  const matchedPatterns = new Set(
    pageRoutes
      .map((route) => findContractForPath(accessContracts, route)?.routePattern)
      .filter((value): value is string => Boolean(value))
  );

  const orphanContracts = accessContracts
    .map((c) => c.routePattern)
    .filter((pattern) => !matchedPatterns.has(pattern) && pattern.startsWith('/dashboard'));

  if (routeFilter) {
    const contract = findContractForPath(accessContracts, routeFilter);
    if (!contract && !missingRoutes.includes(routeFilter)) {
      missingRoutes.push(routeFilter);
    }
  }

  const passed =
    missingRoutes.length === 0 &&
    duplicateRoutePatterns.length === 0 &&
    (!routeFilter || !missingRoutes.includes(routeFilter));

  return {
    pageRoutes: scopedRoutes,
    missingRoutes,
    orphanContracts: routeFilter ? [] : orphanContracts,
    duplicateRoutePatterns,
    passed,
  };
}
