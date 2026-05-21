'use client';
/* eslint-disable react-hooks/set-state-in-effect */

/**
 * Stored Value Hub — Client Component
 *
 * Shows a table of all customers with wallet, advance, or active credit note balances.
 * Each row links to the customer detail page.
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Wallet, RefreshCw } from 'lucide-react';
import { CmxButton } from '@ui/primitives';
import { CmxDataTable } from '@ui/data-display';
import { cmxMessage } from '@ui/feedback';
import { getAllStoredValueSummaries } from '@/app/actions/customers/stored-value-actions';
import type { StoredValueSummaryRow } from '@/app/actions/customers/stored-value-actions';

export function StoredValueHubClient() {
  const t       = useTranslations('customers.storedValue');
  const tCommon = useTranslations('common');

  const [rows, setRows]         = useState<StoredValueSummaryRow[]>([]);
  const [isLoading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await getAllStoredValueSummaries();
    if (result.success) {
      setRows(result.data);
    } else {
      const errorMsg = (result as { success: false; error: string }).error;
      cmxMessage.error(errorMsg);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">{t('hubTitle')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('hubDescription')}</p>
        </div>
        <CmxButton variant="outline" size="sm" onClick={load} className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4" />
          {tCommon('refresh')}
        </CmxButton>
      </div>

      {/* Table */}
      <CmxDataTable
        isLoading={isLoading}
        columns={[
          {
            key: 'customerName',
            header: tCommon('name'),
            render: (row: StoredValueSummaryRow) => (
              <Link
                href={`/dashboard/customers/${row.customerId}`}
                className="font-medium text-primary hover:underline"
              >
                {row.customerName}
              </Link>
            ),
          },
          {
            key: 'walletBalance',
            header: t('walletBalance'),
            render: (row: StoredValueSummaryRow) => (
              <span className="tabular-nums">
                {row.walletCurrency ?? ''}{' '}
                {row.walletBalance.toFixed(3)}
              </span>
            ),
          },
          {
            key: 'advanceBalance',
            header: t('advanceBalance'),
            render: (row: StoredValueSummaryRow) => (
              <span className="tabular-nums">
                {row.advanceCurrency ?? ''}{' '}
                {row.advanceBalance.toFixed(3)}
              </span>
            ),
          },
          {
            key: 'creditNoteCount',
            header: t('creditNotes'),
            render: (row: StoredValueSummaryRow) => (
              <span className="tabular-nums">
                {row.creditNoteCount > 0 ? (
                  <>
                    {row.creditNoteCount} —{' '}
                    {row.creditNoteCurrency ?? ''}{' '}
                    {row.creditNoteTotal.toFixed(3)}
                  </>
                ) : (
                  '—'
                )}
              </span>
            ),
          },
          {
            key: 'actions',
            header: tCommon('actions'),
            render: (row: StoredValueSummaryRow) => (
              <Link
                href={`/dashboard/customers/${row.customerId}`}
                className="inline-flex items-center gap-1 rounded border border-gray-300 px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50"
              >
                <Wallet className="h-3 w-3" />
                {tCommon('view')}
              </Link>
            ),
          },
        ]}
        data={rows}
        totalCount={rows.length}
        currentPage={1}
        pageSize={rows.length || 1}
        onPageChange={() => undefined}
      />
    </div>
  );
}
