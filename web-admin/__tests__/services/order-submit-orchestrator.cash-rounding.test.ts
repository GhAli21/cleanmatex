/** @jest-environment node */
/**
 * A6-1b — actual submitOrder with cash change rounding.
 *
 * The planner is a controllable stub (its own suite covers policy and amounts); this
 * suite proves the orchestration: the rounded change is stored on the cash payment
 * line, the rounding voucher is posted AFTER the receipt voucher with that line's id,
 * explicit overpayment-resolution change is never rounded, and non-COMPLETED legs are
 * skipped. Database atomicity is out of scope (callback composition only).
 */
const mockPlanCashChangeRounding = jest.fn();
const mockPostCashChangeRoundingTx = jest.fn();
jest.mock('@/lib/services/cash-change-rounding.service', () => ({
  planCashChangeRounding: (...a: unknown[]) => mockPlanCashChangeRounding(...a),
  postCashChangeRoundingTx: (...a: unknown[]) => mockPostCashChangeRoundingTx(...a),
}));

import {
  submitOrder, resetSubmitHarness, submitParams, makeSubmitInput,
  mockLine, mockWire, mockTx, tenantId, orderId, customerId, branchId,
} from '../helpers/order-submit-harness';

const rounding = { exactChange: 4.997, roundedChange: 5, adjustment: -0.003, currencyCode: 'OMR' };
const cashLegInput = () =>
  makeSubmitInput({
    amountToCharge: 20,
    paymentMethod: 'CASH',
    paymentLegs: [{ method: 'CASH', amount: 20, cashTendered: 25 }],
  } as never);

describe('A6-1b submitOrder cash change rounding', () => {
  beforeEach(() => {
    resetSubmitHarness();
    mockPlanCashChangeRounding.mockReset();
    mockPostCashChangeRoundingTx.mockReset();
  });

  it('stores the rounded change on the cash line and posts the rounding voucher after the receipt', async () => {
    mockPlanCashChangeRounding.mockResolvedValue(rounding);
    await submitOrder(submitParams(cashLegInput()));

    expect(mockPlanCashChangeRounding).toHaveBeenCalledWith(
      { tenantId, branchId, userId: 'staff-1' },
      expect.objectContaining({ paymentMethodCode: 'CASH', amount: 20, tenderedAmount: 25 }),
    );
    expect(mockLine).toHaveBeenCalledWith(
      tenantId,
      'voucher-1',
      expect.objectContaining({ line_role: 'ORDER_PAYMENT', tendered_amount: 25, change_returned_amount: 5 }),
      'staff-1',
      undefined,
      mockTx,
    );
    expect(mockPostCashChangeRoundingTx).toHaveBeenCalledWith(
      mockTx,
      { tenantOrgId: tenantId, userId: 'staff-1' },
      expect.objectContaining({
        rounding,
        orderId,
        customerId,
        branchId,
        paymentLineId: 'line-1',
        paymentMethodCode: 'CASH',
        idempotencyKey: `${orderId}_cash_round_0`,
      }),
    );
    expect(mockWire.mock.invocationCallOrder[0]).toBeLessThan(
      mockPostCashChangeRoundingTx.mock.invocationCallOrder[0],
    );
  });

  it('leaves the change to the voucher layer (exact) when no rounding applies', async () => {
    mockPlanCashChangeRounding.mockResolvedValue(null);
    await submitOrder(submitParams(cashLegInput()));

    const lineInput = mockLine.mock.calls[0][2] as Record<string, unknown>;
    expect(lineInput).not.toHaveProperty('change_returned_amount');
    expect(mockPostCashChangeRoundingTx).not.toHaveBeenCalled();
  });

  it('does not plan any rounding for a non-cash tender', async () => {
    await submitOrder(submitParams(makeSubmitInput({ amountToCharge: 20, paymentMethod: 'CARD' } as never)));
    expect(mockPostCashChangeRoundingTx).not.toHaveBeenCalled();
    const lineInput = mockLine.mock.calls[0][2] as Record<string, unknown>;
    expect(lineInput).not.toHaveProperty('change_returned_amount');
  });
});
