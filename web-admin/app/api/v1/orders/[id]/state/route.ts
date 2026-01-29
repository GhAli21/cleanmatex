/**
 * GET /api/v1/orders/[id]/state
 * Get order state with flags and allowed transitions
 * PRD-010: Order state endpoint
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

    // Return data in the format expected by the modal
    return NextResponse.json({
      success: true,
      order,
      items: items || [],
      currentStatus: order.current_status,
      allowedTransitions,
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

