/** @jest-environment node */
/**
 * BF-21 — the Ready page and its prints read line totals from
 * GET /api/v1/orders/[id]/state. The route must select the line prices, and
 * the shared Ready mapper must carry them through (it showed 0 before).
 */
import type { NextRequest } from 'next/server';
import { mapReadyOrderFromStateResponse } from '@/src/features/orders/model/ready-order-types';

const TENANT = '11111111-1111-1111-1111-111111111111';
const ORDER = '33333333-3333-3333-3333-333333333333';
const selects: Record<string, string> = {};

const ORDER_ROW = {
  id: ORDER,
  tenant_org_id: TENANT,
  order_no: 'ORD-1',
  current_status: 'ready',
  payment_status: 'PAID',
  total_amount: 3,
  total_paid_amount: 3,
  outstanding_amount: 0,
};
const ITEM_ROWS = [
  { id: 'i1', product_name: 'Shirt', quantity: 2, price_per_unit: 1.5, total_price: 3 },
];

function chain(table: string) {
  const result = table === 'org_orders_mst'
    ? { data: ORDER_ROW, error: null }
    : table === 'org_order_items_dtl'
      ? { data: ITEM_ROWS, error: null }
      : { data: [], error: null };
  const builder: Record<string, unknown> = {};
  builder.select = (cols: string) => {
    selects[table] = cols;
    return builder;
  };
  builder.eq = () => builder;
  builder.order = () => builder;
  builder.single = () => Promise.resolve(result);
  builder.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return builder;
}

jest.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'auth-1' } } }) },
    rpc: async () => ({ data: [{ tenant_id: TENANT }], error: null }),
    from: (table: string) => chain(table),
  }),
}));
jest.mock('@/lib/services/workflow-service', () => ({
  WorkflowService: { getAllowedTransitions: async () => [] },
}));
jest.mock('@/lib/services/pickup/pickup-release-state.service', () => ({
  getPickupReleaseSummary: async () => null,
}));

import { GET } from '@/app/api/v1/orders/[id]/state/route';

describe('GET /api/v1/orders/[id]/state — line prices (BF-21)', () => {
  it('selects price_per_unit and total_price for each item', async () => {
    const response = await GET({} as NextRequest, { params: Promise.resolve({ id: ORDER }) });

    expect(response.status).toBe(200);
    const cols = selects.org_order_items_dtl.split(',').map((c) => c.trim());
    expect(cols).toEqual(expect.arrayContaining(['price_per_unit', 'total_price']));
  });

  it('the Ready mapper shows the stored line total, not 0', async () => {
    const response = await GET({} as NextRequest, { params: Promise.resolve({ id: ORDER }) });
    const body = await response.json();

    const ready = mapReadyOrderFromStateResponse(body);

    expect(ready?.items.map((i) => i.totalPrice)).toEqual([3]);
  });
});
