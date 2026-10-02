/**
 * Tests: stored-value-funding-wiring.handler (B3). Cash legs need no handler — the ledger gate stamps them.
 */

const mockFinalize = jest.fn();
jest.mock('@/lib/services/stored-value-funding.service', () => ({
  finalizeStoredValueFundingIfReady: (...a: unknown[]) => mockFinalize(...a),
}));

import { storedValueFundingWiringHandler } from '@/lib/services/wiring/stored-value-funding-wiring.handler';
import type { VoucherLineForWiring } from '@/lib/types/voucher-wiring';

const TENANT = '11111111-1111-1111-1111-111111111111';
const VOUCHER_ID = '22222222-2222-2222-2222-222222222222';
const USER_ID = 'user-001';

function makeFundingLine(overrides: Partial<VoucherLineForWiring> = {}): VoucherLineForWiring {
  return {
    id: 'line-001',
    tenant_org_id: TENANT,
    voucher_id: VOUCHER_ID,
    line_no: 1,
    line_role: 'WALLET_TOPUP',
    line_status: 'POSTED',
    wiring_status: 'NOT_WIRED',
    direction: 'IN',
    payment_method_code: 'CASH',
    payment_status: 'COMPLETED',
    amount: 20 as never,
    currency_code: 'OMR',
    target_type: 'WALLET',
    target_id: 'wallet-1',
    order_id: null,
    customer_id: 'cust-1',
    cash_drawer_session_id: null,
    pos_session_id: null,
    tendered_amount: null,
    change_returned_amount: null,
    credit_application_type: null,
    order_payment_id: null,
    cash_drawer_mvt_id: null,
    sv_funding_tender_id: null,
    card_brand_code: null,
    card_last4: null,
    gateway_code: null,
    gateway_reference: null,
    bank_reference: null,
    check_number: null,
    check_bank: null,
    check_date: null,
    org_payment_method_id: null,
    payment_terminal_id: null,
    branch_id: null,
    ...overrides,
  };
}

describe('storedValueFundingWiringHandler', () => {
  beforeEach(() => jest.clearAllMocks());

  it('canHandle matches only the 3 funding line roles, direction IN', () => {
    expect(storedValueFundingWiringHandler.canHandle(makeFundingLine({ line_role: 'WALLET_TOPUP' }))).toBe(true);
    expect(storedValueFundingWiringHandler.canHandle(makeFundingLine({ line_role: 'GIFT_CARD_SALE' }))).toBe(true);
    expect(storedValueFundingWiringHandler.canHandle(makeFundingLine({ line_role: 'CUSTOMER_ADVANCE_RECEIPT' }))).toBe(true);
    expect(storedValueFundingWiringHandler.canHandle(makeFundingLine({ line_role: 'ORDER_PAYMENT' }))).toBe(false);
    expect(
      storedValueFundingWiringHandler.canHandle(makeFundingLine({ line_role: 'WALLET_TOPUP', direction: 'OUT' })),
    ).toBe(false);
  });

  it('creates the tender row, backlinks sv_funding_tender_id onto the line, and calls the finalizer', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const create = jest.fn().mockResolvedValue({ id: 'tender-001' });
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const tx = {
      org_sv_funding_tenders_dtl: { findFirst, create },
      org_fin_voucher_trx_lines_dtl: { updateMany },
    };
    const line = makeFundingLine();

    const tenderId = await storedValueFundingWiringHandler.wire(line, VOUCHER_ID, TENANT, USER_ID, tx as never);

    expect(tenderId).toBe('tender-001');
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenant_org_id: TENANT,
          fin_voucher_id: VOUCHER_ID,
          fin_voucher_trx_line_id: line.id,
          funding_type: 'WALLET_TOPUP',
          target_type: 'WALLET',
          target_id: 'wallet-1',
          amount: 20,
          status: 'COMPLETED',
          idempotency_key: `${line.id}_sv_tender`,
        }),
      }),
    );
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: line.id, tenant_org_id: TENANT },
        data: expect.objectContaining({ sv_funding_tender_id: 'tender-001' }),
      }),
    );
    // In-memory mutation for the cash-drawer handler running right after it.
    expect(line.sv_funding_tender_id).toBe('tender-001');
    expect(mockFinalize).toHaveBeenCalledWith(tx, TENANT, VOUCHER_ID, USER_ID, line.id);
  });

  it('is replay-safe: reuses the existing tender row instead of creating a duplicate', async () => {
    const findFirst = jest.fn().mockResolvedValue({ id: 'tender-existing' });
    const create = jest.fn();
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const tx = {
      org_sv_funding_tenders_dtl: { findFirst, create },
      org_fin_voucher_trx_lines_dtl: { updateMany },
    };

    const tenderId = await storedValueFundingWiringHandler.wire(
      makeFundingLine(),
      VOUCHER_ID,
      TENANT,
      USER_ID,
      tx as never,
    );

    expect(tenderId).toBe('tender-existing');
    expect(create).not.toHaveBeenCalled();
  });

  it('validate throws when target_type/target_id or payment_method_code is missing', async () => {
    await expect(
      storedValueFundingWiringHandler.validate(makeFundingLine({ target_type: null })),
    ).rejects.toThrow(/missing target_type/);
    await expect(
      storedValueFundingWiringHandler.validate(makeFundingLine({ payment_method_code: null })),
    ).rejects.toThrow(/missing payment_method_code/);
  });
});
