'use client';

import { useLocale, useTranslations } from 'next-intl';
import { CmxDataTable } from '@ui/data-display';
import { Badge } from '@ui/primitives/badge';
import type { ArCustomerLedgerEntry } from '@/lib/types/ar-invoice';

interface ArLedgerTableProps {
  rows: ArCustomerLedgerEntry[];
  page?: number;
  limit?: number;
  total?: number;
  onPageChange?: (page: number) => void;
}

function formatCurrency(amount: number, currencyCode: string, locale: string) {
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-OM' : 'en-OM', {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(amount);
}

function formatDateTime(value: string, locale: string) {
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-OM' : 'en-OM', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

/**
 *
 * @param root0
 * @param root0.rows
 * @param root0.page
 * @param root0.limit
 * @param root0.total
 * @param root0.onPageChange
 */
export function ArLedgerTable({
  rows,
  page = 1,
  limit = rows.length || 20,
  total = rows.length,
  onPageChange,
}: ArLedgerTableProps) {
  const t = useTranslations('invoices.ar.ledger');
  const locale = useLocale();

  return (
    <CmxDataTable
      columns={[
        {
          key: 'event_at',
          header: t('columns.eventAt'),
          render: (row) => formatDateTime(row.event_at, locale),
          sortable: false,
        },
        {
          key: 'movement',
          header: t('columns.movement'),
          render: (row) => row.movement_cd,
          sortable: false,
        },
        {
          key: 'side',
          header: t('columns.side'),
          render: (row) => (
            <Badge variant={row.entry_side === 'DEBIT' ? 'warning' : 'success'}>
              {t(`sides.${row.entry_side}`)}
            </Badge>
          ),
          sortable: false,
        },
        {
          key: 'amount',
          header: t('columns.amount'),
          render: (row) => formatCurrency(row.amount, row.currency_code, locale),
          sortable: false,
          align: 'right',
        },
        {
          key: 'running_balance',
          header: t('columns.runningBalance'),
          render: (row) => formatCurrency(row.running_balance, row.currency_code, locale),
          sortable: false,
          align: 'right',
        },
        {
          key: 'reference',
          header: t('columns.reference'),
          render: (row) => row.ref_doc_no ?? '—',
          sortable: false,
        },
      ]}
      data={rows}
      currentPage={page}
      pageSize={limit}
      total={total}
      onPageChange={onPageChange}
      emptyStateTitle={t('emptyTitle')}
      emptyStateDescription={t('emptyDescription')}
      showRowNumbers
      paginationFooter="auto"
    />
  );
}
