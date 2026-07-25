import { NextRequest, NextResponse } from 'next/server';
import { checkPublicConfirmReceivedRateLimit } from '@/lib/middleware/rate-limit';
import {
  confirmPublicOrderReceivedResponse,
  resolvePublicTrackingReferenceByToken,
} from '@/lib/services/public-order-tracking.service';

/**
 * Opaque public confirm-received API.
 *
 * @param request Incoming HTTP request.
 * @param root0 Route params wrapper.
 * @param root0.params Promise-wrapped route params.
 * @returns Confirmation result payload.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const rateLimited = await checkPublicConfirmReceivedRateLimit(request);
  if (rateLimited) return rateLimited;

  const { token } = await params;
  const reference = await resolvePublicTrackingReferenceByToken(token);

  if (!reference) {
    return NextResponse.json(
      { success: false, error: 'Order not found' },
      { status: 404 },
    );
  }

  const result = await confirmPublicOrderReceivedResponse(request, reference);
  return NextResponse.json(result.body, { status: result.status });
}
