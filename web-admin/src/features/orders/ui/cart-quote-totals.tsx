/**
 * Cart totals from the server quote (Line-Level P5-03, BF-19, D33).
 *
 * Shows only figures the server calculated (the same quote the payment modal
 * and submit use), never a client sum. While a changed cart is being priced,
 * the last figures stay visible but are marked "Updating" and are not final.
 */

'use client';

import { useLocale, useTranslations } from 'next-intl';
import { CmxButton } from '@ui/primitives';
import { useTenantCurrency } from '@/lib/context/tenant-currency-context';
import { formatMoneyAmountWithCode } from '@/lib/money/format-money';
import { CART_QUOTE_DISCLOSURES, type CartQuoteData } from '@/lib/types/cart-quote';

/** Error codes that have their own EN/AR explanation; any other code gets the generic one. */
const EXPLAINED_ERRORS = new Set([
  'PRODUCT_NOT_FOUND',
  'PREFERENCE_NOT_AVAILABLE',
  'SERVICE_SPEED_INVALID',
  'TIMEZONE_NOT_CONFIGURED',
  'PRICE_NOT_RESOLVED',
  'PRICE_BELOW_MINIMUM',
  'PRICE_OVERRIDE_NOT_PERMITTED',
  'MISSING_TENANT_CURRENCY',
  'LINE_DISCOUNT_NOT_PERMITTED',
  'LINE_DISCOUNT_EXCEEDS_GROSS',
  'INVALID_ADJUSTMENT',
]);

/** Props: the state returned by `useCartQuote`. */
export interface CartQuoteTotalsProps {
  data: CartQuoteData | null;
  pending: boolean;
  failed: boolean;
  errorCode: string | null;
  onRetry: () => void;
  /** Shown before the first answer, so the figures keep the tenant currency. */
  currencyCode: string;
}

/**
 * The summary rail's money block: subtotal, discounts, charges, tax, rounding and total.
 * @param props - cart quote state and retry action
 * @returns the totals block, or null for an empty cart
 */
export function CartQuoteTotals({ data, pending, failed, errorCode, onRetry, currencyCode }: CartQuoteTotalsProps) {
  const t = useTranslations('newOrder.orderSummary');
  const locale = useLocale();
  const { decimalPlaces } = useTenantCurrency();

  if (!data && !pending && !failed) return null;

  const fmt = (amount: number) =>
    formatMoneyAmountWithCode(amount, {
      currencyCode: data?.currencyCode ?? currencyCode,
      decimalPlaces: data?.decimalPlaces ?? decimalPlaces,
      locale: locale === 'ar' ? 'ar' : 'en',
    });
  const totals = data?.totals;
  const chargeTax = data?.disclosures.find((d) => d.code === CART_QUOTE_DISCLOSURES.ORDER_CHARGE_TAXED);
  const rows: Array<{ key: string; label: string; amount: number; sign?: '−' }> = totals
    ? [
        { key: 'subtotal', label: t('subtotal'), amount: totals.subtotal },
        ...(totals.orderDiscountTotal > 0 ? [{ key: 'discounts', label: t('discounts'), amount: totals.orderDiscountTotal, sign: '−' as const }] : []),
        ...(totals.chargesTotal > 0 ? [{ key: 'charges', label: t('charges'), amount: totals.chargesTotal }] : []),
        ...(totals.taxTotal > 0
          ? [{ key: 'tax', label: data?.taxPricingMode === 'TAX_INCLUSIVE' ? t('taxIncluded') : t('tax'), amount: totals.taxTotal }]
          : []),
        ...(totals.roundingAdjustmentAmount !== 0 ? [{ key: 'rounding', label: t('rounding'), amount: totals.roundingAdjustmentAmount }] : []),
      ]
    : [];

  return (
    <div className="px-3 py-2 border-t border-gray-200 bg-white" aria-busy={pending} aria-live="polite">
      {failed ? (
        <div role="alert" className="flex items-start justify-between gap-2 text-xs text-red-700">
          <p className="min-w-0">
            {t(`quote.errors.${errorCode && EXPLAINED_ERRORS.has(errorCode) ? errorCode : 'default'}`)}
          </p>
          <CmxButton type="button" size="xs" variant="outline" onClick={onRetry}>
            {t('quote.retry')}
          </CmxButton>
        </div>
      ) : null}

      {totals ? (
        <dl className={`space-y-0.5 text-xs ${pending || failed ? 'opacity-50' : ''}`}>
          {rows.map((row) => (
            <div key={row.key} className="flex items-center justify-between gap-2 text-gray-600">
              <dt>{row.label}</dt>
              <dd className="tabular-nums">{row.sign ? `${row.sign} ` : ''}{fmt(row.amount)}</dd>
            </div>
          ))}
          <div className="flex items-center justify-between gap-2 pt-1 text-sm font-bold text-gray-900">
            <dt>{t('total')}</dt>
            <dd className="tabular-nums">{fmt(totals.saleTotal)}</dd>
          </div>
        </dl>
      ) : null}

      {pending ? <p className="mt-1 text-[11px] text-gray-500">{t('quote.updating')}</p> : null}
      {chargeTax && !pending && !failed ? (
        <p className="mt-1 text-[11px] text-gray-500">{t('quote.orderChargeTaxed', { amount: fmt(chargeTax.amount) })}</p>
      ) : null}
    </div>
  );
}
