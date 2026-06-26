/** Stale-entry detection and derive annotation helpers for *-access.ts patches. */

export function normalizeApiPathForCompare(apiPath: string): string {
  return apiPath
    .replace(/\$\{[^}]+\}/g, '[id]')
    .replace(/\/[0-9a-f-]{36}/gi, '/[id]')
    .replace(/\/+$/, '');
}

export function apiPathsEquivalent(a: string, b: string): boolean {
  const na = normalizeApiPathForCompare(a);
  const nb = normalizeApiPathForCompare(b);
  if (na === nb) return true;
  if (na.startsWith(nb) || nb.startsWith(na)) return true;
  return false;
}

export function findStaleApiPaths(
  contractPaths: string[],
  inferredPaths: string[]
): string[] {
  const inferredNorm = inferredPaths.map(normalizeApiPathForCompare);
  return contractPaths.filter((p) => {
    if (p.startsWith('/app/actions/')) {
      return !inferredPaths.some((inf) => apiPathsEquivalent(p, inf));
    }
    const norm = normalizeApiPathForCompare(p);
    return !inferredNorm.some((inf) => apiPathsEquivalent(norm, inf));
  });
}

export interface ContractActionMeta {
  actionKey: string;
  permissions: string[];
}

export function findStaleActionKeys(
  contractActions: ContractActionMeta[],
  codePermissions: Set<string>,
  inferredActionKeys: Set<string>
): string[] {
  const stale: string[] = [];
  for (const action of contractActions) {
    if (inferredActionKeys.has(action.actionKey)) continue;
    const permsStillInCode = action.permissions.some((p) => codePermissions.has(p));
    if (!permsStillInCode) {
      stale.push(action.actionKey);
    }
  }
  return stale;
}

export function buildPermissionConflictNote(
  contractPerms: string[],
  inferredPerms: string[]
): string | null {
  const contractSet = new Set(contractPerms);
  const inferredSet = new Set(inferredPerms);
  const onlyContract = contractPerms.filter((p) => !inferredSet.has(p));
  const onlyInferred = inferredPerms.filter((p) => !contractSet.has(p));
  if (!onlyContract.length && !onlyInferred.length) return null;
  const parts: string[] = ['[derive] page.permissions conflict — review manually.'];
  if (onlyContract.length) parts.push(`Contract only: [${onlyContract.join(', ')}].`);
  if (onlyInferred.length) parts.push(`Code only: [${onlyInferred.join(', ')}].`);
  return parts.join(' ');
}

export function buildStaleSummaryNote(
  staleActions: string[],
  staleApis: string[]
): string | null {
  if (!staleActions.length && !staleApis.length) return null;
  const parts: string[] = ['[derive-stale] Commented entries not found in scanned code — review before removing.'];
  if (staleActions.length) parts.push(`Actions: [${staleActions.join(', ')}].`);
  if (staleApis.length) parts.push(`APIs: [${staleApis.join(', ')}].`);
  return parts.join(' ');
}
