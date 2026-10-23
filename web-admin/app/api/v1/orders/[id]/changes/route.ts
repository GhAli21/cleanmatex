import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { validateCSRF } from '@/lib/middleware/csrf';
import { requirePermission } from '@/lib/middleware/require-permission';
import { readBoundedOrderChangeJson, OrderChangeBodyError } from '@/lib/api/order-change-bounded-json';
import { logger } from '@/lib/utils/logger';
import { orderChangeApplyRequestSchema, orderChangeContextParamsSchema, orderChangeHistoryQuerySchema, orderChangeIdempotencyKeySchema } from '@/lib/validations/order-change/order-change.schemas';
import { listOrderChangeHistory } from '@/lib/services/order-change/order-change-history.service';
import { getOrderChangeContext, OrderChangeContextError } from '@/lib/services/order-change/order-change-context.service';
import { hasPermissionServer } from '@/lib/services/permission-service-server';
import { loadOrderChangePreviewFacts, OrderChangePreviewReadError } from '@/lib/services/order-change/order-change-preview-reads';
import { previewOrderChange } from '@/lib/services/order-change/order-change-preview.service';
import { revalidateLockedOrderChangePolicy } from '@/lib/services/order-change/order-change-policy-revalidation.service';
import { applyOrderChange, type OrderChangeApplyTx } from '@/lib/services/order-change/order-change-apply.service';
import { prisma } from '@/lib/db/prisma';
import { withTenantContext } from '@/lib/db/tenant-context';
import { enforceOrderEditSession } from '@/lib/api/order-edit-session-guard';

/** Forces a fresh apply because versions, proof, and settlement are concurrency-sensitive. */
export const dynamic = 'force-dynamic';

function errorResponse(status: number, code: string, message: string, requestId: string): NextResponse {
  return NextResponse.json({ ok: false, error: { code, message, details: null, requestId } }, { status });
}

/**
 * GET /api/v1/orders/[id]/changes
 *
 * Returns applied Change labels for one order. Financial snapshots stay on the server.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const requestId = request.headers.get('x-request-id') ?? randomUUID();
  const auth = await requirePermission('orders:read')(request);
  if (auth instanceof NextResponse) {
    return errorResponse(auth.status, auth.status === 401 ? 'UNAUTHENTICATED' : 'PERMISSION_DENIED', 'Unable to read order changes', requestId);
  }
  const parsedParams = orderChangeContextParamsSchema.safeParse(await params);
  if (!parsedParams.success) return errorResponse(400, 'VALIDATION_ERROR', 'Invalid order identifier', requestId);
  const parsedQuery = orderChangeHistoryQuerySchema.safeParse({
    cursor: request.nextUrl.searchParams.get('cursor') ?? undefined,
    limit: request.nextUrl.searchParams.get('limit') ?? undefined,
  });
  if (!parsedQuery.success) return errorResponse(400, 'VALIDATION_ERROR', 'Invalid history query', requestId);
  const cursor = parsedQuery.data.cursor ? Number(parsedQuery.data.cursor) : undefined;
  if (parsedQuery.data.cursor && !Number.isInteger(cursor)) {
    return errorResponse(400, 'VALIDATION_ERROR', 'Invalid history query', requestId);
  }
  const history = await listOrderChangeHistory({
    tenantId: auth.tenantId,
    orderId: parsedParams.data.id,
    limit: parsedQuery.data.limit,
    cursor,
  });
  return NextResponse.json({ ok: true, data: history, requestId });
}

/**
 * POST /api/v1/orders/[id]/changes
 *
 * Commits one reviewed Change or nothing. Facts are loaded before the
 * transaction. The transaction writes the Change and order fields only.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const requestId = request.headers.get('x-request-id') ?? randomUUID();
  const csrf = await validateCSRF(request);
  if (csrf) return errorResponse(csrf.status, 'CSRF_REJECTED', 'Unable to apply this order change', requestId);

  const auth = await requirePermission('orders:edit')(request);
  if (auth instanceof NextResponse) {
    return errorResponse(auth.status, auth.status === 401 ? 'UNAUTHENTICATED' : 'PERMISSION_DENIED', 'Unable to apply this order change', requestId);
  }

  const idempotencyKey = orderChangeIdempotencyKeySchema.safeParse(request.headers.get('Idempotency-Key'));
  if (!idempotencyKey.success) return errorResponse(400, 'IDEMPOTENCY_KEY_REQUIRED', 'A valid Idempotency-Key header is required', requestId);

  const parsedParams = orderChangeContextParamsSchema.safeParse(await params);
  if (!parsedParams.success) return errorResponse(400, 'VALIDATION_ERROR', 'Invalid order identifier', requestId);
  const session = await enforceOrderEditSession(request, auth, parsedParams.data.id, requestId, errorResponse);
  if (session) return session;

  let body: unknown;
  try {
    body = await readBoundedOrderChangeJson(request);
  } catch (error) {
    if (error instanceof OrderChangeBodyError) return errorResponse(error.status, error.code, 'Invalid order change request', requestId);
    return errorResponse(400, 'MALFORMED_JSON', 'Invalid order change request', requestId);
  }
  const parsedBody = orderChangeApplyRequestSchema.safeParse(body);
  if (!parsedBody.success) return errorResponse(400, 'VALIDATION_ERROR', 'Invalid order change request', requestId);

  try {
    const context = await getOrderChangeContext({ tenantId: auth.tenantId, orderId: parsedParams.data.id });
    const facts = await loadOrderChangePreviewFacts({
      tenantId: auth.tenantId,
      actorUserId: auth.userId,
      context,
      operations: parsedBody.data.operations,
    });
    // Preview reloads the effective policy and rejects a stale revision before any write.
    const preview = await previewOrderChange({
      tenantId: auth.tenantId,
      actorUserId: auth.userId,
      featureEnabled: facts.featureEnabled,
      canUsePermission: (permission) => hasPermissionServer(permission),
      context,
      request: parsedBody.data,
      bindings: facts.bindings,
      policyResolution: facts.policyResolution,
      quotesByTargetId: facts.quotesByTargetId,
      catalog: facts.catalog,
      taxMode: facts.taxMode,
      taxRatePercent: facts.taxRatePercent,
      currencyDecimalPlaces: facts.currencyDecimalPlaces,
      payments: facts.payments,
      credits: facts.credits,
      refunds: facts.refunds,
      persistedExpressAmount: facts.persistedExpressAmount,
      persistedTaxAmount: facts.persistedTaxAmount,
      auditFacts: facts.auditFacts,
      proofKey: facts.proofKey,
    });
    if (preview.ok === false) return errorResponse(preview.status, preview.code, 'Order change apply was rejected', requestId);

    const applied = await applyOrderChange({
      tenantId: auth.tenantId,
      orderId: parsedParams.data.id,
      actorUserId: auth.userId,
      currencyCode: context.order.currencyCode,
      paymentTypeCode: context.order.paymentTypeCode,
      idempotencyKey: idempotencyKey.data,
      request: parsedBody.data,
      preview,
      proofKey: facts.proofKey,
      appliedAt: new Date(),
      // Re-resolve inside the order lock; the earlier re-preview alone cannot
      // protect against a policy replacement between review and mutation.
      validateLockedPolicy: (tx) => revalidateLockedOrderChangePolicy(tx, {
        tenantId: auth.tenantId,
        orderId: parsedParams.data.id,
        binding: preview.reviewBinding,
      }),
      runInTransaction: (fn) => withTenantContext(
        auth.tenantId,
        () => prisma.$transaction((tx) => fn(tx as unknown as OrderChangeApplyTx)),
      ),
    });
    if (applied.ok === false) return errorResponse(applied.status, applied.code, 'Order change apply was rejected', requestId);
    return NextResponse.json({ ok: true, data: applied, requestId });
  } catch (error) {
    if (error instanceof OrderChangeContextError) {
      return errorResponse(error.status, error.code, error.code === 'ORDER_NOT_FOUND' ? 'Order not found' : 'Order is not eligible for Edit V2', requestId);
    }
    if (error instanceof OrderChangePreviewReadError) {
      return errorResponse(error.status, error.code, 'Order change apply could not resolve current commercial facts', requestId);
    }
    logger.error('POST order change apply failed', error instanceof Error ? error : new Error('Unknown apply error'), {
      feature: 'order_change', action: 'apply', tenantId: auth.tenantId, userId: auth.userId, requestId,
    });
    return errorResponse(500, 'INTERNAL_ERROR', 'Unable to apply this order change', requestId);
  }
}
