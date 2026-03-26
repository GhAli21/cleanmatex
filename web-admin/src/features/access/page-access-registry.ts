import { matchesRoutePattern, type PageAccessContract } from '@/lib/auth/access-contracts'
import { B2B_ACCESS_CONTRACTS } from '@features/b2b/access/b2b-access'
import { BILLING_ACCESS_CONTRACTS } from '@features/billing/access/billing-access'
import { CATALOG_ACCESS_CONTRACTS } from '@features/catalog/access/catalog-access'
import { CORE_ACCESS_CONTRACTS } from '@features/core/access/core-access'
import { ORDERS_ACCESS_CONTRACTS } from '@features/orders/access/orders-access'
import { SETTINGS_ACCESS_CONTRACTS } from '@features/settings/access/settings-access'

export const PAGE_ACCESS_CONTRACTS: PageAccessContract[] = [
  ...CORE_ACCESS_CONTRACTS,
  ...B2B_ACCESS_CONTRACTS,
  ...BILLING_ACCESS_CONTRACTS,
  ...CATALOG_ACCESS_CONTRACTS,
  ...ORDERS_ACCESS_CONTRACTS,
  ...SETTINGS_ACCESS_CONTRACTS,
]

export function getAllPageAccessContracts(): PageAccessContract[] {
  return PAGE_ACCESS_CONTRACTS
}

export function getPageAccessContractByPath(pathname: string): PageAccessContract | null {
  return PAGE_ACCESS_CONTRACTS.find((contract) => matchesRoutePattern(contract.routePattern, pathname)) ?? null
}
