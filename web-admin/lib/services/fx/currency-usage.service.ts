/**
 * Currency usage guard (C4, Tenant_Currency_FX plan 01 §4.1).
 * The only place that decides whether a currency is "in use" and therefore
 * blocked from deactivation. org-currency.service.ts calls this before any
 * deactivation / context-off write; never duplicate this check elsewhere.
 *
 * Scope note: "unsettled payments" is proxied by the order's own aggregate
 * `payment_status` (any order not fully PAID) rather than a separate query
 * against individual payment legs — an order-level non-PAID status already
 * implies an unsettled payment exists for that currency. A payment leg that
 * is individually pending while its order already reads PAID is a
 * reconciliation edge case, not a currency-deactivation safety gap.
 */

import 'server-only';

import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import { ORDER_PAYMENT_STATUS } from '@/lib/constants/order-financial';
import { AR_INVOICE_STATUSES, LEGACY_INVOICE_STATUSES } from '@/lib/constants/ar-invoice';
import { CURRENCY_USAGE_REASON, type CurrencyUsageReason } from '@/lib/constants/currency-fx';

const OPEN_ORDER_PAYMENT_STATUSES: string[] = [
  ORDER_PAYMENT_STATUS.UNPAID,
  ORDER_PAYMENT_STATUS.PENDING_COLLECTION,
  ORDER_PAYMENT_STATUS.PARTIALLY_PAID,
];

const OPEN_INVOICE_STATUSES: string[] = [
  AR_INVOICE_STATUSES.DRAFT,
  AR_INVOICE_STATUSES.OPEN,
  AR_INVOICE_STATUSES.PARTIALLY_PAID,
  AR_INVOICE_STATUSES.OVERDUE,
  LEGACY_INVOICE_STATUSES.DRAFT,
  LEGACY_INVOICE_STATUSES.PENDING,
  LEGACY_INVOICE_STATUSES.PARTIAL,
  LEGACY_INVOICE_STATUSES.OVERDUE,
];

export interface CurrencyUsageResult {
  inUse: boolean;
  reasons: CurrencyUsageReason[];
}

/**
 * Check whether `currencyCode` has any open/non-zero activity for this
 * tenant. Every check is independent — all run even after the first match,
 * so the caller can show the user every blocking reason at once rather than
 * one at a time.
 */
export async function checkCurrencyInUse(
  tenantId: string,
  currencyCode: string
): Promise<CurrencyUsageResult> {
  return withTenantContext(tenantId, async (tenant) => {
    const [
      openOrderCount,
      openInvoiceCount,
      walletBalanceCount,
      giftCardBalanceCount,
      advanceBalanceCount,
      openDrawerSessionCount,
      activeDrawerCount,
    ] = await Promise.all([
      prisma.org_orders_mst.count({
        where: { tenant_org_id: tenant, currency_code: currencyCode, payment_status: { in: OPEN_ORDER_PAYMENT_STATUSES } },
      }),
      prisma.org_invoice_mst.count({
        where: { tenant_org_id: tenant, currency_code: currencyCode, status: { in: OPEN_INVOICE_STATUSES } },
      }),
      prisma.org_customer_wallets_mst.count({
        where: { tenant_org_id: tenant, currency_code: currencyCode, is_active: true, balance: { not: 0 } },
      }),
      prisma.org_gift_cards_mst.count({
        where: { tenant_org_id: tenant, currency_code: currencyCode, is_active: true, current_balance: { not: 0 } },
      }),
      prisma.org_customer_advances_mst.count({
        where: { tenant_org_id: tenant, currency_code: currencyCode, is_active: true, balance: { not: 0 } },
      }),
      prisma.org_cash_drawer_sessions_mst.count({
        where: { tenant_org_id: tenant, currency_code: currencyCode, status: 'OPEN', rec_status: 1 },
      }),
      prisma.org_cash_drawers_mst.count({
        where: { tenant_org_id: tenant, currency_code: currencyCode, is_active: true, rec_status: 1 },
      }),
    ]);

    const reasons: CurrencyUsageReason[] = [];
    if (openOrderCount > 0) reasons.push(CURRENCY_USAGE_REASON.OPEN_ORDERS);
    if (openInvoiceCount > 0) reasons.push(CURRENCY_USAGE_REASON.OPEN_AR);
    if (walletBalanceCount > 0) reasons.push(CURRENCY_USAGE_REASON.NONZERO_WALLET_BALANCE);
    if (giftCardBalanceCount > 0) reasons.push(CURRENCY_USAGE_REASON.NONZERO_GIFT_CARD_BALANCE);
    if (advanceBalanceCount > 0) reasons.push(CURRENCY_USAGE_REASON.NONZERO_ADVANCE_BALANCE);
    if (openDrawerSessionCount > 0) reasons.push(CURRENCY_USAGE_REASON.OPEN_DRAWER_SESSIONS);
    if (activeDrawerCount > 0) reasons.push(CURRENCY_USAGE_REASON.ACTIVE_DRAWERS);

    return { inUse: reasons.length > 0, reasons };
  });
}
