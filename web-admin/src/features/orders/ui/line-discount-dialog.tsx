'use client';

/**
 * Line discount dialog (Line-Level P5-03c, PLAN §8.3, §11.1).
 *
 * A cashier discount on one cart line: a percent of the line or an amount,
 * with a required reason for the audit trail. Invalid values are prevented
 * with an inline explanation and a disabled Apply, never clamped or rewritten
 * (rule #15). The server checks `orders:discount` and the line gross again.
 */

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { CmxDialog, CmxDialogContent, CmxDialogFooter, CmxDialogHeader, CmxDialogTitle } from '@ui/overlays';
import { CmxButton, CmxMoneyField, CmxTextarea } from '@ui/primitives';
import { CmxRadioGroup } from '@ui/forms';
import { useTenantCurrency } from '@/lib/context/tenant-currency-context';
import { formatMoneyAmountWithCode } from '@/lib/money/format-money';
import { parseMoneyDraft } from '@/lib/money/money-draft';
import { DISCOUNT_CALC_TYPE, type DiscountCalcType } from '@/lib/constants/discount-source-type';
import type { OrderItemLineDiscount } from '../model/new-order-types';

/** Percent inputs carry at most two decimals (`org_order_discounts_dtl.discount_rate` is DECIMAL(5,2)). */
const PERCENT_DECIMALS = 2;
/** Matches the request schema's reason limit. */
const REASON_MAX = 200;

/** Props of the line discount dialog. */
export interface LineDiscountDialogProps {
  open: boolean;
  onClose: () => void;
  productName: string;
  /**
   * The line's quoted gross (`total_price`), the most an amount discount can
   * take. Null while the line has no quote yet: Apply waits for it.
   */
  lineGross: number | null;
  /** The line's discount before this edit, to edit or remove it. */
  current: OrderItemLineDiscount | null;
  onApply: (discount: OrderItemLineDiscount) => void;
  onRemove: () => void;
}

/**
 * Edits one line's cashier discount.
 * @param props - the line, its quoted gross and the apply/remove handlers
 * @returns the dialog
 */
export function LineDiscountDialog({ open, onClose, productName, lineGross, current, onApply, onRemove }: LineDiscountDialogProps) {
  const t = useTranslations('newOrder.lineDiscount');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const { currencyCode, decimalPlaces } = useTenantCurrency();
  const fmt = (n: number) => formatMoneyAmountWithCode(n, { currencyCode, decimalPlaces, locale: locale === 'ar' ? 'ar' : 'en' });

  const [type, setType] = useState<DiscountCalcType>(current?.type ?? DISCOUNT_CALC_TYPE.PERCENTAGE);
  const [draft, setDraft] = useState(current ? String(current.value) : '');
  const [reason, setReason] = useState(current?.reason ?? '');

  const value = parseMoneyDraft(draft);
  const isPercent = type === DISCOUNT_CALC_TYPE.PERCENTAGE;
  const valueError = draft === '' || value <= 0
    ? t('errors.valueRequired')
    : isPercent && value > 100
      ? t('errors.percentTooHigh')
      : !isPercent && lineGross != null && value > lineGross
        ? t('errors.amountTooHigh', { max: fmt(lineGross) })
        : null;
  const reasonError = reason.trim() === '' ? t('errors.reasonRequired') : null;
  const canApply = !valueError && !reasonError && lineGross != null;

  // Switching the type keeps nothing typed for the other type: a percent is not an amount (rule #15).
  const changeType = (next: string) => {
    if (next === type) return;
    setType(next as DiscountCalcType);
    setDraft('');
  };

  return (
    <CmxDialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <CmxDialogContent className="max-w-md">
        <CmxDialogHeader>
          <CmxDialogTitle>{t('title')}</CmxDialogTitle>
        </CmxDialogHeader>

        <div className="space-y-4">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm">
            <p className="font-medium text-gray-900">{productName}</p>
            <p className="text-gray-600">
              {lineGross != null ? t('lineGross', { amount: fmt(lineGross) }) : t('waitingForPrice')}
            </p>
          </div>

          <CmxRadioGroup
            label={t('typeLabel')}
            value={type}
            onChange={changeType}
            options={[
              { value: DISCOUNT_CALC_TYPE.PERCENTAGE, label: t('typePercent') },
              { value: DISCOUNT_CALC_TYPE.FIXED_AMOUNT, label: t('typeAmount', { currency: currencyCode }) },
            ]}
          />

          <div>
            <label htmlFor="line-discount-value" className="mb-1 block text-sm font-medium text-gray-700">
              {isPercent ? t('percentLabel') : t('amountLabel', { currency: currencyCode })}
            </label>
            <CmxMoneyField
              id="line-discount-value"
              value={value || null}
              draftValue={draft}
              decimalPlaces={isPercent ? PERCENT_DECIMALS : decimalPlaces}
              min={0}
              onValueChange={(_, d) => setDraft(d)}
              aria-invalid={draft !== '' && !!valueError}
            />
            {draft !== '' && valueError ? <p className="mt-1 text-sm text-red-600">{valueError}</p> : null}
          </div>

          <div>
            <label htmlFor="line-discount-reason" className="mb-1 block text-sm font-medium text-gray-700">
              {t('reasonLabel')}
            </label>
            <CmxTextarea
              id="line-discount-reason"
              value={reason}
              maxLength={REASON_MAX}
              rows={3}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t('reasonPlaceholder')}
            />
            <p className="mt-1 text-xs text-gray-500">{t('reasonHint')}</p>
          </div>
        </div>

        <CmxDialogFooter>
          {current ? (
            <CmxButton type="button" variant="ghost" onClick={() => { onRemove(); onClose(); }}>
              {t('remove')}
            </CmxButton>
          ) : null}
          <CmxButton type="button" variant="outline" onClick={onClose}>
            {tCommon('cancel')}
          </CmxButton>
          <CmxButton
            type="button"
            disabled={!canApply}
            title={!canApply ? valueError ?? reasonError ?? t('waitingForPrice') : undefined}
            onClick={() => {
              onApply({ type, value, reason: reason.trim() });
              onClose();
            }}
          >
            {t('apply')}
          </CmxButton>
        </CmxDialogFooter>
      </CmxDialogContent>
    </CmxDialog>
  );
}
