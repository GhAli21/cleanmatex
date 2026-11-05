import { NextRequest, NextResponse } from 'next/server';

import { finViewError, finViewFromGuard, finViewOk, finViewPublicNotFound } from '@/lib/api/order-fin-view-http';
import { ORDER_FIN_API_ERRORS } from '@/lib/constants/order-fin-view';
import { NotFoundError } from '@/lib/errors/base-errors';
import { checkPublicFinancialViewRateLimit } from '@/lib/middleware/rate-limit';
import { PublicViewTooLargeError, getPublicOrderFinancialView } from '@/lib/services/order-fin-view/public-view.service';
import { resolvePublicTrackingReferenceByToken } from '@/lib/services/public-order-tracking.service';
import { logger } from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * GET /api/v1/public/track/[token]/financial-view
 *
 * The customer-safe financial view of a tracked order (PLAN P4-06, §6.2). The
 * tenant and order come from the token (revoked or expired tokens resolve to
 * nothing); the `public` preset and the server projection always apply, and
 * the route takes no display options. Every refusal is the same 404 (PR-06).
 * Logs carry no token, IP or customer data.
 * @param request - incoming public request
 * @param ctx - route context; `params.token` is the opaque tracking token
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ token: string }> }): Promise<NextResponse> {
  const limited = await checkPublicFinancialViewRateLimit(request);
  if (limited) return finViewFromGuard(limited);

  const { token } = await params;
  const reference = await resolvePublicTrackingReferenceByToken(token);
  if (!reference) return finViewPublicNotFound();

  try {
    return finViewOk(await getPublicOrderFinancialView(reference.tenantId, reference.orderId));
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof PublicViewTooLargeError) {
      if (error instanceof PublicViewTooLargeError) logger.warn('Public financial view over size cap', { feature: 'order_fin_view', action: 'public_track', tenantId: reference.tenantId });
      return finViewPublicNotFound();
    }
    logger.error('GET public track financial-view failed', error instanceof Error ? error : new Error('Unknown public view error'), {
      feature: 'order_fin_view', action: 'public_track', tenantId: reference.tenantId,
    });
    return finViewError(500, ORDER_FIN_API_ERRORS.INTERNAL_ERROR);
  }
}
