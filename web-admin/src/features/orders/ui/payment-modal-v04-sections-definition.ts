/**
 * Payment Modal V4 workbench section definitions.
 *
 * The modal uses this small config layer so layout decisions stay testable and
 * future card moves do not require editing finance or submit-flow logic.
 */

export const PAYMENT_MODAL_SECTION_IDS = {
  BALANCE_SNAPSHOT: 'BALANCE_SNAPSHOT',
  AMOUNT_EDITOR: 'AMOUNT_EDITOR',
  PAYMENT_WORKSPACE: 'PAYMENT_WORKSPACE',
  DISCOUNTS_CREDITS: 'DISCOUNTS_CREDITS',
  CASH_DRAWER: 'CASH_DRAWER',
  FINANCIAL_INSPECTOR: 'FINANCIAL_INSPECTOR',
  BALANCE_POLICY: 'BALANCE_POLICY',
} as const;

/**
 * Stable identifiers used by the workbench config and focus shortcuts.
 */
export type PaymentModalSectionId =
  (typeof PAYMENT_MODAL_SECTION_IDS)[keyof typeof PAYMENT_MODAL_SECTION_IDS];

export const PAYMENT_MODAL_INSPECTOR_TAB_IDS = {
  ORDER_VALUE: 'ORDER_VALUE',
  TAX_BREAKDOWN: 'TAX_BREAKDOWN',
  DISCOUNTS: 'DISCOUNTS',
  WARNINGS: 'WARNINGS',
  B2B_AR: 'B2B_AR',
  PAYMENT_NOTES: 'PAYMENT_NOTES',
} as const;

/**
 * Stable identifiers for tabs inside the center Financial Inspector.
 */
export type PaymentModalInspectorTabId =
  (typeof PAYMENT_MODAL_INSPECTOR_TAB_IDS)[keyof typeof PAYMENT_MODAL_INSPECTOR_TAB_IDS];

/**
 * Static metadata for each center workbench section.
 */
export interface PaymentModalSectionDefinition {
  id: PaymentModalSectionId;
  labelKey: string;
  order: number;
  defaultExpanded: boolean;
}

/**
 * Visibility inputs intentionally use already-derived modal state.
 */
export interface PaymentModalSectionVisibilityContext {
  hasActivePaymentLeg: boolean;
  showDeferredExplanation: boolean;
  discountsEnabled: boolean;
  hasDiscountsApplied: boolean;
  hasPromoActivity: boolean;
  hasGiftCardActivity: boolean;
  hasCashLeg: boolean;
  showBalancePolicy: boolean;
}

/**
 * Inputs for building the financial inspector tabs.
 */
export interface PaymentModalInspectorTabContext {
  hasTaxBreakdown: boolean;
  hasDiscountBreakdown: boolean;
  hasWarnings: boolean;
  isB2B: boolean;
}

export const PAYMENT_MODAL_V04_SECTIONS = [
  {
    id: PAYMENT_MODAL_SECTION_IDS.BALANCE_SNAPSHOT,
    labelKey: 'sections.balanceSnapshot',
    order: 10,
    defaultExpanded: true,
  },
  {
    id: PAYMENT_MODAL_SECTION_IDS.AMOUNT_EDITOR,
    labelKey: 'sections.amountEditor',
    order: 20,
    defaultExpanded: true,
  },
  {
    id: PAYMENT_MODAL_SECTION_IDS.PAYMENT_WORKSPACE,
    labelKey: 'sections.paymentWorkspace',
    order: 30,
    defaultExpanded: true,
  },
  {
    id: PAYMENT_MODAL_SECTION_IDS.DISCOUNTS_CREDITS,
    labelKey: 'sections.discountsCredits',
    order: 40,
    defaultExpanded: true,
  },
  {
    id: PAYMENT_MODAL_SECTION_IDS.CASH_DRAWER,
    labelKey: 'sections.cashDrawer',
    order: 50,
    defaultExpanded: true,
  },
  {
    id: PAYMENT_MODAL_SECTION_IDS.FINANCIAL_INSPECTOR,
    labelKey: 'sections.financialInspector',
    order: 60,
    defaultExpanded: true,
  },
  {
    id: PAYMENT_MODAL_SECTION_IDS.BALANCE_POLICY,
    labelKey: 'sections.balancePolicy',
    order: 70,
    defaultExpanded: true,
  },
] as const satisfies readonly PaymentModalSectionDefinition[];

/**
 * Derives visible center sections from UI state without recalculating money.
 *
 * @param context Already-derived modal flags used only for layout visibility.
 * @returns Ordered section definitions for the center workbench.
 */
export function deriveVisiblePaymentSections(
  context: PaymentModalSectionVisibilityContext
): PaymentModalSectionDefinition[] {
  return PAYMENT_MODAL_V04_SECTIONS.filter((section) => {
    switch (section.id) {
      case PAYMENT_MODAL_SECTION_IDS.AMOUNT_EDITOR:
        return context.hasActivePaymentLeg && !context.showDeferredExplanation;
      case PAYMENT_MODAL_SECTION_IDS.DISCOUNTS_CREDITS:
        return (
          context.discountsEnabled ||
          context.hasDiscountsApplied ||
          context.hasPromoActivity ||
          context.hasGiftCardActivity
        );
      case PAYMENT_MODAL_SECTION_IDS.CASH_DRAWER:
        return context.hasCashLeg;
      case PAYMENT_MODAL_SECTION_IDS.BALANCE_POLICY:
        return context.showBalancePolicy;
      default:
        return true;
    }
  }).sort((left, right) => left.order - right.order);
}

/**
 * Keeps the inspector tab set compact while preserving payment notes access.
 *
 * @param context Already-derived modal flags used only for tab visibility.
 * @returns Ordered tab identifiers for the Financial Inspector section.
 */
export function derivePaymentInspectorTabs(
  context: PaymentModalInspectorTabContext
): PaymentModalInspectorTabId[] {
  const tabs: PaymentModalInspectorTabId[] = [
    PAYMENT_MODAL_INSPECTOR_TAB_IDS.ORDER_VALUE,
  ];

  if (context.hasTaxBreakdown) {
    tabs.push(PAYMENT_MODAL_INSPECTOR_TAB_IDS.TAX_BREAKDOWN);
  }

  if (context.hasDiscountBreakdown) {
    tabs.push(PAYMENT_MODAL_INSPECTOR_TAB_IDS.DISCOUNTS);
  }

  if (context.hasWarnings) {
    tabs.push(PAYMENT_MODAL_INSPECTOR_TAB_IDS.WARNINGS);
  }

  if (context.isB2B) {
    tabs.push(PAYMENT_MODAL_INSPECTOR_TAB_IDS.B2B_AR);
  }

  tabs.push(PAYMENT_MODAL_INSPECTOR_TAB_IDS.PAYMENT_NOTES);

  return tabs;
}
