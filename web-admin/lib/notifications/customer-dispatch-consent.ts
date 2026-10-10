/**
 * Shared, channel-agnostic recheck of tenant-customer notification consent at
 * actual dispatch time (production implementation plan invariant 4.1.12 —
 * "Consent, sender eligibility, channel disablement, expiry and suppression
 * are checked again at actual dispatch").
 *
 * Model (confirmed against the current schema before writing this module):
 * - WhatsApp already rechecks consent at dispatch using an OPT-IN model
 *   (customer must explicitly set preferences.notifications.whatsapp = true)
 *   — see lib/notifications/whatsapp-customer-eligibility.ts. That module is
 *   unchanged by this one; WhatsApp remains opt-in because it is a regulated
 *   template channel.
 * - EMAIL and SMS are transactional order notifications that have always been
 *   sent unconditionally (no consent check existed in email.ts/sms.ts before
 *   this module). To satisfy invariant 4.1.12 WITHOUT changing behavior for
 *   every customer who has never touched the preference (required: "preserve
 *   exact current send behavior for every eligible recipient"), this module
 *   uses an OPT-OUT model: it blocks only a channel the customer has
 *   EXPLICITLY turned off (preferences.notifications.<channel> === false).
 *   Absent, true, or any non-false value keeps sending exactly as before.
 * - This module enforces only the customer's own preference flag. A
 *   separate, provider-reported suppression list (email bounce/complaint,
 *   SMS carrier opt-out) now also exists — see
 *   lib/notifications/suppression-list.ts (migration
 *   0603_ntf_suppression_list.sql) — and is checked independently by
 *   adapters/email.ts and adapters/sms.ts, in addition to (never instead of)
 *   this module's customer-preference check.
 * - Only applies when the outbox row is tied to a tenant customer via
 *   source_entity_type === 'order'. Rows with no resolvable customer (e.g.
 *   staff-targeted notifications, or the existing EMAIL fallback-to-auth-user
 *   path used when an order has no customer_id) are left completely
 *   unaffected — there is no customer consent to check for those, and this
 *   module must never block a non-customer recipient.
 */
import { createAdminSupabaseClient } from '@lib/supabase/server';

/** Channels with a customer-facing opt-out preference key on org_customers_mst.preferences.notifications. */
export type ConsentCheckedChannel = 'email' | 'sms';

/**
 * Flat (non-discriminated-union) result shape: web-admin's `strict:false`
 * tsconfig does not narrow discriminated unions reliably (see project memory
 * "ActionResult must be a flat type, not a discriminated union"), so this
 * uses one shape with optional fields instead of a tagged union.
 *
 * `applicable: false` means the row has no resolvable tenant customer (e.g. a
 * staff notification or an order without a customer profile) — callers must
 * proceed exactly as before with no consent gate. When `applicable` is true,
 * `allowed` is authoritative; `retryable`/`reason` are set only when blocked.
 */
export type CustomerDispatchConsent = {
  applicable: boolean;
  allowed: boolean;
  retryable?: boolean;
  reason?: string;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Re-resolve whether a tenant customer has explicitly opted out of EMAIL or
 * SMS notifications, re-read fresh at dispatch so a queued notification
 * respects consent withdrawn after it was enqueued.
 * @param tenantOrgId Tenant owning both the source order and the customer.
 * @param channelCode Dispatch channel being checked.
 * @param sourceEntityType Outbox row source type; only 'order' resolves a customer.
 * @param sourceEntityId Source order identifier.
 * @returns `applicable: false` when there is no customer to check; otherwise the fresh consent outcome.
 * @example
 * const consent = await resolveCustomerDispatchConsent(tenantOrgId, 'email', 'order', orderId);
 */
export async function resolveCustomerDispatchConsent(
  tenantOrgId: string,
  channelCode: ConsentCheckedChannel,
  sourceEntityType?: string | null,
  sourceEntityId?: string | null,
): Promise<CustomerDispatchConsent> {
  if (sourceEntityType !== 'order' || !sourceEntityId) {
    return { applicable: false, allowed: true };
  }

  try {
    // Background dispatch has no customer session; explicit tenant predicates protect both admin-client lookups.
    const supabase = createAdminSupabaseClient();
    const { data: order, error: orderError } = await supabase
      .from('org_orders_mst')
      .select('customer_id')
      .eq('tenant_org_id', tenantOrgId)
      .eq('id', sourceEntityId)
      .maybeSingle();

    if (orderError) {
      return { applicable: true, allowed: false, retryable: true, reason: `${channelCode} customer consent lookup failed for the source order` };
    }
    if (!order?.customer_id) {
      // No tenant customer profile on this order — nothing to check (e.g. legacy EMAIL auth-user fallback path).
      return { applicable: false, allowed: true };
    }

    const { data: customer, error: customerError } = await supabase
      .from('org_customers_mst')
      .select('id, preferences, is_active, rec_status')
      .eq('tenant_org_id', tenantOrgId)
      .eq('id', order.customer_id)
      .maybeSingle();

    if (customerError) {
      return { applicable: true, allowed: false, retryable: true, reason: `${channelCode} customer consent lookup failed for the tenant customer` };
    }
    if (!customer || !customer.is_active || customer.rec_status === 0) {
      return { applicable: true, allowed: false, retryable: false, reason: `${channelCode} tenant customer is missing or inactive` };
    }

    const preferences: unknown = customer.preferences;
    const notifications = isObject(preferences) ? preferences.notifications : undefined;
    const explicitOptOut = isObject(notifications) && notifications[channelCode] === false;
    if (explicitOptOut) {
      return { applicable: true, allowed: false, retryable: false, reason: `Customer has opted out of ${channelCode} notifications` };
    }

    return { applicable: true, allowed: true };
  } catch {
    // Transport failures must retry instead of permanently discarding a consented notification.
    return { applicable: true, allowed: false, retryable: true, reason: `${channelCode} customer consent lookup is temporarily unavailable` };
  }
}
