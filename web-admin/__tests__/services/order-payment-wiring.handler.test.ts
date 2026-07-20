/**
 * Tests: order-payment-wiring.handler
 *
 * Covers voucher-line payment status propagation into order payment fact rows.
 */

import { orderPaymentWiringHandler } from '@/lib/services/wiring/order-payment-wiring.handler';
import type { VoucherLineForWiring } from '@/lib/types/voucher-wiring';

const TENANT = '11111111-1111-1111-1111-111111111111';
const VOUCHER_ID = '22222222-2222-2222-2222-222222222222';
const ORDER_ID = '33333333-3333-3333-3333-333333333333';
const USER_ID = 'user-001';

function makeOrderPaymentLine(overrides: Partial<VoucherLineForWiring> = {}): VoucherLineForWiring {
  return {
    id: 'line-001',
    tenant_org_id: TENANT,
    voucher_id: VOUCHER_ID,
    line_no: 1,
    line_role: 'ORDER_PAYMENT',
    line_status: 'POSTED',
    wiring_status: 'NOT_WIRED',
    direction: 'IN',
    payment_method_code: 'CARD',
    payment_status: 'PENDING',
    amount: 25 as never,
    currency_code: 'OMR',
    target_type: 'ORDER',
    target_id: ORDER_ID,
    order_id: ORDER_ID,
    customer_id: null,
    cash_drawer_session_id: null,
    tendered_amount: null,
    change_returned_amount: null,
    credit_application_type: null,
    order_payment_id: null,
    cash_drawer_mvt_id: null,
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

describe('orderPaymentWiringHandler', () => {
  it('uses voucher line payment_status before payment-method fallback', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'payment-001' });
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const tx = {
      org_order_payments_dtl: { create },
      org_fin_voucher_trx_lines_dtl: { updateMany },
    };

    await orderPaymentWiringHandler.wire(
      makeOrderPaymentLine(),
      VOUCHER_ID,
      TENANT,
      USER_ID,
      tx as never,
    );

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          payment_method_code: 'CARD',
          payment_status: 'PENDING',
          paid_at: null,
        }),
      }),
    );
  });

  // B4: closes the pre-existing gap where a CHECK payment's bank/date
  // proof-of-receipt metadata was captured on the voucher line but silently
  // dropped when wired into org_order_payments_dtl.
  it('forwards check_bank/check_date onto the order payment row (B4 fix)', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'payment-002' });
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const tx = {
      org_order_payments_dtl: { create },
      org_fin_voucher_trx_lines_dtl: { updateMany },
    };
    const checkDate = new Date('2026-08-01T00:00:00.000Z');

    await orderPaymentWiringHandler.wire(
      makeOrderPaymentLine({
        payment_method_code: 'CHECK',
        payment_status: 'PENDING',
        check_number: 'CHK-100',
        check_bank: 'Bank of Oman',
        check_date: checkDate,
      }),
      VOUCHER_ID,
      TENANT,
      USER_ID,
      tx as never,
    );

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          check_no: 'CHK-100',
          check_bank_name: 'Bank of Oman',
          check_due_date: checkDate,
        }),
      }),
    );
  });
});
