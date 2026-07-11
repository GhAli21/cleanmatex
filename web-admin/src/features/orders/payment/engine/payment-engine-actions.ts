/**
 * Typed engine-action facade (bridge to L1 of the composable payment system).
 *
 * `usePaymentEngine` is the single source of truth for payment state,
 * derivations, validation, guards, and the submit payload. It exposes many
 * loose handlers. This facade groups the *actions* capabilities are allowed to
 * call into one coherent, discoverable, typed surface — so capability dialogs
 * (Phase 3) depend on a stable action contract, never on the engine's internal
 * shape, and never re-implement finance logic.
 *
 * Every action type is derived from the engine's own return type via indexed
 * access, so a signature change in the engine surfaces here as a type error
 * rather than silent drift. This module adds **no behavior** — it is a pure
 * re-mapping of existing handlers.
 *
 * See `docs/features/Order_Fin/Payment_Modal_08_07_2026/`.
 */

import type { usePaymentEngine } from '@features/orders/hooks/use-payment-engine';

/**
 * The full engine return shape (state + derivations + actions).
 */
export type PaymentEngine = ReturnType<typeof usePaymentEngine>;

/**
 * The subset of engine handlers capabilities may invoke. State and derivations
 * are read from the engine directly; only *actions* are funnelled through here.
 * Types are indexed off {@link PaymentEngine} so they stay in lockstep.
 */
export interface PaymentEngineActions {
  // ---- methods & legs ----
  selectMethod: PaymentEngine['handleMethodSelect'];
  cycleActiveLeg: PaymentEngine['cycleActiveLeg'];
  fillLegRemaining: PaymentEngine['fillLegRemaining'];
  pressKeypad: PaymentEngine['handleKeypadPress'];
  // ---- leg editing (split-tender capability; H2 extension, Phase 3) ----
  setActiveLegIndex: PaymentEngine['legs']['setActiveLegIndex'];
  updateLeg: PaymentEngine['legs']['updateLeg'];
  /** Guarded add — refuses new legs that cannot accept amount (prevent-at-add). */
  addLeg: PaymentEngine['addPaymentLeg'];
  removeLegAt: PaymentEngine['legs']['removeLegAt'];
  // ---- cash drawer (drawer-selector capability; H2 extension, Phase 3) ----
  selectCashDrawerSession: PaymentEngine['cashDrawer']['setSelectedCashDrawerSessionId'];
  persistPreferredCashDrawerId: PaymentEngine['cashDrawer']['persistPreferredCashDrawerId'];
  openCashDrawerDialog: PaymentEngine['cashDrawer']['handleOpenCashDrawerDialog'];
  createCashDrawerSession: PaymentEngine['cashDrawer']['handleCreateCashDrawerSession'];
  // ---- gift card & promo ----
  fetchGiftCardDetails: PaymentEngine['handleFetchGiftCardDetails'];
  applyGiftCard: PaymentEngine['handleApplyGiftCard'];
  clearGiftCard: PaymentEngine['handleClearGiftCard'];
  // ---- gift-card PIN (gift-card capability; H2 extension, Phase 3) ----
  setGiftCardPin: PaymentEngine['giftPromo']['setGiftCardPin'];
  setGiftCardPinVisible: PaymentEngine['giftPromo']['setPinVisible'];
  setGiftCardPinError: PaymentEngine['giftPromo']['setPinFieldError'];
  validatePromoCode: PaymentEngine['handleValidatePromoCode'];
  clearPromoCode: PaymentEngine['handleClearPromoCode'];
  clearPromoCodeError: PaymentEngine['handleClearPromoCodeError'];
  // ---- customer credit / credit note ----
  selectCustomerCredit: PaymentEngine['handleCustomerCreditSelect'];
  selectCreditNote: PaymentEngine['handleCreditNoteSelect'];
  // ---- B2B / AR policy ----
  changeOutstandingPolicy: PaymentEngine['handleOutstandingPolicyChange'];
  // ---- overpayment routing ----
  setExtraReceiptDialogOpen: PaymentEngine['setExtraReceiptDialogOpen'];
  confirmExtraReceiptSelection: PaymentEngine['confirmExtraReceiptSelection'];
  setPayExtraIntent: PaymentEngine['setPayExtraIntent'];
  // ---- validation ----
  validatePayment: PaymentEngine['runValidatePayment'];
}

/**
 * Projects the engine's handlers into the {@link PaymentEngineActions} facade.
 * Pure mapping — no behavior change except `addLeg`, which binds the
 * prevent-at-add guarded {@link PaymentEngine.addPaymentLeg}.
 *
 * @param engine - The `usePaymentEngine` return value.
 * @returns The grouped, typed action surface.
 */
export function toPaymentEngineActions(
  engine: PaymentEngine,
): PaymentEngineActions {
  return {
    selectMethod: engine.handleMethodSelect,
    cycleActiveLeg: engine.cycleActiveLeg,
    fillLegRemaining: engine.fillLegRemaining,
    pressKeypad: engine.handleKeypadPress,
    setActiveLegIndex: engine.legs.setActiveLegIndex,
    updateLeg: engine.legs.updateLeg,
    addLeg: engine.addPaymentLeg,
    removeLegAt: engine.legs.removeLegAt,
    selectCashDrawerSession: engine.cashDrawer.setSelectedCashDrawerSessionId,
    persistPreferredCashDrawerId: engine.cashDrawer.persistPreferredCashDrawerId,
    openCashDrawerDialog: engine.cashDrawer.handleOpenCashDrawerDialog,
    createCashDrawerSession: engine.cashDrawer.handleCreateCashDrawerSession,
    fetchGiftCardDetails: engine.handleFetchGiftCardDetails,
    applyGiftCard: engine.handleApplyGiftCard,
    clearGiftCard: engine.handleClearGiftCard,
    setGiftCardPin: engine.giftPromo.setGiftCardPin,
    setGiftCardPinVisible: engine.giftPromo.setPinVisible,
    setGiftCardPinError: engine.giftPromo.setPinFieldError,
    validatePromoCode: engine.handleValidatePromoCode,
    clearPromoCode: engine.handleClearPromoCode,
    clearPromoCodeError: engine.handleClearPromoCodeError,
    selectCustomerCredit: engine.handleCustomerCreditSelect,
    selectCreditNote: engine.handleCreditNoteSelect,
    changeOutstandingPolicy: engine.handleOutstandingPolicyChange,
    setExtraReceiptDialogOpen: engine.setExtraReceiptDialogOpen,
    confirmExtraReceiptSelection: engine.confirmExtraReceiptSelection,
    setPayExtraIntent: engine.setPayExtraIntent,
    validatePayment: engine.runValidatePayment,
  };
}
