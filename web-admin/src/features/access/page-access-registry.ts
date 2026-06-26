import { matchesRoutePattern, type PageAccessContract } from '@/lib/auth/access-contracts'
import { B2B_ACCESS_CONTRACTS } from '@features/b2b/access/b2b-access'
import { BILLING_ACCESS_CONTRACTS } from '@features/billing/access/billing-access'
import { CATALOG_ACCESS_CONTRACTS } from '@features/catalog/access/catalog-access'
import { CORE_ACCESS_CONTRACTS } from '@features/core/access/core-access'
import { CUSTOMERS_ACCESS_CONTRACTS } from '@features/customers/access/customers-access'
import { DASHBOARD_ACCESS_CONTRACTS } from '@features/dashboard/access/dashboard-access'
import { DRIVERS_ACCESS_CONTRACTS } from '@features/drivers/access/drivers-access'
import { ERP_LITE_ACCESS_CONTRACTS } from '@features/erp-lite/access/erp-lite-access'
import { VOUCHER_ACCESS_CONTRACTS } from '@features/finance/vouchers/access/vouchers-access'
import { HELP_ACCESS_CONTRACTS } from '@features/help/access/help-access'
import { INVENTORY_ACCESS_CONTRACTS } from '@features/inventory/access/inventory-access'
import { MARKETING_ACCESS_CONTRACTS } from '@features/marketing/access/marketing-access'
import { NOTIFICATIONS_ACCESS_CONTRACTS } from '@features/notifications/access/notifications-access'
import { ORDERS_ACCESS_CONTRACTS } from '@features/orders/access/orders-access'
import { PAYMENT_CONFIG_ACCESS_CONTRACTS } from '@features/payment-config/access/payment-config-access'
import { REPORTS_ACCESS_CONTRACTS } from '@features/reports/access/reports-access'
import { SETTINGS_ACCESS_CONTRACTS } from '@features/settings/access/settings-access'
import { TENANT_ADMIN_ACCESS_CONTRACTS } from '@features/tenant-admin/access/tenant-admin-access'
import { USERS_ACCESS_CONTRACTS } from '@features/users/access/users-access'

/** Re-export catalog route contracts for page gates and inspector (single import). */
export {
  ADMIN_PERMISSIONS,
  CATALOG_ACCESS_CONTRACTS,
  CATALOG_CATALOG_ACCESS,
  CATALOG_CUSTOMER_CATEGORIES_ACCESS,
  CATALOG_ORDER_SOURCES_ACCESS,
  CATALOG_PREFERENCES_ACCESS,
  CATALOG_SECTION_PERMISSIONS,
  CATALOG_SERVICES_ACCESS,
} from '@features/catalog/access/catalog-access'

/**
 * Merged dashboard route contracts — one row per active app/dashboard page route.
 * Feature modules own *-access.ts; this registry only imports and spreads them.
 */
export const PAGE_ACCESS_CONTRACTS: PageAccessContract[] = [
  ...CORE_ACCESS_CONTRACTS,
  ...B2B_ACCESS_CONTRACTS,
  ...BILLING_ACCESS_CONTRACTS,
  ...CATALOG_ACCESS_CONTRACTS,
  ...CUSTOMERS_ACCESS_CONTRACTS,
  ...DASHBOARD_ACCESS_CONTRACTS,
  ...DRIVERS_ACCESS_CONTRACTS,
  ...ERP_LITE_ACCESS_CONTRACTS,
  ...VOUCHER_ACCESS_CONTRACTS,
  ...HELP_ACCESS_CONTRACTS,
  ...INVENTORY_ACCESS_CONTRACTS,
  ...MARKETING_ACCESS_CONTRACTS,
  ...NOTIFICATIONS_ACCESS_CONTRACTS,
  ...ORDERS_ACCESS_CONTRACTS,
  ...PAYMENT_CONFIG_ACCESS_CONTRACTS,
  ...REPORTS_ACCESS_CONTRACTS,
  ...SETTINGS_ACCESS_CONTRACTS,
  ...TENANT_ADMIN_ACCESS_CONTRACTS,
  ...USERS_ACCESS_CONTRACTS,
]

/**
 *
 */
export function getAllPageAccessContracts(): PageAccessContract[] {
  return PAGE_ACCESS_CONTRACTS
}

/**
 *
 * @param pathname
 */
export function getPageAccessContractByPath(pathname: string): PageAccessContract | null {
  return PAGE_ACCESS_CONTRACTS.find((contract) => matchesRoutePattern(contract.routePattern, pathname)) ?? null
}

/**
 * Lookup by exact routePattern (e.g. /dashboard/catalog/services).
 * @param routePattern
 */
export function getPageAccessContractByRoutePattern(
  routePattern: string
): PageAccessContract | null {
  return PAGE_ACCESS_CONTRACTS.find((contract) => contract.routePattern === routePattern) ?? null
}
