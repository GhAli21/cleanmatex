/**
 * POST /api/v1/delivery/stops/:stopId/evidence
 *
 * Stores a private draft proof object and returns a receipt for the atomic
 * delivery completion command. The request never returns an object URL.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { DELIVERY_EVIDENCE_TYPES } from '@/lib/constants/delivery-evidence';
import { DELIVERY_HARDENING_ERROR, STAFF_DELIVERY_COMPLETION_ENABLED } from '@/lib/config/delivery-safety';
import { validateCSRF } from '@/lib/middleware/csrf';
import { requireAllPermissions } from '@/lib/middleware/require-permission';
import { checkAPIRateLimitTenant } from '@/lib/middleware/rate-limit';
import {
  createDeliveryEvidenceUpload,
  DeliveryEvidenceError,
} from '@/lib/services/delivery/delivery-evidence.service';

const stopParamsSchema = z.object({ stopId: z.string().uuid() });
const evidenceTypeSchema = z.enum([
  DELIVERY_EVIDENCE_TYPES.SIGNATURE,
  DELIVERY_EVIDENCE_TYPES.PHOTO,
]);

/**
 * Accepts the standard Web File shape without depending on a runtime-specific
 * constructor identity between Node and Edge multipart implementations.
 */
function isUploadedFile(value: FormDataEntryValue | null): value is File {
  return value !== null
    && typeof value === 'object'
    && typeof value.name === 'string'
    && typeof value.type === 'string'
    && typeof value.size === 'number'
    && typeof value.arrayBuffer === 'function';
}

/**
 * Creates an evidence receipt for the authenticated tenant and delivery stop.
 *
 * @param request multipart form request with `file` and `evidenceType`
 * @param context route parameters
 * @returns a private evidence receipt, never a storage URL
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

  const rateLimit = await checkAPIRateLimitTenant(auth.tenantId);
  if (rateLimit) return rateLimit;

  const routeParams = stopParamsSchema.safeParse(await params);
  if (!routeParams.success) {
    return NextResponse.json(
      { success: false, code: 'INVALID_REQUEST', error: 'Invalid delivery stop.' },
      { status: 400 },
    );
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get('file');
  const evidenceType = evidenceTypeSchema.safeParse(formData?.get('evidenceType'));
  if (!isUploadedFile(file) || !evidenceType.success) {
    return NextResponse.json(
      { success: false, code: 'INVALID_REQUEST', error: 'A file and valid evidence type are required.' },
      { status: 400 },
    );
  }

  try {
    const result = await createDeliveryEvidenceUpload({
      tenantId: auth.tenantId,
      stopId: routeParams.data.stopId,
      actorUserId: auth.userId,
      evidenceType: evidenceType.data,
      content: Buffer.from(await file.arrayBuffer()),
    });
    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error) {
    if (error instanceof DeliveryEvidenceError) {
      return NextResponse.json(
        { success: false, code: error.code, error: error.message },
        { status: error.httpStatus },
      );
    }
    return NextResponse.json(
      { success: false, code: 'DELIVERY_EVIDENCE_FAILED', error: 'Delivery evidence upload failed.' },
      { status: 500 },
    );
  }
}
