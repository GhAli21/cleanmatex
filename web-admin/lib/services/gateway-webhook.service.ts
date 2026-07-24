import 'server-only';

import { prisma } from '@/lib/db/prisma';
import { logger } from '@/lib/utils/logger';
import { transitionPaymentTx } from './payment-transition.service';
import { FALLBACK_CLASSIFICATIONS, PAYMENT_TRANSITION_ACTIONS, type PaymentTransitionAction } from '@/lib/constants/order-financial';
import { getGatewayAdapter, type GatewayWebhookOutcome, type ParsedGatewayEvent } from './gateway/gateway-webhook-adapter';

export type GatewayWebhookProcessStatus =
  | 'TRANSITIONED'
  | 'DUPLICATE'
  | 'UNMATCHED'
  | 'UNSUPPORTED_OUTCOME'
  | 'REJECTED_SIGNATURE'
  | 'REJECTED_SCHEMA'
  | 'GATEWAY_NOT_FOUND'
  | 'ERROR';

export interface GatewayWebhookProcessResult {
  status: GatewayWebhookProcessStatus;
  eventId?: string;
  action?: PaymentTransitionAction;
  message?: string;
}

/**
 * B08 — for a given (leg status, gateway outcome) pair, the one legal D001
 * transition action, if any. Deliberately status-aware, not outcome-alone:
 * the same PAYMENT_SUCCEEDED-shaped confirmation means VERIFY for a leg
 * still at PROCESSING (today's only real gateway creation status) but CAPTURE
 * for a leg already at AUTHORIZED (dormant sub-lifecycle — see migration
 * 0426's header note). Legality is re-checked by transitionPaymentTx itself
 * against PAYMENT_TRANSITION_SOURCE_STATUSES — this map only decides which
 * action to attempt; it never bypasses the service's own legality gate.
 */
function resolveTransitionAction(
  outcome: GatewayWebhookOutcome,
  currentStatus: string,
): PaymentTransitionAction | null {
  switch (outcome) {
    case 'PAYMENT_SUCCEEDED':
      return currentStatus === 'PROCESSING' || currentStatus === 'PENDING'
        ? PAYMENT_TRANSITION_ACTIONS.VERIFY
        : null;
    case 'PAYMENT_FAILED':
      return currentStatus === 'PROCESSING' || currentStatus === 'PENDING'
        ? PAYMENT_TRANSITION_ACTIONS.FAIL_BOUNCE
        : null;
    case 'CAPTURE_SUCCEEDED':
      return currentStatus === 'AUTHORIZED' ? PAYMENT_TRANSITION_ACTIONS.CAPTURE : null;
    case 'CAPTURE_FAILED':
      // D001: AUTHORIZED's only "capture didn't happen" target is VOIDED —
      // there is no AUTHORIZED -> FAILED edge in the approved graph.
      return currentStatus === 'AUTHORIZED' ? PAYMENT_TRANSITION_ACTIONS.VOID : null;
    case 'SETTLED':
      return currentStatus === 'CAPTURED' ? PAYMENT_TRANSITION_ACTIONS.SETTLE : null;
    case 'AUTHORIZATION_EXPIRED':
      // D001 permits AUTHORIZED -> EXPIRED, but no EXPIRE action exists yet
      // — that belongs to B19 (Expiry + idempotency jobs), not B08. Logged
      // as UNSUPPORTED_OUTCOME rather than silently mapped to VOID/nothing.
      return null;
    default:
      return null;
  }
}

/**
 * B08 — process one inbound gateway webhook request end-to-end: parse ->
 * dedup -> resolve the payment leg -> verify signature (per-tenant secret,
 * resolved from the matched leg) -> dispatch the legal D001 transition.
 *
 * Deliberate ordering: this function looks up `org_order_payments_dtl`
 * WITHOUT a tenant_org_id filter (the one narrow, documented exception to
 * CLAUDE.md CRITICAL RULE #4) — a single public webhook endpoint per
 * `gateway_code` receives events for every tenant configured on that
 * gateway, so the tenant is only knowable AFTER matching the event to a
 * leg by gateway_transaction_id/gateway_reference. Every subsequent query
 * in this function re-scopes by the resolved tenant_org_id.
 *
 * A direct corollary: an event that matches no leg (UNMATCHED) can never be
 * signature-verified, because the secret itself is tenant-scoped and
 * unreachable without a resolved tenant. This is logged for ops, not
 * silently dropped, and never applies a transition.
 */
export async function processGatewayWebhookEvent(params: {
  gatewayCode: string;
  rawBody: string;
  headers: Headers;
}): Promise<GatewayWebhookProcessResult> {
  const { gatewayCode, rawBody, headers } = params;

  const gateway = await prisma.sys_payment_gateway_cd.findFirst({
    where: { code: gatewayCode, is_active: true },
    select: { code: true, gateway_type: true },
  });
  if (!gateway) {
    return { status: 'GATEWAY_NOT_FOUND' };
  }

  const adapter = getGatewayAdapter(gateway.gateway_type);
  const parsed = adapter.parseEvent(rawBody);
  if (!parsed) {
    logger.warn('B08 gateway webhook rejected — unparseable payload', { gatewayCode });
    return { status: 'REJECTED_SCHEMA' };
  }

  // ── Dedup (D010: keyed by provider event id) — insert first, race-safe ──
  let eventRow;
  try {
    eventRow = await prisma.sys_gw_webhook_events_tr.create({
      data: {
        gateway_code: gatewayCode,
        provider_event_id: parsed.providerEventId,
        event_type: parsed.outcome,
        raw_payload: JSON.parse(rawBody),
        signature_valid: false,
        processing_status: 'RECEIVED',
      },
      select: { id: true },
    });
  } catch (err) {
    // Unique-violation on (gateway_code, provider_event_id) = a genuine replay.
    const isDuplicate = (err as { code?: string })?.code === 'P2002';
    if (isDuplicate) {
      return { status: 'DUPLICATE' };
    }
    throw err;
  }

  // ── Resolve the leg (deliberate cross-tenant lookup — see doc above) ────
  const leg = await prisma.org_order_payments_dtl.findFirst({
    where: {
      gateway_code: gatewayCode,
      OR: [
        parsed.gatewayTransactionId ? { gateway_transaction_id: parsed.gatewayTransactionId } : undefined,
        parsed.gatewayReference ? { gateway_reference: parsed.gatewayReference } : undefined,
      ].filter((clause): clause is NonNullable<typeof clause> => clause != null),
    },
    select: { id: true, order_id: true, tenant_org_id: true, payment_status: true, payment_method_code: true },
  });

  if (!leg) {
    await prisma.sys_gw_webhook_events_tr.update({
      where: { id: eventRow.id },
      data: { processing_status: 'UNMATCHED', processed_at: new Date() },
    });
    logger.warn('B08 gateway webhook — no matching payment leg found', {
      gatewayCode,
      providerEventId: parsed.providerEventId,
      gatewayTransactionId: parsed.gatewayTransactionId,
      gatewayReference: parsed.gatewayReference,
    });
    return { status: 'UNMATCHED', eventId: eventRow.id };
  }

  await prisma.sys_gw_webhook_events_tr.update({
    where: { id: eventRow.id },
    data: { tenant_org_id: leg.tenant_org_id, order_id: leg.order_id, payment_id: leg.id },
  });

  // ── Resolve the per-tenant webhook secret + verify signature ────────────
  const methodConfig = await prisma.org_payment_methods_cf.findFirst({
    where: { tenant_org_id: leg.tenant_org_id, payment_method_code: leg.payment_method_code, gateway_code: gatewayCode },
    select: { gateway_config: true },
  });
  const webhookSecret =
    methodConfig?.gateway_config && typeof methodConfig.gateway_config === 'object'
      ? (methodConfig.gateway_config as Record<string, unknown>).webhook_secret
      : null;

  const signatureValid =
    typeof webhookSecret === 'string' && webhookSecret.length > 0
      ? adapter.verifySignature(rawBody, headers, webhookSecret)
      : false;

  if (!signatureValid) {
    await prisma.sys_gw_webhook_events_tr.update({
      where: { id: eventRow.id },
      data: { processing_status: 'REJECTED_SIGNATURE', processed_at: new Date() },
    });
    logger.warn('B08 gateway webhook — signature verification failed', {
      gatewayCode,
      tenantId: leg.tenant_org_id,
      paymentId: leg.id,
      hasSecret: typeof webhookSecret === 'string' && webhookSecret.length > 0,
    });
    return { status: 'REJECTED_SIGNATURE', eventId: eventRow.id };
  }

  await prisma.sys_gw_webhook_events_tr.update({
    where: { id: eventRow.id },
    data: { signature_valid: true, processing_status: 'MATCHED' },
  });

  // ── Resolve + dispatch the legal transition ──────────────────────────────
  const action = resolveTransitionAction(parsed.outcome, leg.payment_status);
  if (!action) {
    await prisma.sys_gw_webhook_events_tr.update({
      where: { id: eventRow.id },
      data: {
        processing_status: 'ERROR',
        error_message: `No legal D001 transition for outcome=${parsed.outcome} from status=${leg.payment_status}`,
        processed_at: new Date(),
      },
    });
    logger.warn('B08 gateway webhook — no legal transition for this (outcome, status) pair', {
      gatewayCode,
      paymentId: leg.id,
      outcome: parsed.outcome,
      currentStatus: leg.payment_status,
    });
    return { status: 'UNSUPPORTED_OUTCOME', eventId: eventRow.id };
  }

  try {
    await transitionPaymentTx({
      orderId: leg.order_id,
      paymentId: leg.id,
      tenantId: leg.tenant_org_id,
      // B08: webhook-driven — no interactive actor; provenance is this
      // event row (payment_id/transition_action), linked below.
      actorId: null,
      action,
      // D009: a gateway decline before confirmation defaults to
      // RETRY_TENDER — the policy D009's own doc assigns to B08.
      fallbackClassification: action === PAYMENT_TRANSITION_ACTIONS.FAIL_BOUNCE
        ? FALLBACK_CLASSIFICATIONS.RETRY_TENDER
        : undefined,
      reason:
        action === PAYMENT_TRANSITION_ACTIONS.FAIL_BOUNCE || action === PAYMENT_TRANSITION_ACTIONS.VOID
          ? (parsed.failureReason ?? `Gateway reported ${parsed.outcome.toLowerCase()}`)
          : undefined,
      idempotencyKey: `gw-webhook-${eventRow.id}`,
    });

    await prisma.sys_gw_webhook_events_tr.update({
      where: { id: eventRow.id },
      data: { processing_status: 'TRANSITIONED', transition_action: action, processed_at: new Date() },
    });

    return { status: 'TRANSITIONED', eventId: eventRow.id, action };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'PAYMENT_TRANSITION_FAILED';
    await prisma.sys_gw_webhook_events_tr.update({
      where: { id: eventRow.id },
      data: { processing_status: 'ERROR', error_message: message, processed_at: new Date() },
    });
    logger.error('B08 gateway webhook — transition failed', err as Error, {
      gatewayCode,
      paymentId: leg.id,
      action,
    });
    return { status: 'ERROR', eventId: eventRow.id, action, message };
  }
}

/** Re-exported for the manual re-sync route/UI — see webhook route doc for the parity note. */
export type { ParsedGatewayEvent };
