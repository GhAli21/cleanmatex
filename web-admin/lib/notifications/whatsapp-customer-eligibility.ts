/** Customer consent is checked from the order's tenant record, rather than staff preferences. */
import { createAdminSupabaseClient } from '@lib/supabase/server';
import { normalizePhone } from '@lib/services/customers.service';
import { stripWhatsAppPrefix } from '@lib/notifications/whatsapp-phone';

/** Separates permanent consent blocks from lookup failures that must remain retryable. */
export type WhatsAppCustomerEligibility =
  | { allowed: true; recipientAddress: string; customerId: string }
  | { allowed: false; retryable: boolean; reason: string };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Resolve the currently authorized customer destination for an order notification.
 * Re-reading consent allows queued notifications to respect later revocation.
 * @param tenantOrgId Tenant owning both the source order and customer.
 * @param sourceEntityType Source must identify an order with a tenant customer.
 * @param sourceEntityId Source order identifier; never inferred from a staff recipient.
 * @returns Authorized normalized destination, a consent block, or a retryable lookup failure.
 * @example
 * const eligibility = await resolveWhatsAppCustomerEligibility(tenantOrgId, 'order', orderId);
 */
export async function resolveWhatsAppCustomerEligibility(
  tenantOrgId: string,
  sourceEntityType?: string | null,
  sourceEntityId?: string | null,
): Promise<WhatsAppCustomerEligibility> {
  if (sourceEntityType !== 'order' || !sourceEntityId) {
    return { allowed: false, retryable: false, reason: 'WhatsApp customer consent cannot be verified without a source order' };
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
      return { allowed: false, retryable: true, reason: 'WhatsApp customer consent lookup failed for the source order' };
    }
    if (!order?.customer_id) {
      return { allowed: false, retryable: false, reason: 'WhatsApp source order has no tenant customer' };
    }

    const { data: customer, error: customerError } = await supabase
      .from('org_customers_mst')
      .select('id, phone, preferences, is_active, rec_status')
      .eq('tenant_org_id', tenantOrgId)
      .eq('id', order.customer_id)
      .maybeSingle();

    if (customerError) {
      return { allowed: false, retryable: true, reason: 'WhatsApp customer consent lookup failed for the tenant customer' };
    }
    if (!customer || !customer.is_active || customer.rec_status === 0) {
      return { allowed: false, retryable: false, reason: 'WhatsApp tenant customer is missing or inactive' };
    }

    // A missing or malformed preference must never grant permission to contact the customer.
    const preferences: unknown = customer.preferences;
    const notifications = isObject(preferences) ? preferences.notifications : undefined;
    if (!isObject(notifications) || notifications.whatsapp !== true) {
      return { allowed: false, retryable: false, reason: 'Customer has not opted in to WhatsApp notifications' };
    }

    const phone = typeof customer.phone === 'string' ? stripWhatsAppPrefix(customer.phone.trim()) : '';
    if (!phone) {
      return { allowed: false, retryable: false, reason: 'WhatsApp opted-in customer has no valid phone number' };
    }
    const normalized = normalizePhone(phone);
    if (!normalized.isValid) {
      return { allowed: false, retryable: false, reason: 'WhatsApp opted-in customer has no valid phone number' };
    }
    return { allowed: true, recipientAddress: normalized.normalized, customerId: customer.id };
  } catch {
    // Transport failures must retry instead of permanently discarding a consented notification.
    return { allowed: false, retryable: true, reason: 'WhatsApp customer consent lookup is temporarily unavailable' };
  }
}
