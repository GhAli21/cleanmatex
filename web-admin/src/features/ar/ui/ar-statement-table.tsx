'use client';

import { useLocale, useTranslations } from 'next-intl';
import { CmxDataTable } from '@ui/data-display';
import type { ArStatementLine } from '@/lib/types/ar-invoice';

interface ArStatementTableProps {
  rows: ArStatementLine[];
}

function formatCurrency(amount: number, currencyCode: string, locale: string) {
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-OM' : 'en-OM', {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(amount);
}

function formatDate(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-OM' : 'en-OM', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(value));
}

/**
 *
 * @param root0
 * @param root0.rows
 */
export function ArStatementTable({ rows }: ArStatementTableProps) {
  const t = useTranslations('invoices.ar.statements');
  const locale = useLocale();

  return (
    <CmxDataTable
      columns={[
        {
          key: 'event_at',
          header: t('columns.eventAt'),
          render: (row) => formatDate(row.event_at, locale),
          sortable: false,
        },
        {
          key: 'kind',
          header: t('columns.kind'),
          render: (row) => row.kind,
          sortable: false,
        },
        {
          key: 'reference',
          header: t('columns.reference'),
          render: (row) => row.ref_no ?? '—',
          sortable: false,
        },
        {
          key: 'description',
          header: t('columns.description'),
          render: (row) => row.description ?? '—',
          sortable: false,
        },
        {
          key: 'debit',
          header: t('columns.debit'),
          render: (row) => formatCurrency(row.debit_amount, row.currency_code, locale),
          sortable: false,
          align: 'right',
        },
        {
          key: 'credit',
          header: t('columns.credit'),
          render: (row) => formatCurrency(row.credit_amount, row.currency_code, locale),
          sortable: false,
          align: 'right',
        },
        {
          key: 'balance',
          header: t('columns.balance'),
          render: (row) => formatCurrency(row.running_balance, row.currency_code, locale),
          sortable: false,
          align: 'right',
        },
      ]}
      data={rows}
      emptyStateTitle={t('emptyTitle')}
      emptyStateDescription={t('emptyDescription')}
      showRowNumbers
      paginationFooter="never"
    />
  );
}
