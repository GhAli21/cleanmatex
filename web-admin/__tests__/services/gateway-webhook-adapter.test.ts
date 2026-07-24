/**
 * B08 — genericHmacGatewayAdapter unit tests (parse + signature verification).
 */
import { createHmac } from 'crypto';
import { genericHmacGatewayAdapter } from '@/lib/services/gateway/gateway-webhook-adapter';

function sign(body: string, secret: string): string {
  return `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
}

describe('genericHmacGatewayAdapter.parseEvent', () => {
  it('parses a well-formed envelope', () => {
    const body = JSON.stringify({
      eventId: 'evt_1',
      eventType: 'PAYMENT_SUCCEEDED',
      gatewayTransactionId: 'txn_1',
      gatewayReference: 'ref_1',
      amount: 12.5,
      currencyCode: 'OMR',
      occurredAt: '2026-07-24T10:00:00Z',
    });

    const parsed = genericHmacGatewayAdapter.parseEvent(body);

    expect(parsed).not.toBeNull();
    expect(parsed?.providerEventId).toBe('evt_1');
    expect(parsed?.outcome).toBe('PAYMENT_SUCCEEDED');
    expect(parsed?.gatewayTransactionId).toBe('txn_1');
    expect(parsed?.amount).toBe(12.5);
  });

  it('returns null for invalid JSON', () => {
    expect(genericHmacGatewayAdapter.parseEvent('not json')).toBeNull();
  });

  it('returns null when eventId is missing', () => {
    expect(genericHmacGatewayAdapter.parseEvent(JSON.stringify({ eventType: 'PAYMENT_SUCCEEDED' }))).toBeNull();
  });

  it('normalizes an unrecognized eventType to UNKNOWN rather than throwing', () => {
    const parsed = genericHmacGatewayAdapter.parseEvent(
      JSON.stringify({ eventId: 'evt_2', eventType: 'SOMETHING_NEW' }),
    );
    expect(parsed?.outcome).toBe('UNKNOWN');
  });
});

describe('genericHmacGatewayAdapter.verifySignature', () => {
  const body = JSON.stringify({ eventId: 'evt_1', eventType: 'PAYMENT_SUCCEEDED' });
  const secret = 'test-webhook-secret';

  it('accepts a correctly signed payload', () => {
    const headers = new Headers({ 'x-gateway-signature': sign(body, secret) });
    expect(genericHmacGatewayAdapter.verifySignature(body, headers, secret)).toBe(true);
  });

  it('rejects a payload signed with the wrong secret', () => {
    const headers = new Headers({ 'x-gateway-signature': sign(body, 'wrong-secret') });
    expect(genericHmacGatewayAdapter.verifySignature(body, headers, secret)).toBe(false);
  });

  it('rejects a tampered body (signature no longer matches)', () => {
    const headers = new Headers({ 'x-gateway-signature': sign(body, secret) });
    const tamperedBody = JSON.stringify({ eventId: 'evt_1', eventType: 'PAYMENT_FAILED' });
    expect(genericHmacGatewayAdapter.verifySignature(tamperedBody, headers, secret)).toBe(false);
  });

  it('rejects a missing signature header', () => {
    expect(genericHmacGatewayAdapter.verifySignature(body, new Headers(), secret)).toBe(false);
  });

  it('rejects a malformed signature header (no sha256= prefix)', () => {
    const headers = new Headers({ 'x-gateway-signature': 'deadbeef' });
    expect(genericHmacGatewayAdapter.verifySignature(body, headers, secret)).toBe(false);
  });

  it('rejects when no secret is configured', () => {
    const headers = new Headers({ 'x-gateway-signature': sign(body, secret) });
    expect(genericHmacGatewayAdapter.verifySignature(body, headers, '')).toBe(false);
  });
});
