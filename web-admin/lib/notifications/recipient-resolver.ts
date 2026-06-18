/**
 * Resolves delivery addresses (email, phone) for notification outbox rows.
 * Prefers customer contact from the source order; falls back to auth user email.
 */

import { createAdminSupabaseClient } from '@lib/supabase/server';
import { normalizePhone } from '@lib/services/customers.service';
import { NOTIFICATION_CHANNEL, type NotificationChannel } from '@lib/notifications/types';

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
    .select('customer_id')
    .eq('tenant_org_id', tenantOrgId)
    .eq('id', sourceEntityId)
    .maybeSingle();

  if (!order?.customer_id) {
    return { phone: null, email: null };
  }

  const { data: customer } = await supabase
    .from('org_customers_mst')
    .select('phone, email')
    .eq('tenant_org_id', tenantOrgId)
    .eq('id', order.customer_id)
    .maybeSingle();

  const rawPhone = customer?.phone?.trim() || null;
  let phone: string | null = null;
  if (rawPhone) {
    const normalized = normalizePhone(rawPhone);
    phone = normalized.isValid ? normalized.normalized : rawPhone;
  }

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

  if (
    ctx.channelCode === NOTIFICATION_CHANNEL.WHATSAPP ||
    ctx.channelCode === NOTIFICATION_CHANNEL.SMS
  ) {
    return customer.phone;
  }

  return null;
}
