/**
 * Amount Mismatch Dialog
 * Shown when server-calculated totals differ from client-reported totals.
 * User must refresh or retry to proceed with correct amounts.
 */

'use client';

import { useLocale, useTranslations } from 'next-intl';
import { AlertCircle, RefreshCw, X } from 'lucide-react';
import { useTenantCurrency } from '@/lib/context/tenant-currency-context';
import { formatMoneyAmountWithCode } from '@/lib/money/format-money';
import type { AmountMismatchDifferences } from '@/lib/types/payment';

interface AmountMismatchDialogProps {
  open: boolean;
  onClose: () => void;
  onRefresh: () => void;
  message?: string;
  differences?: AmountMismatchDifferences;
}


/**
 *
 * @param root0
 * @param root0.open
 * @param root0.onClose
 * @param root0.onRefresh
 * @param root0.message
 * @param root0.differences
 */
export function AmountMismatchDialog({
  open,
  onClose,
  onRefresh,
  message,
  differences = {},
}: AmountMismatchDialogProps) {
  const t = useTranslations('amountMismatch');
  const locale = useLocale();
  const { currencyCode, decimalPlaces } = useTenantCurrency();
  const moneyLocale = locale === 'ar' ? 'ar' : 'en';
  const fmt = (n: number) =>
    formatMoneyAmountWithCode(n, { currencyCode, decimalPlaces, locale: moneyLocale });

  if (!open) return null;

  const entries = Object.entries(differences).filter(
    (entry): entry is [string, { client: number; server: number }] =>
      entry[1] != null && typeof entry[1] === 'object' && 'client' in entry[1] && 'server' in entry[1]
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-card rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
        <header className="flex items-center gap-3 p-4 border-b border-border">
          <AlertCircle className="w-8 h-8 text-warning-text flex-shrink-0" />
          <h2 className="flex-1 font-bold text-lg text-foreground text-start">
            {t('title')}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-foreground rounded-lg"
            aria-label={t('cancel')}
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="p-4 space-y-4">
          <p className="text-muted-foreground text-sm text-start">
            {message ?? t('message')}
          </p>

          {entries.length > 0 && (
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted border-b border-border">
                    <th className="py-2 px-3 font-semibold text-foreground text-start">
                      {t('field')}
                    </th>
                    <th className="py-2 px-3 font-semibold text-foreground text-start">
                      {t('yourValue')}
                    </th>
                    <th className="py-2 px-3 font-semibold text-foreground text-start">
                      {t('serverValue')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map(([field, { client, server }]) => (
                    <tr key={field} className="border-b border-border last:border-b-0">
                      <td className="py-2 px-3 text-foreground text-start">
                        {t(`fields.${field}` as any) || field}
                      </td>
                      <td className="py-2 px-3 text-muted-foreground text-start">
                        {fmt(client)}
                      </td>
                      <td className="py-2 px-3 text-muted-foreground text-start">
                        {fmt(server)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onRefresh}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary-hover text-primary-foreground rounded-lg font-medium"
            >
              <RefreshCw className="w-4 h-4" />
              {t('refreshAmounts')}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-border hover:bg-muted rounded-lg font-medium"
            >
              {t('cancel')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
