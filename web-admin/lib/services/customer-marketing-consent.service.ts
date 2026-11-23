import 'server-only';

import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import {
  MARKETING_CONSENT_CHANNELS,
  MARKETING_CONSENT_SOURCE,
  type MarketingConsentChannel,
} from '@/lib/constants/notification-campaigns';

/**
 * Customer marketing consent per channel (org_ntf_cust_consent_dtl, migration 0818). Customer campaigns
 * reach only customers who agreed on the campaign's channel; HQ re-checks it before each send.
 * This is separate from the order-update preferences in org_customers_mst.preferences.notifications.
 */

export interface MarketingConsentEntry {
  channel: MarketingConsentChannel;
  agreed: boolean;
  givenAt: string | null;
  withdrawnAt: string | null;
}

export interface CustomerMarketingConsent {
  customerId: string;
  /** Whether a message on the channel has somewhere to go; consent can be recorded either way. */
  hasEmail: boolean;
  hasPhone: boolean;
  channels: MarketingConsentEntry[];
}

export interface MarketingConsentChange {
  channel: MarketingConsentChannel;
  agreed: boolean;
}

/**
 * Reads a customer's consent on every marketing channel; a channel with no row is "not agreed".
 * @returns null when the customer is not in this organization
 */
export async function getCustomerMarketingConsent(tenantId: string, customerId: string): Promise<CustomerMarketingConsent | null> {
  return withTenantContext(tenantId, async () => {
    const customer = await prisma.org_customers_mst.findFirst({
      where: { id: customerId, tenant_org_id: tenantId },
      select: { email: true, phone: true },
    });
    if (!customer) return null;
    const rows = await prisma.org_ntf_cust_consent_dtl.findMany({
      where: { tenant_org_id: tenantId, customer_id: customerId, is_active: true, rec_status: 1 },
      select: { channel_code: true, marketing_consent: true, consent_given_at: true, consent_withdrawn_at: true },
    });
    const byChannel = new Map(rows.map((r) => [r.channel_code, r]));
    return {
      customerId,
      hasEmail: Boolean(customer.email?.trim()),
      hasPhone: Boolean(customer.phone?.trim()),
      channels: MARKETING_CONSENT_CHANNELS.map((channel) => {
        const r = byChannel.get(channel);
        return {
          channel,
          agreed: r?.marketing_consent ?? false,
          givenAt: r?.consent_given_at?.toISOString() ?? null,
          withdrawnAt: r?.consent_withdrawn_at?.toISOString() ?? null,
        };
      }),
    };
  });
}

/**
 * Records staff-entered consent decisions in one transaction. Agreeing stamps `consent_given_at`;
 * withdrawing stamps `consent_withdrawn_at` and keeps the earlier given date as history.
 * @returns the consent after saving, or null when the customer is not in this organization
 */
export async function setCustomerMarketingConsent(
  tenantId: string,
  customerId: string,
  changes: MarketingConsentChange[],
  actor: { userId: string; userName?: string | null },
): Promise<CustomerMarketingConsent | null> {
  const found = await withTenantContext(tenantId, async () => {
    const customer = await prisma.org_customers_mst.findFirst({ where: { id: customerId, tenant_org_id: tenantId }, select: { id: true } });
    if (!customer) return false;
    const now = new Date();
    await prisma.$transaction(changes.map(({ channel, agreed }) => prisma.org_ntf_cust_consent_dtl.upsert({
      where: { tenant_org_id_customer_id_channel_code: { tenant_org_id: tenantId, customer_id: customerId, channel_code: channel } },
      create: {
        tenant_org_id: tenantId, customer_id: customerId, channel_code: channel, marketing_consent: agreed,
        consent_given_at: agreed ? now : null, consent_withdrawn_at: agreed ? null : now,
        consent_source: MARKETING_CONSENT_SOURCE.STAFF, created_by: actor.userId, created_info: actor.userName ?? null,
      },
      update: {
        marketing_consent: agreed,
        ...(agreed ? { consent_given_at: now, consent_withdrawn_at: null } : { consent_withdrawn_at: now }),
        consent_source: MARKETING_CONSENT_SOURCE.STAFF, is_active: true, rec_status: 1,
        updated_at: now, updated_by: actor.userId, updated_info: actor.userName ?? null,
      },
    })));
    return true;
  });
  return found ? getCustomerMarketingConsent(tenantId, customerId) : null;
}
