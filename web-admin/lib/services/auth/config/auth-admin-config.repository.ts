/**
 * Auth admin config repository — data access only (no business rules).
 *
 * Reads the effective config via fn_auth_config_effective and writes tenant overrides to
 * org_auth_admin_config_cf. Server-only: uses the service-role client, so EVERY org_* query here
 * carries an explicit tenant_org_id predicate (RLS is bypassed). DB triggers (migration 0570)
 * remain the final gate for is_allow_tenant_change and bounds.
 */

import type { createAdminSupabaseClient } from '@/lib/supabase/server'
import type {
  AuthConfigGroup,
  AuthConfigItem,
  AuthConfigSource,
  AuthConfigUnit,
  AuthConfigValueType,
} from '@/lib/types/auth-admin-config'

type AdminClient = ReturnType<typeof createAdminSupabaseClient>

/** Postgres SQLSTATEs raised by the override guard trigger. */
const PG_INSUFFICIENT_PRIVILEGE = '42501'
const PG_CHECK_VIOLATION = '23514'

/** Persistence failure with the DB category, so use-cases can map it to an API code. */
export class AuthConfigRepositoryError extends Error {
  constructor(
    message: string,
    public readonly kind: 'not_editable' | 'invalid' | 'unknown'
  ) {
    super(message)
    this.name = 'AuthConfigRepositoryError'
  }
}

/**
 * Load every active catalog item resolved for one tenant.
 *
 * @param admin - Service-role Supabase client
 * @param tenantId - Tenant whose overrides are applied (tenant resolved server-side by the caller)
 * @returns Items ordered by group, display order, code
 */
export async function fetchEffectiveAuthConfig(
  admin: AdminClient,
  tenantId: string
): Promise<AuthConfigItem[]> {
  const { data, error } = await admin.rpc('fn_auth_config_effective', { p_tenant_org_id: tenantId })
  if (error) {
    throw new AuthConfigRepositoryError(`fn_auth_config_effective failed: ${error.message}`, 'unknown')
  }

  return (data ?? []).map((row) => ({
    configCode: row.config_code,
    configGroup: row.config_group as AuthConfigGroup,
    valueType: row.value_type as AuthConfigValueType,
    unit: row.unit as AuthConfigUnit,
    name: row.name,
    name2: row.name2 ?? null,
    description: row.description ?? null,
    description2: row.description2 ?? null,
    displayOrder: row.display_order,
    platformValue: row.platform_value,
    tenantValue: row.tenant_value ?? null,
    effectiveValue: row.effective_value,
    source: row.source as AuthConfigSource,
    isAllowTenantChange: row.is_allow_tenant_change,
    minValue: row.min_value ?? null,
    maxValue: row.max_value ?? null,
    allowedValues: row.allowed_values ?? null,
  }))
}

/**
 * Create or update a tenant override (reactivating a previously reset one).
 *
 * @param admin - Service-role Supabase client
 * @param params.tenantId - Owning tenant
 * @param params.configCode - Catalog item
 * @param params.value - Normalised text value (already validated)
 * @param params.actorId - Auth user id of the admin making the change
 * @throws AuthConfigRepositoryError (kind: not_editable | invalid | unknown)
 */
export async function upsertTenantOverride(
  admin: AdminClient,
  params: { tenantId: string; configCode: string; value: string; actorId: string }
): Promise<void> {
  const { tenantId, configCode, value, actorId } = params

  const { data: existing, error: readError } = await admin
    .from('org_auth_admin_config_cf')
    .select('id')
    .eq('tenant_org_id', tenantId)
    .eq('config_code', configCode)
    .maybeSingle()
  if (readError) throw new AuthConfigRepositoryError(readError.message, 'unknown')

  const result = existing
    ? await admin
        .from('org_auth_admin_config_cf')
        .update({ config_value: value, is_active: true, rec_status: 1, updated_by: actorId })
        .eq('tenant_org_id', tenantId)
        .eq('config_code', configCode)
    : await admin.from('org_auth_admin_config_cf').insert({
        tenant_org_id: tenantId,
        config_code: configCode,
        config_value: value,
        created_by: actorId,
      })

  if (result.error) throw toRepositoryError(result.error)
}

/**
 * Reset an item to the platform value by deactivating the tenant override (no-op when none).
 *
 * @param admin - Service-role Supabase client
 * @param params.tenantId - Owning tenant
 * @param params.configCode - Catalog item
 * @param params.actorId - Auth user id of the admin making the change
 */
export async function resetTenantOverride(
  admin: AdminClient,
  params: { tenantId: string; configCode: string; actorId: string }
): Promise<void> {
  const { tenantId, configCode, actorId } = params
  const { error } = await admin
    .from('org_auth_admin_config_cf')
    .update({ is_active: false, rec_status: 0, updated_by: actorId })
    .eq('tenant_org_id', tenantId)
    .eq('config_code', configCode)
    .eq('is_active', true)
  if (error) throw toRepositoryError(error)
}

function toRepositoryError(error: { code?: string; message: string }): AuthConfigRepositoryError {
  if (error.code === PG_INSUFFICIENT_PRIVILEGE) {
    return new AuthConfigRepositoryError(error.message, 'not_editable')
  }
  if (error.code === PG_CHECK_VIOLATION) {
    return new AuthConfigRepositoryError(error.message, 'invalid')
  }
  return new AuthConfigRepositoryError(error.message, 'unknown')
}
