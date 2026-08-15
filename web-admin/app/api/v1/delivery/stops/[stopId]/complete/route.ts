/**
 * POST /api/v1/delivery/stops/:stopId/complete
 *
 * Versioned staff Delivery command. It composes POD, stop, route, and workflow
 * writes in one transaction and remains behind the server-side rollout guard.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { validateCSRF } from '@/lib/middleware/csrf';
import { requireAllPermissions } from '@/lib/middleware/require-permission';
import {
  completeDelivery,
  DeliveryCompletionError,
} from '@/lib/services/delivery/delivery-completion.service';
import {
  DELIVERY_HARDENING_ERROR,
  STAFF_DELIVERY_COMPLETION_ENABLED,
} from '@/lib/config/delivery-safety';

const completeDeliverySchema = z.object({
  expectedStateVersion: z.number().int().nonnegative(),
  idempotencyKey: z.string().trim().min(1).max(200),
  podMethodCode: z.string().trim().min(1).max(50),
  podNotes: z.string().trim().max(1000).optional(),
  signatureEvidenceId: z.string().uuid().optional(),
  photoEvidenceIds: z.array(z.string().uuid()).max(10).optional(),
});

/**
 * Completes a delivery for the authenticated tenant.
 *
 * Tenant and actor identity are resolved server-side so callers cannot target
 * another organization by changing request data.
 *
 * @param request authenticated command request
 * @param context route parameters
 * @returns atomic completion result or a stable command error
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ stopId: string }> },
) {
  const csrf = await validateCSRF(request);
  if (csrf) return csrf;

  const auth = await requireAllPermissions(['delivery:pod', 'orders:transition'])(request);
  if (auth instanceof NextResponse) return auth;
  if (!STAFF_DELIVERY_COMPLETION_ENABLED) {
    return NextResponse.json(DELIVERY_HARDENING_ERROR, { status: 503 });
  }

  const body = await request.json().catch(() => null);
  const parsed = completeDeliverySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, code: 'INVALID_REQUEST', error: 'Invalid delivery completion request.' },
      { status: 400 },
    );
  }

  const { stopId } = await params;
  try {
    const result = await completeDelivery({
      tenantId: auth.tenantId,
      stopId,
      actorUserId: auth.userId,
      actorName: auth.userName,
      ...parsed.data,
    });
    return NextResponse.json({ success: true, data: result }, { status: 200 });
  } catch (error) {
    if (error instanceof DeliveryCompletionError) {
      return NextResponse.json(
        { success: false, code: error.code, error: error.message },
        { status: error.httpStatus },
      );
    }
    return NextResponse.json(
      { success: false, code: 'DELIVERY_COMPLETION_FAILED', error: 'Delivery completion failed.' },
      { status: 500 },
    );
  }
}
