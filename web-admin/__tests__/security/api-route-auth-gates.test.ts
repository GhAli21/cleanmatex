/** @jest-environment node */

/**
 * BF-23 wiring: each hardened route asks for the expected gate before any data access,
 * and returns the guard's denial unchanged (401 / SESSION_ENDED / 403 come from the guard).
 */

import { NextRequest, NextResponse } from 'next/server';

const calls: string[] = [];
const DENIED = () => NextResponse.json({ error: 'denied-by-guard' }, { status: 403 });

jest.mock('@/lib/middleware/require-permission', () => ({
  requirePermission: (code: string) => async () => {
    calls.push(`perm:${code}`);
    return DENIED();
  },
  requireAnyPermission: (codes: string[]) => async () => {
    calls.push(`any:${codes.join('|')}`);
    return DENIED();
  },
}));
jest.mock('@/lib/middleware/jwt-tenant-validator', () => ({
  validateJWTWithTenant: async () => {
    calls.push('session');
    return DENIED();
  },
}));
const dataAccess = jest.fn(() => {
  throw new Error('data access before the guard');
});
jest.mock('@/lib/supabase/server', () => ({
  createClient: dataAccess,
  createAdminSupabaseClient: dataAccess,
}));
// Some services build a browser client when imported; never used on these paths.
jest.mock('@/lib/supabase/client', () => ({ supabase: {}, createClient: () => ({}) }));

type Handler = (req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => Promise<Response>;

const PARAMS = { id: 'id-1', itemId: 'item-1', issueId: 'issue-1', category: 'WASH' };

const CASES: Array<[route: string, method: string, expected: string]> = [
  ['v1/orders/[id]/state', 'GET', 'perm:orders:read'],
  ['v1/orders/[id]/history', 'GET', 'perm:orders:history'],
  ['v1/orders/[id]/transitions', 'GET', 'perm:orders:read'],
  ['v1/orders/[id]/discounts', 'GET', 'perm:orders:read'],
  ['v1/orders/[id]/issues', 'GET', 'perm:orders:read'],
  ['v1/orders/[id]/issue-summary', 'GET', 'perm:orders:read'],
  ['v1/orders/issues', 'GET', 'perm:orders:read'],
  ['v1/orders/[id]/issue', 'POST', 'perm:orders:transition'],
  ['v1/orders/[id]/issue/[issueId]', 'PATCH', 'perm:orders:update'],
  ['v1/orders/[id]/items/[itemId]/step', 'POST', 'perm:orders:transition'],
  ['v1/orders/[id]/items/[itemId]/complete', 'POST', 'perm:orders:transition'],
  ['v1/orders/[id]/rack-bags', 'GET', 'perm:orders:read'],
  ['v1/orders/[id]/split', 'POST', 'perm:orders:split'],
  ['v1/products', 'GET', 'perm:products:read'],
  ['v1/products', 'POST', 'perm:products:create'],
  ['v1/products/[id]', 'GET', 'perm:products:read'],
  ['v1/products/[id]', 'PATCH', 'perm:products:update'],
  ['v1/products/[id]', 'DELETE', 'perm:products:delete'],
  ['v1/products/export', 'GET', 'perm:products:export'],
  ['v1/products/import', 'POST', 'perm:products:create'],
  ['v1/categories', 'GET', 'session'],
  ['v1/categories', 'POST', 'perm:products:categories'],
  ['v1/price-lists', 'GET', 'perm:pricing:read'],
  ['v1/price-lists', 'POST', 'perm:pricing:create'],
  ['v1/price-lists/[id]', 'GET', 'perm:pricing:read'],
  ['v1/price-lists/[id]', 'PATCH', 'perm:pricing:update'],
  ['v1/price-lists/[id]', 'DELETE', 'perm:pricing:delete'],
  ['v1/price-lists/[id]/items', 'POST', 'perm:pricing:update'],
  ['v1/price-lists/[id]/items/[itemId]', 'PUT', 'perm:pricing:update'],
  ['v1/price-lists/[id]/items/[itemId]', 'DELETE', 'perm:pricing:update'],
  ['v1/processing-steps/[category]', 'GET', 'session'],
  ['v1/plan-flags', 'GET', 'session'],
  ['v1/workflows/config', 'GET', 'session'],
  ['v1/workflows/config', 'PATCH', 'perm:settings:workflow'],
];

describe('BF-23 hardened routes ask for their gate before any data access', () => {
  beforeEach(() => {
    calls.length = 0;
    dataAccess.mockClear();
  });

  it.each(CASES)('%s %s → %s', async (route, method, expected) => {
    const mod = (await import(`@/app/api/${route}/route`)) as Record<string, Handler>;
    const handler = mod[method];
    expect(typeof handler).toBe('function');

    const req = new NextRequest(`http://localhost/api/${route}`, {
      method,
      ...(method === 'GET' || method === 'DELETE' ? {} : { body: '{}' }),
    });
    const res = await handler(req, { params: Promise.resolve(PARAMS) });

    expect(calls).toEqual([expected]);
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'denied-by-guard' });
    expect(dataAccess).not.toHaveBeenCalled();
  });
});
