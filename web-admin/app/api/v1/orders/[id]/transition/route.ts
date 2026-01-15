import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { WorkflowService } from '@/lib/services/workflow-service';
import { WorkflowServiceEnhanced } from '@/lib/services/workflow-service-enhanced';
import { TransitionRequestSchema } from '@/lib/validations/workflow-schema';
import { requirePermission } from '@/lib/middleware/require-permission';
import type { OrderStatus } from '@/lib/types/workflow';

/**
 * POST /api/v1/orders/[id]/transition
 * PRD-010: Transition order with permission validation
 * Supports USE_OLD_WF_CODE_OR_NEW parameter for gradual migration
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

    // Support both old and new request formats
    const useOldWfCodeOrNew = body.useOldWfCodeOrNew ?? body.use_old_wf_code_or_new;
    const screen = body.screen;
    const authHeader = request.headers.get('Authorization');

    // If using new workflow system with screen parameter
    if (screen && useOldWfCodeOrNew !== false) {
      try {
        const result = await WorkflowServiceEnhanced.executeScreenTransition(
          screen,
          id,
          {
            to_status: body.toStatus,
            notes: body.notes,
            ...body.input,
            user_name: userName,
            metadata: body.metadata,
          },
          {
            useOldWfCodeOrNew: useOldWfCodeOrNew !== false,
            authHeader,
          }
        );

        return NextResponse.json({
          success: result.ok,
          ok: result.ok,
          data: {
            order: {
              id: result.order_id,
              status: result.to_status,
            },
          },
          error: result.message,
        });
      } catch (error: any) {
        // Handle enhanced workflow errors
        const statusCode =
          error instanceof WorkflowServiceEnhanced.ValidationError ||
          error instanceof WorkflowServiceEnhanced.PermissionError ||
          error instanceof WorkflowServiceEnhanced.FeatureFlagError ||
          error instanceof WorkflowServiceEnhanced.SettingsError
            ? 400
            : error instanceof WorkflowServiceEnhanced.LimitExceededError
            ? 402
            : error instanceof WorkflowServiceEnhanced.QualityGateError
            ? 400
            : 500;

        return NextResponse.json(
          {
            success: false,
            ok: false,
            error: error.message,
            code: error.code || error.name,
            blockers: error.blockers,
            details: error.details,
          },
          { status: statusCode }
        );
      }
    }

    // Fallback to old workflow system
    // IMPORTANT: allow clients to always send the "new format" body shape
    // (screen/input/useOldWfCodeOrNew) even when explicitly using the OLD workflow system.
    const normalizedLegacyBody = {
      toStatus:
        body.toStatus ??
        body.to_status ??
        body.input?.toStatus ??
        body.input?.to_status,
      notes: body.notes ?? body.input?.notes,
      metadata: body.metadata ?? body.input?.metadata,
    };

    const parsed = TransitionRequestSchema.safeParse(normalizedLegacyBody);

    if (!parsed.success) {
      const errorDetails = parsed.error.issues?.map(e => ({
        path: e.path.join('.'),
        message: e.message,
        code: e.code,
      })) || [];
      
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid request body', 
          details: errorDetails
        },
        { status: 400 }
      );
    }
      
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


