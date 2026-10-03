/** @jest-environment node */

import { NextRequest } from 'next/server';
import { ORDER_CHANGE_LIMITS } from '@/lib/constants/order-change';
import { OrderChangeBodyError, readBoundedOrderChangeJson } from '@/lib/api/order-change-bounded-json';

function jsonRequest(body: string, declaredLength?: string): Request {
  return new NextRequest('http://localhost/api/v1/orders/order-id/changes', {
    method: 'POST',
    headers: declaredLength === undefined ? { 'content-type': 'application/json' } : { 'content-type': 'application/json', 'content-length': declaredLength },
    body,
  });
}

describe('readBoundedOrderChangeJson', () => {
  it('accepts an exactly bounded JSON payload', async () => {
    const prefix = '{"value":"';
    const suffix = '"}';
    const body = `${prefix}${'a'.repeat(ORDER_CHANGE_LIMITS.MAX_REQUEST_BODY_BYTES - prefix.length - suffix.length)}${suffix}`;
    await expect(readBoundedOrderChangeJson(jsonRequest(body, String(ORDER_CHANGE_LIMITS.MAX_REQUEST_BODY_BYTES)))).resolves.toEqual({ value: expect.any(String) });
  });

  it('rejects a declared oversize body before reading and a deceptive length while streaming', async () => {
    const oversize = JSON.stringify({ value: 'a'.repeat(ORDER_CHANGE_LIMITS.MAX_REQUEST_BODY_BYTES) });
    await expect(readBoundedOrderChangeJson(jsonRequest(oversize, String(ORDER_CHANGE_LIMITS.MAX_REQUEST_BODY_BYTES + 1)))).rejects.toMatchObject<OrderChangeBodyError>({ code: 'REQUEST_BODY_TOO_LARGE', status: 413 });
    await expect(readBoundedOrderChangeJson(jsonRequest(oversize, '1'))).rejects.toMatchObject<OrderChangeBodyError>({ code: 'REQUEST_BODY_TOO_LARGE', status: 413 });
  });

  it('returns a typed malformed-json failure', async () => {
    await expect(readBoundedOrderChangeJson(jsonRequest('{'))).rejects.toMatchObject<OrderChangeBodyError>({ code: 'MALFORMED_JSON', status: 400 });
  });
});
