/**
 * Tests: cash-change-rounding.service (A6-1b)
 *
 * Covers: policy ladder (tenant increment → HQ CASH_CHANGE rule → none), bearer→mode,
 * planner no-op cases (non-cash, no tender, no change, no increment), planned amounts,
 * and the posted rounding voucher: direction from the sign, same drawer session as the
 * payment, order/customer/drawer anchoring, idempotency keys, skip when never stamped.
 */
jest.mock('server-only', () => ({}));

const mockCurrencyFind = jest.fn();
jest.mock('@/lib/db/prisma', () => ({
  prisma: { sys_currency_cd: { findUnique: (...a: unknown[]) => mockCurrencyFind(...a) } },
}));

const mockSettings = jest.fn();
jest.mock('@/lib/services/cash-control-settings.service', () => ({
  getCashControlSettings: (...a: unknown[]) => mockSettings(...a),
}));

const mockHqRule = jest.fn();
jest.mock('@/lib/money/currency-rounding', () => ({
  resolveCurrencyRoundingRule: (...a: unknown[]) => mockHqRule(...a),
}));

const mockCreateVoucher = jest.fn();
const mockAddLine = jest.fn();
const mockPostWire = jest.fn();
jest.mock('@/lib/services/voucher-biz.service', () => ({
  createBizVoucher: (...a: unknown[]) => mockCreateVoucher(...a),
}));
jest.mock('@/lib/services/voucher-line.service', () => ({
  addVoucherLine: (...a: unknown[]) => mockAddLine(...a),
}));
jest.mock('@/lib/services/voucher-wiring.service', () => ({
  postAndWireBizVoucher: (...a: unknown[]) => mockPostWire(...a),
}));

const mockDispatchCash = jest.fn();
jest.mock('@/lib/services/erp-lite-auto-post.service', () => ({
  ErpLiteAutoPostService: { dispatchCashEventInTransaction: (...a: unknown[]) => mockDispatchCash(...a) },
}));
jest.mock('@/lib/services/erp-lite-auto-post.util', () => ({
  safeDispatchAutoPost: async (_label: string, fn: () => Promise<unknown>) => {
    try {
      await fn();
    } catch {
      /* non-blocking, as in production */
    }
  },
}));

import {
  planCashChangeRounding,
  postCashChangeRoundingTx,
  resolveCashChangeRoundingPolicy,
} from '@/lib/services/cash-change-rounding.service';

const TENANT = '11111111-1111-1111-1111-111111111111';
const USER = '22222222-2222-2222-2222-222222222222';
const scope = { tenantId: TENANT, branchId: null, userId: USER };

const settings = (over: Record<string, unknown> = {}) => ({
  cashChangeBearer: 'BUSINESS',
  cashChangeRoundToMinor: null,
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockCurrencyFind.mockResolvedValue({ minor_unit: 3 });
  mockSettings.mockResolvedValue(settings());
  mockHqRule.mockResolvedValue({ roundingMethod: 'HALF_UP', roundingUnit: 0.005 });
});

describe('resolveCashChangeRoundingPolicy', () => {
  it('uses the HQ CASH_CHANGE increment when the tenant has none', async () => {
    const policy = await resolveCashChangeRoundingPolicy(scope, 'OMR');
    expect(mockHqRule).toHaveBeenCalledWith('OMR', 'CASH_CHANGE');
    expect(policy).toMatchObject({ decimalPlaces: 3, incrementMinor: 5, mode: 'CEILING', bearer: 'BUSINESS' });
  });

  it('prefers the tenant increment over HQ and maps the bearer to a mode', async () => {
    mockSettings.mockResolvedValue(settings({ cashChangeRoundToMinor: 10, cashChangeBearer: 'CUSTOMER' }));
    const policy = await resolveCashChangeRoundingPolicy(scope, 'OMR');
    expect(mockHqRule).not.toHaveBeenCalled();
    expect(policy).toMatchObject({ incrementMinor: 10, mode: 'FLOOR' });
  });

  it('resolves to no rounding when neither tenant nor HQ configure an increment', async () => {
    mockHqRule.mockResolvedValue(null);
    expect((await resolveCashChangeRoundingPolicy(scope, 'OMR')).incrementMinor).toBeNull();
  });

  it('falls back to 2 decimals for an unknown currency row', async () => {
    mockCurrencyFind.mockResolvedValue(null);
    mockHqRule.mockResolvedValue(null);
    expect((await resolveCashChangeRoundingPolicy(scope, 'XXX')).decimalPlaces).toBe(2);
  });
});

describe('planCashChangeRounding', () => {
  const cashLeg = { paymentMethodCode: 'CASH', currencyCode: 'OMR', amount: 2.003, tenderedAmount: 5 };

  it('plans the rounded change and the drawer adjustment', async () => {
    const plan = await planCashChangeRounding(scope, cashLeg);
    expect(plan).toMatchObject({ currencyCode: 'OMR', exactChange: 2.997, roundedChange: 3 });
    expect(plan!.adjustment).toBeCloseTo(-0.003, 6);
  });

  it.each([
    ['a non-cash method', { ...cashLeg, paymentMethodCode: 'CARD' }],
    ['no cash tendered', { ...cashLeg, tenderedAmount: undefined }],
    ['an exact tender (no change)', { ...cashLeg, amount: 5 }],
  ])('returns null for %s without reading any policy', async (_n, leg) => {
    expect(await planCashChangeRounding(scope, leg)).toBeNull();
    expect(mockSettings).not.toHaveBeenCalled();
  });

  it('returns null when no increment is configured', async () => {
    mockHqRule.mockResolvedValue(null);
    expect(await planCashChangeRounding(scope, cashLeg)).toBeNull();
  });

  it('returns null when the change already sits on the increment', async () => {
    expect(await planCashChangeRounding(scope, { ...cashLeg, amount: 2 })).toBeNull();
  });
});

describe('postCashChangeRoundingTx', () => {
  const findLine = jest.fn();
  const tx = { org_fin_voucher_trx_lines_dtl: { findFirst: (...a: unknown[]) => findLine(...a) } } as never;
  const ctx = { tenantOrgId: TENANT, userId: USER };
  const loss = { exactChange: 2.997, roundedChange: 3, adjustment: -0.003, currencyCode: 'OMR' };
  const gain = { exactChange: 2.997, roundedChange: 2.995, adjustment: 0.002, currencyCode: 'OMR' };
  const input = { paymentLineId: 'pl-1', paymentMethodCode: 'CASH', idempotencyKey: 'k1' };

  beforeEach(() => {
    findLine.mockResolvedValue({ cash_drawer_session_id: 'sess-1', cash_drawer_id: 'drawer-1' });
    mockCreateVoucher.mockResolvedValue({ id: 'v-1' });
    mockAddLine.mockResolvedValue({ id: 'l-1', line_no: 1 });
    mockPostWire.mockResolvedValue({ voucherId: 'v-1' });
    mockDispatchCash.mockResolvedValue({ status: 'executed' });
  });

  it('posts a loss as an OUT line in the payment drawer session, anchored to the order', async () => {
    const res = await postCashChangeRoundingTx(tx, ctx, {
      ...input,
      rounding: loss,
      orderId: 'o-1',
      customerId: 'c-1',
      branchId: 'b-1',
    });
    expect(res).toEqual({ voucherId: 'v-1' });
    expect(findLine).toHaveBeenCalledWith({
      where: { id: 'pl-1', tenant_org_id: TENANT },
      select: { cash_drawer_session_id: true, cash_drawer_id: true },
    });
    expect(mockCreateVoucher.mock.calls[0][1]).toMatchObject({
      voucher_type: 'ADJUSTMENT_VOUCHER',
      direction: 'OUT',
      total_amount: 0.003,
      order_id: 'o-1',
      source_ref_type: 'ORDER',
      source_ref_id: 'o-1',
      idempotency_key: 'k1_vch',
    });
    expect(mockAddLine.mock.calls[0][2]).toMatchObject({
      line_type: 'ROUNDING',
      line_role: 'CASH_CHANGE_ROUNDING',
      direction: 'OUT',
      amount: 0.003,
      payment_method_code: 'CASH',
      payment_status: 'COMPLETED',
      cash_drawer_session_id: 'sess-1',
      target_type: 'ORDER',
      target_id: 'o-1',
      idempotency_key: 'k1_line',
    });
    expect(mockPostWire).toHaveBeenCalledWith(TENANT, 'v-1', USER, 'INTERACTIVE', 'k1_vch_post', tx);
    expect(mockDispatchCash).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        tenant_org_id: TENANT,
        event_code: 'CASH_ROUND_LOSS',
        voucher_id: 'v-1',
        amount: 0.003,
        currency_code: 'OMR',
        branch_id: 'b-1',
      }),
    );
  });

  it('never fails the rounding when the GL dispatch throws (NON_BLOCKING)', async () => {
    mockDispatchCash.mockRejectedValue(new Error('gl down'));
    await expect(postCashChangeRoundingTx(tx, ctx, { ...input, rounding: loss, orderId: 'o-1' })).resolves.toEqual({
      voucherId: 'v-1',
    });
  });

  it('posts a gain as an IN line', async () => {
    await postCashChangeRoundingTx(tx, ctx, { ...input, rounding: gain, orderId: 'o-1' });
    expect(mockAddLine.mock.calls[0][2]).toMatchObject({ direction: 'IN', amount: 0.002 });
    expect(mockDispatchCash.mock.calls[0][1]).toMatchObject({ event_code: 'CASH_ROUND_GAIN', amount: 0.002 });
  });

  it('anchors to the customer when there is no order, with the caller-supplied source', async () => {
    await postCashChangeRoundingTx(tx, ctx, {
      ...input,
      rounding: loss,
      customerId: 'c-1',
      source: { module: 'STORED_VALUE', refType: 'WALLET_TOPUP', refId: 'w-1' },
    });
    expect(mockCreateVoucher.mock.calls[0][1]).toMatchObject({
      party_type: 'CUSTOMER',
      source_module: 'STORED_VALUE',
      source_ref_id: 'w-1',
    });
    expect(mockAddLine.mock.calls[0][2]).toMatchObject({ target_type: 'CUSTOMER', target_id: 'c-1' });
  });

  it('anchors to the drawer when there is neither an order nor a customer', async () => {
    await postCashChangeRoundingTx(tx, ctx, {
      ...input,
      rounding: loss,
      source: { module: 'STORED_VALUE', refType: 'GIFT_CARD_SALE', refId: 'g-1' },
    });
    expect(mockAddLine.mock.calls[0][2]).toMatchObject({ target_type: 'CASH_DRAWER', target_id: 'drawer-1' });
  });

  it('does nothing when the payment line never reached a drawer', async () => {
    findLine.mockResolvedValue({ cash_drawer_session_id: null, cash_drawer_id: null });
    expect(await postCashChangeRoundingTx(tx, ctx, { ...input, rounding: loss, orderId: 'o-1' })).toBeNull();
    expect(mockCreateVoucher).not.toHaveBeenCalled();
  });

  it('does nothing when there is no anchor at all', async () => {
    findLine.mockResolvedValue({ cash_drawer_session_id: 'sess-1', cash_drawer_id: null });
    expect(await postCashChangeRoundingTx(tx, ctx, { ...input, rounding: loss })).toBeNull();
    expect(mockCreateVoucher).not.toHaveBeenCalled();
  });
});
