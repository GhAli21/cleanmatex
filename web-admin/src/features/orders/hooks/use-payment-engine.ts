'use client';

/**
 * Payment Modal v4 — composition engine (Phase 2G-1).
 *
 * `usePaymentEngine` composes the seven extracted concern slices
 * (`useGiftCardAndPromo`, `usePaymentTotals`, `usePaymentCatalog`,
 * `usePaymentLegs`, `useMoneyDerivations`, `usePayExtraCheckout`,
 * `useCashDrawer`) together with every **cross-slice derivation** and the
 * **non-DOM handlers** that previously lived inline in `payment-modal-v4.tsx`
 * (≈ lines 515–2475 of the pre-2G modal). It is the single logic core the
 * Full-view (Phase 2G-2) and the Simple/Full mode switch (Phase 4) both consume.
 *
 * Boundary (per the 2G execution spec):
 * - **Engine (here):** the 7 slices, the `payExtraIntentRef` bridge, the
 *   cross-slice derivations (`giftCardSettlementAmount`, `cashDrawerRequired`,
 *   `editableLegEntries`, `validationItems`, `rightRailState`,
 *   `effectiveOutstandingPolicy`, `needsAdvanced`, …) and the render-independent
 *   handlers (`handleMethodSelect`, `handleCustomerCreditSelect`,
 *   `handleCreditNoteSelect`, the gift/promo async handlers,
 *   `handleOutstandingPolicyChange`, `handleKeypadPress`, `cycleActiveLeg`,
 *   `fillLegRemaining`).
 * - **View / shell (caller):** the RHF form, `currencyConfig` load + open-reset,
 *   submit orchestration, the DOM refs, focus/scroll helpers, section state and
 *   the entire JSX. Refs the slices consume (`pinInputRef`, the gift-card detail
 *   refs) and `focusAmountEditor` are **created in the view and threaded in**.
 *
 * Behavior freeze + payload identity are hard constraints: the hook order,
 * effect bodies, dependency arrays and the render-time `payExtraIntentRef`
 * assignment are reproduced verbatim from the inline modal. The only structural
 * change is relocation — no logic was altered. The `computeNeedsAdvanced` wiring
 * is returned but **not yet consumed** (its consumer is the Phase 4 Simple mode),
 * mirroring how catalog `isError` shipped unused in Phase 2A.
 *
 * See `docs/features/Order_Fin/Payment_Modal_Review/`.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type RefObject,
  type SetStateAction,
} from 'react';
import { useQuery } from '@tanstack/react-query';
import type { FieldErrors, UseFormSetValue } from 'react-hook-form';
import { validatePromoCodeAction } from '@/app/actions/payments/validate-promo';
import { validateGiftCardAction } from '@/app/actions/payments/validate-gift-card';
import type { PaymentFormData } from '@features/orders/model/payment-form-schema';
import {
  toCanonicalLegMethod,
  type OutstandingPolicy,
  type PaymentLeg,
} from '@/lib/validations/new-order-payment-schemas';
import { cmxMessage } from '@ui/feedback';
import { NEW_ORDER_PROMO_GIFT_DISABLED } from '@/lib/constants/order-checkout-flags';
import { PAYMENT_METHODS } from '@/lib/constants/order-types';
import type { PaymentMethodCode } from '@/lib/constants/order-types';
import {
  applyKeypadInput,
  capPaymentLegAmount,
  deriveChangeReturnedAmount,
  deriveLegAppliedAmount,
  deriveOutstandingPolicy,
  formatDecimalDraft,
  getDisplayChangeAmount,
  getNetCashRetainedAmount,
  getRemainingToAllocate,
  getSuggestedDefaultLegAmount,
  getSuggestedStoredValueAmount,
  parseDecimalDraft,
  validateCheckDueDate,
  legHasRequiredPaymentReference,
  wasPaymentLegAmountCapped,
  getStoredValueCapForLeg,
  type PaymentKeypadKey,
} from '../ui/payment-modal-v4.utils';
import { usePayExtraCheckout } from '@features/orders/hooks/use-pay-extra-checkout';
import { useHasPermissionCode } from '@/lib/hooks/usePermissions';
import { OVERPAYMENT_RESOLUTION_PERMISSIONS } from '@/lib/constants/settlement-catalog';
import { useMoneyDerivations } from '@features/orders/hooks/use-money-derivations';
import { derivePaymentValidationItems } from '@features/orders/hooks/payment-validation';
import {
  usePaymentCatalog,
  IMMEDIATE_METHOD_CODES,
  type CheckoutSettlementOption,
} from '@features/orders/hooks/use-payment-catalog';
import { useGiftCardAndPromo } from '@features/orders/hooks/use-gift-card-and-promo';
import { usePaymentTotals } from '@features/orders/hooks/use-payment-totals';
import { usePaymentLegs } from '@features/orders/hooks/use-payment-legs';
import { useCashDrawer } from '@features/orders/hooks/use-cash-drawer';
import {
  resolvePaymentOverpaymentPolicy,
  resolveSupportsRetainedOverpayment,
} from '@/lib/payments/overpayment-policy';
import {
  derivePaymentModalRightRailState,
  type PaymentModalRightRailState,
} from '../ui/payment-modal-v4.right-rail';
import { computeNeedsAdvanced } from '@features/orders/hooks/payment-needs-advanced';

/**
 * Minimal translate signature compatible with next-intl's `useTranslations`.
 */
export type PaymentEngineTranslate = (
  key: string,
  params?: Record<string, string | number>
) => string;

/**
 * Currency configuration the engine reads (FX rate for the right rail, code +
 * decimals for formatting). Loaded by the shell and threaded in.
 */
export interface PaymentEngineCurrencyConfig {
  currencyCode: string;
  decimalPlaces: number;
  currencyExRate: number;
}

/**
 * Order line item used by the totals preview.
 */
export interface PaymentEngineItem {
  productId: string;
  quantity: number;
  priceOverride?: number | null;
  servicePrefCharge?: number;
  packingPrefCharge?: number;
}

/**
 * Customer stored-value summary (wallet, advance, credit notes) consumed by the
 * leg suggestion + live-balance derivations.
 */
export type StoredValueSummaryResponse = {
  wallet: {
    walletId: string | null;
    balance: number;
    currencyCode: string | null;
  };
  advance: {
    advanceId: string | null;
    balance: number;
    currencyCode: string | null;
  };
  creditNoteTotal: number;
  creditNotes: Array<{
    id: string;
    remaining_balance: number;
    currency_code: string;
  }>;
};

/**
 * Inputs threaded from the shell/view. Order context + the RHF form values the
 * slices consume, the DOM refs + `focusAmountEditor` the slices need, the
 * currency-derived formatters, the translate fns, and the small set of shared
 * state atoms the shell owns but the engine handlers mutate
 * (`isDirtySinceOpen`, the credit-note picker).
 */
export interface UsePaymentEngineParams {
  open: boolean;
  items: PaymentEngineItem[];
  tenantOrgId: string;
  branchId?: string;
  customerId?: string;
  customerType?: string;
  isExpress: boolean;
  isRetailOnlyOrder: boolean;
  isB2BCustomer: boolean;
  total: number;
  checkoutAmount?: number;
  userId?: string;
  serviceCategories?: string[];
  loading: boolean;
  defaultPaymentMethod: PaymentFormData['paymentMethod'];
  defaultOutstandingPolicy: OutstandingPolicy;
  isRTL: boolean;
  csrfToken: string | null | undefined;
  setValue: UseFormSetValue<PaymentFormData>;
  errors: FieldErrors<PaymentFormData>;
  paymentMethod: PaymentFormData['paymentMethod'];
  percentDiscount: PaymentFormData['percentDiscount'];
  amountDiscount: PaymentFormData['amountDiscount'];
  promoCode: PaymentFormData['promoCode'];
  giftCardNumber: PaymentFormData['giftCardNumber'];
  giftCardAmount: PaymentFormData['giftCardAmount'];
  outstandingPolicy: PaymentFormData['outstandingPolicy'];
  currencyConfig: PaymentEngineCurrencyConfig | null;
  currencyCode: string;
  decimalPlaces: number;
  formatAmount: (n: number) => string;
  focusAmountEditor: () => void;
  pinInputRef: RefObject<HTMLInputElement | null>;
  giftCardDetailsRef: RefObject<HTMLDivElement | null>;
  giftCardAmountInputRef: RefObject<HTMLInputElement | null>;
  creditLimitOverride: boolean;
  isDirtySinceOpen: boolean;
  setIsDirtySinceOpen: Dispatch<SetStateAction<boolean>>;
  pendingCreditNoteOption: CheckoutSettlementOption | null;
  setPendingCreditNoteOption: Dispatch<SetStateAction<CheckoutSettlementOption | null>>;
  setCreditNotePickerOpen: Dispatch<SetStateAction<boolean>>;
  t: PaymentEngineTranslate;
  tGiftCardErrors: PaymentEngineTranslate;
}

/**
 * Composes the Payment Modal v4 logic core from its concern slices and returns
 * grouped slices + cross-slice derivations + non-DOM handlers.
 *
 * @param params {@link UsePaymentEngineParams}.
 * @returns The grouped slice outputs (`catalog`, `giftPromo`, `totals`, `legs`,
 * `derivations`, `payExtra`, `cashDrawer`), the cross-slice view-model values,
 * and the render-independent handlers the view binds to.
 */
export function usePaymentEngine(params: UsePaymentEngineParams) {
  const {
    open,
    items,
    tenantOrgId,
    branchId,
    customerId,
    isExpress,
    isRetailOnlyOrder,
    isB2BCustomer,
    total,
    checkoutAmount,
    userId,
    serviceCategories,
    loading,
    defaultPaymentMethod,
    defaultOutstandingPolicy,
    isRTL,
    csrfToken,
    setValue,
    errors,
    paymentMethod,
    percentDiscount,
    amountDiscount,
    promoCode,
    giftCardNumber,
    giftCardAmount,
    outstandingPolicy,
    currencyConfig,
    currencyCode,
    decimalPlaces,
    formatAmount,
    focusAmountEditor,
    pinInputRef,
    giftCardDetailsRef,
    giftCardAmountInputRef,
    creditLimitOverride,
    isDirtySinceOpen,
    setIsDirtySinceOpen,
    pendingCreditNoteOption,
    setPendingCreditNoteOption,
    setCreditNotePickerOpen,
    t,
    tGiftCardErrors,
  } = params;

  const [cashOverRemainingNotice, setCashOverRemainingNotice] = useState<string | null>(null);

  // Dependency-ordered slices: gift/promo → totals → catalog. Totals reads the
  // applied promo/gift; catalog's checkout-options query key reads totals'
  // checkoutEligibilityAmount; walletCreditOption derives from catalog output.

  // Gift-card + promo state, error mapping, and reset/PIN-focus effects (Phase 2B).
  const giftPromo = useGiftCardAndPromo({
    open,
    giftCardNumber,
    setValue,
    pinInputRef,
    t,
    tGiftCardErrors,
  });
  const {
    promoCodeValidating,
    setPromoCodeValidating,
    promoCodeResult,
    setPromoCodeResult,
    appliedPromoCode,
    setAppliedPromoCode,
    giftCardValidating,
    setGiftCardValidating,
    giftCardResult,
    setGiftCardResult,
    giftCardDetails,
    setGiftCardDetails,
    appliedGiftCard,
    setAppliedGiftCard,
    giftCardPin,
    setGiftCardPin,
    pinRequired,
    setPinRequired,
    pinVisible,
    setPinVisible,
    pinFieldError,
    setPinFieldError,
    resolveGiftCardError,
  } = giftPromo;

  // Server-driven totals + tax breakdown (Phase 2C). Behavior-frozen.
  const totals = usePaymentTotals({
    open,
    items,
    tenantOrgId,
    branchId,
    customerId,
    isExpress,
    total,
    checkoutAmount,
    percentDiscount,
    amountDiscount,
    serviceCategories,
    appliedPromoCode,
    appliedGiftCard,
    decimalPlaces,
    csrfToken,
    t,
  });
  const {
    serverTotals,
    totalsLoading,
    totals: totalsModel,
    saleTotal,
    taxProfileEntries,
    displayTaxBreakdown,
    profilesTaxAmount,
    checkoutEligibilityAmount,
  } = totals;

  // Read-only payment catalog: card brands, branch terminals, and checkout
  // settlement options (real methods + customer credits) + the getMethodOption
  // resolver. Extracted to use-payment-catalog (Phase 2A); behavior-frozen.
  const catalog = usePaymentCatalog({
    open,
    tenantOrgId,
    branchId,
    customerId,
    checkoutEligibilityAmount,
    isRetailOnlyOrder,
    isRTL,
    t,
  });
  const {
    checkoutMethods,
    customerCreditOptions,
    checkoutMethodsLoading,
    creditMethodCodes,
    getMethodOption,
    getOptionDisplayName: getCheckoutOptionDisplayName,
  } = catalog;

  const walletCreditOption = customerCreditOptions.find(
    (option) =>
      option.credit_application_type === 'WALLET' ||
      option.payment_method_code === 'WALLET'
  );

  const {
    data: storedValueSummary,
    isLoading: storedValueLoading,
    isFetching: storedValueFetching,
    refetch: refetchStoredValueSummary,
  } = useQuery<StoredValueSummaryResponse | null>({
    queryKey: ['customer-stored-value-summary', tenantOrgId, customerId ?? ''],
    queryFn: async () => {
      if (!customerId) return null;
      const res = await fetch(`/api/v1/customers/${customerId}/stored-value`);
      if (!res.ok) {
        throw new Error('FAILED_TO_FETCH_STORED_VALUE_SUMMARY');
      }
      const json = await res.json();
      return (json.data ?? null) as StoredValueSummaryResponse | null;
    },
    enabled: open && !!customerId,
    staleTime: 15_000,
  });

  const giftCardSettlementAmount = NEW_ORDER_PROMO_GIFT_DISABLED ? 0 : (appliedGiftCard?.amount || 0);

  const liveWalletBalance = walletCreditOption
    ? storedValueSummary?.wallet.balance ?? walletCreditOption.available_balance ?? 0
    : 0;
  const liveWalletCurrencyCode =
    storedValueSummary?.wallet.currencyCode ??
    currencyCode;
  const walletBalanceLoaded = !!walletCreditOption && !storedValueLoading;
  const walletHasAvailableBalance = liveWalletBalance > 0.001;
  const liveWalletBalanceDisplay = `${liveWalletCurrencyCode} ${formatAmount(liveWalletBalance)}`;
  const liveAdvanceBalance = storedValueSummary?.advance.balance ?? 0;

  const getLegStoredValueCap = useCallback(
    (leg: PaymentLeg) => {
      const option = getMethodOption(leg.method, leg.gateway_code);
      const creditNoteBalance = leg.creditReferenceId
        ? storedValueSummary?.creditNotes.find((note) => note.id === leg.creditReferenceId)?.remaining_balance
        : undefined;
      return getStoredValueCapForLeg(leg.method, {
        walletBalance: leg.method === 'WALLET' ? liveWalletBalance : undefined,
        advanceBalance: leg.method === 'ADVANCE' ? liveAdvanceBalance : undefined,
        creditNoteBalance: leg.method === 'CREDIT_NOTE' ? creditNoteBalance : undefined,
        loyaltyBalance:
          leg.method === 'LOYALTY_POINTS' ? option?.available_balance ?? undefined : undefined,
      });
    },
    [getMethodOption, liveAdvanceBalance, liveWalletBalance, storedValueSummary?.creditNotes]
  );

  // Payment-leg state, mutators, reconciliation + draft-sync effects, and the
  // additive addLeg / quickTender seams (Phase 2D).
  const legs = usePaymentLegs({
    open,
    getMethodOption,
    getLegStoredValueCap,
    focusAmountEditor,
    saleTotal,
    giftCardSettlementAmount,
    decimalPlaces,
    setIsDirtySinceOpen,
    t,
  });
  const {
    paymentLegs,
    setPaymentLegs,
    activeLegIndex,
    setActiveLegIndex,
    activeAmountDraft,
    setActiveAmountDraft,
    activeLeg,
    updateLeg,
    upsertSettlementLeg,
    payExtraIntentRef,
  } = legs;

  // Sync the check-* form fields from the active/first check leg. Reads paymentLegs /
  // activeLegIndex (owned by usePaymentLegs), so it registers after the hook call.
  useEffect(() => {
    if (paymentMethod !== PAYMENT_METHODS.CHECK) {
      setValue('checkNumber', '', { shouldValidate: false, shouldDirty: false });
      setValue('checkBank', '', { shouldValidate: false, shouldDirty: false });
      setValue('checkDate', '', { shouldValidate: false, shouldDirty: false });
      return;
    }

    const activeCheckLeg =
      paymentLegs[activeLegIndex]?.method === PAYMENT_METHODS.CHECK
        ? paymentLegs[activeLegIndex]
        : paymentLegs.find((leg) => leg.method === PAYMENT_METHODS.CHECK);

    setValue('checkNumber', activeCheckLeg?.checkNumber ?? '', {
      shouldValidate: false,
      shouldDirty: false,
    });
    setValue('checkBank', activeCheckLeg?.checkBank ?? '', {
      shouldValidate: false,
      shouldDirty: false,
    });
    setValue('checkDate', activeCheckLeg?.checkDate ?? '', {
      shouldValidate: false,
      shouldDirty: false,
    });
  }, [activeLegIndex, paymentLegs, paymentMethod, setValue]);

  // Keep the form's default method/policy aligned until the cashier touches the modal.
  // Reads paymentLegs.length (owned by usePaymentLegs), so it registers after the hook.
  useEffect(() => {
    if (!open || isDirtySinceOpen || paymentLegs.length > 0) {
      return;
    }

    if (paymentMethod !== defaultPaymentMethod) {
      setValue('paymentMethod', defaultPaymentMethod, { shouldDirty: false });
    }

    if (outstandingPolicy !== defaultOutstandingPolicy) {
      setValue('outstandingPolicy', defaultOutstandingPolicy, { shouldDirty: false });
    }
  }, [
    defaultOutstandingPolicy,
    defaultPaymentMethod,
    isDirtySinceOpen,
    open,
    outstandingPolicy,
    paymentLegs.length,
    paymentMethod,
    setValue,
  ]);

  const handleCreditNoteSelect = useCallback(
    (noteId: string) => {
      const option = pendingCreditNoteOption;
      if (!option) return;
      const note = storedValueSummary?.creditNotes.find((entry) => entry.id === noteId);
      if (!note) return;

      setCreditNotePickerOpen(false);
      setPendingCreditNoteOption(null);
      setIsDirtySinceOpen(true);
      setPaymentLegs((prev) => {
        const existingIndex = prev.findIndex(
          (leg) => leg.method === 'CREDIT_NOTE' && leg.creditReferenceId === noteId
        );
        const fallbackIndex = prev.findIndex((leg) => leg.method === 'CREDIT_NOTE');
        const targetIndex =
          existingIndex >= 0 ? existingIndex : fallbackIndex >= 0 ? fallbackIndex : prev.length;
        const amount = getSuggestedStoredValueAmount(
          note.remaining_balance,
          prev,
          saleTotal,
          giftCardSettlementAmount,
          decimalPlaces,
          targetIndex < prev.length ? targetIndex : undefined
        );
        const nextLeg: PaymentLeg = {
          legRef:
            existingIndex >= 0
              ? prev[existingIndex].legRef ?? crypto.randomUUID()
              : fallbackIndex >= 0
                ? prev[fallbackIndex].legRef ?? crypto.randomUUID()
                : crypto.randomUUID(),
          method: 'CREDIT_NOTE',
          amount,
          creditReferenceId: noteId,
        };

        if (existingIndex >= 0) {
          const updated = [...prev];
          updated[existingIndex] = { ...updated[existingIndex], ...nextLeg };
          setActiveLegIndex(existingIndex);
          return updated;
        }
        if (fallbackIndex >= 0) {
          const updated = [...prev];
          updated[fallbackIndex] = { ...updated[fallbackIndex], ...nextLeg };
          setActiveLegIndex(fallbackIndex);
          return updated;
        }
        if (prev.length === 1 && (prev[0].amount ?? 0) === 0) {
          setActiveLegIndex(0);
          return [{ ...prev[0], ...nextLeg }];
        }
        setActiveLegIndex(prev.length);
        return [...prev, nextLeg];
      });
      focusAmountEditor();
    },
    [
      decimalPlaces,
      focusAmountEditor,
      giftCardSettlementAmount,
      pendingCreditNoteOption,
      saleTotal,
      storedValueSummary?.creditNotes,
      setCreditNotePickerOpen,
      setPendingCreditNoteOption,
      setIsDirtySinceOpen,
      setPaymentLegs,
      setActiveLegIndex,
    ]
  );

  const handleMethodSelect = useCallback(
    (option: CheckoutSettlementOption) => {
      setValue('paymentMethod', toCanonicalLegMethod(option.payment_method_code as PaymentMethodCode), { shouldDirty: true });
      const existingIndex = paymentLegs.findIndex(
        (leg) =>
          leg.method === option.payment_method_code &&
          (leg.gateway_code ?? '') === (option.gateway_code ?? '')
      );
      const suggestedAmount = getSuggestedDefaultLegAmount(
        paymentLegs,
        existingIndex >= 0 ? existingIndex : undefined,
        saleTotal,
        giftCardSettlementAmount,
        decimalPlaces
      );
      upsertSettlementLeg(option, suggestedAmount);
    },
    [decimalPlaces, giftCardSettlementAmount, paymentLegs, setValue, saleTotal, upsertSettlementLeg]
  );

  const handleCustomerCreditSelect = useCallback(
    (option: CheckoutSettlementOption) => {
      if (option.payment_method_code === 'CREDIT_NOTE') {
        if (storedValueLoading) {
          cmxMessage.info(t('customerCredits.loadingBalance'));
          return;
        }
        if (!storedValueSummary?.creditNotes.length) {
          cmxMessage.info(t('customerCredits.creditNotePickerEmpty'));
          return;
        }
        setPendingCreditNoteOption(option);
        setCreditNotePickerOpen(true);
        return;
      }
      if (option.requires_credit_reference_selection) {
        cmxMessage.info(t('customerCredits.referenceSelectionHint'));
        return;
      }
      const availableBalance =
        option.credit_application_type === 'WALLET' ||
        option.payment_method_code === 'WALLET'
          ? liveWalletBalance
          : option.payment_method_code === 'ADVANCE'
            ? liveAdvanceBalance
            : option.available_balance ?? 0;
      const existingIndex = paymentLegs.findIndex(
        (leg) => leg.method === option.payment_method_code
      );
      const suggestedAmount = getSuggestedStoredValueAmount(
        availableBalance,
        paymentLegs,
        saleTotal,
        giftCardSettlementAmount,
        decimalPlaces,
        existingIndex >= 0 ? existingIndex : undefined
      );
      upsertSettlementLeg(option, suggestedAmount);
    },
    [
      decimalPlaces,
      giftCardSettlementAmount,
      liveAdvanceBalance,
      liveWalletBalance,
      paymentLegs,
      saleTotal,
      storedValueLoading,
      storedValueSummary?.creditNotes.length,
      t,
      upsertSettlementLeg,
      setPendingCreditNoteOption,
      setCreditNotePickerOpen,
    ]
  );

  const {
    settlementLegEntries,
    realPaymentEntries,
    customerCreditEntries,
    payNowAmount,
    customerCreditAmount,
    settledNowAmount,
    cashLegAmount,
    cashTenderedAmount,
    totalSettledNowAmount,
    walletLegEntry,
    storedValueLegExceedance,
    walletLegExceedsLiveBalance,
    storedValueLegExceedsBalance,
    moneyEpsilon,
    remainingBalance,
    changeAmount,
    canReturnChangeFromCash,
    cashChangeAmount,
    cashChangeCapacity,
    legacyUnresolvedOverpaymentAmount,
    amountAppliedToOrder,
  } = useMoneyDerivations({
    paymentLegs,
    immediateMethodCodes: IMMEDIATE_METHOD_CODES,
    creditMethodCodes,
    getMethodOption,
    getLegStoredValueCap,
    saleTotal,
    giftCardSettlementAmount,
    decimalPlaces,
  });

  const notifyIfLegAmountCapped = useCallback(
    (leg: PaymentLeg, rawAmount: number, cappedAmount: number) => {
      const option = getMethodOption(leg.method, leg.gateway_code);
      const policy = resolvePaymentOverpaymentPolicy({
        paymentMethodCode: leg.method,
        supportsChangeReturn: option?.supports_change_return,
        supportsOverpayment: option?.supports_overpayment,
        requiresCashDrawer: option?.requires_cash_drawer,
      });

      if (!wasPaymentLegAmountCapped(rawAmount, cappedAmount, moneyEpsilon)) {
        setCashOverRemainingNotice(null);
        return;
      }

      if (policy.isCash && !policy.supportsChangeReturn) {
        setCashOverRemainingNotice(
          t('splitPayment.validation.cashOverRemainingNotAllowed', {
            max: `${currencyCode} ${formatAmount(cappedAmount)}`,
          })
        );
        return;
      }

      // Non-cash (or cash-with-change that still hit an order cap while intent OFF):
      // explain the hard gate — enable "Customer is paying extra" to retain overpay.
      if (
        !resolveSupportsRetainedOverpayment({
          payExtraIntent: payExtraIntentRef.current,
          policy,
        })
      ) {
        setCashOverRemainingNotice(
          t('payExtraIntent.cappedAtRemaining', {
            max: `${currencyCode} ${formatAmount(cappedAmount)}`,
          })
        );
        return;
      }

      setCashOverRemainingNotice(null);
    },
    [currencyCode, formatAmount, getMethodOption, moneyEpsilon, payExtraIntentRef, t]
  );

  const canAllocateOverpayment = useHasPermissionCode(
    OVERPAYMENT_RESOLUTION_PERMISSIONS.ALLOCATE
  );
  const canDisposeOverpayment = useHasPermissionCode(
    OVERPAYMENT_RESOLUTION_PERMISSIONS.DISPOSE
  );
  const canWalletOverpayment = useHasPermissionCode(
    OVERPAYMENT_RESOLUTION_PERMISSIONS.TO_WALLET
  );
  const canAdvanceOverpayment = useHasPermissionCode(
    OVERPAYMENT_RESOLUTION_PERMISSIONS.TO_ADVANCE
  );
  const canCreditOverpayment = useHasPermissionCode(
    OVERPAYMENT_RESOLUTION_PERMISSIONS.TO_CREDIT
  );
  const canCreditNoteOverpayment = useHasPermissionCode(
    OVERPAYMENT_RESOLUTION_PERMISSIONS.TO_CREDIT_NOTE
  );
  const canSaveAdvanceOverpayment = canDisposeOverpayment || canAdvanceOverpayment;
  const canSaveCreditOverpayment =
    canDisposeOverpayment || canCreditOverpayment || canCreditNoteOverpayment;

  const checkoutExcessLegs = useMemo(
    () =>
      settlementLegEntries.map(({ leg }) => {
        const option = getMethodOption(leg.method, leg.gateway_code);
        return {
          paymentMethodCode: leg.method,
          amount: leg.amount ?? 0,
          tenderedAmount:
            leg.method === PAYMENT_METHODS.CASH ? (leg.cashTendered ?? leg.amount) : undefined,
          supportsChangeReturn: option?.supports_change_return === true,
        };
      }),
    [getMethodOption, settlementLegEntries]
  );

  const canEnablePayExtra = useMemo(
    () =>
      !checkoutMethodsLoading &&
      checkoutMethods.some(
        (option) =>
          option.supports_overpayment === true ||
          (option.payment_method_code === PAYMENT_METHODS.CASH &&
            option.supports_change_return === true)
      ),
    [checkoutMethods, checkoutMethodsLoading]
  );

  const primaryCashLegRef = useMemo(() => {
    const cashEntry = settlementLegEntries.find(({ leg }) => leg.method === PAYMENT_METHODS.CASH);
    return cashEntry?.leg.legRef ?? null;
  }, [settlementLegEntries]);

  const payExtraResetFingerprint = useMemo(
    () =>
      settlementLegEntries
        .map(({ leg }) => `${leg.method}:${leg.amount}:${leg.cashTendered ?? ''}`)
        .join('|'),
    [settlementLegEntries]
  );

  const payExtra = usePayExtraCheckout({
    customerId,
    branchId,
    currencyCode,
    excessAmount: legacyUnresolvedOverpaymentAmount,
    legacyUnresolvedExcess: legacyUnresolvedOverpaymentAmount,
    saleTotal,
    immediateSettlementAmount: totalSettledNowAmount,
    legs: checkoutExcessLegs,
    primaryCashLegRef,
    receiptAmount: totalSettledNowAmount,
    currentOrderAllocationAmount: amountAppliedToOrder,
    sourceType: 'ORDER_PAYMENT_MODAL',
    paymentMethodCode: paymentMethod,
    moneyEpsilon,
    confirmedToastMessage: t('extraReceipt.allocation.confirmedToast'),
    remainingUnallocatedErrorMessage: t('extraReceipt.allocation.remainingUnallocatedError'),
    resetDeps: [payExtraResetFingerprint, totalSettledNowAmount],
  });

  const allocation = payExtra;
  const {
    payExtraIntent,
    setPayExtraIntent,
    validationPhase,
    extraReceiptDialogOpen,
    setExtraReceiptDialogOpen,
    runValidatePayment,
    confirmExtraReceiptSelection,
  } = payExtra;
  payExtraIntentRef.current = payExtraIntent;

  const unresolvedOverpaymentAmount = payExtra.unresolvedExcessAmount;
  const extraReceiptDialogExcessAmount = payExtra.extraReceiptDialogExcessAmount;
  const overpaymentNeedsResolution = payExtra.overpaymentNeedsResolution;
  const overpaymentResolutionPayload = payExtra.overpaymentResolutionPayload;
  const overpaymentBlocksSubmit = payExtra.overpaymentBlocksSubmit;

  const editableLegEntries = useMemo(() => {
    const entries = paymentLegs.map((leg, index) => ({ leg, index }));
    if (payExtraIntent) {
      return entries;
    }
    const nonZero = entries.filter(({ leg }) => (leg.amount ?? 0) > 0);
    return nonZero.length > 0 ? nonZero : entries;
  }, [paymentLegs, payExtraIntent]);

  const legacyDisplayChangeAmount = getDisplayChangeAmount(
    cashChangeAmount,
    canReturnChangeFromCash,
    moneyEpsilon
  );
  const displayChangeAmount = payExtraIntent
    ? payExtra.checkoutMetrics.changeResolvedAmount
    : legacyDisplayChangeAmount;

  useEffect(() => {
    if (!open) return;
    payExtra.resetPayExtraState();
    allocation.setAutoDrawerOpen(false);
    allocation.setManualDrawerOpen(false);
  }, [open]);

  const netCashRetainedAmount = payExtraIntent
    ? Math.max(0, cashTenderedAmount - displayChangeAmount)
    : getNetCashRetainedAmount(
        cashTenderedAmount,
        cashChangeAmount,
        canReturnChangeFromCash,
        moneyEpsilon
      );
  const primaryMethodOption = getMethodOption(paymentMethod);
  const cashDrawerRequired = useMemo(() => {
    const selectedLegRequiresDrawer = settlementLegEntries.some(({ leg }) => {
      const option = getMethodOption(leg.method, leg.gateway_code);
      return !!option?.requires_cash_drawer;
    });

    if (selectedLegRequiresDrawer) {
      return true;
    }

    return paymentLegs.length === 0 && !!primaryMethodOption?.requires_cash_drawer;
  }, [getMethodOption, paymentLegs.length, primaryMethodOption, settlementLegEntries]);

  // Cash-drawer session state, query, blocking message, and open-session flow
  // (Phase 2E).
  const cashDrawer = useCashDrawer({
    open,
    tenantOrgId,
    branchId,
    userId,
    isRTL,
    csrfToken,
    t,
    cashDrawerRequired,
  });
  const {
    cashDrawerSessionChoices,
    cashDrawerBlockingMessage,
  } = cashDrawer;

  // Promo handlers
  const handleValidatePromoCode = async () => {
    if (NEW_ORDER_PROMO_GIFT_DISABLED) return;
    if (!promoCode?.trim()) return;
    setPromoCodeValidating(true);
    setPromoCodeResult(null);
    try {
      const result = await validatePromoCodeAction(tenantOrgId, {
        promo_code: promoCode,
        order_total: total,
        customer_id: customerId,
        service_categories: serviceCategories,
      });
      setPromoCodeResult(result);
      if (result.isValid && result.promoCode && result.discountAmount) {
        const applied = { code: promoCode, id: result.promoCode.id, discount: result.discountAmount };
        setAppliedPromoCode(applied);
        setValue('promoCode', promoCode);
        setValue('promoCodeId', result.promoCode.id);
        setValue('promoDiscount', result.discountAmount);
      }
    } catch {
      setPromoCodeResult({ isValid: false, error: t('promoCode.errors.validationFailed') });
    } finally {
      setPromoCodeValidating(false);
    }
  };

  const handleClearPromoCode = () => {
    if (NEW_ORDER_PROMO_GIFT_DISABLED) return;
    setValue('promoCode', '');
    setValue('promoCodeId', '');
    setValue('promoDiscount', 0);
    setPromoCodeResult(null);
    setAppliedPromoCode(null);
  };

  const handleClearPromoCodeError = () => {
    setPromoCodeResult(null);
  };

  // Gift card handlers
  const handleFetchGiftCardDetails = async () => {
    if (NEW_ORDER_PROMO_GIFT_DISABLED) return;
    if (!giftCardNumber?.trim()) return;
    if (pinRequired && !giftCardPin.trim()) {
      setPinFieldError(t('giftCard.pinPendingError'));
      window.setTimeout(() => {
        pinInputRef.current?.focus();
        pinInputRef.current?.select();
      }, 60);
      return;
    }

    setGiftCardValidating(true);
    setGiftCardResult(null);
    setGiftCardDetails(null);
    try {
      const result = await validateGiftCardAction({
        gift_card_code: giftCardNumber,
        ...(giftCardPin.trim() ? { card_pin: giftCardPin.trim() } : {}),
      });

      if (!result.isValid && result.errorCode === 'INVALID_PIN' && !giftCardPin.trim()) {
        setPinRequired(true);
        setPinFieldError(t('giftCard.pinPendingError'));
        window.setTimeout(() => {
          pinInputRef.current?.focus();
          pinInputRef.current?.select();
        }, 60);
        return;
      }
      if (!result.isValid && result.errorCode === 'INVALID_PIN' && giftCardPin.trim()) {
        setPinFieldError(resolveGiftCardError(result));
        return;
      }

      setGiftCardResult(result);
      if (result.isValid && result.giftCard && result.availableBalance != null) {
        setPinRequired(false);
        const details = {
          number: result.giftCard.gift_card_code,
          balance: result.availableBalance,
          status: result.giftCard.status,
          expiryDate: result.giftCard.expiry_date,
          id: result.giftCard.id,
          searchStr: giftCardNumber,
        };
        setGiftCardDetails(details);
        const defaultAmount = getSuggestedStoredValueAmount(
          result.availableBalance,
          paymentLegs,
          saleTotal,
          giftCardSettlementAmount,
          decimalPlaces
        );
        setValue('giftCardAmount', defaultAmount);
        setValue('giftCardId', result.giftCard.id ?? '');
        window.setTimeout(() => {
          giftCardDetailsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          giftCardAmountInputRef.current?.focus();
          giftCardAmountInputRef.current?.select();
        }, 80);
      }
    } catch {
      setGiftCardResult({ isValid: false, error: t('giftCard.errors.validationFailed') });
    } finally {
      setGiftCardValidating(false);
    }
  };

  const handleApplyGiftCard = () => {
    if (NEW_ORDER_PROMO_GIFT_DISABLED || !giftCardDetails) return;
    const amountToUse = Number(giftCardAmount) || 0;
    const maxAmount = getSuggestedStoredValueAmount(
      giftCardDetails.balance,
      paymentLegs,
      saleTotal,
      giftCardSettlementAmount,
      decimalPlaces
    );
    if (amountToUse <= 0) { cmxMessage.error(t('giftCard.errors.amountRequired')); return; }
    if (amountToUse > maxAmount) {
      cmxMessage.error(t('giftCard.errors.maxAmountExceeded'));
      setValue('giftCardAmount', maxAmount);
      return;
    }
    setAppliedGiftCard({ number: giftCardDetails.number, amount: amountToUse, balance: giftCardDetails.balance, id: giftCardDetails.id ?? '' });
    setValue('giftCardNumber', giftCardDetails.number);
    setValue('giftCardAmount', amountToUse);
    setValue('giftCardId', giftCardDetails.id ?? '');
  };

  const handleClearGiftCard = () => {
    if (NEW_ORDER_PROMO_GIFT_DISABLED) return;
    setValue('giftCardNumber', '');
    setValue('giftCardAmount', 0);
    setValue('giftCardId', '');
    setGiftCardResult(null);
    setGiftCardDetails(null);
    setAppliedGiftCard(null);
    setGiftCardPin('');
    setPinRequired(false);
    setPinVisible(false);
    setPinFieldError(null);
  };

  const appliedBadgeCount = (appliedPromoCode ? 1 : 0) + (appliedGiftCard ? 1 : 0);
  const activeLegRemainingCap = useMemo(() => {
    if (!activeLeg) return 0;
    return getRemainingToAllocate(
      saleTotal,
      paymentLegs,
      giftCardSettlementAmount,
      activeLegIndex,
      decimalPlaces
    );
  }, [activeLeg, activeLegIndex, decimalPlaces, giftCardSettlementAmount, paymentLegs, saleTotal]);
  const effectiveOutstandingPolicy = deriveOutstandingPolicy(
    totalSettledNowAmount,
    saleTotal,
    (outstandingPolicy as OutstandingPolicy | undefined) ?? defaultOutstandingPolicy
  );
  const showDeferredExplanation =
    settlementLegEntries.length === 0 &&
    (paymentMethod === PAYMENT_METHODS.PAY_ON_COLLECTION || paymentMethod === PAYMENT_METHODS.INVOICE);
  const showGiftCardWorkspace =
    !NEW_ORDER_PROMO_GIFT_DISABLED &&
    !appliedGiftCard &&
    (pinRequired || !!giftCardDetails);
  const hasCheckLegWithoutNumber = paymentLegs.some(
    (leg) => leg.method === PAYMENT_METHODS.CHECK && !leg.checkNumber?.trim()
  );
  const hasCheckLegWithInvalidDate = useMemo(
    () =>
      paymentLegs.some((leg) => {
        if (leg.method !== PAYMENT_METHODS.CHECK || !(leg.amount ?? 0)) return false;
        return !!validateCheckDueDate(leg.checkDate);
      }),
    [paymentLegs]
  );
  const creditNoteLegsMissingReference = useMemo(
    () =>
      settlementLegEntries.filter(
        ({ leg }) => leg.method === 'CREDIT_NOTE' && !leg.creditReferenceId?.trim()
      ),
    [settlementLegEntries]
  );
  const terminalRequiredLegs = useMemo(
    () =>
      settlementLegEntries.filter(({ leg }) => {
        const option = getMethodOption(leg.method, leg.gateway_code);
        return option?.requires_terminal && !leg.terminalId?.trim();
      }),
    [getMethodOption, settlementLegEntries]
  );
  const legsMissingRequiredReference = useMemo(
    () =>
      paymentLegs.filter((leg) => {
        const option = getMethodOption(leg.method, leg.gateway_code);
        return (
          (leg.amount ?? 0) > moneyEpsilon &&
          option?.requires_reference === true &&
          !legHasRequiredPaymentReference(leg, true)
        );
      }),
    [getMethodOption, moneyEpsilon, paymentLegs]
  );
  const activeLegOption = activeLeg
    ? getMethodOption(activeLeg.method, activeLeg.gateway_code)
    : undefined;
  const activeLegChangeReturned = useMemo(() => {
    if (!activeLeg || activeLeg.method !== PAYMENT_METHODS.CASH) return 0;
    if (payExtraIntent) {
      return displayChangeAmount;
    }
    return deriveChangeReturnedAmount(
      activeLeg.cashTendered ?? activeLeg.amount ?? 0,
      activeLeg.amount ?? 0,
      activeLegOption?.supports_change_return === true,
      moneyEpsilon
    );
  }, [
    activeLeg,
    activeLegOption?.supports_change_return,
    displayChangeAmount,
    moneyEpsilon,
    payExtraIntent,
  ]);
  const paymentLegsTotal = settlementLegEntries.reduce((sum, { leg }) => sum + (leg.amount || 0), 0);
  const splitSidebarSettledTotal = paymentLegsTotal + giftCardSettlementAmount;
  const invalidImmediateAmount =
    paymentMethod !== PAYMENT_METHODS.PAY_ON_COLLECTION &&
    paymentMethod !== PAYMENT_METHODS.INVOICE &&
    totalSettledNowAmount <= 0;
  const cycleActiveLeg = useCallback(() => {
    if (editableLegEntries.length <= 1) return;
    setActiveLegIndex((prev) => {
      const currentPosition = editableLegEntries.findIndex((entry) => entry.index === prev);
      const nextPosition = currentPosition >= 0
        ? (currentPosition + 1) % editableLegEntries.length
        : 0;
      return editableLegEntries[nextPosition]?.index ?? prev;
    });
    focusAmountEditor();
  }, [editableLegEntries, focusAmountEditor, setActiveLegIndex]);

  const fillLegRemaining = useCallback(
    (legIndex: number) => {
      const targetLeg = paymentLegs[legIndex];
      if (!targetLeg) return;

      const fillAmount = getSuggestedDefaultLegAmount(
        paymentLegs,
        legIndex,
        saleTotal,
        giftCardSettlementAmount,
        decimalPlaces
      );
      const cappedAmount = capPaymentLegAmount(
        fillAmount,
        paymentLegs,
        legIndex,
        saleTotal,
        giftCardSettlementAmount,
        decimalPlaces,
        getLegStoredValueCap(targetLeg)
      );

      if (cappedAmount <= moneyEpsilon) {
        cmxMessage.info(t('splitPayment.noRemainingToFill'));
        return;
      }

      setIsDirtySinceOpen(true);
      setActiveLegIndex(legIndex);
      updateLeg(legIndex, 'amount', cappedAmount);
      setActiveAmountDraft(formatDecimalDraft(cappedAmount, decimalPlaces));
      focusAmountEditor();
    },
    [
      decimalPlaces,
      focusAmountEditor,
      getLegStoredValueCap,
      giftCardSettlementAmount,
      moneyEpsilon,
      paymentLegs,
      saleTotal,
      t,
      updateLeg,
      setIsDirtySinceOpen,
      setActiveLegIndex,
      setActiveAmountDraft,
    ]
  );

  const validationItems = useMemo(() => derivePaymentValidationItems({
    t,
    currencyCode,
    formatAmount,
    getMethodOption,
    getOptionDisplayName: getCheckoutOptionDisplayName,
    promoCodeValidating,
    giftCardValidating,
    overpaymentBlocksSubmit,
    payExtraIntent,
    validationPhase,
    unresolvedOverpaymentAmount,
    checkNumberError: errors.checkNumber?.message != null ? String(errors.checkNumber.message) : undefined,
    amountDiscountError: errors.amountDiscount?.message != null ? String(errors.amountDiscount.message) : undefined,
    percentDiscountError: errors.percentDiscount?.message != null ? String(errors.percentDiscount.message) : undefined,
    pinRequired,
    hasCheckLegWithoutNumber,
    hasCheckLegWithInvalidDate,
    paymentLegs,
    legsMissingRequiredReference,
    walletLegExceedsLiveBalance,
    liveWalletBalanceDisplay,
    storedValueLegExceedsBalance,
    storedValueLegExceedance,
    creditNoteLegsMissingReference,
    terminalRequiredLegs,
    cashDrawerBlockingMessage,
    invalidImmediateAmount,
    remainingBalance,
    effectiveOutstandingPolicy,
    creditLimitWouldExceed: Boolean(serverTotals?.creditLimit?.wouldExceed),
    creditLimitMode: serverTotals?.creditLimit?.mode,
    creditLimitOverride,
  }), [
    creditLimitOverride,
    errors.amountDiscount?.message,
    effectiveOutstandingPolicy,
    errors.checkNumber?.message,
    errors.percentDiscount?.message,
    giftCardValidating,
    hasCheckLegWithoutNumber,
    hasCheckLegWithInvalidDate,
    creditNoteLegsMissingReference,
    terminalRequiredLegs,
    storedValueLegExceedance,
    storedValueLegExceedsBalance,
    legsMissingRequiredReference,
    getMethodOption,
    getCheckoutOptionDisplayName,
    liveWalletBalanceDisplay,
    cashDrawerBlockingMessage,
    changeAmount,
    currencyCode,
    paymentMethod,
    formatAmount,
    pinRequired,
    promoCodeValidating,
    overpaymentBlocksSubmit,
    payExtraIntent,
    validationPhase,
    unresolvedOverpaymentAmount,
    remainingBalance,
    serverTotals?.creditLimit?.mode,
    serverTotals?.creditLimit?.wouldExceed,
    totalSettledNowAmount,
    t,
    walletLegExceedsLiveBalance,
  ]);

  const submitBusy = loading || totalsLoading || (items.length > 0 && !serverTotals);
  const submitHasBlockingIssues = validationItems.length > 0;
  const rightRailState: PaymentModalRightRailState = useMemo(
    () =>
      derivePaymentModalRightRailState({
        hasBlockingIssues: submitHasBlockingIssues,
        changeAmount: payExtraIntent ? displayChangeAmount : changeAmount,
        remainingBalance,
        effectiveOutstandingPolicy,
        epsilon: moneyEpsilon,
        cashDrawerBlockingMessage,
        creditLimitWouldExceed: !!serverTotals?.creditLimit?.wouldExceed,
        creditLimitMode: serverTotals?.creditLimit?.mode,
        creditLimitOverride,
        pinRequired,
        hasCheckLegWithoutNumber,
        walletLegExceedsLiveBalance,
        invalidImmediateAmount,
        canReturnChangeFromCash,
        currencyExRate: currencyConfig?.currencyExRate,
        roundingAmount: 0,
      }),
    [
      submitHasBlockingIssues,
      payExtraIntent,
      displayChangeAmount,
      changeAmount,
      remainingBalance,
      effectiveOutstandingPolicy,
      moneyEpsilon,
      cashDrawerBlockingMessage,
      serverTotals?.creditLimit?.wouldExceed,
      serverTotals?.creditLimit?.mode,
      creditLimitOverride,
      pinRequired,
      hasCheckLegWithoutNumber,
      walletLegExceedsLiveBalance,
      invalidImmediateAmount,
      canReturnChangeFromCash,
      currencyConfig?.currencyExRate,
    ]
  );

  const handleOutstandingPolicyChange = useCallback((policy: OutstandingPolicy) => {
    setIsDirtySinceOpen(true);
    setValue('outstandingPolicy', policy, { shouldDirty: true });

    if (paymentMethod === PAYMENT_METHODS.PAY_ON_COLLECTION || paymentMethod === PAYMENT_METHODS.INVOICE) {
      setValue(
        'paymentMethod',
        policy === 'CREDIT_INVOICE' ? PAYMENT_METHODS.INVOICE : PAYMENT_METHODS.PAY_ON_COLLECTION,
        { shouldDirty: true }
      );
    }
  }, [paymentMethod, setValue, setIsDirtySinceOpen]);

  const handleKeypadPress = useCallback((key: PaymentKeypadKey) => {
    if (!activeLeg) return;
    const nextDraft = applyKeypadInput(
      activeAmountDraft,
      key,
      decimalPlaces
    );
    const nextAmount = parseDecimalDraft(nextDraft);
    const option = getMethodOption(activeLeg.method, activeLeg.gateway_code);
    const policy = resolvePaymentOverpaymentPolicy({
      paymentMethodCode: activeLeg.method,
      supportsChangeReturn: option?.supports_change_return,
      supportsOverpayment: option?.supports_overpayment,
      requiresCashDrawer: option?.requires_cash_drawer,
    });
    const cappedAmount = deriveLegAppliedAmount({
      rawAmount: nextAmount,
      paymentLegs,
      legIndex: activeLegIndex,
      saleTotal,
      giftCardAmount: giftCardSettlementAmount,
      decimalPlaces,
      walletBalance: activeLeg ? getLegStoredValueCap(activeLeg) : undefined,
      supportsOverpayment: resolveSupportsRetainedOverpayment({
        payExtraIntent,
        policy,
      }),
    });
    setActiveAmountDraft(
      nextAmount > cappedAmount && !(policy.isCash && policy.supportsChangeReturn)
        ? formatDecimalDraft(cappedAmount, decimalPlaces)
        : nextDraft
    );
    if (activeLeg) {
      notifyIfLegAmountCapped(activeLeg, nextAmount, cappedAmount);
    }
    updateLeg(activeLegIndex, 'amount', nextAmount);
  }, [
    activeAmountDraft,
    activeLeg,
    activeLegIndex,
    decimalPlaces,
    getLegStoredValueCap,
    getMethodOption,
    giftCardSettlementAmount,
    notifyIfLegAmountCapped,
    paymentLegs,
    payExtraIntent,
    saleTotal,
    updateLeg,
    setActiveAmountDraft,
  ]);

  // Simple→Full escalation predicate (Phase 4 consumer). Wired here, returned but
  // intentionally not consumed yet — exactly like catalog `isError` in Phase 2A.
  const needsAdvancedResult = useMemo(
    () =>
      computeNeedsAdvanced({
        settlementLegCount: settlementLegEntries.length,
        hasCustomerCreditApplied: customerCreditEntries.length > 0,
        isB2BCreditInvoice: isB2BCustomer || effectiveOutstandingPolicy === 'CREDIT_INVOICE',
        hasGiftCardOrPromo: !!appliedGiftCard || !!appliedPromoCode,
        overpaymentNeedsResolution,
        pinRequired,
        cashDrawerSessionChoiceCount: cashDrawerSessionChoices.length,
        cashDrawerBlocked: !!cashDrawerBlockingMessage,
        showCurrencyRounding: (currencyConfig?.currencyExRate ?? 1) !== 1,
      }),
    [
      settlementLegEntries.length,
      customerCreditEntries.length,
      isB2BCustomer,
      effectiveOutstandingPolicy,
      appliedGiftCard,
      appliedPromoCode,
      overpaymentNeedsResolution,
      pinRequired,
      cashDrawerSessionChoices.length,
      cashDrawerBlockingMessage,
      currencyConfig?.currencyExRate,
    ]
  );
  const needsAdvanced = needsAdvancedResult.needsAdvanced;
  const needsAdvancedReasons = needsAdvancedResult.reasons;

  return {
    // Grouped slices (caller re-destructures to the modal's local names).
    catalog,
    giftPromo,
    totals,
    legs,
    derivations: {
      settlementLegEntries,
      realPaymentEntries,
      customerCreditEntries,
      payNowAmount,
      customerCreditAmount,
      settledNowAmount,
      cashLegAmount,
      cashTenderedAmount,
      totalSettledNowAmount,
      walletLegEntry,
      storedValueLegExceedance,
      walletLegExceedsLiveBalance,
      storedValueLegExceedsBalance,
      moneyEpsilon,
      remainingBalance,
      changeAmount,
      canReturnChangeFromCash,
      cashChangeAmount,
      cashChangeCapacity,
      legacyUnresolvedOverpaymentAmount,
      amountAppliedToOrder,
    },
    payExtra,
    cashDrawer,

    // Stored-value query.
    walletCreditOption,
    storedValueSummary,
    storedValueLoading,
    storedValueFetching,
    refetchStoredValueSummary,

    // Cross-slice derivations.
    giftCardSettlementAmount,
    liveWalletBalance,
    liveWalletCurrencyCode,
    walletBalanceLoaded,
    walletHasAvailableBalance,
    liveWalletBalanceDisplay,
    liveAdvanceBalance,
    getLegStoredValueCap,
    notifyIfLegAmountCapped,
    cashOverRemainingNotice,
    canAllocateOverpayment,
    canDisposeOverpayment,
    canWalletOverpayment,
    canAdvanceOverpayment,
    canCreditOverpayment,
    canCreditNoteOverpayment,
    canSaveAdvanceOverpayment,
    canSaveCreditOverpayment,
    checkoutExcessLegs,
    canEnablePayExtra,
    primaryCashLegRef,
    payExtraResetFingerprint,
    allocation,
    payExtraIntent,
    setPayExtraIntent,
    validationPhase,
    extraReceiptDialogOpen,
    setExtraReceiptDialogOpen,
    runValidatePayment,
    confirmExtraReceiptSelection,
    unresolvedOverpaymentAmount,
    extraReceiptDialogExcessAmount,
    overpaymentNeedsResolution,
    overpaymentResolutionPayload,
    overpaymentBlocksSubmit,
    editableLegEntries,
    legacyDisplayChangeAmount,
    displayChangeAmount,
    netCashRetainedAmount,
    primaryMethodOption,
    cashDrawerRequired,
    effectiveOutstandingPolicy,
    activeLegRemainingCap,
    showDeferredExplanation,
    showGiftCardWorkspace,
    hasCheckLegWithoutNumber,
    hasCheckLegWithInvalidDate,
    creditNoteLegsMissingReference,
    terminalRequiredLegs,
    legsMissingRequiredReference,
    activeLegOption,
    activeLegChangeReturned,
    paymentLegsTotal,
    splitSidebarSettledTotal,
    invalidImmediateAmount,
    appliedBadgeCount,
    validationItems,
    submitBusy,
    submitHasBlockingIssues,
    rightRailState,
    needsAdvanced,
    needsAdvancedReasons,

    // Non-DOM handlers.
    handleCreditNoteSelect,
    handleMethodSelect,
    handleCustomerCreditSelect,
    handleValidatePromoCode,
    handleClearPromoCode,
    handleClearPromoCodeError,
    handleFetchGiftCardDetails,
    handleApplyGiftCard,
    handleClearGiftCard,
    handleOutstandingPolicyChange,
    handleKeypadPress,
    cycleActiveLeg,
    fillLegRemaining,
  };
}
