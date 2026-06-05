import {
  applyKeypadInput,
  buildGatewayReturnState,
  deriveOutstandingPolicy,
  getPreferredCashDrawerStorageKey,
  getSuggestedStoredValueAmount,
  getWalletLegMaxAmount,
  parseGatewayReturnState,
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
    expect(draft).toBe('11.5');
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
    expect(getSuggestedStoredValueAmount(40, 20, 100, 3)).toBe(40);
    expect(getSuggestedStoredValueAmount(80, 40, 100, 3)).toBe(60);
  });

  it('caps wallet editing to the remaining order allocation for that leg', () => {
    const paymentLegs = [{ amount: 60 }, { amount: 40 }];
    expect(getWalletLegMaxAmount(50, paymentLegs, 1, 100, 3)).toBe(40);
    expect(getWalletLegMaxAmount(50, paymentLegs, 0, 100, 3)).toBe(50);
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
