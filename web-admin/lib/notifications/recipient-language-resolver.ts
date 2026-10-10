/**
 * Recipient-language resolution for the Notification Hub's route/binding-aware
 * dispatch (production implementation plan sections 4.2, 17.2, 22, 23.1,
 * 26.2.1). `ResolveEffectiveNotificationRoute` requires an already-authorized
 * `languageCode` argument and never infers or defaults one itself (see
 * lib/notifications/route-resolver.ts) — this module is that authorization
 * step for a WhatsApp outbox row tied to a tenant order/customer.
 *
 * Fallback chain, in order:
 *   1. org_customers_mst.preferred_language (migration 0608), when set.
 *   2. org_tenants_mst.language — the tenant's own existing default-language
 *      setting (confirmed via schema read to genuinely exist, default 'en';
 *      this is NOT invented for this module).
 *   3. 'en' hard fallback.
 *
 * Every org_* read filters tenant_org_id directly in the query itself
 * (CLAUDE.md CRITICAL RULE #4). Correlation from outbox row to customer
 * follows the exact same source_entity_type/source_entity_id -> order ->
 * customer_id path already established by
 * lib/notifications/customer-dispatch-consent.ts and
 * lib/notifications/whatsapp-customer-eligibility.ts.
 *
 * Type-bridge note: `org_customers_mst.preferred_language` is added by
 * migration 0608, which is drafted but NOT YET APPLIED — it is therefore
 * absent from the generated `Database` types in types/database.ts. This
 * module reads it through a narrow, explicit interface cast at the client
 * boundary (`CustomerLanguageQueryClient` below), the same established
 * pattern used elsewhere in this directory for an unapplied-migration column
 * or function (see lib/notifications/campaign-target-sync.ts's
 * `CampTargetResolveRpcClient`). Remove `CustomerLanguageQueryClient` once
 * migration 0608 is applied and `npm run prisma:pull` / the Supabase type
 * generator has regenerated `Database` to include the column — at that point
 * select it directly through the normally-typed `createAdminSupabaseClient()`
 * return value instead.
 */
import { createAdminSupabaseClient } from '@lib/supabase/server';
import { logger } from '@lib/utils/logger';

/** Hard fallback when no customer preference and no tenant default can be resolved. */
const HARD_FALLBACK_LANGUAGE = 'en';

interface CustomerPreferredLanguageRow {
  id: string;
  is_active: boolean | null;
  rec_status: number | null;
  preferred_language: string | null;
}

/**
 * Narrow bridge for the one additional column (`preferred_language`) this
 * module needs from `org_customers_mst` ahead of migration 0608 being
 * applied and types regenerated — see the module-level type-bridge note.
 */
interface CustomerLanguageQueryClient {
  from(table: 'org_customers_mst'): {
    select(columns: string): {
      eq(column: string, value: string): {
        eq(column: string, value: string): {
          maybeSingle(): Promise<{ data: CustomerPreferredLanguageRow | null; error: { message: string } | null }>;
        };
      };
    };
  };
}

function isNonBlank(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Reads the tenant's own default-language setting (org_tenants_mst.language).
 * This table's primary key `id` IS the tenant_org_id (org_tenants_mst has no
 * separate tenant_org_id column — it is the tenant row itself), so filtering
 * by `id` is the tenant-scoping predicate for this one lookup.
 * @param tenantOrgId Tenant whose default language is being resolved.
 * @returns The tenant's configured language, or null on any lookup problem/absence.
 */
async function resolveTenantDefaultLanguage(tenantOrgId: string): Promise<string | null> {
  try {
    const supabase = createAdminSupabaseClient();
    const { data, error } = await supabase
      .from('org_tenants_mst')
      .select('language')
      .eq('id', tenantOrgId)
      .maybeSingle();
    if (error || !data) return null;
    return isNonBlank(data.language) ? data.language.trim() : null;
  } catch (err) {
    logger.warn('recipient-language-resolver: tenant default-language lookup failed', {
      tenantOrgId, error: err instanceof Error ? err.message : String(err), feature: 'notifications',
    });
    return null;
  }
}

/**
 * Reads the tenant customer's explicit preferred_language, correlated from a
 * WhatsApp outbox row's source order. Returns null (not a throw) for every
 * case that should fall through to the next tier: no order source, no
 * customer on the order, inactive/soft-deleted customer, lookup failure, or
 * an unset preference.
 * @param tenantOrgId Tenant owning both the source order and the customer.
 * @param sourceEntityType Outbox row source type; only 'order' resolves a customer.
 * @param sourceEntityId Source order identifier.
 * @returns The customer's explicit preferred_language, or null to fall through.
 */
async function resolveCustomerPreferredLanguage(
  tenantOrgId: string,
  sourceEntityType?: string | null,
  sourceEntityId?: string | null,
): Promise<string | null> {
  if (sourceEntityType !== 'order' || !sourceEntityId) return null;

  try {
    // Background dispatch has no customer session; explicit tenant predicates protect both admin-client lookups.
    const supabase = createAdminSupabaseClient();
    const { data: order, error: orderError } = await supabase
      .from('org_orders_mst')
      .select('customer_id')
      .eq('tenant_org_id', tenantOrgId)
      .eq('id', sourceEntityId)
      .maybeSingle();

    if (orderError || !order?.customer_id) return null;

    const customerClient = supabase as unknown as CustomerLanguageQueryClient;
    const { data: customer, error: customerError } = await customerClient
      .from('org_customers_mst')
      .select('id, is_active, rec_status, preferred_language')
      .eq('tenant_org_id', tenantOrgId)
      .eq('id', order.customer_id)
      .maybeSingle();

    if (customerError || !customer || !customer.is_active || customer.rec_status === 0) return null;
    return isNonBlank(customer.preferred_language) ? customer.preferred_language.trim() : null;
  } catch (err) {
    logger.warn('recipient-language-resolver: customer preferred-language lookup failed', {
      tenantOrgId, sourceEntityType, sourceEntityId,
      error: err instanceof Error ? err.message : String(err), feature: 'notifications',
    });
    return null;
  }
}

/**
 * Resolves the recipient language to pass as
 * `ResolveEffectiveNotificationRoute`'s `languageCode` argument, for a
 * WhatsApp outbox row tied to a tenant order/customer. Always resolves to a
 * non-empty string (never null, never throws) via the three-tier fallback
 * chain documented at the top of this file.
 * @param tenantOrgId Tenant owning the source order/customer.
 * @param sourceEntityType Outbox row source type; only 'order' resolves a customer preference.
 * @param sourceEntityId Source order identifier.
 * @returns The resolved recipient language code, always non-empty.
 * @example
 * const languageCode = await resolveNotificationRecipientLanguage(tenantOrgId, 'order', orderId);
 */
export async function resolveNotificationRecipientLanguage(
  tenantOrgId: string,
  sourceEntityType?: string | null,
  sourceEntityId?: string | null,
): Promise<string> {
  const customerPreference = await resolveCustomerPreferredLanguage(tenantOrgId, sourceEntityType, sourceEntityId);
  if (customerPreference) return customerPreference;

  const tenantDefault = await resolveTenantDefaultLanguage(tenantOrgId);
  if (tenantDefault) return tenantDefault;

  return HARD_FALLBACK_LANGUAGE;
}
