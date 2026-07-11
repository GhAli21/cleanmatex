'use client';

/**
 * PaymentDiscountFields — the manual OMR / % discount editor (L4 primitive;
 * single source for both the Full workbench and the Simple face).
 *
 * Mirrors the legacy Full-view "Discounts" block field-for-field (draft/focus
 * handling for the amount input, percent↔amount sync, clamp-to-order-total,
 * and the shared error line) so the two faces never drift. No money math lives
 * here beyond that clamp/sync — the authoritative discount total is always
 * `totals.manualDiscount` computed server-side (`order-calculation.service.ts`)
 * and read back by the receipt. This keeps discounts compliant with
 * `docs/dev/rules/no-silent-money-mutation.md`: invalid entry is prevented
 * (clamped to `[0, total]`) rather than silently corrected after the fact, and
 * the clamp is visible immediately in the field itself.
 *
 * See `docs/features/Order_Fin/Payment_Modal_08_07_2026/`.
 */

import { useCallback, useState, type RefObject } from 'react';
import { useTranslations } from 'next-intl';
import { Controller, type Control, type FieldErrors, type UseFormSetValue } from 'react-hook-form';
import { useRTL } from '@/lib/hooks/useRTL';
import type { PaymentFormData } from '@features/orders/model/payment-form-schema';
import {
  formatDecimalDraft,
  parseDecimalDraft,
  syncDiscountFromPercent,
  syncDiscountPercentFromAmount,
} from '@features/orders/ui/payment-modal-v4.utils';
import { CmxInput } from '@ui/primitives';

/** Props for {@link PaymentDiscountFields}. */
export interface PaymentDiscountFieldsProps {
  /** RHF control for the shared payment form. */
  control: Control<PaymentFormData>;
  /** RHF setter — used to keep the OMR and % fields in sync. */
  setValue: UseFormSetValue<PaymentFormData>;
  /** Relevant slice of form errors (amount/percent discount only). */
  errors: Pick<FieldErrors<PaymentFormData>, 'amountDiscount' | 'percentDiscount'>;
  /** Order total the discount is clamped against. */
  total: number;
  /** Currency decimal places (draft formatting/parsing). */
  decimalPlaces: number;
  /** Optional external ref for the OMR field (Full-view scroll-to-error). */
  amountInputRef?: RefObject<HTMLInputElement | null>;
  /** Optional external ref for the % field (Full-view scroll-to-error). */
  percentInputRef?: RefObject<HTMLInputElement | null>;
  /** Wrapper class override (Full uses a bordered card; Simple can be plainer). */
  className?: string;
}

/**
 * Renders the manual discount editor: an OMR field and a % field that stay in
 * sync, clamped to `[0, total]`, with a shared inline error line.
 *
 * @param props - See {@link PaymentDiscountFieldsProps}.
 * @returns The discount editor fields.
 */
export function PaymentDiscountFields({
  control,
  setValue,
  errors,
  total,
  decimalPlaces,
  amountInputRef,
  percentInputRef,
  className,
}: PaymentDiscountFieldsProps) {
  const t = useTranslations('newOrder.payment');
  const isRTL = useRTL();
  const [amountFocused, setAmountFocused] = useState(false);
  const [amountDraft, setAmountDraft] = useState('');

  const sanitizeDraft = useCallback(
    (raw: string): string => {
      let s = raw.replace(/[^\d.]/g, '');
      if (s.startsWith('.')) s = `0${s}`;
      const di = s.indexOf('.');
      if (di !== -1) {
        s = s.slice(0, di + 1) + s.slice(di + 1).replace(/\./g, '');
        const frac = s.slice(di + 1);
        if (frac.length > decimalPlaces) {
          s = s.slice(0, di + 1 + decimalPlaces);
        }
      }
      return s;
    },
    [decimalPlaces]
  );

  return (
    <div className={className}>
      <div>
        <p className={`text-sm font-semibold text-slate-900 ${isRTL ? 'text-right' : 'text-left'}`}>
          {t('rightRail.discounts')}
        </p>
        <p className={`mt-1 text-xs text-slate-500 ${isRTL ? 'text-right' : 'text-left'}`}>
          {t('rightRail.discountsHelp')}
        </p>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <Controller
          name="amountDiscount"
          control={control}
          render={({ field }) => (
            <CmxInput
              ref={amountInputRef}
              data-testid="payment-discount-amount"
              label={t('manualDiscount.amount')}
              value={amountFocused ? amountDraft : formatDecimalDraft(field.value ?? 0, decimalPlaces)}
              dir="ltr"
              placeholder={t('manualDiscount.amountPlaceholder')}
              onFocus={() => {
                setAmountFocused(true);
                setAmountDraft(formatDecimalDraft(field.value ?? 0, decimalPlaces));
              }}
              onBlur={() => {
                setAmountFocused(false);
                const raw = sanitizeDraft(amountDraft.trim());
                const nextAmount = Math.max(0, Math.min(parseDecimalDraft(raw), total));
                field.onChange(nextAmount);
                setValue('percentDiscount', syncDiscountPercentFromAmount(total, nextAmount));
                setAmountDraft('');
              }}
              onChange={(event) => {
                const nextDraft = sanitizeDraft(event.target.value);
                setAmountDraft(nextDraft);
                const nextAmount = Math.max(0, Math.min(parseDecimalDraft(nextDraft), total));
                field.onChange(nextAmount);
                setValue('percentDiscount', syncDiscountPercentFromAmount(total, nextAmount));
              }}
            />
          )}
        />
        <Controller
          name="percentDiscount"
          control={control}
          render={({ field }) => (
            <CmxInput
              ref={percentInputRef}
              data-testid="payment-discount-percent"
              label={t('manualDiscount.percent')}
              value={field.value ? String(field.value) : ''}
              dir="ltr"
              placeholder={t('manualDiscount.percentPlaceholder')}
              onChange={(event) => {
                const nextPercent = Math.max(0, Math.min(100, Number.parseFloat(event.target.value) || 0));
                field.onChange(nextPercent);
                setValue('amountDiscount', syncDiscountFromPercent(total, nextPercent, decimalPlaces));
              }}
            />
          )}
        />
      </div>
      {(errors.percentDiscount || errors.amountDiscount) ? (
        <p className={`mt-2 text-xs text-rose-600 ${isRTL ? 'text-right' : 'text-left'}`} role="alert">
          {errors.percentDiscount?.message || errors.amountDiscount?.message}
        </p>
      ) : null}
    </div>
  );
}
