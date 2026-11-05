import 'server-only';

import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import { getDiscountLinesForOrder } from '@/lib/db/order-discounts';

/*
 * Fact-table sources that already existed in `getOrderFinancialSummary`
 * (DESIGN D18). Each returns raw rows for one order, with an explicit
 * tenant_org_id filter; mapping happens in the caller.
 */

/** All charge rows, voided included (shown, never summed). */
export function loadOrderCharges(tenantId: string, orderId: string) {
  return withTenantContext(tenantId, () =>
    prisma.org_order_charges_dtl.findMany({
      where: { tenant_org_id: tenantId, order_id: orderId },
      orderBy: { created_at: 'asc' },
    }),
  );
}

/** Discount lines (manual, rule, promo), via the shared discount reader. */
export function loadOrderDiscounts(tenantId: string, orderId: string) {
  return getDiscountLinesForOrder(tenantId, orderId);
}

export function loadOrderTaxes(tenantId: string, orderId: string) {
  return withTenantContext(tenantId, () =>
    prisma.org_order_taxes_dtl.findMany({
      where: { tenant_org_id: tenantId, order_id: orderId },
      orderBy: { created_at: 'asc' },
    }),
  );
}

/** Active payment rows in every lifecycle state. */
export function loadOrderPayments(tenantId: string, orderId: string) {
  return withTenantContext(tenantId, () =>
    prisma.org_order_payments_dtl.findMany({
      where: { tenant_org_id: tenantId, order_id: orderId, is_active: true },
      orderBy: { created_at: 'asc' },
    }),
  );
}

export function loadOrderCredits(tenantId: string, orderId: string) {
  return withTenantContext(tenantId, () =>
    prisma.org_order_credit_apps_dtl.findMany({
      where: { tenant_org_id: tenantId, order_id: orderId },
      orderBy: { applied_at: 'asc' },
    }),
  );
}

export function loadOrderRefunds(tenantId: string, orderId: string) {
  return withTenantContext(tenantId, () =>
    prisma.org_order_refunds_dtl.findMany({
      where: { tenant_org_id: tenantId, order_id: orderId, is_active: true },
      orderBy: { created_at: 'asc' },
    }),
  );
}

/** Active tax documents, newest first (the supersede chain is in `supersedes_id`). */
export function loadOrderTaxDocuments(tenantId: string, orderId: string) {
  return withTenantContext(tenantId, () =>
    prisma.org_tax_documents_mst.findMany({
      where: { tenant_org_id: tenantId, order_id: orderId, is_active: true },
      orderBy: { created_at: 'desc' },
    }),
  );
}

/** Adjustment row as read by `loadOrderAdjustments`. */
export interface OrderAdjustmentDbRow {
  id: string;
  adjustment_type: string;
  amount: number;
  currency_code: string;
  reason: string | null;
  status: string;
  approved_by: string | null;
  created_by: string | null;
  created_at: Date | string;
  metadata: Record<string, unknown> | null;
}

/** Active adjustments; an environment without the table yields none. */
export async function loadOrderAdjustments(tenantId: string, orderId: string): Promise<OrderAdjustmentDbRow[]> {
  try {
    return await prisma.$queryRaw<OrderAdjustmentDbRow[]>`
      SELECT
        a.id,
        a.adjustment_type,
        a.amount::float8 AS amount,
        a.currency_code,
        a.reason,
        a.status,
        a.approved_by,
        a.created_by,
        a.created_at,
        a.metadata
      FROM public.org_order_adjustments_dtl a
      WHERE a.tenant_org_id = ${tenantId}::uuid
        AND a.order_id = ${orderId}::uuid
        AND a.is_active = true
        AND a.rec_status = 1
      ORDER BY a.created_at ASC
    `;
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (!message.includes('org_order_adjustments_dtl')) throw error;
    return [];
  }
}
