'use server';

import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import { getOrderRefunds } from '@/lib/services/order-refund.service';
import { getAuthContext } from '@/lib/auth/server-auth';
import { getDiscountLinesForOrder } from '@/lib/db/order-discounts';

export interface OrderChargeRow {
  id: string;
  charge_type: string;
  label: string | null;
  label2: string | null;
  amount: number;
  currency_code: string | null;
}

export interface OrderTaxRow {
  id: string;
  tax_type: string;
  label: string;
  rate: number;
  tax_amount: number;
  currency_code: string;
}

export interface OrderPaymentRow {
  id: string;
  payment_method_code: string | null;
  payment_nature_snapshot: string | null;
  amount: number;
  payment_status: string | null;
  received_by: string | null;
  created_at: string;
}

export interface OrderRefundRow {
  id: string;
  refund_no: string | null;
  refund_amount: number;
  refund_status: string | null;
  refund_method_code: string | null;
  reason_code: string | null;
  currency_code: string | null;
  created_at: string;
}

export interface OrderDiscountRow {
  id: string;
  source_type: string;
  source_name: string | null;
  discount_type: string;
  discount_rate: number | null;
  discount_amount: number;
}

export interface OrderFinancialData {
  charges: OrderChargeRow[];
  taxes: OrderTaxRow[];
  payments: OrderPaymentRow[];
  refunds: OrderRefundRow[];
  discounts: OrderDiscountRow[];
}

export async function getOrderFinancialAction(
  tenantId: string,
  orderId: string
): Promise<{ success: boolean; data?: OrderFinancialData; error?: string }> {
  try {
    const [charges, taxes, payments, refundsRaw, discountLines] = await Promise.all([
      withTenantContext(tenantId, () =>
        prisma.org_order_charges_dtl.findMany({
          where: { tenant_org_id: tenantId, order_id: orderId },
          orderBy: { created_at: 'asc' },
        })
      ),
      withTenantContext(tenantId, () =>
        prisma.org_order_taxes_dtl.findMany({
          where: { tenant_org_id: tenantId, order_id: orderId },
          orderBy: { created_at: 'asc' },
        })
      ),
      withTenantContext(tenantId, () =>
        prisma.org_order_payments_dtl.findMany({
          where: { tenant_org_id: tenantId, order_id: orderId },
          orderBy: { created_at: 'asc' },
        })
      ),
      getOrderRefunds(tenantId, orderId),
      getDiscountLinesForOrder(tenantId, orderId),
    ]);

    return {
      success: true,
      data: {
        charges: charges.map((c) => ({
          id: c.id,
          charge_type: c.charge_type,
          label: c.label ?? null,
          label2: c.label2 ?? null,
          amount: Number(c.amount),
          currency_code: c.currency_code ?? null,
        })),
        taxes: taxes.map((t) => ({
          id: t.id,
          tax_type: t.tax_type,
          label: t.label,
          rate: Number(t.rate),
          tax_amount: Number(t.tax_amount),
          currency_code: t.currency_code,
        })),
        payments: payments.map((p) => ({
          id: p.id,
          payment_method_code: p.payment_method_code ?? null,
          payment_nature_snapshot: (p as { payment_nature_snapshot?: string | null }).payment_nature_snapshot ?? null,
          amount: Number(p.amount),
          payment_status: p.payment_status ?? null,
          received_by: (p as { received_by?: string | null }).received_by ?? null,
          created_at: p.created_at ? p.created_at.toISOString() : new Date().toISOString(),
        })),
        discounts: discountLines.map((d) => ({
          id: d.id,
          source_type: d.source_type,
          source_name: d.source_name ?? null,
          discount_type: d.discount_type,
          discount_rate: d.discount_rate ?? null,
          discount_amount: d.discount_amount,
        })),
        refunds: refundsRaw.map((r) => ({
          id: r.id,
          refund_no: r.refund_no ?? null,
          refund_amount: Number(r.refund_amount),
          refund_status: r.refund_status ?? null,
          refund_method_code: r.refund_method_code ?? null,
          reason_code: r.reason_code ?? null,
          currency_code: r.currency_code ?? null,
          created_at: r.created_at ? r.created_at.toISOString() : new Date().toISOString(),
        })),
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch financial data';
    return { success: false, error: message };
  }
}

/** Client-callable variant — resolves tenantId from session internally. */
export async function getOrderFinancialForReceiptAction(
  orderId: string
): Promise<{ success: boolean; data?: OrderFinancialData; error?: string }> {
  try {
    const { tenantId } = await getAuthContext();
    if (!tenantId) return { success: false, error: 'Not authenticated' };
    return getOrderFinancialAction(tenantId, orderId);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch financial data';
    return { success: false, error: message };
  }
}
