import 'server-only';
import { createHmac, timingSafeEqual } from 'crypto';

/**
 * B08 — Gateway Lifecycle Integration.
 *
 * The normalized outcome vocabulary a `GatewayAdapter` translates a
 * provider-specific webhook payload into. `gateway-webhook.service.ts` maps
 * (outcome, current leg status) onto a legal D001 transition action — never
 * the event type alone, since the same outcome means a different action
 * depending on which sub-lifecycle bucket the leg is already in (e.g.
 * PAYMENT_SUCCEEDED on a PROCESSING leg -> VERIFY, but this outcome never
 * applies to an AUTHORIZED leg).
 */
export type GatewayWebhookOutcome =
  | 'PAYMENT_SUCCEEDED'
  | 'PAYMENT_FAILED'
  | 'CAPTURE_SUCCEEDED'
  | 'CAPTURE_FAILED'
  | 'SETTLED'
  | 'AUTHORIZATION_EXPIRED'
  | 'UNKNOWN';

/** A provider payload normalized into this system's own webhook contract. */
export interface ParsedGatewayEvent {
  /** Gateway-assigned event id — the D010 dedup key (unique per gateway_code). */
  providerEventId: string;
  outcome: GatewayWebhookOutcome;
  /** Matches `org_order_payments_dtl.gateway_transaction_id`, when present. */
  gatewayTransactionId: string | null;
  /** Matches `org_order_payments_dtl.gateway_reference`, when present. */
  gatewayReference: string | null;
  amount: number | null;
  currencyCode: string | null;
  /** Human-readable failure reason from the provider, if any. */
  failureReason: string | null;
  occurredAt: string | null;
}

/**
 * B08 — gateway adapter contract. One implementation per
 * `sys_payment_gateway_cd.gateway_type`. Every adapter must be able to parse
 * its provider's raw payload into the normalized {@link ParsedGatewayEvent}
 * shape and verify that provider's signature scheme over the exact raw
 * bytes (never the re-serialized/parsed body — signatures are computed over
 * the bytes as sent).
 */
export interface GatewayAdapter {
  /** Returns null (never throws) when the payload does not parse as a recognizable event. */
  parseEvent(rawBody: string): ParsedGatewayEvent | null;
  verifySignature(rawBody: string, headers: Headers, secret: string): boolean;
}

/**
 * Generic normalized-envelope adapter. No real payment gateway (Stripe,
 * HyperPay, PayTabs) is integrated anywhere in this codebase today — only
 * catalog rows exist (`sys_payment_gateway_cd`). Building vendor-specific
 * payload parsers now would be speculative code with no way to test against
 * a real account. This adapter instead defines and implements THIS
 * system's own normalized webhook contract (used by the `MANUAL` gateway
 * type and as the extension point for a future real vendor integration —
 * that integration translates the vendor's payload into this same shape
 * rather than requiring a new route or transition-mapping logic).
 *
 * Expected envelope:
 * ```json
 * {
 *   "eventId": "evt_...",
 *   "eventType": "PAYMENT_SUCCEEDED" | "PAYMENT_FAILED" | "CAPTURE_SUCCEEDED"
 *              | "CAPTURE_FAILED" | "SETTLED" | "AUTHORIZATION_EXPIRED",
 *   "gatewayTransactionId": "...",
 *   "gatewayReference": "...",
 *   "amount": 12.500,
 *   "currencyCode": "OMR",
 *   "failureReason": "insufficient_funds",
 *   "occurredAt": "2026-07-24T10:00:00Z"
 * }
 * ```
 * Signature: header `x-gateway-signature: sha256=<hex>` — HMAC-SHA256 of the
 * exact raw request body, using the tenant+gateway's configured
 * `webhook_secret` (mirrors the existing WhatsApp webhook's verification
 * pattern at `app/api/v1/receipts/webhooks/whatsapp/route.ts`).
 */
export const genericHmacGatewayAdapter: GatewayAdapter = {
  parseEvent(rawBody: string): ParsedGatewayEvent | null {
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      return null;
    }

    const eventId = typeof body.eventId === 'string' ? body.eventId.trim() : '';
    if (!eventId) return null;

    const outcome = normalizeOutcome(body.eventType);

    return {
      providerEventId: eventId,
      outcome,
      gatewayTransactionId: typeof body.gatewayTransactionId === 'string' ? body.gatewayTransactionId : null,
      gatewayReference: typeof body.gatewayReference === 'string' ? body.gatewayReference : null,
      amount: typeof body.amount === 'number' ? body.amount : null,
      currencyCode: typeof body.currencyCode === 'string' ? body.currencyCode : null,
      failureReason: typeof body.failureReason === 'string' ? body.failureReason : null,
      occurredAt: typeof body.occurredAt === 'string' ? body.occurredAt : null,
    };
  },

  verifySignature(rawBody: string, headers: Headers, secret: string): boolean {
    const signature = headers.get('x-gateway-signature') ?? '';
    if (!secret || !signature.startsWith('sha256=')) return false;
    const expectedHex = signature.slice(7);
    let expected: Buffer;
    try {
      expected = Buffer.from(expectedHex, 'hex');
    } catch {
      return false;
    }
    if (expected.length !== 32) return false;
    const computed = createHmac('sha256', secret).update(rawBody).digest();
    if (computed.length !== expected.length) return false;
    return timingSafeEqual(computed, expected);
  },
};

function normalizeOutcome(raw: unknown): GatewayWebhookOutcome {
  const value = typeof raw === 'string' ? raw.trim().toUpperCase() : '';
  const known: readonly GatewayWebhookOutcome[] = [
    'PAYMENT_SUCCEEDED',
    'PAYMENT_FAILED',
    'CAPTURE_SUCCEEDED',
    'CAPTURE_FAILED',
    'SETTLED',
    'AUTHORIZATION_EXPIRED',
  ];
  return (known as readonly string[]).includes(value) ? (value as GatewayWebhookOutcome) : 'UNKNOWN';
}

/**
 * Adapter registry keyed by `sys_payment_gateway_cd.gateway_type`. Every
 * seeded type (STRIPE, HYPERPAY, PAYTABS, MANUAL) resolves to the generic
 * adapter today — none of the three named vendors has a real integration in
 * this codebase. Adding a real vendor adapter later is a registry entry
 * change here, not a route/service rewrite.
 */
export function getGatewayAdapter(_gatewayType: string): GatewayAdapter {
  return genericHmacGatewayAdapter;
}
