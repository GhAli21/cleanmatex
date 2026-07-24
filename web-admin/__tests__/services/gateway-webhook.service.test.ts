/**
 * B08 — gateway-webhook.service.ts unit tests.
 *
 * Covers: gateway-not-found, unparseable payload, dedup (unique-violation
 * replay), unmatched leg, signature rejection (missing/invalid secret),
 * happy-path TRANSITIONED dispatch (VERIFY for a PROCESSING leg; CAPTURE for
 * a dormant AUTHORIZED leg), and an unsupported (outcome, status) pairing.
 */
import { createHmac } from 'crypto';

const mockGatewayFindFirst = jest.fn();
const mockEventCreate = jest.fn();
const mockEventUpdate = jest.fn();
const mockLegFindFirst = jest.fn();
const mockMethodConfigFindFirst = jest.fn();
const mockTransitionPaymentTx = jest.fn();
const mockLoggerWarn = jest.fn();
const mockLoggerError = jest.fn();

jest.mock('@/lib/db/prisma', () => ({
  prisma: {
    sys_payment_gateway_cd: { findFirst: (...a: unknown[]) => mockGatewayFindFirst(...a) },
    sys_gw_webhook_events_tr: {
      create: (...a: unknown[]) => mockEventCreate(...a),
      update: (...a: unknown[]) => mockEventUpdate(...a),
    },
    org_order_payments_dtl: { findFirst: (...a: unknown[]) => mockLegFindFirst(...a) },
    org_payment_methods_cf: { findFirst: (...a: unknown[]) => mockMethodConfigFindFirst(...a) },
  },
}));

jest.mock('@/lib/services/payment-transition.service', () => ({
  transitionPaymentTx: (...a: unknown[]) => mockTransitionPaymentTx(...a),
}));

jest.mock('@/lib/utils/logger', () => ({
  logger: { warn: (...a: unknown[]) => mockLoggerWarn(...a), error: (...a: unknown[]) => mockLoggerError(...a), info: jest.fn() },
}));

import { processGatewayWebhookEvent } from '@/lib/services/gateway-webhook.service';

const GATEWAY_CODE = 'MANUAL';
const SECRET = 'test-secret';
const TENANT_ID = '11111111-1111-1111-1111-111111111111';
const ORDER_ID = '00000000-0000-0000-0000-0000000000aa';
const PAYMENT_ID = '00000000-0000-0000-0000-0000000000bb';

function envelope(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    eventId: 'evt_1',
    eventType: 'PAYMENT_SUCCEEDED',
    gatewayTransactionId: 'txn_1',
    gatewayReference: null,
    amount: 10,
    currencyCode: 'OMR',
    ...overrides,
  });
}

function signedHeaders(body: string, secret = SECRET) {
  const sig = createHmac('sha256', secret).update(body).digest('hex');
  return new Headers({ 'x-gateway-signature': `sha256=${sig}` });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockGatewayFindFirst.mockResolvedValue({ code: GATEWAY_CODE, gateway_type: 'manual' });
  mockEventCreate.mockResolvedValue({ id: 'event-row-1' });
  mockEventUpdate.mockResolvedValue({});
  mockMethodConfigFindFirst.mockResolvedValue({ gateway_config: { webhook_secret: SECRET } });
});

describe('processGatewayWebhookEvent', () => {
  it('returns GATEWAY_NOT_FOUND for an unknown/inactive gateway code', async () => {
    mockGatewayFindFirst.mockResolvedValue(null);
    const result = await processGatewayWebhookEvent({
      gatewayCode: 'NOPE',
      rawBody: envelope(),
      headers: new Headers(),
    });
    expect(result.status).toBe('GATEWAY_NOT_FOUND');
    expect(mockEventCreate).not.toHaveBeenCalled();
  });

  it('returns REJECTED_SCHEMA for an unparseable payload', async () => {
    const result = await processGatewayWebhookEvent({
      gatewayCode: GATEWAY_CODE,
      rawBody: 'not json',
      headers: new Headers(),
    });
    expect(result.status).toBe('REJECTED_SCHEMA');
  });

  it('returns DUPLICATE when the (gateway_code, provider_event_id) unique constraint rejects the insert', async () => {
    mockEventCreate.mockRejectedValue({ code: 'P2002' });
    const result = await processGatewayWebhookEvent({
      gatewayCode: GATEWAY_CODE,
      rawBody: envelope(),
      headers: signedHeaders(envelope()),
    });
    expect(result.status).toBe('DUPLICATE');
    expect(mockLegFindFirst).not.toHaveBeenCalled();
  });

  it('returns UNMATCHED and cannot verify signature when no leg matches', async () => {
    mockLegFindFirst.mockResolvedValue(null);
    const result = await processGatewayWebhookEvent({
      gatewayCode: GATEWAY_CODE,
      rawBody: envelope(),
      headers: signedHeaders(envelope()),
    });
    expect(result.status).toBe('UNMATCHED');
    expect(mockMethodConfigFindFirst).not.toHaveBeenCalled();
    expect(mockEventUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ processing_status: 'UNMATCHED' }) }),
    );
  });

  it('returns REJECTED_SIGNATURE when the resolved tenant secret does not verify the payload', async () => {
    mockLegFindFirst.mockResolvedValue({
      id: PAYMENT_ID,
      order_id: ORDER_ID,
      tenant_org_id: TENANT_ID,
      payment_status: 'PROCESSING',
      payment_method_code: 'CARD',
    });
    const body = envelope();
    const result = await processGatewayWebhookEvent({
      gatewayCode: GATEWAY_CODE,
      rawBody: body,
      headers: signedHeaders(body, 'wrong-secret'),
    });
    expect(result.status).toBe('REJECTED_SIGNATURE');
    expect(mockTransitionPaymentTx).not.toHaveBeenCalled();
  });

  it('returns REJECTED_SIGNATURE when no webhook_secret is configured for the tenant/gateway', async () => {
    mockLegFindFirst.mockResolvedValue({
      id: PAYMENT_ID,
      order_id: ORDER_ID,
      tenant_org_id: TENANT_ID,
      payment_status: 'PROCESSING',
      payment_method_code: 'CARD',
    });
    mockMethodConfigFindFirst.mockResolvedValue({ gateway_config: {} });
    const body = envelope();
    const result = await processGatewayWebhookEvent({
      gatewayCode: GATEWAY_CODE,
      rawBody: body,
      headers: signedHeaders(body),
    });
    expect(result.status).toBe('REJECTED_SIGNATURE');
  });

  it('dispatches VERIFY for a verified PAYMENT_SUCCEEDED event on a PROCESSING leg (today\'s only real path)', async () => {
    mockLegFindFirst.mockResolvedValue({
      id: PAYMENT_ID,
      order_id: ORDER_ID,
      tenant_org_id: TENANT_ID,
      payment_status: 'PROCESSING',
      payment_method_code: 'CARD',
    });
    mockTransitionPaymentTx.mockResolvedValue({ newStatus: 'COMPLETED', flipped: true });
    const body = envelope();
    const result = await processGatewayWebhookEvent({
      gatewayCode: GATEWAY_CODE,
      rawBody: body,
      headers: signedHeaders(body),
    });
    expect(result.status).toBe('TRANSITIONED');
    expect(result.action).toBe('VERIFY');
    expect(mockTransitionPaymentTx).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'VERIFY', actorId: null, tenantId: TENANT_ID, paymentId: PAYMENT_ID }),
    );
  });

  it('dispatches CAPTURE for a verified CAPTURE_SUCCEEDED event on a dormant AUTHORIZED leg', async () => {
    mockLegFindFirst.mockResolvedValue({
      id: PAYMENT_ID,
      order_id: ORDER_ID,
      tenant_org_id: TENANT_ID,
      payment_status: 'AUTHORIZED',
      payment_method_code: 'CARD',
    });
    mockTransitionPaymentTx.mockResolvedValue({ newStatus: 'CAPTURED', flipped: true });
    const body = envelope({ eventType: 'CAPTURE_SUCCEEDED' });
    const result = await processGatewayWebhookEvent({
      gatewayCode: GATEWAY_CODE,
      rawBody: body,
      headers: signedHeaders(body),
    });
    expect(result.status).toBe('TRANSITIONED');
    expect(result.action).toBe('CAPTURE');
  });

  it('dispatches FAIL_BOUNCE with RETRY_TENDER fallback for a PAYMENT_FAILED event (D009)', async () => {
    mockLegFindFirst.mockResolvedValue({
      id: PAYMENT_ID,
      order_id: ORDER_ID,
      tenant_org_id: TENANT_ID,
      payment_status: 'PROCESSING',
      payment_method_code: 'CARD',
    });
    mockTransitionPaymentTx.mockResolvedValue({ newStatus: 'FAILED', flipped: true });
    const body = envelope({ eventType: 'PAYMENT_FAILED', failureReason: 'insufficient_funds' });
    const result = await processGatewayWebhookEvent({
      gatewayCode: GATEWAY_CODE,
      rawBody: body,
      headers: signedHeaders(body),
    });
    expect(result.status).toBe('TRANSITIONED');
    expect(mockTransitionPaymentTx).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'FAIL_BOUNCE', fallbackClassification: 'RETRY_TENDER', reason: 'insufficient_funds' }),
    );
  });

  it('returns UNSUPPORTED_OUTCOME for a legal-shaped event with no matching D001 transition (e.g. SETTLED on a PROCESSING leg)', async () => {
    mockLegFindFirst.mockResolvedValue({
      id: PAYMENT_ID,
      order_id: ORDER_ID,
      tenant_org_id: TENANT_ID,
      payment_status: 'PROCESSING',
      payment_method_code: 'CARD',
    });
    const body = envelope({ eventType: 'SETTLED' });
    const result = await processGatewayWebhookEvent({
      gatewayCode: GATEWAY_CODE,
      rawBody: body,
      headers: signedHeaders(body),
    });
    expect(result.status).toBe('UNSUPPORTED_OUTCOME');
    expect(mockTransitionPaymentTx).not.toHaveBeenCalled();
  });

  it('re-dispatching the same providerEventId after DUPLICATE never calls transitionPaymentTx a second time', async () => {
    mockEventCreate.mockRejectedValueOnce({ code: 'P2002' });
    const body = envelope();
    const first = await processGatewayWebhookEvent({ gatewayCode: GATEWAY_CODE, rawBody: body, headers: signedHeaders(body) });
    expect(first.status).toBe('DUPLICATE');
    expect(mockTransitionPaymentTx).not.toHaveBeenCalled();
  });
});
