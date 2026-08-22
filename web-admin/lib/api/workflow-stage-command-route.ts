import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateCSRF } from '@/lib/middleware/csrf';
import {
  requireRequestPermission,
  usesBearerAuthentication,
} from '@/lib/auth/request-permission-auth';
import { WorkflowEngineError } from '@/lib/services/workflow/workflow-engine.service';
import { httpStatusForWorkflowEngineError } from '@/lib/api/workflow-engine-http';
import { executeWorkflowStageCommand } from '@/lib/services/workflow/workflow-stage-command.service';
import { isValidUUID } from '@/lib/utils/validation-helpers';
import type { WorkflowActionCode } from '@/lib/constants/workflow-actions';
import type { SemanticWorkflowCommandChannel } from '@/lib/services/workflow/semantic-workflow-artifact.service';

const orderIdSchema = z.string().refine(isValidUUID, 'Invalid order UUID.');
const idempotencyKeySchema = z.string().trim().min(1).max(255);

const stageCommandBodySchema = z.object({
  expectedStateVersion: z.number().int().nonnegative(),
  rackLocation: z.string().trim().min(1).max(120).optional(),
  reason: z.string().trim().min(1).max(1000).optional(),
  notes: z.string().trim().max(1000).optional(),
  gateDecisions: z.array(z.object({
    gateCode: z.string().trim().min(1).max(100),
    acknowledgementChallenge: z.string().trim().min(1).max(8000).optional(),
    overrideReason: z.string().trim().min(1).max(2000).optional(),
  })).max(20).optional(),
}).strict();

/** Configuration for a thin stage-owned workflow command route. */
export interface WorkflowStageCommandRouteConfig {
  screen: string;
  actionCode: WorkflowActionCode | string;
  requireReason?: boolean;
  minReasonLength?: number;
  permission?: string;
}

function workflowErrorResponse(error: WorkflowEngineError): NextResponse {
  const status = httpStatusForWorkflowEngineError(error.code);
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

function resolveChannel(isBearer: boolean): SemanticWorkflowCommandChannel {
  return isBearer ? 'mobile' : 'staff_web';
}

/**
 * Creates a CSRF-aware, bearer-compatible POST handler for one stage command.
 * The route owns the screen and action; the client may only supply version,
 * optional rack, and an optional reason/notes payload.
 *
 * @param config server-owned screen, action, and reason policy
 * @returns App Router POST handler
 */
export function createWorkflowStageCommandHandler(
  config: WorkflowStageCommandRouteConfig,
) {
  const permission = config.permission ?? 'orders:transition';
  const minReasonLength = config.minReasonLength ?? 10;

  return async function POST(
    request: NextRequest,
    context: { params: Promise<{ id: string }> },
  ): Promise<NextResponse> {
    const params = await context.params;
    const orderId = orderIdSchema.safeParse(params.id);
    if (!orderId.success) {
      return NextResponse.json(
        { success: false, code: 'INVALID_REQUEST', error: 'Order ID must be a UUID.' },
        { status: 400 },
      );
    }

    const isBearer = usesBearerAuthentication(request);
    // Cookie sessions can be forged from another origin; bearer JWTs are not
    // ambient browser credentials, so CSRF applies only to the session path.
    if (!isBearer) {
      const csrf = await validateCSRF(request);
      if (csrf) return csrf;
    }

    const auth = await requireRequestPermission(request, permission);
    if (auth instanceof NextResponse) return auth;

    const idempotencyKey = idempotencyKeySchema.safeParse(request.headers.get('Idempotency-Key'));
    if (!idempotencyKey.success) {
      return NextResponse.json(
        {
          success: false,
          code: 'IDEMPOTENCY_KEY_REQUIRED',
          error: 'A valid Idempotency-Key header is required.',
        },
        { status: 400 },
      );
    }

    const parsed = stageCommandBodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, code: 'INVALID_REQUEST', error: 'Invalid stage command request.' },
        { status: 400 },
      );
    }

    const reason = parsed.data.reason?.trim() || parsed.data.notes?.trim() || '';
    if (config.requireReason && reason.length < minReasonLength) {
      return NextResponse.json(
        {
          success: false,
          code: 'REASON_REQUIRED',
          error: `This action requires a reason of at least ${minReasonLength} characters.`,
        },
        { status: 400 },
      );
    }

    try {
      const result = await executeWorkflowStageCommand({
        tenantId: auth.tenantId,
        orderId: orderId.data,
        actorUserId: auth.userId,
        actorName: auth.userName,
        screen: config.screen,
        actionCode: config.actionCode,
        expectedStateVersion: parsed.data.expectedStateVersion,
        idempotencyKey: idempotencyKey.data,
        channel: resolveChannel(isBearer),
        input: {
          ...(parsed.data.rackLocation ? { rackLocation: parsed.data.rackLocation } : {}),
          ...(reason ? { notes: reason, reason } : {}),
        },
        gateDecisions: parsed.data.gateDecisions,
      });
      return NextResponse.json({ success: true, data: result }, { status: 200 });
    } catch (error) {
      if (error instanceof WorkflowEngineError) {
        return workflowErrorResponse(error);
      }
      return NextResponse.json(
        { success: false, code: 'STAGE_COMMAND_FAILED', error: 'The stage command failed.' },
        { status: 500 },
      );
    }
  };
}
