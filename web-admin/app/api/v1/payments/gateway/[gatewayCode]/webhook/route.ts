/**
 * POST /api/v1/payments/gateway/[gatewayCode]/webhook
 *
 * B08 — Gateway Lifecycle Integration. Public, signature-authenticated
 * inbound webhook (NOT session-authenticated — no CSRF, no getAuthContext;
 * the caller is a payment gateway, not a logged-in browser). Signature
 * verification happens inside `processGatewayWebhookEvent` using the
 * per-tenant secret resolved AFTER the event is matched to a payment leg —
 * see that service's own doc for why this ordering is deliberate.
 *
 * Always reads the raw body as text before anything else — signatures are
 * computed over the exact bytes the gateway sent, not a re-serialized
 * parse of them.
 *
 * Response codes are deliberately generic (never leak whether a
 * tenant/leg/gateway exists to an unauthenticated caller): 200 for every
 * outcome except a genuinely malformed request (400) or a failed signature
 * check (401). A 200 on UNMATCHED/ERROR is intentional — the webhook was
 * received and logged; retrying an unmatched event will not resolve it
 * (ops visibility is via `sys_gw_webhook_events_tr`, not HTTP retries).
 */
import { NextRequest, NextResponse } from 'next/server';
import { processGatewayWebhookEvent } from '@/lib/services/gateway-webhook.service';
import { logger } from '@/lib/utils/logger';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ gatewayCode: string }> },
) {
  const { gatewayCode } = await params;

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ success: false, error: 'INVALID_BODY' }, { status: 400 });
  }
  if (!rawBody) {
    return NextResponse.json({ success: false, error: 'EMPTY_BODY' }, { status: 400 });
  }

  try {
    const result = await processGatewayWebhookEvent({
      gatewayCode,
      rawBody,
      headers: request.headers,
    });

    if (result.status === 'GATEWAY_NOT_FOUND' || result.status === 'REJECTED_SCHEMA') {
      return NextResponse.json({ success: false, error: result.status }, { status: 400 });
    }
    if (result.status === 'REJECTED_SIGNATURE') {
      return NextResponse.json({ success: false, error: result.status }, { status: 401 });
    }
    // TRANSITIONED / DUPLICATE / UNMATCHED / UNSUPPORTED_OUTCOME / ERROR all
    // ack with 200 — see doc above.
    return NextResponse.json({ success: true, data: { status: result.status } }, { status: 200 });
  } catch (error) {
    logger.error('B08 gateway webhook — unhandled processing error', error as Error, { gatewayCode });
    // Still 200: an unhandled exception here should not cause the gateway
    // to hammer retries against an endpoint that will keep throwing for the
    // same malformed/unexpected event; the raw payload for a genuinely new
    // event was already durably logged before any code that could throw.
    return NextResponse.json({ success: false, error: 'PROCESSING_ERROR' }, { status: 200 });
  }
}
