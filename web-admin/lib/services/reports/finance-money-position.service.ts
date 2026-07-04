import 'server-only';

import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import { ORDER_PAYMENT_LIFECYCLE_STATUSES } from '@/lib/constants/order-financial';

/**
 * Why:
 * Owners/finance need one glanceable "money position" — what came in today,
 * what is still owed to us, and what we still owe customers — without opening
 * four separate reports. Every number is a thin aggregate over the canonical
 * ledgers (order payments, order/AR outstanding, stored-value balances,
 * drawer sessions); nothing here recomputes business rules.
 */

/** One collected-today bucket per payment method. */
export interface MoneyPositionMethodBucket {
  methodCode: string;
  methodName: string;
  count: number;
  amount: number;
}

/** Point-in-time money position for one tenant. */
export interface MoneyPosition {
  /** Start of the reporting day (server time, ISO). */
  asOf: string;
  todayCollections: {
    total: number;
    count: number;
    byMethod: MoneyPositionMethodBucket[];
  };
  /** Σ `org_orders_mst.outstanding_amount` over active orders (> 0). */
  ordersOutstanding: number;
  /** Σ `org_invoice_mst.outstanding_amount` over active invoices (> 0). */
  arOutstanding: number;
  /** Wallet + advance + credit-note balances owed to customers. */
  storedValueLiability: number;
  /** Cash drawer sessions currently OPEN. */
  openDrawerSessions: number;
}

/**
 * Aggregate the tenant's money position from the canonical ledgers.
 *
 * @param tenantOrgId authenticated tenant identifier
 * @returns point-in-time money position (today = server-local day)
 */
export async function getMoneyPosition(tenantOrgId: string): Promise<MoneyPosition> {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  return withTenantContext(tenantOrgId, async () => {
    const [todayPayments, ordersAgg, arAgg, wallets, advances, creditNotes, openSessions] =
      await Promise.all([
        prisma.org_order_payments_dtl.findMany({
          where: {
            tenant_org_id: tenantOrgId,
            is_active: true,
            payment_status: { in: [...ORDER_PAYMENT_LIFECYCLE_STATUSES.COMPLETED] },
            created_at: { gte: startOfToday },
          },
          select: {
            amount: true,
            payment_method_code: true,
            payment_method_name_snapshot: true,
          },
        }),
        prisma.org_orders_mst.aggregate({
          _sum: { outstanding_amount: true },
          where: {
            tenant_org_id: tenantOrgId,
            rec_status: 1,
            outstanding_amount: { gt: 0 },
          },
        }),
        prisma.org_invoice_mst.aggregate({
          _sum: { outstanding_amount: true },
          where: {
            tenant_org_id: tenantOrgId,
            is_active: true,
            outstanding_amount: { gt: 0 },
          },
        }),
        prisma.org_customer_wallets_mst.aggregate({
          _sum: { balance: true },
          where: { tenant_org_id: tenantOrgId, is_active: true, balance: { gt: 0 } },
        }),
        prisma.org_customer_advances_mst.aggregate({
          _sum: { balance: true },
          where: { tenant_org_id: tenantOrgId, is_active: true, balance: { gt: 0 } },
        }),
        prisma.org_credit_notes_mst.aggregate({
          _sum: { remaining_balance: true },
          where: { tenant_org_id: tenantOrgId, is_active: true, remaining_balance: { gt: 0 } },
        }),
        prisma.org_cash_drawer_sessions_mst.count({
          where: { tenant_org_id: tenantOrgId, status: 'OPEN' },
        }),
      ]);

    const byMethodMap = new Map<string, MoneyPositionMethodBucket>();
    let total = 0;
    for (const p of todayPayments) {
      const amount = Number(p.amount ?? 0);
      total += amount;
      const bucket = byMethodMap.get(p.payment_method_code) ?? {
        methodCode: p.payment_method_code,
        methodName: p.payment_method_name_snapshot ?? p.payment_method_code,
        count: 0,
        amount: 0,
      };
      bucket.count += 1;
      bucket.amount += amount;
      byMethodMap.set(p.payment_method_code, bucket);
    }
    const byMethod = Array.from(byMethodMap.values()).sort((a, b) => b.amount - a.amount);

    return {
      asOf: startOfToday.toISOString(),
      todayCollections: { total, count: todayPayments.length, byMethod },
      ordersOutstanding: Number(ordersAgg._sum.outstanding_amount ?? 0),
      arOutstanding: Number(arAgg._sum.outstanding_amount ?? 0),
      storedValueLiability:
        Number(wallets._sum.balance ?? 0)
        + Number(advances._sum.balance ?? 0)
        + Number(creditNotes._sum.remaining_balance ?? 0),
      openDrawerSessions: openSessions,
    };
  });
}
