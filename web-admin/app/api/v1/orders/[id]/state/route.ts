/**
 * GET /api/v1/orders/[id]/state
 * Get order state with flags and allowed transitions
 * PRD-010: Order state endpoint
 * Includes payment summary and primary invoice for ready/handover flow
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { WorkflowService } from '@/lib/services/workflow-service';

async function getAuthContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');
  const { data: tenants, error } = await supabase.rpc('get_user_tenants');
  if (error || !tenants || tenants.length === 0) throw new Error('No tenant access found');
  return { tenantId: tenants[0].tenant_id as string };
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { tenantId } = await getAuthContext();
    const { id } = await params;
    
    const supabase = await createClient();
    
    // Fetch order with customer data
    const { data: order, error: orderError } = await supabase
      .from('org_orders_mst')
      .select(`
        *,
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
      `)
      .eq('id', id)
      .eq('tenant_org_id', tenantId)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    // Fetch order items with product details
    const { data: items, error: itemsError } = await supabase
      .from('org_order_items_dtl')
      .select(`
        *,
        org_product_data_mst (
          product_name,
          product_name2,
          product_code
        )
      `)
      .eq('order_id', id)
      .eq('tenant_org_id', tenantId)
      .order('order_item_srno', { ascending: true });

    if (itemsError) {
      console.error('Error fetching order items:', itemsError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch order items' },
        { status: 500 }
      );
    }

    // Get allowed transitions
    const allowedTransitions = await WorkflowService.getAllowedTransitions(
      id,
      tenantId,
      (order.current_status ?? undefined) as any
    );

    // Payment summary from order (total, paid_amount, payment_status)
    const total = Number(order.total ?? order.total_amount ?? 0);
    const paid = Number(order.paid_amount ?? 0);
    const remaining = Math.max(0, total - paid);
    const paymentSummary = {
      status: (order.payment_status as string) || 'pending',
      total,
      paid,
      remaining,
    };

    // All order invoices for payment recording (id, invoice_no, total, paid_amount, remaining)
    type InvoiceRow = { id: string; invoice_no: string | null; total: number; paid_amount: number };
    let orderInvoices: Array<InvoiceRow & { remaining: number }> = [];
    let primaryInvoiceId: string | null = null;
    try {
      const { data: invoices } = await supabase
        .from('org_invoice_mst')
        .select('id, invoice_no, total, paid_amount')
        .eq('order_id', id)
        .eq('tenant_org_id', tenantId)
        .order('created_at', { ascending: false });

      if (invoices?.length) {
        orderInvoices = invoices.map((inv: InvoiceRow) => {
          const total = Number(inv.total ?? 0);
          const paid = Number(inv.paid_amount ?? 0);
          return { ...inv, remaining: Math.max(0, total - paid) };
        });
        // Primary = first invoice with remaining balance, else most recent
        const withBalance = orderInvoices.find((inv) => inv.remaining > 0);
        primaryInvoiceId = (withBalance ?? orderInvoices[0])?.id ?? null;
      }
    } catch {
      // Optional
    }

    // Return data in the format expected by the modal
    return NextResponse.json({
      success: true,
      order,
      items: items || [],
      currentStatus: order.current_status,
      allowedTransitions,
      paymentSummary,
      primaryInvoiceId,
      invoices: orderInvoices,
      flags: {
        isQuickDrop: order.is_order_quick_drop,
        hasSplit: order.has_split,
        hasIssue: order.has_issue,
        isRejected: order.is_rejected,
        requiresRackLocation: order.current_status === 'ready' && !order.rack_location,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    const status = message.includes('Unauthorized') ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

