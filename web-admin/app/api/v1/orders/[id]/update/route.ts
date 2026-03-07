/**
 * Update Order API Endpoint
 * PATCH /api/v1/orders/[id]/update
 *
 * PRD: Edit Order Feature - API Layer
 * Validates permissions, CSRF, and delegates to OrderService.updateOrder()
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateCSRF } from '@/lib/middleware/csrf';
import { requirePermission } from '@/lib/middleware/require-permission';
import { updateOrderInputSchema } from '@/lib/validations/edit-order-schemas';
import { OrderService } from '@/lib/services/order-service';
import { getRequestAuditContext } from '@/lib/utils/request-audit';
import { logger } from '@/lib/utils/logger';

/**
 * PATCH /api/v1/orders/[id]/update
 * Updates an existing order with validation and audit trail
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: orderId } = await params;

  // 1. CSRF validation
  const csrfResponse = await validateCSRF(request);
  if (csrfResponse) {
    return csrfResponse;
  }

  // 2. Permission check: 'orders:update'
  const authCheck = await requirePermission('orders:update')(request);
  if (authCheck instanceof NextResponse) {
    return authCheck;
  }

  const { tenantId, userId, userName } = authCheck;
  const requestAudit = getRequestAuditContext(request);

  // 3. Parse and validate request body
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    logger.error('[update-order] Invalid request body', undefined, {
      feature: 'orders',
      action: 'update_order',
      orderId,
      userId,
    });
    return NextResponse.json(
      { success: false, error: 'Invalid request body' },
      { status: 400 }
    );
  }

  const parsed = updateOrderInputSchema.safeParse({
    ...body,
    orderId,
  });

  if (!parsed.success) {
    const issues = parsed.error.issues;
    const detailMessages = issues.map((issue) => {
      const path = issue.path.length > 0 ? issue.path.join('.') : 'request';
      return `${path}: ${issue.message}`;
    });
    const readableMessage = detailMessages.length > 0
      ? `Validation failed. ${detailMessages.join('; ')}`
      : 'Validation failed';

    logger.error('[update-order] Request body validation failed', undefined, {
      feature: 'orders',
      action: 'update_order',
      orderId,
      userId,
      zodIssues: issues,
    });
    return NextResponse.json(
      {
        success: false,
        error: readableMessage,
        details: issues,
      },
      { status: 400 }
    );
  }

  // 4. Call updateOrder service
  try {
    const result = await OrderService.updateOrder({
      ...parsed.data,
      tenantId,
      userId,
      userName: userName || 'Unknown',
      ipAddress: requestAudit.ip_address || undefined,
      userAgent: requestAudit.user_agent || undefined,
    });

    if (!result.success) {
      // Determine status code based on error
      let statusCode = 500;
      if (result.error?.includes('locked')) {
        statusCode = 423; // Locked
      } else if (result.error?.includes('not found')) {
        statusCode = 404; // Not Found
      } else if (result.error?.includes('cannot be edited') || result.error?.includes('modified by another')) {
        statusCode = 409; // Conflict
      }

      logger.warn('[update-order] Update failed', {
        feature: 'orders',
        action: 'update_order',
        orderId,
        userId,
        error: result.error,
        statusCode,
      });

      return NextResponse.json(
        { success: false, error: result.error },
        { status: statusCode }
      );
    }

    logger.info('[update-order] Order updated successfully', {
      feature: 'orders',
      action: 'update_order',
      orderId,
      userId,
    });

    return NextResponse.json({
      success: true,
      data: { order: result.order },
    });
  } catch (error) {
    logger.error('[update-order] Unexpected error', error as Error, {
      feature: 'orders',
      action: 'update_order',
      orderId,
      userId,
    });

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
      },
      { status: 500 }
    );
  }
}
