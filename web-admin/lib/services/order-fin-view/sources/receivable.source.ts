import 'server-only';

import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';

/**
 * AR invoices this order is on (PLAN §5 `receivable`): the per-order link rows,
 * the invoices, and the invoices' payment and credit allocations. Pay on
 * collection is not a receivable and never appears here (D31).
 */
export async function loadOrderReceivable(tenantId: string, orderId: string) {
  const links = await withTenantContext(tenantId, () =>
    prisma.org_invoice_orders_dtl.findMany({
      where: { tenant_org_id: tenantId, order_id: orderId, is_active: true },
      orderBy: { created_at: 'asc' },
      select: {
        id: true,
        invoice_id: true,
        order_total_amount: true,
        invoiced_amount: true,
        paid_before_amount: true,
        credit_before_amount: true,
        outstanding_amount: true,
        created_at: true,
      },
    }),
  );
  const invoiceIds = [...new Set(links.map((l) => l.invoice_id))];
  if (invoiceIds.length === 0) return { links, invoices: [], payments: [], creditAllocations: [] };

  const [invoices, payments, creditAllocations] = await Promise.all([
    withTenantContext(tenantId, () =>
      prisma.org_invoice_mst.findMany({
        where: { tenant_org_id: tenantId, id: { in: invoiceIds } },
        select: {
          id: true,
          invoice_no: true,
          status: true,
          currency_code: true,
          total: true,
          paid_amount: true,
          outstanding_amount: true,
          due_date: true,
          issued_at: true,
          voided_at: true,
        },
      }),
    ),
    withTenantContext(tenantId, () =>
      prisma.org_invoice_payments_dtl.findMany({
        where: { tenant_org_id: tenantId, invoice_id: { in: invoiceIds }, is_active: true },
        orderBy: { applied_at: 'asc' },
        select: {
          id: true,
          invoice_id: true,
          voucher_id: true,
          allocation_outcome: true,
          allocated_amount: true,
          applied_at: true,
          reversed_at: true,
        },
      }),
    ),
    withTenantContext(tenantId, () =>
      prisma.org_ar_credit_allocs_dtl.findMany({
        where: { tenant_org_id: tenantId, invoice_id: { in: invoiceIds } },
        orderBy: { applied_at: 'asc' },
        select: {
          id: true,
          invoice_id: true,
          allocation_status_cd: true,
          applied_amount: true,
          applied_at: true,
          reversed_at: true,
        },
      }),
    ),
  ]);
  return { links, invoices, payments, creditAllocations };
}
