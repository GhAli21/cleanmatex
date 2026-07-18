/**
 * GET /api/v1/orders/[id]/state
 * Get order state with flags and allowed transitions
 * PRD-010: Order state endpoint
 * Includes payment summary and primary invoice for ready/handover flow
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { WorkflowService } from '@/lib/services/workflow-service';
import { readCanonicalOrderFinancialSnapshot } from '@/lib/utils/order-financial-snapshot';

const ORDER_STATE_SELECT = `
  id,
  tenant_org_id,
  order_no,
  current_status,
  current_stage,
  status,
  service_category_code,
  rack_location,
  ready_by,
  ready_by_at_new,
  payment_status,
  subtotal_amount,
  total_tax_amount,
  total_amount,
  total_paid_amount,
  outstanding_amount,
  is_order_quick_drop,
  has_split,
  has_issue,
  is_rejected,
  created_at,
  updated_at,
  created_info,
  created_by,
  org_customers_mst(
    id,
    name,
    name2,
    phone,
    email,
    sys_customers_mst(
      id,
      name,
      name2,
      phone,
      email
    )
  )
`.replace(/\s+/g, ' ').trim();

const ORDER_ITEM_STATE_SELECT = `
  id,
  order_id,
  tenant_org_id,
  order_item_srno,
  quantity,
  quantity_ready,
  service_category_code,
  item_last_step,
  item_is_rejected,
  item_status,
  packing_pref_code,
  status,
  notes,
  product_name,
  product_name2,
  org_product_data_mst(
    product_name,
    product_name2,
    product_code
  )
`.replace(/\s+/g, ' ').trim();

async function getAuthContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');
  const { data: tenants, error } = await supabase.rpc('get_user_tenants');
  if (error || !tenants || tenants.length === 0) throw new Error('No tenant access found');
  return { tenantId: tenants[0].tenant_id as string };
}

/**
 *
 * @param _request
 * @param root0
 * @param root0.params
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { tenantId } = await getAuthContext();
    const { id } = await params;

    const supabase = await createClient();

    const { data: order, error: orderError } = await supabase
      .from('org_orders_mst')
      .select(ORDER_STATE_SELECT)
      .eq('id', id)
      .eq('tenant_org_id', tenantId)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    const orderRow = order as unknown as Record<string, unknown>;

    type InvoiceRow = { id: string; invoice_no: string | null; total: number; paid_amount: number };

    const [itemsResult, allowedTransitions, invoicesResult] = await Promise.all([
      supabase
        .from('org_order_items_dtl')
        .select(ORDER_ITEM_STATE_SELECT)
        .eq('order_id', id)
        .eq('tenant_org_id', tenantId)
        .order('order_item_srno', { ascending: true }),
      WorkflowService.getAllowedTransitions(
        id,
        tenantId,
        (orderRow.current_status ?? undefined) as Parameters<
          typeof WorkflowService.getAllowedTransitions
        >[2]
      ),
      supabase
        .from('org_invoice_mst')
        .select('id, invoice_no, total, paid_amount')
        .eq('order_id', id)
        .eq('tenant_org_id', tenantId)
        .order('created_at', { ascending: false }),
    ]);

    const { data: items, error: itemsError } = itemsResult;

    if (itemsError) {
      console.error('Error fetching order items:', itemsError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch order items' },
        { status: 500 }
      );
    }

    const financialSnapshot = readCanonicalOrderFinancialSnapshot(orderRow);
    const paymentSummary = {
      status: (orderRow.payment_status as string) || 'pending',
      total: financialSnapshot.totalAmount,
      paid: financialSnapshot.totalPaidAmount,
      remaining: financialSnapshot.outstandingAmount,
    };

    let orderInvoices: Array<InvoiceRow & { remaining: number }> = [];
    let primaryInvoiceId: string | null = null;

    const invoices = invoicesResult.data;
    if (invoices?.length) {
      orderInvoices = invoices.map((inv: InvoiceRow) => {
        const total = Number(inv.total ?? 0);
        const paid = Number(inv.paid_amount ?? 0);
        return { ...inv, remaining: Math.max(0, total - paid) };
      });
      const withBalance = orderInvoices.find((inv) => inv.remaining > 0);
      primaryInvoiceId = (withBalance ?? orderInvoices[0])?.id ?? null;
    }

    return NextResponse.json({
      success: true,
      order,
      items: items || [],
      currentStatus: orderRow.current_status,
      allowedTransitions,
      paymentSummary,
      primaryInvoiceId,
      invoices: orderInvoices,
      flags: {
        isQuickDrop: orderRow.is_order_quick_drop,
        hasSplit: orderRow.has_split,
        hasIssue: orderRow.has_issue,
        isRejected: orderRow.is_rejected,
        requiresRackLocation: orderRow.current_status === 'ready' && !orderRow.rack_location,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    const status = message.includes('Unauthorized') ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
