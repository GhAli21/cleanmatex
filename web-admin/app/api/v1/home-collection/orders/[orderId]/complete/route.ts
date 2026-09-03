import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateCSRF } from '@/lib/middleware/csrf';
import {
  requireRequestPermission,
  usesBearerAuthentication,
} from '@/lib/auth/request-permission-auth';
import { WorkflowEngineError } from '@/lib/services/workflow/workflow-engine.service';
import { httpStatusForWorkflowEngineError } from '@/lib/api/workflow-engine-http';
import { resolveWorkflowCommandChannel } from '@/lib/api/workflow-command-channel';
import {
  completeHomeCollection,
  HomeCollectionCompletionError,
} from '@/lib/services/home-collection/home-collection-completion.service';
import { isValidUUID } from '@/lib/utils/validation-helpers';

const routeParamsSchema = z.object({
  orderId: z.string().refine(isValidUUID, 'Invalid order UUID.'),
});

const completeRequestSchema = z.object({
  expectedStateVersion: z.number().int().nonnegative(),
  collectionNotes: z.string().trim().max(1000).optional(),
}).strict();

const idempotencyKeySchema = z.string().trim().min(1).max(255);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const routeParams = routeParamsSchema.safeParse(await params);
  if (!routeParams.success) {
    return NextResponse.json(
      { success: false, code: 'INVALID_REQUEST', error: 'Order ID must be a UUID.' },
      { status: 400 },
    );
  }

  if (!usesBearerAuthentication(request)) {
    const csrf = await validateCSRF(request);
    if (csrf) return csrf;
  }

  const auth = await requireRequestPermission(request, 'orders:transition');
  if (auth instanceof NextResponse) return auth;

  const idempotencyKey = idempotencyKeySchema.safeParse(request.headers.get('Idempotency-Key'));
  if (!idempotencyKey.success) {
    return NextResponse.json(
      { success: false, code: 'IDEMPOTENCY_KEY_REQUIRED', error: 'A valid Idempotency-Key header is required.' },
      { status: 400 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = completeRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, code: 'INVALID_REQUEST', error: 'Invalid home collection completion request.' },
      { status: 400 },
    );
  }

  try {
    const result = await completeHomeCollection({
      tenantId: auth.tenantId,
      orderId: routeParams.data.orderId,
      actorUserId: auth.userId,
      actorName: auth.userName,
      idempotencyKey: idempotencyKey.data,
      ...parsed.data,
      channel: resolveWorkflowCommandChannel(request),
    });
    return NextResponse.json({ success: true, data: result }, { status: 200 });
  } catch (error) {
    if (error instanceof HomeCollectionCompletionError) {
      return NextResponse.json(
        { success: false, code: error.code, error: error.message },
        { status: error.httpStatus },
      );
    }
    if (error instanceof WorkflowEngineError) {
      const status = httpStatusForWorkflowEngineError(error.code);
      return NextResponse.json(
        { success: false, code: error.code, error: error.message, blockedReasons: error.blockedReasons },
        { status },
      );
    }
    return NextResponse.json(
      { success: false, code: 'HOME_COLLECTION_COMPLETION_FAILED', error: 'Home collection completion failed.' },
      { status: 500 },
    );
  }
}
