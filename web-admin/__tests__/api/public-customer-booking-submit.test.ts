/** @jest-environment node */

/**
 * Tests: POST /api/v1/public/customer/booking — the customer mobile booking
 * prices through the commercial calculator (Line-Level PF-11 / C9).
 *
 * The route sends product codes and quantities to the checkout quote and
 * creates the order through the shared unpaid quoted-create path; it never
 * computes a price itself. Pieces are placed by their `pieceSeq`.
 */

import { NextRequest } from 'next/server';
import { CommercialContextError } from '@/lib/services/commercial/commercial-context.loader';

const mockResolveSession = jest.fn();
const mockCanAccess = jest.fn();
const mockQuote = jest.fn();
const mockCreate = jest.fn();
const mockServicePrefs = jest.fn();
const mockPackingPrefs = jest.fn();
/** Supabase results per table, consumed in call order. */
const tableResults: Record<string, Array<{ data: unknown; error: unknown }>> = {};

jest.mock('@/lib/services/customer-mobile-session.service', () => ({
  resolveCustomerMobileSession: (...a: unknown[]) => mockResolveSession(...a),
}));
jest.mock('@/lib/services/feature-flags.service', () => ({
  canAccess: (...a: unknown[]) => mockCanAccess(...a),
}));
jest.mock('@/lib/services/commercial/commercial-checkout.service', () => ({
  quoteCheckout: (...a: unknown[]) => mockQuote(...a),
}));
jest.mock('@/lib/services/order-create-from-checkout.service', () => ({
  createUnpaidOrderFromCheckout: (...a: unknown[]) => mockCreate(...a),
}));
jest.mock('@/lib/services/preference-catalog.service', () => ({
  PreferenceCatalogService: {
    getServicePreferences: (...a: unknown[]) => mockServicePrefs(...a),
    getPackingPreferences: (...a: unknown[]) => mockPackingPrefs(...a),
  },
}));
// The bootstrap (GET) reads settings; the submit does not.
jest.mock('@/lib/services/tenant-settings.service', () => ({ createTenantSettingsService: jest.fn() }));
jest.mock('@/lib/db/tenant-context', () => ({
  withTenantContext: (_tenant: string, fn: () => unknown) => fn(),
}));
jest.mock('@/lib/utils/logger', () => ({
  logger: { warn: jest.fn(), info: jest.fn(), error: jest.fn() },
}));
// A chainable read builder: every filter returns itself; the result is the next one queued for the table.
jest.mock('@/lib/supabase/server', () => ({
  createAdminSupabaseClient: () => ({
    from: (table: string) => {
      const next = () => tableResults[table]?.shift() ?? { data: null, error: null };
      const builder: Record<string, unknown> = {};
      for (const method of ['select', 'eq', 'in', 'gte', 'order', 'limit']) builder[method] = () => builder;
      builder.single = async () => next();
      builder.maybeSingle = async () => next();
      builder.then = (resolve: (value: unknown) => unknown) => resolve(next());
      return builder;
    },
  }),
}));

import { POST } from '@/app/api/v1/public/customer/booking/route';

const TENANT = '11111111-1111-1111-1111-111111111111';
const CUSTOMER = 'c0000000-0000-4000-8000-000000000001';
const BRANCH = 'b0000000-0000-4000-8000-000000000001';
const SHIRT = 'a0000000-0000-4000-8000-000000000001';
const ORDER = 'd0000000-0000-4000-8000-000000000001';
const checkout = { totals: { saleTotal: 4.62, currencyCode: 'OMR' } };

function request(body: Record<string, unknown>) {
  return new NextRequest('http://localhost/api/v1/public/customer/booking', {
    method: 'POST',
    headers: { authorization: 'Bearer token-1', 'content-type': 'application/json' },
    body: JSON.stringify({ tenantId: TENANT, fulfillmentType: 'bring_in', items: [{ itemId: SHIRT, qty: 2 }], ...body }),
  });
}

function queueCatalog(product: Record<string, unknown> = {}) {
  tableResults.org_product_data_mst = [{
    data: [{
      id: SHIRT, tenant_org_id: TENANT, service_category_code: 'WASH_AND_IRON', product_name: 'Shirt', product_name2: null,
      default_sell_price: 99, default_packing_pref: 'HANG', ...product,
    }],
    error: null,
  }];
  tableResults.org_branches_mst = [{ data: { id: BRANCH }, error: null }];
  // First the duplicate check (none), then the created order read.
  tableResults.org_orders_mst = [
    { data: null, error: null },
    { data: { ready_by: '2026-10-29T08:00:00.000Z', total_amount: '4.6200' }, error: null },
  ];
}

describe('customer booking submit', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    for (const key of Object.keys(tableResults)) delete tableResults[key];
    mockResolveSession.mockResolvedValue({ customerId: CUSTOMER, phoneNumber: '+96890000000', displayName: 'Sara' });
    mockCanAccess.mockResolvedValue(true);
    mockServicePrefs.mockResolvedValue([{ code: 'STARCH_LIGHT', default_extra_price: 0.2 }]);
    mockPackingPrefs.mockResolvedValue([{ code: 'FOLD', default_extra_price: 0.1 }]);
    mockQuote.mockResolvedValue(checkout);
    mockCreate.mockResolvedValue({ success: true, order: { id: ORDER, orderNo: 'ORD-1', currentStatus: 'intake', readyByAt: '' } });
    queueCatalog();
  });

  it('prices through the quote and creates the order on the shared unpaid path', async () => {
    const response = await POST(request({
      serviceSpeed: 'EXPRESS',
      servicePreferenceIds: ['STARCH_LIGHT'],
      pickupPreferenceIds: ['FOLD'],
      items: [{ itemId: SHIRT, qty: 2, pieces: [{ pieceSeq: 2, colorCode: 'BLUE' }, { pieceSeq: 1, servicePreferenceIds: ['STARCH_LIGHT'] }] }],
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: { orderId: ORDER, orderNo: 'ORD-1', promisedWindow: '2026-10-29T08:00:00.000Z', totalAmount: '4.6200', currencyCode: 'OMR' },
    });
    // Codes and quantities only: the catalog price (99) never reaches the quote.
    expect(mockQuote).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: TENANT, branchId: BRANCH, customerId: CUSTOMER, serviceSpeed: 'EXPRESS', strictFinancialReads: true,
      items: [{
        productId: SHIRT, quantity: 2, servicePrefs: [{ preference_code: 'STARCH_LIGHT' }], packingPrefCode: 'FOLD',
        pieces: [
          { servicePrefs: [{ preference_code: 'STARCH_LIGHT' }], packingPrefCode: null },
          { servicePrefs: [], packingPrefCode: null },
        ],
      }],
    }));
    const created = mockCreate.mock.calls[0][0];
    expect(created).toMatchObject({ tenantId: TENANT, checkout, committedBy: null, issuedBy: CUSTOMER });
    expect(created.order).toMatchObject({
      customerId: CUSTOMER, branchId: BRANCH, orderSourceCode: 'customer_mobile_app', paymentTypeCode: 'PAY_ON_COLLECTION',
      customerDetails: expect.objectContaining({ serviceSpeed: 'EXPRESS' }),
    });
    // Piece k is pieceSeq k + 1, whatever order the app sent them in.
    expect(created.order.items[0].pieces).toEqual([
      expect.objectContaining({ pieceSeq: 1, servicePrefs: [{ preference_code: 'STARCH_LIGHT', source: 'customer_mobile_app' }] }),
      expect.objectContaining({ pieceSeq: 2, color: 'BLUE' }),
    ]);
    expect(created.order.items[0]).toMatchObject({ pricePerUnit: 0, totalPrice: 0 });
  });

  it('rejects piece details that do not fit the quantity before pricing anything', async () => {
    const response = await POST(request({ items: [{ itemId: SHIRT, qty: 1, pieces: [{ pieceSeq: 2 }] }] }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ errorCode: 'booking_piece_invalid' });
    expect(mockQuote).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('answers a quote error with its code and creates nothing', async () => {
    mockQuote.mockRejectedValue(new CommercialContextError('SERVICE_SPEED_INVALID', 'Unknown speed', { serviceSpeed: 'TURBO' }));

    const response = await POST(request({ serviceSpeed: 'TURBO' }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ success: false, errorCode: 'SERVICE_SPEED_INVALID' });
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('refuses retail goods with the existing unavailable-item code', async () => {
    mockCreate.mockResolvedValue({ success: false, errorCode: 'RETAIL_PAY_ON_COLLECTION_NOT_ALLOWED', error: 'Retail' });

    const response = await POST(request({}));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ errorCode: 'booking_item_unavailable' });
  });

  it('returns the order already created by the same request within two minutes', async () => {
    tableResults.org_orders_mst = [{
      data: { id: ORDER, order_no: 'ORD-1', ready_by_at_new: null, ready_by: '2026-10-29T08:00:00.000Z', total_amount: '4.6200', currency_code: 'OMR' },
      error: null,
    }];

    const response = await POST(request({}));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ data: { orderId: ORDER, totalAmount: '4.6200', currencyCode: 'OMR' } });
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
