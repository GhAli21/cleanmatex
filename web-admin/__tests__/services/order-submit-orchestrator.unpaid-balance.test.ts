/** @jest-environment node */
/**
 * Exercises actual submission decisions for gifts and remaining receivables.
 * Mocked policy and ledger boundaries verify their invocation and failure propagation;
 * persisted debit atomicity and tenant RLS require separate database integration tests.
 */
import {
  submitOrder, resetSubmitHarness, submitParams, makeSubmitInput, makeServerTotals,
  mockCalculate, mockTransaction, mockSettle, mockDebit, mockInvoice, mockCreditCheck,
  mockCreditAssert, mockReadOrder, mockTx, tenantId, orderId, customerId,
} from '../helpers/order-submit-harness';

describe('WP01 actual submitOrder unpaid balance and stored value', () => {
  beforeEach(resetSubmitHarness);
  it('accepts NONE when cash plus gift covers sale and debits gift with voucher lineage', async () => {
    mockCalculate.mockResolvedValue(makeServerTotals({ giftCardApplied: 5 }));
    mockReadOrder.mockResolvedValueOnce({ id: orderId, order_no: 'ORD-WP01', current_status: 'intake',
      total_amount: '20.000', total_paid_amount: '15.000', total_credit_applied_amount: '5.000',
      outstanding_amount: '0.000', payment_status: 'paid', payment_type_code: 'PAY_IN_ADVANCE' });
    const result = await submitOrder(submitParams(makeSubmitInput({ amountToCharge: 15,
      giftCardId: '66666666-6666-4666-8666-666666666666' })));
    expect(mockDebit).toHaveBeenCalledWith(mockTx, expect.objectContaining({ tenantId, orderId,
      customerId, creditType: 'GIFT_CARD', amount: 5, voucherId: 'voucher-1', voucherLineId: 'line-1' }));
    expect(mockSettle).toHaveBeenCalledWith(mockTx, expect.objectContaining({
      breakdown: expect.objectContaining({ grandTotal: 20, creditsTotal: 5, netReceivable: 15, outstanding: 0 }) }));
    expect(mockInvoice).not.toHaveBeenCalled();
    expect(result.order).toMatchObject({ totalAmount: '20.000', totalPaidAmount: '15.000',
      totalCreditAppliedAmount: '5.000', outstandingAmount: '0.000' });
  });
  it('rejects NONE when payment plus gift leaves an unpaid remainder', async () => {
    mockCalculate.mockResolvedValue(makeServerTotals({ giftCardApplied: 4 }));
    await expect(submitOrder(submitParams(makeSubmitInput({ amountToCharge: 15,
      giftCardId: '66666666-6666-4666-8666-666666666666' })))).rejects.toThrow('OUTSTANDING_POLICY_REQUIRED');
    expect(mockTransaction).not.toHaveBeenCalled();
  });
  it('checks and invoices only the remaining credit receivable in the same transaction', async () => {
    mockReadOrder.mockResolvedValueOnce({ id: orderId, order_no: 'ORD-WP01', current_status: 'intake',
      total_amount: '20.000', total_paid_amount: '12.000', total_credit_applied_amount: '0.000',
      outstanding_amount: '8.000', payment_status: 'partial', payment_type_code: 'CREDIT_INVOICE' });
    const result = await submitOrder(submitParams(makeSubmitInput({ amountToCharge: 12, outstandingPolicy: 'CREDIT_INVOICE' })));
    expect(mockCreditCheck).toHaveBeenCalledWith(customerId, 8);
    expect(mockInvoice).toHaveBeenCalledWith(expect.objectContaining({ order_ids: [orderId],
      expected_total_amount: 8, allocation_policy: 'REMAINING_ONLY' }), { tenantId, userId: 'staff-1' }, mockTx);
    expect(result.order).toMatchObject({ outstandingAmount: '8.000', paymentTypeCode: 'CREDIT_INVOICE' });
  });
  it('cannot bypass a credit-policy rejection using the legacy override input', async () => {
    mockCreditAssert.mockImplementationOnce(() => { throw new Error('B2B_CREDIT_EXCEEDED'); });
    await expect(submitOrder(submitParams(makeSubmitInput({ amountToCharge: 12,
      outstandingPolicy: 'CREDIT_INVOICE', creditLimitOverride: true })))).rejects.toThrow('B2B_CREDIT_EXCEEDED');
    expect(mockTransaction).not.toHaveBeenCalled();
  });
  it('propagates stored-value debit failure before snapshot settlement', async () => {
    mockCalculate.mockResolvedValue(makeServerTotals({ giftCardApplied: 5 }));
    mockDebit.mockRejectedValueOnce(new Error('gift-debit-failed'));
    await expect(submitOrder(submitParams(makeSubmitInput({ amountToCharge: 15,
      giftCardId: '66666666-6666-4666-8666-666666666666' })))).rejects.toThrow('gift-debit-failed');
    expect(mockSettle).not.toHaveBeenCalled();
  });
});
