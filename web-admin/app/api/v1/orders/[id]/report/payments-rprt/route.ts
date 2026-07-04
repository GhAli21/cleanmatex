/**
 * GET /api/v1/orders/[id]/report/payments-rprt?sort=asc|desc
 * A4 report: order header + canonical payments list (sort by date).
 *
 * Reads `org_order_payments_dtl` via the canonical read model (ADR-002 —
 * the legacy payments ledger is deprecated) so the print can never disagree with
 * the order financial snapshot.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import {
  getOrderPaymentsCanonical,
  type OrderPaymentRow,
} from '@/lib/services/order-financial-summary.service';

/** Response contract consumed by `order-payments-print-rprt.tsx`. */
export interface PaymentsRprtResponse {
  order: {
    id: string;
    order_no: string;
    customer: { name: string; phone: string };
  };
  payments: OrderPaymentRow[];
  sortOrder: 'asc' | 'desc';
}

/**
 * @param request incoming request (optional `sort` query param)
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
    const sortParam = request.nextUrl.searchParams.get('sort');
    const sortOrder: 'asc' | 'desc' = sortParam === 'asc' ? 'asc' : 'desc';

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

    const payments = await getOrderPaymentsCanonical(tenantId, id);
    if (sortOrder === 'asc') payments.reverse();

    const body: PaymentsRprtResponse = {
      order: orderHeader,
      payments,
      sortOrder,
    };
    return NextResponse.json({ success: true, ...body });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    const status = message.includes('Unauthorized') || message.includes('tenant') ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
