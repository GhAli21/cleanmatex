'use client';

import { useLocale, useTranslations } from 'next-intl';
import { ORDER_DEFAULTS } from '@/lib/constants/order-defaults';
import { useTenantCurrency } from '@/lib/context/tenant-currency-context';
import { formatMoneyAmountWithCode } from '@/lib/money/format-money';
import { useCallback, useEffect, useState } from 'react';
import { getCashUpHistory } from '@/app/actions/billing/cashup-actions';
import type { ReconciliationHistoryItem } from '@/lib/services/cashup-service';

interface CashUpHistoryProps {
  currencyCode?: string;
}

function formatDate(isoDate: string): string {
  try {
    return new Date(isoDate + 'Z').toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return isoDate;
  }
}

export default function CashUpHistory({
  currencyCode: currencyCodeProp = ORDER_DEFAULTS.CURRENCY,
}: CashUpHistoryProps) {
  const t = useTranslations('cashup');
  const locale = useLocale();
  const { currencyCode: tenantCc, decimalPlaces } = useTenantCurrency();
  const moneyLocale = locale === 'ar' ? 'ar' : 'en';
  const displayCurrency = (currencyCodeProp?.trim() || tenantCc) as string;
  const fmt = (n: number) =>
    formatMoneyAmountWithCode(n, {
      currencyCode: displayCurrency,
      decimalPlaces,
      locale: moneyLocale,
    });
  const [items, setItems] = useState<ReconciliationHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await getCashUpHistory({ limit: 30 });
    if (result.success) {
      setItems(result.data);
    } else {
      setError(result.error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <h2 className="mb-4 text-lg font-semibold text-gray-900">{t('history')}</h2>
      {loading && (
        <div className="py-4 text-sm text-gray-500">Loading...</div>
      )}
      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">{error}</div>
      )}
      {!loading && !error && items.length === 0 && (
        <p className="text-sm text-gray-500">{t('noReconciliation')}</p>
      )}
      {!loading && !error && items.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  {t('date')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  {t('method')}
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">
                  {t('expectedAmount')}
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">
                  {t('actualAmount')}
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">
                  {t('variance')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  {t('status')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  {t('reconciledBy')}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  {t('reconciledAt')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {items.map((row) => (
                <tr key={row.id}>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
                    {formatDate(row.reconciliation_date)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">
                    {row.payment_method_code}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-gray-700">
                    {fmt(row.expected_amount)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-sm text-gray-700">
                    {fmt(row.actual_amount)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-sm">
                    <span
                      className={
                        row.variance === 0
                          ? 'text-gray-700'
                          : row.variance > 0
                            ? 'text-green-600'
                            : 'text-red-600'
                      }
                    >
                      {fmt(row.variance)}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">
                    {row.status === 'reconciled'
                      ? t('reconciled')
                      : row.status === 'variance_noted'
                        ? t('varianceNoted')
                        : t('pending')}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                    {row.reconciled_by ?? '—'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-500">
                    {row.reconciled_at
                      ? new Date(row.reconciled_at).toLocaleString(undefined, {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
