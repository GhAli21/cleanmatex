/**
 * Amount Mismatch Dialog
 * Shown when server-calculated totals differ from client-reported totals.
 * User must refresh or retry to proceed with correct amounts.
 */

'use client';

import { useLocale, useTranslations } from 'next-intl';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { useTenantCurrency } from '@/lib/context/tenant-currency-context';
import { formatMoneyAmountWithCode } from '@/lib/money/format-money';
import type { AmountMismatchDifferences } from '@/lib/types/payment';
import {
  CmxDialog,
  CmxDialogContent,
  CmxDialogFooter,
  CmxDialogHeader,
  CmxDialogTitle,
} from '@ui/overlays';
import { CmxButton } from '@ui/primitives';
import { CmxDataTable, type CmxDataTableSimpleColumn } from '@ui/data-display/cmx-datatable';

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

  const entries = Object.entries(differences).filter(
    (entry): entry is [string, { client: number; server: number }] =>
      entry[1] != null && typeof entry[1] === 'object' && 'client' in entry[1] && 'server' in entry[1]
  );

  return (
    <CmxDialog open={open} onOpenChange={(next) => { if (!next) onClose(); }} stackAboveModals>
      <CmxDialogContent className="max-w-md w-full">
        <CmxDialogHeader>
          <div className="flex items-center gap-3">
            <AlertCircle className="w-7 h-7 text-warning-text flex-shrink-0" aria-hidden="true" />
            <CmxDialogTitle>{t('title')}</CmxDialogTitle>
          </div>
        </CmxDialogHeader>

        <div className="space-y-4">
          <p className="text-muted-foreground text-sm text-start">
            {message ?? t('message')}
          </p>

          {entries.length > 0 && (
            <CmxDataTable
              auditConfig={false}
              scrollable={false}
              paginationFooter="never"
              data={entries.map(([field, vals]) => ({ field, ...vals }))}
              columns={[
                {
                  key: 'field',
                  header: t('field'),
                  sortable: false,
                  render: (row) => (
                    <span className="text-foreground">
                      {t(`fields.${row.field}` as any) || row.field}
                    </span>
                  ),
                },
                {
                  key: 'client',
                  header: t('yourValue'),
                  align: 'end',
                  sortable: false,
                  render: (row) => (
                    <span className="text-muted-foreground tabular-nums">
                      <bdi dir="ltr">{fmt(row.client)}</bdi>
                    </span>
                  ),
                },
                {
                  key: 'server',
                  header: t('serverValue'),
                  align: 'end',
                  sortable: false,
                  render: (row) => (
                    <span className="font-medium text-foreground tabular-nums">
                      <bdi dir="ltr">{fmt(row.server)}</bdi>
                    </span>
                  ),
                },
              ] satisfies CmxDataTableSimpleColumn<{ field: string; client: number; server: number }>[]}
            />
          )}
        </div>

        <CmxDialogFooter className="gap-2">
          <CmxButton type="button" variant="outline" onClick={onClose} className="flex-1">
            {t('cancel')}
          </CmxButton>
          <CmxButton type="button" variant="primary" onClick={onRefresh} className="flex-1">
            <RefreshCw className="me-2 w-4 h-4" aria-hidden="true" />
            {t('refreshAmounts')}
          </CmxButton>
        </CmxDialogFooter>
      </CmxDialogContent>
    </CmxDialog>
  );
}
