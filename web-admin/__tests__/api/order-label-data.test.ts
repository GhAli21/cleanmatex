/**
 * @jest-environment node
 *
 * HFC P4: GET /api/v1/orders/[id]/label-data validates the id and the pieces list, scopes by the caller's
 * tenant, returns 404 ORDER_NOT_FOUND when the service finds nothing, and never caches.
 */
import { NextRequest, NextResponse } from 'next/server';

const getLabelData = jest.fn();
let denied = false;

jest.mock('@/lib/middleware/require-permission', () => ({
  requirePermission: (perm: string) => async () =>
    denied ? NextResponse.json({ perm }, { status: 403 }) : { tenantId: 't1', userId: 'u1' },
}));
jest.mock('@/lib/utils/logger', () => ({ log: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ db: true }) }));
jest.mock('@/lib/services/labels/label-data.service', () => ({
  ...jest.requireActual('@/lib/services/labels/label-types'),
  LabelDataService: { getLabelData: (...a: unknown[]) => getLabelData(...a) },
}));

import { GET } from '@/app/api/v1/orders/[id]/label-data/route';

const O = '0a000000-0000-4000-8000-000000000001';
const P1 = '0c000000-0000-4000-8000-000000000001';
const call = (id: string, qs = '') =>
  GET(new NextRequest(`http://x/api/v1/orders/${id}/label-data${qs}`), { params: Promise.resolve({ id }) });

beforeEach(() => {
  denied = false;
  getLabelData.mockReset();
});

describe('GET /api/v1/orders/[id]/label-data', () => {
  it('returns the label data for the caller tenant (default pieces=none)', async () => {
    getLabelData.mockResolvedValue({ order: { orderNo: 'ORD-1' }, pieces: [], settings: {} });
    const res = await call(O);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await res.json()).toEqual({ success: true, data: { order: { orderNo: 'ORD-1' }, pieces: [], settings: {} } });
    expect(getLabelData).toHaveBeenCalledWith({ db: true }, { tenantId: 't1', orderId: O, userId: 'u1', pieces: 'none' });
  });

  it('passes all and a piece id list', async () => {
    getLabelData.mockResolvedValue({ order: {}, pieces: [], settings: {} });
    await call(O, '?pieces=all');
    await call(O, `?pieces=${P1}`);
    expect(getLabelData.mock.calls.map((c) => c[1].pieces)).toEqual(['all', [P1]]);
  });

  it('rejects a bad order id or pieces list with 400', async () => {
    for (const [id, qs] of [['nope', ''], [O, '?pieces=1,2'], [O, '?pieces=,']]) {
      const res = await call(id, qs);
      expect(res.status).toBe(400);
      expect((await res.json()).code).toBe('VALIDATION_ERROR');
    }
    expect(getLabelData).not.toHaveBeenCalled();
  });

  it('404 when the order is not in the tenant', async () => {
    getLabelData.mockResolvedValue(null);
    const res = await call(O);
    expect(res.status).toBe(404);
    expect((await res.json()).code).toBe('ORDER_NOT_FOUND');
  });

  it('returns the permission response and 500 on errors', async () => {
    denied = true;
    expect((await call(O)).status).toBe(403);
    denied = false;
    getLabelData.mockRejectedValue(new Error('boom'));
    const res = await call(O);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ success: false, error: 'Internal server error' });
  });
});
