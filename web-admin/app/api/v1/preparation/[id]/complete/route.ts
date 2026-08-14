/**
 * POST /api/v1/preparation/:id/complete
 *
 * Compatibility adapter for the versioned stage-owned Preparation command.
 * It never writes preparation status directly; the WorkflowEngine remains the
 * sole authority for the workflow transition.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateCSRF } from '@/lib/middleware/csrf';
import { requireAllPermissions } from '@/lib/middleware/require-permission';
import { isPreparationEnabled } from '@/lib/config/features';
import {
  listAvailableActions,
  WorkflowEngineError,
} from '@/lib/services/workflow/workflow-engine.service';
import {
  completePreparationCommand,
  PreparationCompletionError,
} from '@/lib/services/preparation/preparation-completion.service';

const completePreparationRequestSchema = z.object({
  expectedStateVersion: z.number().int().nonnegative().optional(),
  readyByOverride: z.coerce.date().optional(),
  internalNotes: z.string().max(1000).optional(),
});

function workflowErrorResponse(error: WorkflowEngineError) {
  const status =
    error.code === 'NOT_FOUND'
      ? 404
      : error.code === 'VERSION_CONFLICT' || error.code === 'IDEMPOTENCY_CONFLICT'
        ? 409
        : error.code === 'GATE_FAILED'
          ? 422
          : error.code === 'ACTION_NOT_ALLOWED'
            ? 403
            : 400;

  return NextResponse.json(
    {
      success: false,
      code: error.code,
      error: error.message,
      blockedReasons: error.blockedReasons,
    },
    { status },
  );
}

/**
 * Completes preparation for the authenticated tenant.
 *
 * @param request authenticated request body
 * @param context route params
 * @returns atomic stage and workflow completion result
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // CSRF prevents another site from submitting an authenticated stage command.
  const csrf = await validateCSRF(request);
  if (csrf) return csrf;
  if (!isPreparationEnabled()) {
    return NextResponse.json({ success: false, code: 'FEATURE_DISABLED', error: 'Feature disabled.' }, { status: 403 });
  }

  const auth = await requireAllPermissions(['orders:update', 'orders:transition'])(request);
  if (auth instanceof NextResponse) return auth;

  const body = await request.json().catch(() => null);
  const parsed = completePreparationRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, code: 'INVALID_REQUEST', error: 'Invalid preparation completion request.' },
      { status: 400 },
    );
  }

  try {
    const { id: orderId } = await params;
    const idempotencyKey = request.headers.get('Idempotency-Key')?.trim();
    if (!idempotencyKey) {
      return NextResponse.json(
        {
          success: false,
          code: 'IDEMPOTENCY_KEY_REQUIRED',
          error: 'Idempotency-Key header is required.',
        },
        { status: 400 },
      );
    }
    const expectedStateVersion = parsed.data.expectedStateVersion ?? (
      await listAvailableActions({ tenantId: auth.tenantId, orderId, screen: 'preparation' })
    ).stateVersion;
    const result = await completePreparationCommand({
      tenantId: auth.tenantId,
      orderId,
      actorUserId: auth.userId,
      actorName: auth.userName,
      expectedStateVersion,
      idempotencyKey,
      readyByOverride: parsed.data.readyByOverride,
      internalNotes: parsed.data.internalNotes,
    });
    return NextResponse.json({
      success: true,
      data: {
        orderId: result.orderId,
        readyBy: result.readyBy,
        status: result.workflow.currentStatus,
        currentStatus: result.workflow.currentStatus,
        stateVersion: result.workflow.stateVersion,
        preparationStatus: 'completed',
        engine: 'workflow_v2',
      },
    });
  } catch (error) {
    if (error instanceof PreparationCompletionError) {
      return NextResponse.json(
        { success: false, code: error.code, error: error.message },
        { status: error.httpStatus },
      );
    }
    if (error instanceof WorkflowEngineError) {
      return workflowErrorResponse(error);
    }
    return NextResponse.json(
      { success: false, code: 'PREPARATION_COMPLETION_FAILED', error: 'Preparation completion failed.' },
      { status: 500 },
    );
  }
}
