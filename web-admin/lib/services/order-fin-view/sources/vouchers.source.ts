import 'server-only';

import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';

/**
 * Finance vouchers for the order: those carrying its `order_id`, plus those
 * referenced by its payments, credit applications and refunds (PLAN §5).
 * Two steps, each tenant-filtered, so no join can cross tenants.
 */
export async function loadOrderVouchers(tenantId: string, orderId: string) {
  const scope = { tenant_org_id: tenantId, order_id: orderId, fin_voucher_id: { not: null } };
  const pick = { fin_voucher_id: true } as const;
  const [payments, credits, refunds] = await Promise.all([
    withTenantContext(tenantId, () => prisma.org_order_payments_dtl.findMany({ where: scope, select: pick })),
    withTenantContext(tenantId, () => prisma.org_order_credit_apps_dtl.findMany({ where: scope, select: pick })),
    withTenantContext(tenantId, () => prisma.org_order_refunds_dtl.findMany({ where: scope, select: pick })),
  ]);
  const referenced = [...new Set([...payments, ...credits, ...refunds].map((r) => r.fin_voucher_id as string))];

  return withTenantContext(tenantId, () =>
    prisma.org_fin_vouchers_mst.findMany({
      where: {
        tenant_org_id: tenantId,
        OR: [{ order_id: orderId }, ...(referenced.length ? [{ id: { in: referenced } }] : [])],
      },
      orderBy: { created_at: 'asc' },
      select: {
        id: true,
        voucher_no: true,
        voucher_category: true,
        voucher_type: true,
        voucher_subtype: true,
        voucher_status: true,
        posting_status: true,
        direction: true,
        total_amount: true,
        currency_code: true,
        issued_at: true,
        voided_at: true,
        reversed_at: true,
        reversed_by_voucher_id: true,
        ref_voucher_id: true,
        created_at: true,
      },
    }),
  );
}
