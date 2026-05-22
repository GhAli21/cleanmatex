import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/middleware/require-permission';
import { createArDispute, listArDisputes } from '@/lib/services/ar-dispute.service';
import {
  arDisputesQuerySchema,
  createArDisputeSchema,
} from '@/lib/validations/ar-invoice-schemas';
import { jsonApiError, jsonValidationError, parseSearchParams } from '@/app/api/v1/ar/_shared';

export async function GET(request: NextRequest) {
  const auth = await requirePermission('ar_disputes:view')(request);
  if (auth instanceof NextResponse) return auth;

  const parsed = arDisputesQuerySchema.safeParse(parseSearchParams(request.nextUrl.searchParams));
  if (!parsed.success) {
    return jsonValidationError(parsed.error);
  }

  try {
    const data = await listArDisputes(parsed.data, { tenantId: auth.tenantId });
    return NextResponse.json({ success: true, ...data });
  } catch (error) {
    return jsonApiError(error, 'Failed to list AR disputes');
  }
}

export async function POST(request: NextRequest) {
  const auth = await requirePermission('ar_disputes:create')(request);
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await request.json();
    const parsed = createArDisputeSchema.safeParse(body);
    if (!parsed.success) {
      return jsonValidationError(parsed.error);
    }

    const data = await createArDispute(parsed.data, {
      tenantId: auth.tenantId,
      userId: auth.userId,
    });
    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (error) {
    return jsonApiError(error, 'Failed to create AR dispute');
  }
}
