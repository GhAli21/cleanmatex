/**
 * POST /api/notifications/webhooks/resend
 *
 * Public, signature-authenticated inbound webhook from Resend (NOT
 * session-authenticated — no CSRF, no getAuthContext; the caller is Resend,
 * not a logged-in browser). Mirrors the ordering and public-webhook shape of
 * app/api/v1/payments/gateway/[gatewayCode]/webhook/route.ts: the raw body is
 * read first and the signature is verified over those exact bytes before any
 * parsing, and the response is always 200 once the signature itself is valid
 * (an unmatched or unsupported event is normal webhook traffic, not an error
 * worth a retry storm) except for a malformed body (400) or a failed
 * signature (401).
 *
 * Closes the confirmed gap from STATUS.md's 2026-10-09/10 entries: EMAIL
 * bounce/complaint events had no suppression-list sink at all. Resend was
 * confirmed as the actually-configured email provider by reading
 * lib/notifications/email-sender.ts (the only email transport in this repo;
 * gated on RESEND_API_KEY, using the `resend` npm package already in
 * package.json) — not guessed.
 *
 * Correlation note: a Resend webhook event carries no tenant context by
 * itself (Resend is one shared platform account, not one account per
 * tenant). Exactly like the payment-gateway webhook's own documented
 * ordering (tenant/leg resolved AFTER the event is matched, before any
 * write), this route resolves the owning tenant by looking up
 * `org_ntf_outbox_dtl.provider_message_id = data.email_id` (now captured at
 * send time — see lib/notifications/email-sender.ts `sendEmailWithId` /
 * lib/notifications/adapters/email.ts) and takes `tenant_org_id` from that
 * single matched row. Every subsequent write (the suppression upsert) then
 * carries that resolved tenant_org_id as an explicit predicate. An event with
 * no matching outbox row (e.g. a transactional email sent through a
 * different, non-notification-hub code path) is logged and acknowledged with
 * 200, not written anywhere — there is no tenant to attribute it to.
 */
import { createHmac, timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@lib/supabase/server';
import { logger } from '@lib/utils/logger';
import { recordSuppression } from '@lib/notifications/suppression-list';

interface ResendWebhookPayload {
  type?: string;
  data?: {
    email_id?: string;
    to?: string[];
    bounce?: { type?: string; subType?: string };
  };
}

/**
 * Verifies a Resend (Svix-format) webhook signature.
 * Svix signs `${svix-id}.${svix-timestamp}.${rawBody}` with HMAC-SHA256 using
 * the base64 portion of the `whsec_...` secret, base64-encodes the digest,
 * and sends one or more space-separated `v1,<base64sig>` tokens in
 * `svix-signature`. The `resend` npm package already in this repo's
 * dependencies does not ship a server-side verifier, so this reimplements
 * the documented Svix v1 scheme directly with Node's `crypto` rather than
 * adding a new dependency for one HMAC comparison.
 * @param rawBody Exact raw request body bytes Resend signed.
 * @param svixId `svix-id` header value.
 * @param svixTimestamp `svix-timestamp` header value.
 * @param svixSignature `svix-signature` header value (space-separated `v1,<sig>` tokens).
 * @param secret `RESEND_WEBHOOK_SECRET` (format `whsec_<base64>`).
 */
function verifyResendSignature(
  rawBody: string,
  svixId: string | null,
  svixTimestamp: string | null,
  svixSignature: string | null,
  secret: string,
): boolean {
  if (!svixId || !svixTimestamp || !svixSignature || !secret) {
    return false;
  }
  const secretBase64 = secret.startsWith('whsec_') ? secret.slice('whsec_'.length) : secret;
  let secretBytes: Buffer;
  try {
    secretBytes = Buffer.from(secretBase64, 'base64');
  } catch {
    return false;
  }
  if (secretBytes.length === 0) {
    return false;
  }

  const signedContent = `${svixId}.${svixTimestamp}.${rawBody}`;
  const expected = createHmac('sha256', secretBytes).update(signedContent).digest();

  const candidates = svixSignature.split(' ').map((token) => token.split(',')[1]).filter(Boolean);
  for (const candidate of candidates) {
    try {
      const candidateBytes = Buffer.from(candidate, 'base64');
      if (candidateBytes.length === expected.length && timingSafeEqual(candidateBytes, expected)) {
        return true;
      }
    } catch {
      // Malformed candidate token — try the next one.
    }
  }
  return false;
}

export async function POST(request: NextRequest) {
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ success: false, error: 'INVALID_BODY' }, { status: 400 });
  }
  if (!rawBody) {
    return NextResponse.json({ success: false, error: 'EMPTY_BODY' }, { status: 400 });
  }

  const secret = process.env.RESEND_WEBHOOK_SECRET ?? '';
  if (!secret) {
    logger.error('resend-webhook: RESEND_WEBHOOK_SECRET not configured — rejecting all callbacks', undefined, {
      feature: 'notifications',
    });
    return NextResponse.json({ success: false, error: 'NOT_CONFIGURED' }, { status: 401 });
  }

  const svixId = request.headers.get('svix-id');
  const svixTimestamp = request.headers.get('svix-timestamp');
  const svixSignature = request.headers.get('svix-signature');

  if (!verifyResendSignature(rawBody, svixId, svixTimestamp, svixSignature, secret)) {
    logger.warn('resend-webhook: invalid signature — rejecting callback', { feature: 'notifications' });
    return NextResponse.json({ success: false, error: 'INVALID_SIGNATURE' }, { status: 401 });
  }

  let payload: ResendWebhookPayload;
  try {
    payload = JSON.parse(rawBody) as ResendWebhookPayload;
  } catch {
    return NextResponse.json({ success: false, error: 'INVALID_JSON' }, { status: 400 });
  }

  const eventType = payload.type ?? '';
  const emailId = payload.data?.email_id ?? null;
  const recipient = payload.data?.to?.[0] ?? null;

  // Only bounce/complaint events feed the suppression list; every other Resend
  // event (sent/delivered/opened/clicked/delivery_delayed) is acknowledged and
  // ignored here — they are not a suppression signal.
  if (eventType !== 'email.bounced' && eventType !== 'email.complained') {
    return NextResponse.json({ success: true, data: { status: 'IGNORED_EVENT_TYPE' } }, { status: 200 });
  }
  if (!emailId || !recipient) {
    logger.warn('resend-webhook: bounce/complaint event missing email_id or recipient — cannot correlate', {
      eventType, feature: 'notifications',
    });
    return NextResponse.json({ success: true, data: { status: 'UNMATCHED_NO_IDENTITY' } }, { status: 200 });
  }

  // Resolve the owning tenant by matching the provider's own message id against
  // the outbox row that was sent with it — the only way to attribute a Resend
  // event (one shared platform account) to a tenant. No tenant predicate is
  // possible before this lookup; every write after it uses the resolved tenant.
  const supabase = createAdminSupabaseClient();
  const { data: outboxRow, error: outboxError } = await supabase
    .from('org_ntf_outbox_dtl')
    .select('tenant_org_id')
    .eq('provider_message_id', emailId)
    .eq('channel_code', 'EMAIL')
    .maybeSingle();

  if (outboxError) {
    logger.error('resend-webhook: outbox correlation lookup failed', new Error(outboxError.message), {
      eventType, feature: 'notifications',
    });
    return NextResponse.json({ success: false, error: 'LOOKUP_FAILED' }, { status: 200 });
  }
  if (!outboxRow) {
    logger.info('resend-webhook: no matching outbox row for this Resend email_id — not a notification-hub send', {
      eventType, feature: 'notifications',
    });
    return NextResponse.json({ success: true, data: { status: 'UNMATCHED_NO_OUTBOX_ROW' } }, { status: 200 });
  }

  if (eventType === 'email.complained') {
    await recordSuppression(outboxRow.tenant_org_id, 'EMAIL', recipient, 'COMPLAINT', 'RESEND_WEBHOOK');
    return NextResponse.json({ success: true, data: { status: 'SUPPRESSED_COMPLAINT' } }, { status: 200 });
  }

  // email.bounced: Resend's payload does not always carry a hard/soft
  // distinction. When it does (data.bounce.type), only a non-'Transient'
  // bounce is treated as permanent enough to suppress on a single event —
  // a lone transient/soft bounce is logged but NOT suppressed here (building
  // repeated-soft-bounce counting/threshold tracking is separate, reported
  // scope below in STATUS.md, not invented in this route).
  const bounceType = payload.data?.bounce?.type;
  if (bounceType && bounceType.toLowerCase() === 'transient') {
    logger.info('resend-webhook: transient (soft) bounce observed — not suppressing on a single occurrence', {
      eventType, feature: 'notifications',
    });
    return NextResponse.json({ success: true, data: { status: 'SOFT_BOUNCE_NOT_SUPPRESSED' } }, { status: 200 });
  }

  await recordSuppression(
    outboxRow.tenant_org_id, 'EMAIL', recipient, 'BOUNCE_HARD', 'RESEND_WEBHOOK',
    bounceType ? `bounce.type=${bounceType}` : undefined,
  );
  return NextResponse.json({ success: true, data: { status: 'SUPPRESSED_BOUNCE' } }, { status: 200 });
}
