/** @jest-environment node */
/**
 * Protects real Create orchestration while infrastructure remains mocked.
 * Shared callback identity and propagated failures prove composition, not DB rollback;
 * workflow status is a supplied creation result rather than a runtime-engine test.
 */
import {
  submitOrder, resolveOrderBranch, resetSubmitHarness, submitParams, makeSubmitInput,
  makeServerTotals, mockCalculate, mockCreate, mockSettle, mockTaxDoc, mockVoucher,
  mockWire, mockLine, mockPromo, mockInvoice, mockTransaction, mockTenantContext,
  mockReadOrder, mockBranchRead, mockEffects, mockTx, tenantId, orderId, branchId,
} from '../helpers/order-submit-harness';

describe('WP01 actual canonical Create orchestration', () => {
  beforeEach(resetSubmitHarness);
  it('composes order, voucher, wiring and financial snapshot through one transaction', async () => {
    const result = await submitOrder(submitParams());
    expect(mockTransaction).toHaveBeenCalledTimes(1);
    expect(mockTransaction).toHaveBeenCalledWith(expect.any(Function), { maxWait: 10000, timeout: 30000 });
    expect(mockCreate).toHaveBeenCalledWith(mockTx, expect.objectContaining({ tenantId, useOldWfCodeOrNew: false }));
    expect(mockVoucher.mock.calls[0][3]).toBe(mockTx);
    expect(mockLine.mock.calls[0][5]).toBe(mockTx);
    expect(mockWire.mock.calls[0][5]).toBe(mockTx);
    expect(mockSettle).toHaveBeenCalledWith(mockTx, expect.objectContaining({ tenantId, orderId,
      breakdown: expect.objectContaining({ grandTotal: 20, outstanding: 0, creditsTotal: 0 }) }));
    expect(mockInvoice).not.toHaveBeenCalled();
    expect(mockReadOrder).toHaveBeenCalledWith(expect.objectContaining({ where: { id: orderId, tenant_org_id: tenantId } }));
    expect(mockTenantContext.mock.calls.every(([tenant]) => tenant === tenantId)).toBe(true);
    expect(result.order).toMatchObject({ id: orderId, currentStatus: 'intake', totalAmount: '20.000', outstandingAmount: '0.000' });
    expect(result.voucher).toMatchObject({ id: 'voucher-1', wiringStatus: 'WIRED' });
  });
  it('forwards Quick Drop and ITEM/PIECE/ORDER preference intent', async () => {
    const pref = { preference_code: 'IRON', source: 'ORDER', extra_price: 2 };
    mockCalculate.mockResolvedValue(makeServerTotals({ subtotal: 23, afterDiscounts: 23, saleTotal: 25, chargesTotal: 2 }));
    const input = makeSubmitInput({ isQuickDrop: true, quickDropQuantity: 3, orderServicePrefs: [pref], amountToCharge: 25,
      clientTotals: { subtotal: 23, manualDiscount: 0, promoDiscount: 0, vatValue: 0, saleTotal: 25 },
      items: [{ ...makeSubmitInput().items[0], servicePrefCharge: 1, packingPrefCharge: 2,
        servicePrefs: [{ ...pref, source: 'ITEM' }],
        pieces: [{ pieceSeq: 1, conditions: ['STAIN'], servicePrefs: [{ ...pref, source: 'PIECE' }] }] }] });
    await submitOrder(submitParams(input));
    expect(mockCalculate).toHaveBeenCalledWith(expect.objectContaining({ tenantId,
      items: [expect.objectContaining({ servicePrefCharge: 1, packingPrefCharge: 2 })],
      orderCharges: [{ label: 'IRON', amount: 2 }] }));
    expect(mockCreate).toHaveBeenCalledWith(mockTx, expect.objectContaining({ isQuickDrop: true,
      quickDropQuantity: 3, orderServicePrefs: [pref], items: [expect.objectContaining(input.items[0])] }));
  });
  it('rejects stale client totals before opening the transaction', async () => {
    mockCalculate.mockResolvedValue(makeServerTotals({ saleTotal: 21 }));
    await expect(submitOrder(submitParams())).rejects.toMatchObject({ message: 'AMOUNT_MISMATCH', differences: expect.any(Object) });
    expect(mockTransaction).not.toHaveBeenCalled();
  });
  it('preserves split tender as two voucher lines with distinct keys', async () => {
    await submitOrder(submitParams(makeSubmitInput({ paymentLegs: [
      { method: 'CASH', amount: 8 }, { method: 'CARD', amount: 12 },
    ] })));
    expect(mockLine).toHaveBeenCalledTimes(2);
    expect(mockLine.mock.calls.map((call) => call[2].amount)).toEqual([8, 12]);
    expect(new Set(mockLine.mock.calls.map((call) => call[2].idempotency_key)).size).toBe(2);
    expect(mockLine.mock.calls.every((call) => call[5] === mockTx)).toBe(true);
  });
  it('retains pending payment status and exposes its confirmation warning', async () => {
    const result = await submitOrder(submitParams(makeSubmitInput({
      paymentLegs: [{ method: 'CARD', amount: 20, paymentStatus: 'PENDING' }],
    })));
    expect(mockLine.mock.calls[0][2].payment_status).toBe('PENDING');
    expect(result.warnings).toContain('CARD_PENDING_CONFIRMATION');
  });
  it.each(['create', 'voucher', 'wire', 'settle'] as const)('propagates %s failure without success or final reads', async (stage) => {
    const failure = new Error(`wp01-${stage}-failure`);
    ({ create: mockCreate, voucher: mockVoucher, wire: mockWire, settle: mockSettle })[stage].mockRejectedValueOnce(failure);
    await expect(submitOrder(submitParams())).rejects.toBe(failure);
    expect(mockReadOrder).not.toHaveBeenCalled();
    expect(mockEffects).not.toHaveBeenCalled();
    if (stage !== 'settle') expect(mockSettle).not.toHaveBeenCalled();
  });
  it('composes promo consumption in the same transaction', async () => {
    mockCalculate.mockResolvedValue(makeServerTotals({ subtotal: 22, afterDiscounts: 20, promoDiscount: 2 }));
    await submitOrder(submitParams(makeSubmitInput({ promoCodeId: '66666666-6666-4666-8666-666666666666',
      clientTotals: { subtotal: 22, manualDiscount: 0, promoDiscount: 2, vatValue: 0, saleTotal: 20 } })));
    expect(mockPromo).toHaveBeenCalledWith(mockTx, expect.objectContaining({ tenantOrgId: tenantId, orderId, discountAmount: 2 }));
  });
  it('retains current non-blocking tax issuance at the callback boundary', async () => {
    mockTaxDoc.mockRejectedValueOnce(new Error('tax-doc-boundary-failure'));
    await expect(submitOrder(submitParams())).resolves.toMatchObject({ order: { id: orderId } });
    expect(mockTaxDoc).toHaveBeenCalledWith(mockTx, expect.objectContaining({ tenantId, orderId }));
    // A failed SQL statement can still abort PostgreSQL; WP18 must prove that case.
  });
  it('surfaces a post-commit response-read failure (current Create limitation)', async () => {
    mockReadOrder.mockRejectedValueOnce(new Error('response-read-failed'));
    await expect(submitOrder(submitParams())).rejects.toThrow('response-read-failed');
    expect(mockSettle).toHaveBeenCalledTimes(1);
  });
  it('resolves a branch with an explicit tenant predicate', async () => {
    mockBranchRead.mockResolvedValueOnce({ id: branchId });
    await expect(resolveOrderBranch(tenantId, branchId)).resolves.toBe(branchId);
    expect(mockBranchRead).toHaveBeenCalledWith(expect.objectContaining({ where: { tenant_org_id: tenantId, id: branchId } }));
  });
});
