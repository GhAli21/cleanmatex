/**
 * Slice 5 — opt-in historical preference-charge recalc.
 * POST /api/v1/orders/recalc-preference-charges
 * No floor screen. Flag default OFF. Permission: orders:post_settlement_edit.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { validateCSRF } from '@/lib/middleware/csrf';
import { prefChargeRecalcRequestSchema } from '@/lib/validations/pref-charge-recalc-schemas';
import {
  PreferenceChargeRecalcError,
  confirmPreferenceChargeRecalc,
  previewPreferenceChargeRecalc,
} from '@/lib/services/order-preference-charge-recalc.service';

/**
 * @param request
 */
export async function POST(request: NextRequest) {
  const csrfResponse = await validateCSRF(request);
  if (csrfResponse) return csrfResponse;

  const authCheck = await requirePermission('orders:post_settlement_edit')(request);
  if (authCheck instanceof NextResponse) return authCheck;
  const { tenantId, userId, userName } = authCheck;

  const body = await request.json().catch(() => null);
  const parsed = prefChargeRecalcRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: 'Invalid request body', details: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    if (parsed.data.mode === 'preview') {
      const data = await previewPreferenceChargeRecalc({
        tenantId,
        orderIds: parsed.data.orderIds,
        limit: parsed.data.limit,
      });
      return NextResponse.json({ success: true, data });
    }

    const data = await confirmPreferenceChargeRecalc({
      tenantId,
      userId,
      userName,
      orderIds: parsed.data.orderIds,
      limit: parsed.data.limit,
      idempotencyKey: parsed.data.idempotencyKey,
    });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error instanceof PreferenceChargeRecalcError) {
      const status =
        error.code === 'FLAG_DISABLED' ? 403
        : error.code === 'IDEMPOTENCY_CONFLICT' ? 409
        : error.code === 'IDEMPOTENCY_IN_PROGRESS' ? 409
        : 400;
      return NextResponse.json({ success: false, error: error.message, code: error.code }, { status });
    }
    const message = error instanceof Error ? error.message : 'Preference charge recalc failed';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
