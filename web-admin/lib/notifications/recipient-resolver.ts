/**
 * Resolves delivery addresses (email, phone) for notification outbox rows.
 * Prefers customer contact from the source order; falls back to auth user email.
 */

import { createAdminSupabaseClient } from '@lib/supabase/server';
import { normalizePhone } from '@lib/services/customers.service';
import { NOTIFICATION_CHANNEL, type NotificationChannel } from '@lib/notifications/types';
import { getTwilioWhatsappSandboxToPhone } from '@lib/notifications/config';
import { pickWhatsAppDestination, stripWhatsAppPrefix } from '@lib/notifications/whatsapp-phone';

export interface RecipientResolveContext {
  tenantOrgId: string;
  recipientUserId: string;
  channelCode: NotificationChannel | string;
  sourceEntityType?: string | null;
  sourceEntityId?: string | null;
}

interface CustomerContact {
  phone: string | null;
  email: string | null;
}

/** Normalize a picked phone to E.164; keep the raw value if it cannot be parsed. */
function toWhatsAppE164(raw: string): string {
  const normalized = normalizePhone(raw)
  return normalized.isValid ? normalized.normalized : raw
}

async function resolveAuthUserEmail(userId: string): Promise<string | null> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase.auth.admin.getUserById(userId);
  if (error || !data.user) return null;
  return data.user.email ?? null;
}

async function resolveCustomerContactFromOrder(
  tenantOrgId: string,
  sourceEntityType: string | null | undefined,
  sourceEntityId: string | null | undefined,
): Promise<CustomerContact> {
  if (sourceEntityType !== 'order' || !sourceEntityId) {
    return { phone: null, email: null };
  }

  const supabase = createAdminSupabaseClient();

  const { data: order } = await supabase
    .from('org_orders_mst')
    .select('customer_id, customer_mobile_number')
    .eq('tenant_org_id', tenantOrgId)
    .eq('id', sourceEntityId)
    .maybeSingle();

  if (!order?.customer_id) {
    const rawPhone = pickWhatsAppDestination(null, null, order?.customer_mobile_number)
    return {
      phone: rawPhone ? toWhatsAppE164(rawPhone) : null,
      email: null,
    };
  }

  const { data: customer } = await supabase
    .from('org_customers_mst')
    .select('phone, email')
    .eq('tenant_org_id', tenantOrgId)
    .eq('id', order.customer_id)
    .maybeSingle();

  const rawPhone = pickWhatsAppDestination(null, customer?.phone, order.customer_mobile_number);
  const phone = rawPhone ? toWhatsAppE164(rawPhone) : null;

  const email = customer?.email?.trim() || null;
  return { phone, email };
}

/**
 * Resolve the delivery address for a channel (customer-first, then auth user for email).
 */
export async function resolveRecipientAddress(ctx: RecipientResolveContext): Promise<string | null> {
  const customer = await resolveCustomerContactFromOrder(
    ctx.tenantOrgId,
    ctx.sourceEntityType,
    ctx.sourceEntityId,
  );

  if (ctx.channelCode === NOTIFICATION_CHANNEL.EMAIL) {
    return customer.email ?? (await resolveAuthUserEmail(ctx.recipientUserId));
  }

  if (ctx.channelCode === NOTIFICATION_CHANNEL.SMS) {
    return customer.phone;
  }

  if (ctx.channelCode === NOTIFICATION_CHANNEL.WHATSAPP) {
    const sandboxTo = await getTwilioWhatsappSandboxToPhone();
    const dest = pickWhatsAppDestination(sandboxTo, customer.phone, null);
    return dest ? toWhatsAppE164(stripWhatsAppPrefix(dest)) : null;
  }

  return null;
}
