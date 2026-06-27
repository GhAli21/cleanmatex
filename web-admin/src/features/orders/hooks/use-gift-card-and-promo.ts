'use client';

/**
 * Gift-card + promo-code state for Payment Modal V4.
 *
 * Verbatim extraction of the modal's gift-card/promo concern (previously inline in
 * `payment-modal-v4.tsx`): the promo-code + gift-card validation/applied state, the
 * gift-card PIN flow flags, the `resolveGiftCardError` message mapper, the
 * "reset gift-card details when the code changes" effect, the PIN-focus effect, and
 * this slice's `open`-reset.
 *
 * Scope (Phase 2B, program plan `:579–806`): this hook owns the **state + effects +
 * reset** only. The async handlers (`handleValidatePromoCode`,
 * `handleFetchGiftCardDetails`, `handleApplyGiftCard`, …) stay in the component for
 * now — they read downstream legs/totals values that only become hook slices later;
 * the engine threads those at composition time (Phase 2G). The handlers drive this
 * slice through the returned setters.
 *
 * Behavior freeze: state shapes, effect bodies, effect dependency arrays, and the
 * error-mapping switch stay byte-equivalent to the original inline code. DOM refs
 * stay declared in the view (per the 2G "refs/scroll/focus stay in view" rule) and
 * are threaded in; this hook only uses `pinInputRef` to reproduce the existing
 * PIN-focus effect.
 *
 * See `docs/features/Order_Fin/Payment_Modal_Review/`.
 */

/* eslint-disable react-hooks/set-state-in-effect --
 * Behavior-frozen verbatim lift of the modal's gift-card reset/PIN/open-reset
 * effects. Render-time reset (the preferred pattern) is impractical here: the
 * code-changed reset must also call RHF `setValue`, which is unsafe during render.
 * Sanctioned last-resort per docs/dev/rules/react-effects-patterns.md §2.
 */

import { useCallback, useEffect, useState, type RefObject } from 'react';
import type { UseFormSetValue } from 'react-hook-form';
import type { PaymentFormData } from '@features/orders/model/payment-form-schema';
import type { ValidatePromoCodeResult, ValidateGiftCardResult } from '@/lib/types/payment';

/**
 * Minimal translate signature compatible with next-intl's `useTranslations`.
 */
export type GiftCardPromoTranslate = (
  key: string,
  params?: Record<string, string | number>
) => string;

/**
 * A successfully applied promo code (code + id + resolved discount amount).
 */
export type AppliedPromoCode = {
  code: string;
  id: string;
  discount: number;
};

/**
 * Validated gift-card details available for application to the order.
 */
export type GiftCardDetails = {
  number: string;
  balance: number;
  status: string;
  expiryDate?: string;
  id?: string;
  searchStr?: string;
};

/**
 * A gift card applied to the order (number + amount + balance + id).
 */
export type AppliedGiftCard = {
  number: string;
  amount: number;
  balance: number;
  id: string;
};

/**
 * Inputs threaded from the modal. The form (`setValue`), the watched
 * `giftCardNumber`, the PIN input ref, and the two translate functions stay
 * component-owned; this hook owns the gift/promo state.
 */
export interface UseGiftCardAndPromoParams {
  /** Gates the PIN-focus + slice `open`-reset effects; matches the modal `open` flag. */
  open: boolean;
  /** Watched RHF `giftCardNumber` value (drives the code-changed reset effect). */
  giftCardNumber: string | undefined;
  /** RHF setter — clears gift-card form fields when the code changes. */
  setValue: UseFormSetValue<PaymentFormData>;
  /** PIN input ref (declared in the view) used by the PIN-focus effect. */
  pinInputRef: RefObject<HTMLInputElement | null>;
  /** `newOrder.payment` translate function. */
  t: GiftCardPromoTranslate;
  /** `marketing.giftCards.errors` translate function. */
  tGiftCardErrors: GiftCardPromoTranslate;
}

/**
 * Gift-card + promo-code state, error mapping, and reset/focus effects for
 * Payment Modal V4.
 *
 * @param params - {@link UseGiftCardAndPromoParams}.
 * @param params.open - Gates the PIN-focus + slice `open`-reset effects.
 * @param params.giftCardNumber - Watched RHF gift-card number.
 * @param params.setValue - RHF setter for gift-card form fields.
 * @param params.pinInputRef - PIN input ref owned by the view.
 * @param params.t - `newOrder.payment` translate function.
 * @param params.tGiftCardErrors - `marketing.giftCards.errors` translate function.
 * @returns Promo + gift-card state, their setters, and `resolveGiftCardError`.
 */
export function useGiftCardAndPromo({
  open,
  giftCardNumber,
  setValue,
  pinInputRef,
  t,
  tGiftCardErrors,
}: UseGiftCardAndPromoParams) {
  // Promo code state
  const [promoCodeValidating, setPromoCodeValidating] = useState(false);
  const [promoCodeResult, setPromoCodeResult] = useState<ValidatePromoCodeResult | null>(null);
  const [appliedPromoCode, setAppliedPromoCode] = useState<AppliedPromoCode | null>(null);

  // Gift card state
  const [giftCardValidating, setGiftCardValidating] = useState(false);
  const [giftCardResult, setGiftCardResult] = useState<ValidateGiftCardResult | null>(null);
  const [giftCardDetails, setGiftCardDetails] = useState<GiftCardDetails | null>(null);
  const [appliedGiftCard, setAppliedGiftCard] = useState<AppliedGiftCard | null>(null);
  const [giftCardPin, setGiftCardPin]     = useState('');
  const [pinRequired, setPinRequired]     = useState(false);
  const [pinVisible, setPinVisible]       = useState(false);
  const [pinFieldError, setPinFieldError] = useState<string | null>(null);

  const resolveGiftCardError = useCallback(
    (result: ValidateGiftCardResult): string => {
      if (!result.errorCode) {
        return result.error ?? t('giftCard.errors.validationFailed');
      }
      switch (result.errorCode) {
        case 'EXPIRED':              return tGiftCardErrors('EXPIRED');
        case 'INSUFFICIENT_BALANCE': return tGiftCardErrors('INSUFFICIENT_BALANCE');
        case 'INVALID_PIN':          return tGiftCardErrors('INVALID_PIN');
        case 'CARD_SUSPENDED':       return tGiftCardErrors('SUSPENDED');
        case 'VOIDED':               return tGiftCardErrors('VOIDED');
        case 'NOT_FOUND':            return tGiftCardErrors('INVALID_CODE');
        default:                     return result.error ?? t('giftCard.errors.validationFailed');
      }
    },
    [t, tGiftCardErrors]
  );

  // Reset gift card details when code changes
  useEffect(() => {
    if (!giftCardNumber || appliedGiftCard) return;
    if (giftCardDetails?.number && giftCardDetails.number !== giftCardNumber && giftCardDetails.searchStr !== giftCardNumber) {
      setGiftCardDetails(null);
      setGiftCardResult(null);
      setValue('giftCardAmount', 0);
      setValue('giftCardId', '');
    }
  }, [giftCardNumber, giftCardDetails, appliedGiftCard, setValue]);

  useEffect(() => {
    if (!open || !pinRequired) return;
    window.setTimeout(() => {
      pinInputRef.current?.focus();
      pinInputRef.current?.select();
    }, 60);
  }, [open, pinRequired, pinInputRef]);

  // This slice's open-reset (each extracted hook owns its own reset).
  useEffect(() => {
    if (!open) return;
    setPromoCodeResult(null);
    setAppliedPromoCode(null);
    setGiftCardResult(null);
    setGiftCardDetails(null);
    setAppliedGiftCard(null);
    setGiftCardPin('');
    setPinRequired(false);
    setPinVisible(false);
    setPinFieldError(null);
  }, [open]);

  return {
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
  };
}
