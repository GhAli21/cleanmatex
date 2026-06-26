import { ingestAccessContractsTs } from '../ingest/ingest-access-contracts-ts';
import { findContractForPath } from '../inventories/route-match';

export function printRouteContract(routePath: string): void {
  const { accessContracts } = ingestAccessContractsTs();
  const contract = findContractForPath(accessContracts, routePath);

  if (!contract) {
    console.error(`[ui-access-contract] No contract for route: ${routePath}`);
    process.exitCode = 1;
    return;
  }

  console.log(JSON.stringify(contract, null, 2));
}
