import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { WorkflowService } from '@/lib/services/workflow-service';
import { TransitionRequestSchema } from '@/lib/validations/workflow-schema';
import { requirePermission } from '@/lib/middleware/require-permission';
import type { OrderStatus } from '@/lib/types/workflow';

/**
 * POST /api/v1/orders/[id]/transition
 * PRD-010: Transition order with permission validation
 * Requires: orders:transition permission
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    
    // Check permission
    const authCheck = await requirePermission('orders:transition')(request);
    if (authCheck instanceof NextResponse) {
      return authCheck; // Permission denied
    }
    const { tenantId, userId, userName } = authCheck;

    const body = await request.json();
    console.log('[Jh] POST /api/v1/orders/[id]/transition: Request body:'
      , JSON.stringify(body, null, 2));

    const parsed = TransitionRequestSchema.safeParse(body);
    console.log('[Jh] POST /api/v1/orders/[id]/transition: parsed:'
      , JSON.stringify(parsed, null, 2));

    if (!parsed.success) {
      const errorDetails = parsed.error.issues?.map(e => ({
        path: e.path.join('.'),
        message: e.message,
        code: e.code,
      })) || [];
      
      console.error('[Jh] POST /api/v1/orders/[id]/transition: Validation failed:' + JSON.stringify(errorDetails, null, 2));
      
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid request body', 
          details: errorDetails
        },
        { status: 400 }
      );
    }
    console.log('[Jh] POST /api/v1/orders/[id]/transition: Parsed data:'
      + JSON.stringify(parsed.data, null, 2));
    console.log('[Jh] POST /api/v1/orders/[id]/transition: toStatus:' + parsed.data.toStatus);
    console.log('[Jh] POST /api/v1/orders/[id]/transition: notes:' + parsed.data.notes);
    console.log('[Jh] POST /api/v1/orders/[id]/transition: metadata:' + JSON.stringify(parsed.data.metadata, null, 2));
      
    const toStatus = parsed.data.toStatus;
    const notes = parsed.data.notes;
    const metadata = parsed.data.metadata;

    // Get current order status
    const supabase = await createClient();
    const { data: order, error } = await supabase
      .from('org_orders_mst')
      .select('current_status, status')
      .eq('id', id)
      .eq('tenant_org_id', tenantId)
      .single();

    if (error || !order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    // Normalize status values to lowercase for consistent matching
    const fromStatus = ((order.current_status || order.status) as string)?.toLowerCase() as OrderStatus;
    const normalizedToStatus = toStatus.toLowerCase() as OrderStatus;

    // Permission check already done via requirePermission('orders:transition')
    // Additional workflow-specific checks can be added here if needed

    const result = await WorkflowService.changeStatus({
      orderId: id,
      tenantId,
      fromStatus,
      toStatus: normalizedToStatus,
      userId,
      userName,
      notes,
      metadata,
    });

    if (!result.success) {
      return NextResponse.json({ success: false, error: result.error, blockers: result.blockers }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: result.order });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    const status = message.includes('Unauthorized') ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}


