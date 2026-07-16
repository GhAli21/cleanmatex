'use client';

/**
 * Payment-leg state, mutators, and reconciliation for Payment Modal V4.
 *
 * Verbatim extraction of the modal's **legs** concern (previously inline in
 * `payment-modal-v4.tsx`): the `paymentLegs` array plus `activeLegIndex` /
 * `activeAmountDraft` editor state, the `payExtraIntentRef` /
 * `activeLegDraftSyncKeyRef` / `allocationBaselineRef` refs, the three core leg
 * mutators (`removeLegAt`, `updateLeg`, `upsertSettlementLeg`), the totals-change
 * reconciliation effect, and the active-leg draft-sync effect. Two **additive**
 * surfaces are designed in now but left unwired (Phase 3 consumes them, like the
 * catalog's `isError`/`refetch`): an always-append `addLeg` (multi-leg / card1+card2
 * seam) and a pure `quickTender(...)` (exact / direct-change-entry seam).
 *
 * Scope (Phase 2D, program plan `:1334-1554, 2621-2679, 3401-3465`): this hook owns
 * the **state + mutators + the two leg effects + this slice's open-reset**. The
 * handlers that read post-`payExtra` values or stored-value/catalog state
 * (`handleMethodSelect`, `handleCustomerCreditSelect`, `handleCreditNoteSelect`,
 * `handleKeypadPress`, `fillLegRemaining`, `cycleActiveLeg`, `notifyIfLegAmountCapped`)
 * stay in the component for now and drive this slice through the returned
 * mutators/setters; the engine threads them at composition time (Phase 2G).
 *
 * The `payExtraIntentRef` bridge (the crux): `paymentLegs` feeds `useMoneyDerivations`
 * → `usePayExtraCheckout` → `payExtraIntent`, but the mutators (defined before
 * `usePayExtraCheckout`) need `payExtraIntent` at call-time. The hook **owns and
 * returns** `payExtraIntentRef`; the component keeps the render-time bridge
 * `legs.payExtraIntentRef.current = payExtraIntent;` after `usePayExtraCheckout`
 * resolves, and the mutators read `.current` at call-time. Behavior identical.
 *
 * Behavior freeze: mutator bodies, the leg-construction shapes, the effect bodies,
 * and the effect dependency arrays stay byte-equivalent to the original inline code.
 * The only deliberate (behavior-equivalent) change vs the inline original: this
 * slice's `open`-reset runs at render-time (Pattern A) instead of in the component's
 * big reset effect — the clean fix the repo prescribes for
 * `react-hooks/set-state-in-effect`. The reconciliation + draft-sync effects keep
 * their setState calls; both are **ref-anchored** (the `allocationBaselineRef.current`
 * / `activeLegDraftSyncKeyRef.current` mutations precede each setState), so
 * `set-state-in-effect` does not fire — verified by probe; keep the anchors.
 *
 * See `docs/features/Order_Fin/Payment_Modal_Review/`.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { PAYMENT_METHODS } from '@/lib/constants/order-types';
import type { PaymentLeg } from '@/lib/validations/new-order-payment-schemas';
import {
  resolvePaymentOverpaymentPolicy,
  resolveSupportsRetainedOverpayment,
} from '@/lib/payments/overpayment-policy';
import { cmxMessage } from '@ui/feedback';
import {
  deriveCashTenderedAmount,
  deriveLegAppliedAmount,
  formatDecimalDraft,
  parseDecimalDraft,
  quickTender,
  reconcilePaymentLegAmounts,
  sanitizeDecimalDraft,
  type QuickTenderInput,
  type QuickTenderResult,
  type QuickTenderPolicy,
} from '@features/orders/ui/payment-modal-v4.utils';

// Re-export the pure quick-tender helper + its types from the legs slice's public API
// (the function itself lives in the utils module so it stays jest-testable without the
// hook's cmxMessage import chain).
export { quickTender };
export type { QuickTenderInput, QuickTenderResult, QuickTenderPolicy };
import {
  GATEWAY_METHOD_CODES,
  type CheckoutSettlementOption,
} from '@features/orders/hooks/use-payment-catalog';

/**
 * Minimal translate signature compatible with next-intl's `useTranslations`.
 */
export type PaymentLegsTranslate = (
  key: string,
  params?: Record<string, string | number>
) => string;

/**
 * Resolves a `(methodCode, gatewayCode?)` pair to its settlement option — the
 * `getMethodOption` resolver produced by the catalog slice.
 */
export type GetMethodOption = (
  methodCode: string,
  gatewayCode?: string | null
) => CheckoutSettlementOption | undefined;

/**
 * Inputs threaded from the modal. The catalog resolver, the stored-value cap
 * resolver, the focus helper, the totals/gift values, and the dirty-flag setter stay
 * component/engine-owned; this hook owns the leg state itself.
 */
export interface UsePaymentLegsParams {
  /** Gates the slice `open`-reset + reconciliation effect; matches the modal `open` flag. */
  open: boolean;
  /** Catalog resolver (`getMethodOption`). */
  getMethodOption: GetMethodOption;
  /** Stored-value cap resolver for a leg (`getLegStoredValueCap`). */
  getLegStoredValueCap: (leg: PaymentLeg) => number | undefined;
  /** Expands + scrolls + focuses the amount editor (refs/scroll/focus stay in the view). */
  focusAmountEditor: () => void;
  /** Resolved sale total (from totals). */
  saleTotal: number;
  /** Gift-card settlement amount applied to the order (from gift/totals). */
  giftCardSettlementAmount: number;
  /** Currency decimal places (from `currencyConfig`). */
  decimalPlaces: number;
  /** Marks the modal dirty since open (the mutators set it). */
  setIsDirtySinceOpen: (dirty: boolean) => void;
  /** `newOrder.payment` translate function (reconciliation notice). */
  t: PaymentLegsTranslate;
}

/**
 * Payment-leg state, mutators, reconciliation, and the additive `addLeg` /
 * `quickTender` seams for Payment Modal V4.
 *
 * @param params - {@link UsePaymentLegsParams}.
 * @param params.open - Gates the slice `open`-reset + reconciliation effect.
 * @param params.getMethodOption - Catalog resolver.
 * @param params.getLegStoredValueCap - Stored-value cap resolver for a leg.
 * @param params.focusAmountEditor - Expands/scrolls/focuses the amount editor.
 * @param params.saleTotal - Resolved sale total.
 * @param params.giftCardSettlementAmount - Gift-card settlement amount.
 * @param params.decimalPlaces - Currency decimal places.
 * @param params.setIsDirtySinceOpen - Marks the modal dirty since open.
 * @param params.t - `newOrder.payment` translate function.
 * @returns The leg state + setters, `activeLeg`, the three mutators, the additive
 *   `addLeg` / `quickTender` seams, and the `payExtraIntentRef` bridge.
 */
export function usePaymentLegs({
  open,
  getMethodOption,
  getLegStoredValueCap,
  focusAmountEditor,
  saleTotal,
  giftCardSettlementAmount,
  decimalPlaces,
  setIsDirtySinceOpen,
  t,
}: UsePaymentLegsParams) {
  const [activeLegIndex, setActiveLegIndex] = useState(0);
  const [activeAmountDraft, setActiveAmountDraft] = useState('');
  const [paymentLegs, setPaymentLegs] = useState<PaymentLeg[]>([]);

  /** Latest pay-extra intent for leg upsert/update callbacks defined before usePayExtraCheckout. */
  const payExtraIntentRef = useRef(false);
  const activeLegDraftSyncKeyRef = useRef<string | null>(null);
  const allocationBaselineRef = useRef<{ saleTotal: number; giftCard: number } | null>(null);

  const activeLeg = paymentLegs[activeLegIndex] ?? null;

  // This slice's open-reset (each extracted hook owns its own reset). Done at
  // render-time via the prev-open transition pattern (react-effects-patterns §2,
  // Pattern A) rather than in the component's big reset effect. Behavior-equivalent:
  // every atom's initial value already equals its reset value, so the only observable
  // reset is when `open` flips true on a re-open. `activeAmountDraft` is cleared by
  // the draft-sync effect when `activeLeg` becomes null. `allocationBaselineRef` is
  // nulled by the reconciliation effect's `!open` branch.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setPaymentLegs([]);
      setActiveLegIndex(0);
    }
  }

  // Clear the editor draft at render-time when there is no active leg (was a
  // synchronous setState in the draft-sync effect's `!activeLeg` branch; moved out to
  // keep that effect lint-clean — same render-time clear pattern as use-payment-totals).
  // Self-terminating via the `!== ''` guard; the effect below still nulls the sync key.
  if (!activeLeg && activeAmountDraft !== '') {
    setActiveAmountDraft('');
  }

  const removeLegAt = useCallback((idx: number) => {
    setIsDirtySinceOpen(true);
    setPaymentLegs((prev) => {
      const next = prev.filter((_, currentIdx) => currentIdx !== idx);
      return next;
    });
    // Allow clearing the last leg (empty split). Clamp to 0 when the list is empty.
    setActiveLegIndex((prev) => {
      if (prev > idx) return prev - 1;
      if (prev === idx) return Math.max(0, prev - 1);
      return prev;
    });
  }, [setIsDirtySinceOpen]);

  const updateLeg = useCallback(<K extends keyof PaymentLeg>(idx: number, key: K, value: PaymentLeg[K]) => {
    setIsDirtySinceOpen(true);
    setPaymentLegs((prev) => {
      const target = prev[idx];
      if (!target) return prev;
      const updated = [...prev];

      if (key === 'amount' && typeof value === 'number') {
        const option = getMethodOption(target.method, target.gateway_code);
        const policy = resolvePaymentOverpaymentPolicy({
          paymentMethodCode: target.method,
          supportsChangeReturn: option?.supports_change_return,
          supportsOverpayment: option?.supports_overpayment,
          requiresCashDrawer: option?.requires_cash_drawer,
        });
        const appliedAmount = deriveLegAppliedAmount({
          rawAmount: value,
          paymentLegs: prev,
          legIndex: idx,
          saleTotal,
          giftCardAmount: giftCardSettlementAmount,
          decimalPlaces,
          walletBalance: getLegStoredValueCap(target),
          supportsOverpayment: resolveSupportsRetainedOverpayment({
            payExtraIntent: payExtraIntentRef.current,
            policy,
          }),
        });
        const cashTendered = policy.isCash
          ? deriveCashTenderedAmount(value, appliedAmount, policy.supportsChangeReturn, decimalPlaces)
          : undefined;

        updated[idx] = {
          ...target,
          amount: appliedAmount,
          ...(policy.isCash ? { cashTendered } : { cashTendered: undefined }),
        };
        return updated;
      }

      updated[idx] = { ...updated[idx], [key]: value };
      return updated;
    });
  }, [decimalPlaces, getLegStoredValueCap, getMethodOption, giftCardSettlementAmount, saleTotal, setIsDirtySinceOpen]);

  const upsertSettlementLeg = useCallback(
    (option: CheckoutSettlementOption, defaultAmount: number) => {
      // If this method already has a leg, only activate it — never overwrite
      // amount / cashTendered the cashier already entered.
      const existingIndex = paymentLegs.findIndex(
        (leg) =>
          leg.method === option.payment_method_code &&
          (leg.gateway_code ?? '') === (option.gateway_code ?? '')
      );
      if (existingIndex >= 0) {
        setActiveLegIndex(existingIndex);
        focusAmountEditor();
        return;
      }

      setIsDirtySinceOpen(true);
      setPaymentLegs((prev) => {
        const targetIndex = prev.length;
        const policy = resolvePaymentOverpaymentPolicy({
          paymentMethodCode: option.payment_method_code,
          supportsChangeReturn: option.supports_change_return,
          supportsOverpayment: option.supports_overpayment,
          requiresCashDrawer: option.requires_cash_drawer,
        });
        const nextAmount = deriveLegAppliedAmount({
          rawAmount: defaultAmount,
          paymentLegs: prev,
          legIndex: targetIndex,
          saleTotal,
          giftCardAmount: giftCardSettlementAmount,
          decimalPlaces,
          walletBalance: getLegStoredValueCap({
            method: option.payment_method_code as PaymentLeg['method'],
            amount: defaultAmount,
          }),
          supportsOverpayment: resolveSupportsRetainedOverpayment({
            payExtraIntent: payExtraIntentRef.current,
            policy,
          }),
        });
        const nextLeg: PaymentLeg = {
          legRef: crypto.randomUUID(),
          method: option.payment_method_code as PaymentLeg['method'],
          amount: nextAmount,
          ...(policy.isCash ? { cashTendered: nextAmount } : {}),
          ...(GATEWAY_METHOD_CODES.includes(option.payment_method_code)
            ? { gateway_code: option.gateway_code ?? undefined }
            : {}),
        };

        const legEpsilon = Math.pow(10, -(decimalPlaces + 1));
        const allPlaceholdersZero =
          prev.length > 0 && prev.every((leg) => (leg.amount ?? 0) <= legEpsilon);

        if (allPlaceholdersZero || (prev.length === 1 && (prev[0].amount ?? 0) <= legEpsilon)) {
          setActiveLegIndex(0);
          return [nextLeg];
        }

        setActiveLegIndex(prev.length);
        return [...prev, nextLeg];
      });
      focusAmountEditor();
    },
    [
      decimalPlaces,
      focusAmountEditor,
      getLegStoredValueCap,
      giftCardSettlementAmount,
      paymentLegs,
      saleTotal,
      setIsDirtySinceOpen,
    ]
  );

  // Additive seam (#3 — multi-leg same method / card1+card2): always-append sibling
  // of `upsertSettlementLeg` that mints a fresh `legRef`-keyed leg with no dedupe, for
  // instance-capable methods (CARD/terminal). Unwired in 2D — wiring it makes
  // multi-card a post-2G UI change only. Construction mirrors the upsert "append"
  // branch byte-for-byte so a future multi-card path stays behavior-consistent.
  const addLeg = useCallback(
    (option: CheckoutSettlementOption, defaultAmount: number) => {
      setIsDirtySinceOpen(true);
      // Compute next index from current legs — never call setActiveLegIndex inside
      // the setPaymentLegs updater (can race and leave focus on the first leg).
      const nextIndex = paymentLegs.length;
      const policy = resolvePaymentOverpaymentPolicy({
        paymentMethodCode: option.payment_method_code,
        supportsChangeReturn: option.supports_change_return,
        supportsOverpayment: option.supports_overpayment,
        requiresCashDrawer: option.requires_cash_drawer,
      });
      const nextAmount = deriveLegAppliedAmount({
        rawAmount: defaultAmount,
        paymentLegs,
        legIndex: nextIndex,
        saleTotal,
        giftCardAmount: giftCardSettlementAmount,
        decimalPlaces,
        walletBalance: getLegStoredValueCap({
          method: option.payment_method_code as PaymentLeg['method'],
          amount: defaultAmount,
        }),
        supportsOverpayment: resolveSupportsRetainedOverpayment({
          payExtraIntent: payExtraIntentRef.current,
          policy,
        }),
      });
      const nextLeg: PaymentLeg = {
        legRef: crypto.randomUUID(),
        method: option.payment_method_code as PaymentLeg['method'],
        amount: nextAmount,
        ...(policy.isCash ? { cashTendered: nextAmount } : {}),
        ...(GATEWAY_METHOD_CODES.includes(option.payment_method_code)
          ? { gateway_code: option.gateway_code ?? undefined }
          : {}),
      };
      setPaymentLegs((prev) => [...prev, nextLeg]);
      setActiveLegIndex(nextIndex);
      setActiveAmountDraft(formatDecimalDraft(nextAmount, decimalPlaces));
      focusAmountEditor();
    },
    [
      decimalPlaces,
      focusAmountEditor,
      getLegStoredValueCap,
      giftCardSettlementAmount,
      paymentLegs,
      saleTotal,
      setIsDirtySinceOpen,
    ]
  );

  // Re-cap leg amounts when the sale total or applied gift card changes after legs
  // exist. This is a genuine effect: it reacts to external totals changes AND fires a
  // `cmxMessage` toast, which cannot run during render — so the re-cap `setPaymentLegs`
  // must stay in the effect (a scoped disable, not a render-time pattern). Verbatim
  // lift of the component's reconciliation effect (behavior-frozen).
  useEffect(() => {
    if (!open) {
      allocationBaselineRef.current = null;
      return;
    }

    const epsilon = Math.pow(10, -(decimalPlaces + 1));
    const previous = allocationBaselineRef.current;

    if (previous !== null && paymentLegs.length > 0) {
      const saleTotalChanged = Math.abs(previous.saleTotal - saleTotal) > epsilon;
      const giftCardChanged = Math.abs(previous.giftCard - giftCardSettlementAmount) > epsilon;

      if (saleTotalChanged || giftCardChanged) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- re-cap is coupled to the cmxMessage toast below; must remain in the effect
        setPaymentLegs((prevLegs) =>
          reconcilePaymentLegAmounts(prevLegs, saleTotal, giftCardSettlementAmount, decimalPlaces)
        );
        cmxMessage.info(t('messages.totalsAdjusted'));
      }
    }

    allocationBaselineRef.current = { saleTotal, giftCard: giftCardSettlementAmount };
  }, [decimalPlaces, giftCardSettlementAmount, open, paymentLegs.length, saleTotal, t]);

  // Keep the amount-editor draft in sync with the active leg. Ref-anchored: the
  // `activeLegDraftSyncKeyRef.current = …` write precedes each `setActiveAmountDraft`,
  // so `set-state-in-effect` does not fire — keep the anchor.
  useEffect(() => {
    if (!activeLeg) {
      // Draft is cleared at render-time (above); here we only reset the sync key.
      activeLegDraftSyncKeyRef.current = null;
      return;
    }

    const activeLegDraftSyncKey = `${activeLegIndex}:${activeLeg.method}:${activeLeg.gateway_code ?? ''}`;
    const draftSourceAmount =
      activeLeg.method === PAYMENT_METHODS.CASH
        ? activeLeg.cashTendered ?? activeLeg.amount ?? 0
        : activeLeg.amount ?? 0;
    const normalizedLegDraft = formatDecimalDraft(draftSourceAmount, decimalPlaces);
    const normalizedCurrentDraft = sanitizeDecimalDraft(activeAmountDraft, decimalPlaces);
    const currentDraftAmount = parseDecimalDraft(normalizedCurrentDraft);
    const legAmount = draftSourceAmount;
    const sameLeg = activeLegDraftSyncKeyRef.current === activeLegDraftSyncKey;
    const draftMatchesSameLegAmount = sameLeg && currentDraftAmount === legAmount;

    activeLegDraftSyncKeyRef.current = activeLegDraftSyncKey;

    if (draftMatchesSameLegAmount) {
      return;
    }

    // Verbatim lift: the editor draft is derived from the active leg here (the
    // "no active leg" clear is handled at render-time above). Reproducing the
    // original ref-keyed sync at render-time would mutate the sync-key ref during
    // render (StrictMode double-invoke unsafe) and shift the high-frequency keypad
    // sync earlier — so this stays a (scoped-disabled) effect to preserve behavior.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- behavior-frozen ref-keyed draft sync; render-time would change keypad timing
    setActiveAmountDraft(normalizedLegDraft);
  }, [activeAmountDraft, activeLeg, activeLegIndex, decimalPlaces]);

  return {
    paymentLegs,
    setPaymentLegs,
    activeLegIndex,
    setActiveLegIndex,
    activeAmountDraft,
    setActiveAmountDraft,
    activeLeg,
    removeLegAt,
    updateLeg,
    upsertSettlementLeg,
    /** Additive seam (#3): always-append leg variant for multi-card. Unwired in 2D. */
    addLeg,
    /** Additive pure seam (#2-capable): exact / direct-change-entry. Unwired in 2D. */
    quickTender,
    /** Bridge: the component sets `.current = payExtraIntent` after usePayExtraCheckout. */
    payExtraIntentRef,
  };
}
