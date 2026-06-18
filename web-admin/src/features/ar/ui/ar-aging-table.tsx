'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { CmxDataTable } from '@ui/data-display';
import { CmxButton } from '@ui/primitives';
import type { ArAgingCustomerRow } from '@/lib/types/ar-invoice';

interface ArAgingTableProps {
  rows: ArAgingCustomerRow[];
  page: number;
  limit: number;
  total: number;
}

function formatCurrency(amount: number, currencyCode: string, locale: string) {
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-OM' : 'en-OM', {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(amount);
}

/**
 *
 * @param root0
 * @param root0.rows
 * @param root0.page
 * @param root0.limit
 * @param root0.total
 */
export function ArAgingTable({ rows, page, limit, total }: ArAgingTableProps) {
  const t = useTranslations('invoices.ar.aging');
  const tCommon = useTranslations('common');
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
          key: 'current',
          header: t('columns.current'),
          render: (row) => formatCurrency(row.current_amount, row.currency_code, locale),
          sortable: false,
          align: 'right',
        },
        {
          key: 'due_1_30',
          header: t('columns.due_1_30'),
          render: (row) => formatCurrency(row.due_1_30_amount, row.currency_code, locale),
          sortable: false,
          align: 'right',
        },
        {
          key: 'due_31_60',
          header: t('columns.due_31_60'),
          render: (row) => formatCurrency(row.due_31_60_amount, row.currency_code, locale),
          sortable: false,
          align: 'right',
        },
        {
          key: 'due_61_90',
          header: t('columns.due_61_90'),
          render: (row) => formatCurrency(row.due_61_90_amount, row.currency_code, locale),
          sortable: false,
          align: 'right',
        },
        {
          key: 'due_90_plus',
          header: t('columns.due_90_plus'),
          render: (row) => formatCurrency(row.due_90_plus_amount, row.currency_code, locale),
          sortable: false,
          align: 'right',
        },
        {
          key: 'total',
          header: t('columns.total'),
          render: (row) => formatCurrency(row.total_outstanding_amount, row.currency_code, locale),
          sortable: false,
          align: 'right',
        },
        {
          key: 'actions',
          header: tCommon('actions'),
          render: (row) => (
            <div className="flex items-center gap-2 rtl:flex-row-reverse">
              <CmxButton asChild size="sm" variant="outline">
                <Link href={`/dashboard/internal_fin/ar/ledger?customerId=${row.customer_id}`}>
                  {t('actions.ledger')}
                </Link>
              </CmxButton>
              <CmxButton asChild size="sm" variant="ghost">
                <Link href={`/dashboard/internal_fin/ar/statements?customerId=${row.customer_id}`}>
                  {t('actions.statement')}
                </Link>
              </CmxButton>
            </div>
          ),
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
