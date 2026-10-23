/**
 * Retired public order confirmation (BF-16).
 * POST /api/v1/public/orders/[tenantId]/[orderNo]/confirm-received
 *
 * This readable path let anyone who guessed an order number confirm receipt,
 * which runs a workflow transition. Confirmation now uses only the opaque
 * `/api/v1/public/track/[token]/confirm-received` route.
 *
 * The route stays as a plain 404: no database access and no workflow call.
 */

import { NextResponse } from 'next/server';
import { logger } from '@/lib/utils/logger';

/**
 * Always answers 404 without touching the database or the workflow engine.
 * @returns Generic not-found response.
 */
export async function POST() {
  logger.warn('Retired legacy public confirm path requested', {
    feature: 'public_order_tracking',
    action: 'legacy_confirm_retired',
  });
  return NextResponse.json({ success: false }, { status: 404 });
}
