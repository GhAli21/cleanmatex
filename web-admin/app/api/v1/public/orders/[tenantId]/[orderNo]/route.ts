/**
 * Retired public order lookup (BF-16).
 * GET /api/v1/public/orders/[tenantId]/[orderNo]
 *
 * This readable path answered by tenant ID + order number with no second
 * check. Order numbers are guessable, so anyone could read another customer's
 * name, phone, email, items and balance. Public tracking now uses only the
 * opaque `/api/v1/public/track/[token]` route.
 *
 * The route stays as a plain 404 so old links fail closed: no database access,
 * and no response difference between a real and a made-up order (no oracle).
 */

import { NextResponse } from 'next/server';
import { logger } from '@/lib/utils/logger';

/**
 * Always answers 404 without touching the database.
 * @returns Generic not-found response.
 */
export async function GET() {
  logger.warn('Retired legacy public order path requested', {
    feature: 'public_order_tracking',
    action: 'legacy_lookup_retired',
  });
  return NextResponse.json({ success: false }, { status: 404 });
}
