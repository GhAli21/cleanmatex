/**
 * GET /api/v1/orders/[id]/report/invoices-payments-rprt
 * A4 report: order header + invoices with their canonical payment allocations.
 *
 * Per-invoice payments come from `org_invoice_payments_dtl` (AR allocations),
 * not the deprecated the legacy payments ledger ledger (ADR-002).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import { requirePermission } from '@/lib/middleware/require-permission';
import { getInvoicesForOrder } from '@/lib/services/invoice-service';
import { getDiscountLinesForOrder } from '@/lib/db/order-discounts';
import type { OrderDiscountLine } from '@/lib/db/order-discounts';
import type { Invoice } from '@/lib/types/payment';

/** One canonical AR payment allocation, shaped for the print. */
export interface InvoicePaymentPrintRow {
  id: string;
  paid_at: string | null;
  amount: number;
  currency_code: string | null;
  payment_method_code: string | null;
}

/** Invoice + its canonical payment allocations. */
export interface InvoiceWithPaymentsRprt extends Invoice {
  payments: InvoicePaymentPrintRow[];
}

/** Response contract consumed by `order-invoices-payments-print-rprt.tsx`. */
export interface InvoicesPaymentsRprtResponse {
  order: {
    id: string;
    order_no: string;
    customer: { name: string; phone: string };
    discountLines: OrderDiscountLine[];
  };
  invoices: InvoiceWithPaymentsRprt[];
}

/**
 * @param request incoming request
 * @param root0 route context
 * @param root0.params dynamic segment params promise
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermission('orders:read')(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const { id } = await params;
    const { tenantId } = auth;

    const supabase = await createClient();
    const { data: order, error: orderError } = await supabase
      .from('org_orders_mst')
      .select(`
        id,
        order_no,
        org_customers_mst(
          name,
          name2,
          phone,
          sys_customers_mst(name, name2, phone)
        )
      `)
      .eq('id', id)
      .eq('tenant_org_id', tenantId)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    const custRaw = order.org_customers_mst as unknown;
    const cust = (Array.isArray(custRaw) ? custRaw[0] : custRaw) as {
      name?: string | null;
      phone?: string | null;
      sys_customers_mst?: { name?: string | null; phone?: string | null } | null;
    } | null;
    const sysCust = cust?.sys_customers_mst;
    const orderHeader = {
      id: order.id,
      order_no: order.order_no ?? '',
      customer: {
        name: sysCust?.name || cust?.name || '',
        phone: sysCust?.phone || cust?.phone || '',
      },
    };

    const [invoices, discountLines] = await Promise.all([
      getInvoicesForOrder(id),
      getDiscountLinesForOrder(tenantId, id).catch(() => [] as OrderDiscountLine[]),
    ]);

    const invoiceIds = invoices.map((inv) => inv.id);
    const allocations = invoiceIds.length
      ? await withTenantContext(tenantId, () =>
          prisma.org_invoice_payments_dtl.findMany({
            where: {
              tenant_org_id: tenantId,
              invoice_id: { in: invoiceIds },
              reversed_at: null,
            },
            orderBy: { applied_at: 'asc' },
            select: {
              id: true,
              invoice_id: true,
              allocated_amount: true,
              applied_at: true,
              metadata: true,
            },
          }),
        )
      : [];

    const paymentsByInvoice = new Map<string, InvoicePaymentPrintRow[]>();
    for (const row of allocations) {
      const metadata = (row.metadata ?? {}) as Record<string, unknown>;
      const list = paymentsByInvoice.get(row.invoice_id) ?? [];
      list.push({
        id: row.id,
        paid_at: row.applied_at ? new Date(row.applied_at).toISOString() : null,
        amount: Number(row.allocated_amount ?? 0),
        currency_code: null,
        payment_method_code:
          typeof metadata.payment_method_code === 'string' ? metadata.payment_method_code : null,
      });
      paymentsByInvoice.set(row.invoice_id, list);
    }

    const invoicesWithPayments: InvoiceWithPaymentsRprt[] = invoices.map((inv) => ({
      ...inv,
      payments: paymentsByInvoice.get(inv.id) ?? [],
    }));

    const body: InvoicesPaymentsRprtResponse = {
      order: { ...orderHeader, discountLines },
      invoices: invoicesWithPayments,
    };
    return NextResponse.json({ success: true, ...body });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    const status = message.includes('Unauthorized') || message.includes('tenant') ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
