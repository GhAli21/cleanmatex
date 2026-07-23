import 'server-only';

import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import { PAYMENT_NATURE } from '@/lib/constants/order-financial';

const WORKLIST_STATUSES = ['PENDING', 'PROCESSING'] as const;
export type WorklistStatusFilter = (typeof WORKLIST_STATUSES)[number] | undefined;

export interface PendingPaymentsWorklistParams {
  tenantId: string;
  page: number;
  limit: number;
  branchId?: string;
  paymentMethodCode?: string;
  status?: WorklistStatusFilter;
}

export interface PendingPaymentWorklistRow {
  id: string;
  order_id: string;
  order_no: string | null;
  branch_id: string | null;
  branch_name: string | null;
  customer_name: string | null;
  payment_method_code: string;
  payment_status: string;
  amount: number;
  currency_code: string;
  reference: string | null;
  cash_drawer_session_id: string | null;
  created_at: string;
}

export interface PendingPaymentsWorklistResult {
  counts: { pending: number; processing: number; total: number };
  rows: PendingPaymentWorklistRow[];
  total: number;
}

/**
 * B30 — cross-order back-office worklist query. Tenant/branch-scoped list of
 * PENDING/PROCESSING REAL_PAYMENT legs with health counts, so an accountant
 * does not have to hunt through individual orders for aged pending checks or
 * gateway captures.
 */
export async function listPendingPaymentsWorklist(
  params: PendingPaymentsWorklistParams,
): Promise<PendingPaymentsWorklistResult> {
  const { tenantId, page, limit, branchId, paymentMethodCode, status } = params;

  return withTenantContext(tenantId, async () => {
    const baseWhere = {
      tenant_org_id: tenantId,
      payment_nature_snapshot: PAYMENT_NATURE.REAL_PAYMENT,
      is_active: true,
      ...(branchId ? { branch_id: branchId } : {}),
      ...(paymentMethodCode ? { payment_method_code: paymentMethodCode } : {}),
    };

    const [pending, processing, total, rows] = await Promise.all([
      prisma.org_order_payments_dtl.count({ where: { ...baseWhere, payment_status: 'PENDING' } }),
      prisma.org_order_payments_dtl.count({ where: { ...baseWhere, payment_status: 'PROCESSING' } }),
      prisma.org_order_payments_dtl.count({
        where: { ...baseWhere, payment_status: { in: status ? [status] : [...WORKLIST_STATUSES] } },
      }),
      prisma.org_order_payments_dtl.findMany({
        where: { ...baseWhere, payment_status: { in: status ? [status] : [...WORKLIST_STATUSES] } },
        orderBy: { created_at: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          order_id: true,
          branch_id: true,
          customer_id: true,
          payment_method_code: true,
          payment_status: true,
          amount: true,
          currency_code: true,
          gateway_reference: true,
          check_no: true,
          bank_reference: true,
          cash_drawer_session_id: true,
          created_at: true,
        },
      }),
    ]);

    const branchIds = [...new Set(rows.map((r) => r.branch_id).filter((id): id is string => !!id))];
    const customerIds = [...new Set(rows.map((r) => r.customer_id).filter((id): id is string => !!id))];
    const orderIds = [...new Set(rows.map((r) => r.order_id))];

    const [branches, customers, ordersById] = await Promise.all([
      branchIds.length
        ? prisma.org_branches_mst.findMany({
            where: { id: { in: branchIds }, tenant_org_id: tenantId },
            select: { id: true, branch_name: true },
          })
        : Promise.resolve([]),
      customerIds.length
        ? prisma.org_customers_mst.findMany({
            where: { id: { in: customerIds }, tenant_org_id: tenantId },
            select: { id: true, display_name: true, name: true },
          })
        : Promise.resolve([]),
      orderIds.length
        ? prisma.org_orders_mst.findMany({
            where: { id: { in: orderIds }, tenant_org_id: tenantId },
            select: { id: true, order_no: true },
          })
        : Promise.resolve([]),
    ]);
    const branchNameById = new Map(branches.map((b) => [b.id, b.branch_name]));
    const customerNameById = new Map(customers.map((c) => [c.id, c.display_name ?? c.name]));
    const orderNoById = new Map(ordersById.map((o) => [o.id, o.order_no]));

    return {
      counts: { pending, processing, total },
      total,
      rows: rows.map((r) => ({
        id: r.id,
        order_id: r.order_id,
        order_no: orderNoById.get(r.order_id) ?? null,
        branch_id: r.branch_id,
        branch_name: r.branch_id ? (branchNameById.get(r.branch_id) ?? null) : null,
        customer_name: r.customer_id ? (customerNameById.get(r.customer_id) ?? null) : null,
        payment_method_code: r.payment_method_code,
        payment_status: r.payment_status,
        amount: Number(r.amount),
        currency_code: r.currency_code,
        reference: r.gateway_reference ?? r.check_no ?? r.bank_reference ?? null,
        cash_drawer_session_id: r.cash_drawer_session_id,
        created_at: r.created_at.toISOString(),
      })),
    };
  });
}
