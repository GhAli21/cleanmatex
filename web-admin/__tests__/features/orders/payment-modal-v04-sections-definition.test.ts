import {
  buildInitialWorkbenchSectionExpandedState,
  deriveAutoExpandPaymentSections,
  derivePaymentInspectorTabs,
  deriveVisiblePaymentSections,
  PAYMENT_MODAL_INSPECTOR_TAB_IDS,
  PAYMENT_MODAL_SECTION_IDS,
  PAYMENT_MODAL_V04_PIN_FINAL_ORDER_TOTAL,
  PAYMENT_MODAL_V04_SHOW_LIVE_EFFECT,
  PAYMENT_MODAL_V04_SECTIONS,
  type PaymentModalSectionAutoExpandContext,
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
  it('defaults Live Effect preview to hidden (Balance Result covers settlement)', () => {
    expect(PAYMENT_MODAL_V04_SHOW_LIVE_EFFECT).toBe(false);
  });

  it('pins Final Order Total to the receipt rail above submit by default', () => {
    expect(PAYMENT_MODAL_V04_PIN_FINAL_ORDER_TOTAL).toBe(true);
  });

  it('seeds expanded state from section defaults (Phase 3: only A + B open)', () => {
    const state = buildInitialWorkbenchSectionExpandedState();

    expect(state[PAYMENT_MODAL_SECTION_IDS.BALANCE_SNAPSHOT]).toBe(true);
    expect(state[PAYMENT_MODAL_SECTION_IDS.AMOUNT_EDITOR]).toBe(true);
    expect(state[PAYMENT_MODAL_SECTION_IDS.PAYMENT_WORKSPACE]).toBe(false);
    expect(state[PAYMENT_MODAL_SECTION_IDS.DISCOUNTS_CREDITS]).toBe(false);
    expect(state[PAYMENT_MODAL_SECTION_IDS.CASH_DRAWER]).toBe(false);
    expect(state[PAYMENT_MODAL_SECTION_IDS.FINANCIAL_INSPECTOR]).toBe(false);
    expect(state[PAYMENT_MODAL_SECTION_IDS.BALANCE_POLICY]).toBe(false);
  });

  it('marks every center workbench section as collapsible', () => {
    for (const section of PAYMENT_MODAL_V04_SECTIONS) {
      expect(section.collapsible).toBe(true);
    }
  });

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

describe('deriveAutoExpandPaymentSections (Phase 3 contextual expansion)', () => {
  function makeAutoExpandContext(
    overrides: Partial<PaymentModalSectionAutoExpandContext> = {}
  ): PaymentModalSectionAutoExpandContext {
    return {
      workspaceNeedsAttention: false,
      cashDrawerBlocking: false,
      balancePolicyRelevant: false,
      discountsCreditsActive: false,
      ...overrides,
    };
  }

  it('expands nothing when no signal is active', () => {
    expect(deriveAutoExpandPaymentSections(makeAutoExpandContext())).toEqual([]);
  });

  it('expands the workspace when a required action or leg details need attention', () => {
    expect(
      deriveAutoExpandPaymentSections(
        makeAutoExpandContext({ workspaceNeedsAttention: true })
      )
    ).toEqual([PAYMENT_MODAL_SECTION_IDS.PAYMENT_WORKSPACE]);
  });

  it('expands the cash drawer only while its session blocks submit', () => {
    expect(
      deriveAutoExpandPaymentSections(makeAutoExpandContext({ cashDrawerBlocking: true }))
    ).toEqual([PAYMENT_MODAL_SECTION_IDS.CASH_DRAWER]);
  });

  it('expands balance policy when a remaining balance needs a policy', () => {
    expect(
      deriveAutoExpandPaymentSections(
        makeAutoExpandContext({ balancePolicyRelevant: true })
      )
    ).toEqual([PAYMENT_MODAL_SECTION_IDS.BALANCE_POLICY]);
  });

  it('expands discounts/credits on gift-card or promo activity', () => {
    expect(
      deriveAutoExpandPaymentSections(
        makeAutoExpandContext({ discountsCreditsActive: true })
      )
    ).toEqual([PAYMENT_MODAL_SECTION_IDS.DISCOUNTS_CREDITS]);
  });

  it('returns every active signal in workbench order', () => {
    expect(
      deriveAutoExpandPaymentSections(
        makeAutoExpandContext({
          workspaceNeedsAttention: true,
          cashDrawerBlocking: true,
          balancePolicyRelevant: true,
          discountsCreditsActive: true,
        })
      )
    ).toEqual([
      PAYMENT_MODAL_SECTION_IDS.PAYMENT_WORKSPACE,
      PAYMENT_MODAL_SECTION_IDS.DISCOUNTS_CREDITS,
      PAYMENT_MODAL_SECTION_IDS.CASH_DRAWER,
      PAYMENT_MODAL_SECTION_IDS.BALANCE_POLICY,
    ]);
  });
});
