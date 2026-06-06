import {
  applyKeypadInput,
  buildGatewayReturnState,
  capPaymentLegAmount,
  deriveOutstandingPolicy,
  getPreferredCashDrawerStorageKey,
  getAmountAppliedToOrder,
  getDisplayChangeAmount,
  getNetCashRetainedAmount,
  getRemainingToAllocate,
  getSuggestedDefaultLegAmount,
  getSuggestedStoredValueAmount,
  getUnresolvedOverpaymentAmount,
  getWalletLegMaxAmount,
  parseGatewayReturnState,
  reconcilePaymentLegAmounts,
  resolvePreferredCashDrawerSessionId,
  sanitizeDecimalDraft,
  syncDiscountFromPercent,
  syncDiscountPercentFromAmount,
  todayYyyyMmDd,
  validateCheckDueDate,
  walletLegExceedsBalance,
} from '@features/orders/ui/payment-modal-v4.utils';

describe('payment-modal-v4 utils', () => {
  it('sanitizes decimal drafts to one decimal separator', () => {
    expect(sanitizeDecimalDraft('1..23', 3)).toBe('1.23');
  });

  it('applies keypad digits and decimal safely', () => {
    let draft = '';
    draft = applyKeypadInput(draft, '1', 3);
    draft = applyKeypadInput(draft, '2', 3);
    draft = applyKeypadInput(draft, '.', 3);
    draft = applyKeypadInput(draft, '5', 3);
    expect(draft).toBe('12.5');
  });

  it('supports decimal-first keypad entry after clearing a leg', () => {
    let draft = '';
    draft = applyKeypadInput(draft, '.', 3);
    draft = applyKeypadInput(draft, '5', 3);
    expect(draft).toBe('0.5');
  });

  it('supports clearing a draft in one tap', () => {
    expect(applyKeypadInput('12.5', 'clear', 3)).toBe('');
  });

  it('supports quick-add keypad shortcuts', () => {
    const draft = applyKeypadInput('1.5', '+10', 3);
    expect(draft).toBe('11.500');
  });

  it('derives no outstanding policy for full payment', () => {
    expect(deriveOutstandingPolicy(100, 100, 'CREDIT_INVOICE')).toBe('NONE');
  });

  it('keeps preferred outstanding policy for partial payment', () => {
    expect(deriveOutstandingPolicy(40, 100, 'CREDIT_INVOICE')).toBe('CREDIT_INVOICE');
  });

  it('syncs manual discount from percent', () => {
    expect(syncDiscountFromPercent(100, 5, 3)).toBe(5);
  });

  it('syncs manual discount percent from amount', () => {
    expect(syncDiscountPercentFromAmount(200, 10)).toBe(5);
  });

  it('suggests a wallet leg amount capped by live balance and remaining due', () => {
    expect(getSuggestedStoredValueAmount(40, [{ amount: 20 }], 100, 0, 3)).toBe(40);
    expect(getSuggestedStoredValueAmount(80, [{ amount: 40 }], 100, 0, 3)).toBe(60);
  });

  it('subtracts gift card credits when suggesting stored-value amounts', () => {
    expect(getSuggestedStoredValueAmount(80, [], 100, 20, 3)).toBe(80);
    expect(getSuggestedStoredValueAmount(80, [{ amount: 50 }], 100, 20, 3)).toBe(30);
  });

  it('caps wallet editing to the remaining order allocation for that leg', () => {
    const paymentLegs = [{ amount: 60 }, { amount: 40 }];
    expect(getWalletLegMaxAmount(50, paymentLegs, 1, 100, 3)).toBe(40);
    expect(getWalletLegMaxAmount(50, paymentLegs, 0, 100, 3)).toBe(50);
  });

  it('computes remaining to allocate excluding the active leg', () => {
    const legs = [{ amount: 8.321 }, { amount: 2 }];
    expect(getRemainingToAllocate(8.321, legs, 0, 0, 3)).toBe(6.321);
    expect(getRemainingToAllocate(8.321, legs, 0, 1, 3)).toBe(0);
    expect(getRemainingToAllocate(8.321, legs, 2, undefined, 3)).toBe(0);
    expect(getRemainingToAllocate(8.321, [{ amount: 2 }], 0, undefined, 3)).toBe(6.321);
    expect(getRemainingToAllocate(8.321, [{ amount: 6 }], 2, undefined, 3)).toBe(0.321);
  });

  it('defaults a newly selected leg to remaining balance', () => {
    expect(getSuggestedDefaultLegAmount([{ amount: 2 }], undefined, 8.321, 0, 3)).toBe(6.321);
    expect(getSuggestedDefaultLegAmount([{ amount: 8.321 }, { amount: 2 }], 0, 8.321, 0, 3)).toBe(6.321);
    expect(getSuggestedDefaultLegAmount([], undefined, 8.321, 0, 3)).toBe(8.321);
  });

  it('caps payment leg amounts to remaining allocation', () => {
    const legs = [{ amount: 8.321 }, { amount: 0 }];
    expect(capPaymentLegAmount(8.321, legs, 1, 8.321, 0, 3)).toBe(0);
    expect(capPaymentLegAmount(5, [{ amount: 6 }], 0, 10, 2, 3)).toBe(5);
    expect(capPaymentLegAmount(9, [{ amount: 6 }], 0, 10, 2, 3)).toBe(8);
  });

  it('reconciles legs when sale total drops', () => {
    const legs = [{ amount: 8.321 }, { amount: 2 }];
    const reconciled = reconcilePaymentLegAmounts(legs, 8.321, 0, 3);
    expect(reconciled[0].amount).toBe(6.321);
    expect(reconciled[1].amount).toBe(2);
  });

  it('separates cash change from unresolved overpayment', () => {
    expect(getAmountAppliedToOrder(8.321, 8.821)).toBe(8.321);
    expect(getDisplayChangeAmount(0.5, true)).toBe(0.5);
    expect(getDisplayChangeAmount(0.5, false)).toBe(0);
    expect(getUnresolvedOverpaymentAmount(0.5, true)).toBe(0);
    expect(getUnresolvedOverpaymentAmount(0.5, false)).toBe(0.5);
    expect(getNetCashRetainedAmount(6.821, 0.5, true)).toBe(6.321);
  });

  it('detects when a live wallet refresh makes the applied leg invalid', () => {
    expect(walletLegExceedsBalance(40, 20)).toBe(true);
    expect(walletLegExceedsBalance(40, 40)).toBe(false);
  });

  it('scopes preferred cash drawer storage by tenant, branch, and user', () => {
    expect(
      getPreferredCashDrawerStorageKey({
        tenantOrgId: 'tenant 1',
        branchId: 'branch/A',
        userId: 'user@example.com',
      })
    ).toBe('cmx:payment:v4:preferred-cash-drawer:tenant%201:branch%2FA:user%40example.com');
  });

  it('does not build a preferred cash drawer key without complete scope', () => {
    expect(getPreferredCashDrawerStorageKey({ tenantOrgId: 'tenant-1', branchId: 'branch-1' })).toBeNull();
    expect(getPreferredCashDrawerStorageKey({ tenantOrgId: 'tenant-1', userId: 'user-1' })).toBeNull();
    expect(getPreferredCashDrawerStorageKey({ branchId: 'branch-1', userId: 'user-1' })).toBeNull();
  });

  it('resolves a saved cash drawer id to the current open session id', () => {
    expect(
      resolvePreferredCashDrawerSessionId(
        [
          { drawer: { id: 'drawer-a' }, session: { id: 'session-a-open' } },
          { drawer: { id: 'drawer-b' }, session: { id: 'session-b-open' } },
        ],
        'drawer-b'
      )
    ).toBe('session-b-open');
  });

  it('ignores stale preferred cash drawer ids not present in the open-session list', () => {
    expect(
      resolvePreferredCashDrawerSessionId(
        [{ drawer: { id: 'drawer-a' }, session: { id: 'session-a-open' } }],
        'drawer-closed-or-other-branch'
      )
    ).toBeNull();
    expect(resolvePreferredCashDrawerSessionId([], 'drawer-a')).toBeNull();
    expect(resolvePreferredCashDrawerSessionId([{ drawer: { id: 'drawer-a' }, session: { id: 'session-a-open' } }], ''))
      .toBeNull();
  });

  // ─── BVM Phase 6 Sub-item 4 ──────────────────────────────────────────────

  it('formats today as YYYY-MM-DD in local time', () => {
    expect(todayYyyyMmDd(new Date('2026-03-05T10:00:00Z'))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('validateCheckDueDate accepts today and future dates, rejects past', () => {
    const today = '2026-05-30';
    expect(validateCheckDueDate('', today)).toBeNull();
    expect(validateCheckDueDate(undefined, today)).toBeNull();
    expect(validateCheckDueDate('2026-05-30', today)).toBeNull();
    expect(validateCheckDueDate('2026-06-15', today)).toBeNull();
    expect(validateCheckDueDate('2026-05-29', today)).toBe('checkDateInPast');
    expect(validateCheckDueDate('not-a-date', today)).toBe('checkDateInvalid');
    expect(validateCheckDueDate('2026/05/30', today)).toBe('checkDateInvalid');
  });

  it('round-trips a gateway return-state envelope through JSON', () => {
    const state = { selectedLeg: 1, customerId: 'c-123', draftAmount: '12.500' };
    const serialised = buildGatewayReturnState(state);
    expect(parseGatewayReturnState(serialised)).toEqual(state);
  });

  it('parseGatewayReturnState defends against malformed input', () => {
    expect(parseGatewayReturnState(null)).toBeNull();
    expect(parseGatewayReturnState('')).toBeNull();
    expect(parseGatewayReturnState('not json')).toBeNull();
    expect(parseGatewayReturnState('[1,2,3]')).toBeNull(); // arrays rejected
    expect(parseGatewayReturnState('"plain string"')).toBeNull(); // primitives rejected
  });
});
