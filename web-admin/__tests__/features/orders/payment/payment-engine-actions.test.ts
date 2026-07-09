import {
  toPaymentEngineActions,
  type PaymentEngine,
} from '@features/orders/payment/engine/payment-engine-actions';

/**
 * The facade must be a pure, identity-preserving re-mapping of engine handlers —
 * no wrapping. We build a mock engine of jest.fn()s and assert every action
 * points at the exact handler, so drift or a wrong mapping fails the build.
 */
describe('toPaymentEngineActions (typed engine-action facade)', () => {
  function buildMockEngine() {
    return {
      handleMethodSelect: jest.fn(),
      cycleActiveLeg: jest.fn(),
      fillLegRemaining: jest.fn(),
      handleKeypadPress: jest.fn(),
      legs: {
        setActiveLegIndex: jest.fn(),
        updateLeg: jest.fn(),
        addLeg: jest.fn(),
        removeLegAt: jest.fn(),
      },
      cashDrawer: {
        setSelectedCashDrawerSessionId: jest.fn(),
        persistPreferredCashDrawerId: jest.fn(),
        handleOpenCashDrawerDialog: jest.fn(),
        handleCreateCashDrawerSession: jest.fn(),
      },
      handleFetchGiftCardDetails: jest.fn(),
      handleApplyGiftCard: jest.fn(),
      handleClearGiftCard: jest.fn(),
      giftPromo: {
        setGiftCardPin: jest.fn(),
        setPinVisible: jest.fn(),
        setPinFieldError: jest.fn(),
      },
      handleValidatePromoCode: jest.fn(),
      handleClearPromoCode: jest.fn(),
      handleClearPromoCodeError: jest.fn(),
      handleCustomerCreditSelect: jest.fn(),
      handleCreditNoteSelect: jest.fn(),
      handleOutstandingPolicyChange: jest.fn(),
      setExtraReceiptDialogOpen: jest.fn(),
      confirmExtraReceiptSelection: jest.fn(),
      setPayExtraIntent: jest.fn(),
      runValidatePayment: jest.fn(),
    };
  }

  it('maps every action to its exact engine handler (identity, no wrapping)', () => {
    const engine = buildMockEngine();
    const actions = toPaymentEngineActions(
      engine as unknown as PaymentEngine,
    );

    expect(actions.selectMethod).toBe(engine.handleMethodSelect);
    expect(actions.cycleActiveLeg).toBe(engine.cycleActiveLeg);
    expect(actions.fillLegRemaining).toBe(engine.fillLegRemaining);
    expect(actions.pressKeypad).toBe(engine.handleKeypadPress);
    expect(actions.setActiveLegIndex).toBe(engine.legs.setActiveLegIndex);
    expect(actions.updateLeg).toBe(engine.legs.updateLeg);
    expect(actions.addLeg).toBe(engine.legs.addLeg);
    expect(actions.removeLegAt).toBe(engine.legs.removeLegAt);
    expect(actions.selectCashDrawerSession).toBe(
      engine.cashDrawer.setSelectedCashDrawerSessionId,
    );
    expect(actions.persistPreferredCashDrawerId).toBe(
      engine.cashDrawer.persistPreferredCashDrawerId,
    );
    expect(actions.openCashDrawerDialog).toBe(
      engine.cashDrawer.handleOpenCashDrawerDialog,
    );
    expect(actions.createCashDrawerSession).toBe(
      engine.cashDrawer.handleCreateCashDrawerSession,
    );
    expect(actions.fetchGiftCardDetails).toBe(engine.handleFetchGiftCardDetails);
    expect(actions.applyGiftCard).toBe(engine.handleApplyGiftCard);
    expect(actions.clearGiftCard).toBe(engine.handleClearGiftCard);
    expect(actions.setGiftCardPin).toBe(engine.giftPromo.setGiftCardPin);
    expect(actions.setGiftCardPinVisible).toBe(engine.giftPromo.setPinVisible);
    expect(actions.setGiftCardPinError).toBe(engine.giftPromo.setPinFieldError);
    expect(actions.validatePromoCode).toBe(engine.handleValidatePromoCode);
    expect(actions.clearPromoCode).toBe(engine.handleClearPromoCode);
    expect(actions.clearPromoCodeError).toBe(engine.handleClearPromoCodeError);
    expect(actions.selectCustomerCredit).toBe(engine.handleCustomerCreditSelect);
    expect(actions.selectCreditNote).toBe(engine.handleCreditNoteSelect);
    expect(actions.changeOutstandingPolicy).toBe(
      engine.handleOutstandingPolicyChange,
    );
    expect(actions.setExtraReceiptDialogOpen).toBe(
      engine.setExtraReceiptDialogOpen,
    );
    expect(actions.confirmExtraReceiptSelection).toBe(
      engine.confirmExtraReceiptSelection,
    );
    expect(actions.setPayExtraIntent).toBe(engine.setPayExtraIntent);
    expect(actions.validatePayment).toBe(engine.runValidatePayment);
  });

  it('does not invoke any handler at mapping time', () => {
    const engine = buildMockEngine();
    toPaymentEngineActions(engine as unknown as PaymentEngine);
    const allFns = Object.values(engine).flatMap((value) =>
      typeof value === 'function' ? [value] : Object.values(value),
    );
    allFns.forEach((fn) => expect(fn).not.toHaveBeenCalled());
  });
});
