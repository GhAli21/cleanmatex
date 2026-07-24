import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { AvailableActionsQuerySchema } from '@/lib/validations/workflow-schema';
import {
  WorkflowEngineError,
  listAvailableActions,
} from '@/lib/services/workflow/workflow-engine.service';

/**
 * GET /api/v1/orders/[id]/available-actions?screen={screenKey}&locale=
 *
 * Returns configured workflow actions for the order on the given screen,
 * including gate-blocked reasons. Requires orders:transition permission.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const authCheck = await requirePermission('orders:transition')(request);
    if (authCheck instanceof NextResponse) {
      return authCheck;
    }
    const { tenantId } = authCheck;
    const { id: orderId } = await params;

    const queryParsed = AvailableActionsQuerySchema.safeParse({
      screen: request.nextUrl.searchParams.get('screen') ?? '',
      locale: request.nextUrl.searchParams.get('locale') ?? undefined,
    });

    if (!queryParsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid query parameters',
          details: queryParsed.error.issues,
        },
        { status: 400 },
      );
    }

    const data = await listAvailableActions({
      tenantId,
      orderId,
      screen: queryParsed.data.screen,
      locale: queryParsed.data.locale,
    });

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    if (error instanceof WorkflowEngineError) {
      const status =
        error.code === 'NOT_FOUND'
          ? 404
          : error.code === 'ACTION_NOT_ALLOWED'
            ? 403
            : 400;
      return NextResponse.json(
        {
          success: false,
          error: error.message,
          code: error.code,
          blockedReasons: error.blockedReasons,
        },
        { status },
      );
    }

    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message.includes('Unauthorized') ? 401 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
