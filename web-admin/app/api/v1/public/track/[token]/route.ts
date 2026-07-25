import { NextRequest, NextResponse } from 'next/server';
import {
  getPublicOrderTrackingResponse,
  resolvePublicTrackingReferenceByToken,
} from '@/lib/services/public-order-tracking.service';

/**
 * Opaque public order tracking detail API.
 *
 * @param request Incoming HTTP request.
 * @param root0 Route params wrapper.
 * @param root0.params Promise-wrapped route params.
 * @returns Customer-safe order detail payload.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const reference = await resolvePublicTrackingReferenceByToken(token);

  if (!reference) {
    return NextResponse.json(
      {
        success: false,
        error: 'Order not found',
      },
      { status: 404 },
    );
  }

  const result = await getPublicOrderTrackingResponse(request, reference);
  return NextResponse.json(result.body, { status: result.status });
}
