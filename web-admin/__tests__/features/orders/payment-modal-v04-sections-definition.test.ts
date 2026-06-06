import {
  derivePaymentInspectorTabs,
  deriveVisiblePaymentSections,
  PAYMENT_MODAL_INSPECTOR_TAB_IDS,
  PAYMENT_MODAL_SECTION_IDS,
  type PaymentModalSectionVisibilityContext,
} from '@features/orders/ui/payment-modal-v04-sections-definition';

function makeSectionContext(
  overrides: Partial<PaymentModalSectionVisibilityContext> = {}
): PaymentModalSectionVisibilityContext {
  return {
    hasActivePaymentLeg: true,
    showDeferredExplanation: false,
    discountsEnabled: true,
    hasDiscountsApplied: false,
    hasPromoActivity: false,
    hasGiftCardActivity: false,
    hasCashLeg: false,
    showBalancePolicy: false,
    ...overrides,
  };
}

describe('payment-modal-v04 section definitions', () => {
  it('keeps the approved center workbench order', () => {
    const sections = deriveVisiblePaymentSections(
      makeSectionContext({
        hasCashLeg: true,
        showBalancePolicy: true,
      })
    );

    expect(sections.map((section) => section.id)).toEqual([
      PAYMENT_MODAL_SECTION_IDS.BALANCE_SNAPSHOT,
      PAYMENT_MODAL_SECTION_IDS.AMOUNT_EDITOR,
      PAYMENT_MODAL_SECTION_IDS.PAYMENT_WORKSPACE,
      PAYMENT_MODAL_SECTION_IDS.DISCOUNTS_CREDITS,
      PAYMENT_MODAL_SECTION_IDS.CASH_DRAWER,
      PAYMENT_MODAL_SECTION_IDS.FINANCIAL_INSPECTOR,
      PAYMENT_MODAL_SECTION_IDS.BALANCE_POLICY,
    ]);
  });

  it('shows cash drawer section only when a cash leg exists', () => {
    const withoutCash = deriveVisiblePaymentSections(makeSectionContext());
    const withCash = deriveVisiblePaymentSections(
      makeSectionContext({ hasCashLeg: true })
    );

    expect(withoutCash.map((section) => section.id)).not.toContain(
      PAYMENT_MODAL_SECTION_IDS.CASH_DRAWER
    );
    expect(withCash.map((section) => section.id)).toContain(
      PAYMENT_MODAL_SECTION_IDS.CASH_DRAWER
    );
  });

  it('shows balance policy only when remaining balance requires it', () => {
    const settled = deriveVisiblePaymentSections(makeSectionContext());
    const deferred = deriveVisiblePaymentSections(
      makeSectionContext({ showBalancePolicy: true })
    );

    expect(settled.map((section) => section.id)).not.toContain(
      PAYMENT_MODAL_SECTION_IDS.BALANCE_POLICY
    );
    expect(deferred.map((section) => section.id)).toContain(
      PAYMENT_MODAL_SECTION_IDS.BALANCE_POLICY
    );
  });

  it('keeps discounts available when disabled globally but applied state exists', () => {
    const sections = deriveVisiblePaymentSections(
      makeSectionContext({
        discountsEnabled: false,
        hasDiscountsApplied: true,
      })
    );

    expect(sections.map((section) => section.id)).toContain(
      PAYMENT_MODAL_SECTION_IDS.DISCOUNTS_CREDITS
    );
  });

  it('hides amount editor for fully deferred payment explanation state', () => {
    const sections = deriveVisiblePaymentSections(
      makeSectionContext({
        hasActivePaymentLeg: false,
        showDeferredExplanation: true,
      })
    );

    expect(sections.map((section) => section.id)).not.toContain(
      PAYMENT_MODAL_SECTION_IDS.AMOUNT_EDITOR
    );
    expect(sections.map((section) => section.id)).toContain(
      PAYMENT_MODAL_SECTION_IDS.PAYMENT_WORKSPACE
    );
  });

  it('builds compact financial inspector tabs from relevant states', () => {
    const tabs = derivePaymentInspectorTabs({
      hasTaxBreakdown: true,
      hasDiscountBreakdown: true,
      hasWarnings: true,
      isB2B: true,
    });

    expect(tabs).toEqual([
      PAYMENT_MODAL_INSPECTOR_TAB_IDS.ORDER_VALUE,
      PAYMENT_MODAL_INSPECTOR_TAB_IDS.TAX_BREAKDOWN,
      PAYMENT_MODAL_INSPECTOR_TAB_IDS.DISCOUNTS,
      PAYMENT_MODAL_INSPECTOR_TAB_IDS.WARNINGS,
      PAYMENT_MODAL_INSPECTOR_TAB_IDS.B2B_AR,
      PAYMENT_MODAL_INSPECTOR_TAB_IDS.PAYMENT_NOTES,
    ]);
  });

  it('always keeps order value and payment notes in the financial inspector', () => {
    const tabs = derivePaymentInspectorTabs({
      hasTaxBreakdown: false,
      hasDiscountBreakdown: false,
      hasWarnings: false,
      isB2B: false,
    });

    expect(tabs).toEqual([
      PAYMENT_MODAL_INSPECTOR_TAB_IDS.ORDER_VALUE,
      PAYMENT_MODAL_INSPECTOR_TAB_IDS.PAYMENT_NOTES,
    ]);
  });
});
