'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { CmxDataTable } from '@ui/data-display';
import type { ArCustomerCreditRow } from '@/lib/types/ar-invoice';

interface ArCreditsTableProps {
  rows: ArCustomerCreditRow[];
  page: number;
  limit: number;
  total: number;
}

function formatCurrency(amount: number, currencyCode: string, locale: string) {
  return new Intl.NumberFormat(locale === 'ar' ? 'ar' : 'en', {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(amount);
}

function formatDateTime(value: string | undefined, locale: string) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar' : 'en', {
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
 */
export function ArCreditsTable({ rows, page, limit, total }: ArCreditsTableProps) {
  const t = useTranslations('invoices.ar.v2.credits');
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();

  const onPageChange = (nextPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(nextPage));
    router.push(`?${params.toString()}`);
  };

  return (
    <CmxDataTable
      columns={[
        {
          key: 'customer',
          header: t('columns.customer'),
          render: (row) => row.customer_name ?? row.customer_name2 ?? row.customer_id,
          sortable: false,
        },
        {
          key: 'source_ledger_id',
          header: t('columns.sourceLedger'),
          render: (row) => row.source_ledger_id,
          sortable: false,
        },
        {
          key: 'ref_doc_no',
          header: t('columns.reference'),
          render: (row) => row.ref_doc_no ?? '—',
          sortable: false,
        },
        {
          key: 'available_credit_amount',
          header: t('columns.availableCredit'),
          render: (row) => formatCurrency(row.available_credit_amount, row.currency_code, locale),
          sortable: false,
          align: 'right',
        },
        {
          key: 'last_credit_at',
          header: t('columns.lastCreditAt'),
          render: (row) => formatDateTime(row.last_credit_at, locale),
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
