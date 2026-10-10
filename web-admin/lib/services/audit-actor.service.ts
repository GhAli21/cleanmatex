/**
 * Shared audit actor lookup service.
 *
 * Resolves tenant-scoped user ids to the display metadata the reusable audit
 * surfaces need without forcing each page to join user tables manually.
 */

import { createAdminSupabaseClient } from '@/lib/supabase/server'
import { isValidUUID } from '@/lib/utils/validation-helpers'

/**
 *
 */
export interface AuditActorLookupResult {
  id: string
  displayName: string | null
  email: string | null
  phone: string | null
}

interface AuditActorRow {
  id: string
  user_id: string
  display_name: string | null
  email: string | null
  phone: string | null
}

/**
 * Resolve a small set of actor ids inside the current tenant.
 *
 * Uses the admin client because audit metadata can reference inactive users,
 * while the route itself remains tenant-scoped and authenticated.
 *
 * @param tenantId current tenant id
 * @param actorIds user ids to resolve
 * @returns list of resolved actor metadata keyed by user id
 */
export async function lookupAuditActors(
  tenantId: string,
  actorIds: string[],
): Promise<AuditActorLookupResult[]> {
  const uniqueActorIds = [...new Set(actorIds.map((value) => value.trim()).filter(Boolean))]
  // `cash_recognized_by` / `performed_by` can hold a migration marker such as
  // `migration_0549`. Both lookup columns are uuid, so one non-uuid value
  // makes Postgres reject the whole `.in()` and the drawer page cannot load.
  const queryableIds = uniqueActorIds.filter((actorId) => isValidUUID(actorId))

  if (queryableIds.length === 0) {
    return []
  }

  const supabase = createAdminSupabaseClient()
  const { data, error } = await supabase
    .from('org_users_mst')
    .select('user_id, display_name, email, phone')
    .eq('tenant_org_id', tenantId)
    .in('user_id', queryableIds)

  if (error) {
    throw new Error(error.message)
  }

  const primaryRows = (data ?? []) as Array<Pick<AuditActorRow, 'user_id' | 'display_name' | 'email' | 'phone'>>
  const results = primaryRows.map((row) => ({
    id: row.user_id,
    displayName: row.display_name ?? null,
    email: row.email ?? null,
    phone: row.phone ?? null,
  }))

  const resolvedIds = new Set(results.map((row) => row.id))
  const unresolvedIds = queryableIds.filter((actorId) => !resolvedIds.has(actorId))

  if (unresolvedIds.length === 0) {
    return results
  }

  const { data: fallbackData, error: fallbackError } = await supabase
    .from('org_users_mst')
    .select('id, user_id, display_name, email, phone')
    .eq('tenant_org_id', tenantId)
    .in('id', unresolvedIds)

  if (fallbackError) {
    throw new Error(fallbackError.message)
  }

  const fallbackRows = (fallbackData ?? []) as AuditActorRow[]

  return [
    ...results,
    ...fallbackRows.map((row) => ({
      id: row.id,
      displayName: row.display_name ?? null,
      email: row.email ?? null,
      phone: row.phone ?? null,
    })),
  ]
}
