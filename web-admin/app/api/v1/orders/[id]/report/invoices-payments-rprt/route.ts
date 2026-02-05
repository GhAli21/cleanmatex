/**
 * GET /api/v1/orders/[id]/report/invoices-payments-rprt
 * A4 report: order header + invoices with their payments
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getInvoicesForOrder } from '@/lib/services/invoice-service';
import { getPaymentHistory } from '@/lib/services/payment-service';
import type { Invoice } from '@/lib/types/payment';
import type { PaymentTransaction } from '@/lib/types/payment';

async function getAuthContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');
  const { data: tenants, error } = await supabase.rpc('get_user_tenants');
  if (error || !tenants || tenants.length === 0) throw new Error('No tenant access found');
  return { tenantId: tenants[0].tenant_id as string };
}

export interface InvoiceWithPaymentsRprt extends Invoice {
  payments: PaymentTransaction[];
}

export interface InvoicesPaymentsRprtResponse {
  order: {
    id: string;
    order_no: string;
    customer: { name: string; phone: string };
  };
  invoices: InvoiceWithPaymentsRprt[];
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { tenantId } = await getAuthContext();

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

    const custRaw = order.org_customers_mst as any;
    const cust = Array.isArray(custRaw) ? custRaw[0] : custRaw;
    const sysCust = cust?.sys_customers_mst;
    const orderHeader = {
      id: order.id,
      order_no: order.order_no ?? '',
      customer: {
        name: sysCust?.name || cust?.name || '',
        phone: sysCust?.phone || cust?.phone || '',
      },
    };

    const invoices = await getInvoicesForOrder(id);
    const invoicesWithPayments: InvoiceWithPaymentsRprt[] = await Promise.all(
      invoices.map(async (inv) => {
        const payments = await getPaymentHistory(inv.id);
        return { ...inv, payments };
      })
    );

    const body: InvoicesPaymentsRprtResponse = {
      order: orderHeader,
      invoices: invoicesWithPayments,
    };
    return NextResponse.json({ success: true, ...body });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    const status = message.includes('Unauthorized') || message.includes('tenant') ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
