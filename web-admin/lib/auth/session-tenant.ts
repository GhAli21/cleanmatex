/**
 * The open laundry is the session's tenant. A list position is not authority.
 */

/** One organization row that carries the session tenant id. */
export interface SessionTenantRow {
  tenant_id: string
  is_active: boolean
}

/**
 * Keep the organization the session is bound to.
 *
 * @param tenants - Rows returned by get_user_tenants
 * @param sessionTenantId - Tenant on the validated session row
 * @returns That row when it is active, otherwise null
 */
export function selectSessionTenant<T extends SessionTenantRow>(
  tenants: readonly T[],
  sessionTenantId: string | null | undefined,
): T | null {
  if (!sessionTenantId) return null
  const match = tenants.find((tenant) => tenant.tenant_id === sessionTenantId)
  if (!match?.is_active) return null
  return match
}
