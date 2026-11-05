import { NextRequest, NextResponse } from 'next/server';

import { readBoundedOrderChangeJson } from '@/lib/api/order-change-bounded-json';
import { enforceOrderEditSession } from '@/lib/api/order-edit-session-guard';
import { finViewError, finViewFromGuard, finViewOk } from '@/lib/api/order-fin-view-http';
import { ORDER_FIN_API_ERRORS } from '@/lib/constants/order-fin-view';
import { ORDERS_PERMISSIONS } from '@/lib/constants/permissions/orders-perm';
import { NotFoundError } from '@/lib/errors/base-errors';
import { validateCSRF } from '@/lib/middleware/csrf';
import { checkEditQuoteRateLimit } from '@/lib/middleware/rate-limit';
import { requirePermission } from '@/lib/middleware/require-permission';
import { OrderChangeContextError } from '@/lib/services/order-change/order-change-context.service';
import { OrderChangePreviewReadError } from '@/lib/services/order-change/order-change-preview-reads';
import { runOrderChangePreview } from '@/lib/services/order-change/order-change-preview-run';
import { getOrderEditQuoteView } from '@/lib/services/order-fin-view/edit-view.service';
import { logger } from '@/lib/utils/logger';
import { orderChangeContextParamsSchema, orderChangeRequestSchema } from '@/lib/validations/order-change/order-change.schemas';
import { orderFinViewRequestSchema } from '@/lib/validations/order-fin-view-schemas';
import { resolveOrderFinDisplayConfig } from '@features/orders/order-fin-view/config/resolve-display-config';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/orders/[id]/changes/quote?preset=totals   body: the Edit change request
 *
 * The Order Edit live card (PLAN §6.4, P4-08). Same session, permission
 * (`orders:edit`), CSRF, edit-session lock and calculation as Preview
 * (`runOrderChangePreview`), but no review proof is issued and nothing is
 * written. Returns the Edit preview status (`READY`, `DENIED`, …) and the
 * financial view built on the server over the saved order. Limited per user
 * (PR-22); the card debounces and keeps its last figures on 429.
 * @param request - incoming request (CSRF, auth + tenant from the session, edit-session header)
 * @param ctx - route context; `params.id` is the order id
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  const csrf = await validateCSRF(request);
  if (csrf) return finViewError(403, ORDER_FIN_API_ERRORS.CSRF_REJECTED);
  const auth = await requirePermission(ORDERS_PERMISSIONS.EDIT)(request);
  if (auth instanceof NextResponse) return finViewFromGuard(auth);
  const limited = await checkEditQuoteRateLimit(auth.userId);
  if (limited) return finViewFromGuard(limited);

  const parsedParams = orderChangeContextParamsSchema.safeParse(await params);
  const query = orderFinViewRequestSchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsedParams.success || !query.success) return finViewError(400, ORDER_FIN_API_ERRORS.VALIDATION_FAILED);
  const orderId = parsedParams.data.id;

  const session = await enforceOrderEditSession(request, auth, orderId, '', () => finViewError(403, ORDER_FIN_API_ERRORS.EDIT_SESSION_INVALID));
  if (session) return session;

  let body: unknown;
  try {
    body = await readBoundedOrderChangeJson(request);
  } catch {
    return finViewError(400, ORDER_FIN_API_ERRORS.VALIDATION_FAILED);
  }
  const parsedBody = orderChangeRequestSchema.safeParse(body);
  if (!parsedBody.success) return finViewError(400, ORDER_FIN_API_ERRORS.VALIDATION_FAILED);

  try {
    const startedAt = Date.now();
    const preview = await runOrderChangePreview({ tenantId: auth.tenantId, actorUserId: auth.userId, orderId, request: parsedBody.data, issueProof: false });
    if (preview.ok === false) {
      // A version conflict means the order moved under the draft; anything else is the engine's refusal.
      return preview.status === 409
        ? finViewError(409, ORDER_FIN_API_ERRORS.ORDER_CHANGED, {}, preview.code)
        : finViewError(422, ORDER_FIN_API_ERRORS.QUOTE_REJECTED, {}, preview.code);
    }
    const resolved = resolveOrderFinDisplayConfig({ preset: query.data.preset ?? 'totals', sections: query.data.sections }, 'edit');
    const view = await getOrderEditQuoteView(auth.tenantId, orderId, preview, resolved);
    // Quote latency (PR-13): what the live card waits for after its debounce.
    logger.info('Order edit quote served', {
      feature: 'order_fin_view', action: 'edit_quote', tenantId: auth.tenantId, userId: auth.userId, orderId,
      status: preview.status, outcome: view.header.editOutcome ?? null, latencyMs: Date.now() - startedAt,
    });
    return finViewOk({ status: preview.status, view });
  } catch (error) {
    if (error instanceof NotFoundError) return finViewError(404, ORDER_FIN_API_ERRORS.ORDER_NOT_FOUND);
    if (error instanceof OrderChangeContextError) {
      return error.code === 'ORDER_NOT_FOUND'
        ? finViewError(404, ORDER_FIN_API_ERRORS.ORDER_NOT_FOUND)
        : finViewError(error.status, ORDER_FIN_API_ERRORS.QUOTE_REJECTED, {}, error.code);
    }
    if (error instanceof OrderChangePreviewReadError) return finViewError(error.status, ORDER_FIN_API_ERRORS.QUOTE_REJECTED, {}, error.code);
    logger.error('POST order change quote failed', error instanceof Error ? error : new Error('Unknown quote error'), {
      feature: 'order_fin_view', action: 'edit_quote', tenantId: auth.tenantId, userId: auth.userId, orderId,
    });
    return finViewError(500, ORDER_FIN_API_ERRORS.INTERNAL_ERROR);
  }
}
