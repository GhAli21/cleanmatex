'use client';

/**
 * Price changed dialog (Reusable Order Fin View D26, Line-Level P5-03d).
 *
 * Shown when submit was rejected because unit prices the cart showed changed
 * on the server. Nothing was saved. The cashier sees each line with the price
 * shown and the current price, and chooses: "Use current prices" re-prices the
 * cart and payment window in place (the cart is kept), then they press Submit
 * again; there is never an automatic resubmit (rule #15). "Back" changes nothing.
 */

import { useLocale, useTranslations } from 'next-intl';
import { CmxDialog, CmxDialogContent, CmxDialogFooter, CmxDialogHeader, CmxDialogTitle } from '@ui/overlays';
import { CmxButton } from '@ui/primitives';
import { useTenantCurrency } from '@/lib/context/tenant-currency-context';
import { formatMoneyAmountWithCode } from '@/lib/money/format-money';
import type { PriceChangedLine } from '@/lib/services/commercial/price-confirmation';

/** Props of the price changed dialog. */
export interface PriceChangedDialogProps {
  open: boolean;
  lines: readonly PriceChangedLine[];
  /** The cart line name at a cart position (the server reports positions). */
  itemName: (index: number) => string;
  onUseCurrentPrices: () => void;
  onBack: () => void;
}

/**
 * Lists the lines whose unit price changed between the cart and submit.
 * @param props - the changed lines, a name lookup and the two choices
 * @returns the dialog
 */
export function PriceChangedDialog({ open, lines, itemName, onUseCurrentPrices, onBack }: PriceChangedDialogProps) {
  const t = useTranslations('newOrder.priceChanged');
  const locale = useLocale();
  const { currencyCode, decimalPlaces } = useTenantCurrency();
  const fmt = (n: number) => formatMoneyAmountWithCode(n, { currencyCode, decimalPlaces, locale: locale === 'ar' ? 'ar' : 'en' });

  return (
    <CmxDialog open={open} onOpenChange={(o) => { if (!o) onBack(); }}>
      <CmxDialogContent className="max-w-lg">
        <CmxDialogHeader>
          <CmxDialogTitle>{t('title')}</CmxDialogTitle>
        </CmxDialogHeader>
        <p className="text-sm text-gray-600">{t('message')}</p>
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-700">
              <tr>
                <th scope="col" className="px-3 py-2 text-start font-semibold">{t('item')}</th>
                <th scope="col" className="px-3 py-2 text-end font-semibold">{t('shownPrice')}</th>
                <th scope="col" className="px-3 py-2 text-end font-semibold">{t('currentPrice')}</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.index} className="border-t border-gray-100">
                  <td className="px-3 py-2 text-start text-gray-800">{itemName(line.index)}</td>
                  <td className="px-3 py-2 text-end tabular-nums text-gray-500 line-through">{fmt(line.shownUnitPrice)}</td>
                  <td className="px-3 py-2 text-end tabular-nums font-semibold text-gray-900">{fmt(line.currentUnitPrice)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-500">{t('hint')}</p>
        <CmxDialogFooter>
          <CmxButton type="button" variant="outline" onClick={onBack}>{t('back')}</CmxButton>
          <CmxButton type="button" onClick={onUseCurrentPrices}>{t('useCurrentPrices')}</CmxButton>
        </CmxDialogFooter>
      </CmxDialogContent>
    </CmxDialog>
  );
}
