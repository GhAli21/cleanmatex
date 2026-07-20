/**
 * POST /api/finance/process-outbox
 *
 * Internal-only financial outbox processor (B7). Called by pg_cron every
 * minute via pg_net (see migration 0410 — `fin-outbox-processor` job).
 * Authorization: Bearer {FINANCE_OUTBOX_SECRET}
 *
 * Mirrors the notifications outbox processor's auth/trigger pattern
 * (app/api/notifications/process-outbox/route.ts). All business logic lives
 * in lib/services/outbox-processor.service.ts — this route only owns auth
 * and the HTTP envelope.
 */

import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/utils/logger';
import { processOutboxBatch } from '@/lib/services/outbox-processor.service';

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.FINANCE_OUTBOX_SECRET;
  if (!secret) return false;
  const authHeader = request.headers.get('authorization') ?? '';
  return authHeader === `Bearer ${secret}`;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await processOutboxBatch();
    if (result.failed > 0 || result.deadLettered > 0) {
      logger.warn('Financial outbox batch had failures', result as unknown as Record<string, unknown>);
    }
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    logger.error('Financial outbox processor crashed', error instanceof Error ? error : undefined);
    return NextResponse.json({ success: false, error: 'Outbox processing failed' }, { status: 500 });
  }
}
