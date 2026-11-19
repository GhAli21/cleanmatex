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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@ui/primitives/table';
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
        <p className="text-sm text-muted-foreground">{t('message')}</p>
        <div className="overflow-hidden rounded-lg border border-border">
          <Table className="w-full text-sm">
            <TableHeader className="bg-muted text-foreground">
              <TableRow>
                <TableHead scope="col" className="px-3 py-2 text-start font-semibold">{t('item')}</TableHead>
                <TableHead scope="col" className="px-3 py-2 text-end font-semibold">{t('shownPrice')}</TableHead>
                <TableHead scope="col" className="px-3 py-2 text-end font-semibold">{t('currentPrice')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((line) => (
                <TableRow key={line.index} className="border-t border-border">
                  <TableCell className="px-3 py-2 text-start text-foreground">{itemName(line.index)}</TableCell>
                  <TableCell className="px-3 py-2 text-end tabular-nums text-muted-foreground line-through">
                    <bdi dir="ltr">{fmt(line.shownUnitPrice)}</bdi>
                  </TableCell>
                  <TableCell className="px-3 py-2 text-end tabular-nums font-semibold text-foreground">
                    <bdi dir="ltr">{fmt(line.currentUnitPrice)}</bdi>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <p className="text-xs text-muted-foreground">{t('hint')}</p>
        <CmxDialogFooter>
          <CmxButton type="button" variant="outline" onClick={onBack}>{t('back')}</CmxButton>
          <CmxButton type="button" onClick={onUseCurrentPrices}>{t('useCurrentPrices')}</CmxButton>
        </CmxDialogFooter>
      </CmxDialogContent>
    </CmxDialog>
  );
}
