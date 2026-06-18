'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { CmxDataTable } from '@ui/data-display';
import { CmxButton } from '@ui/primitives';
import type { ArCustomerBalanceRow } from '@/lib/types/ar-invoice';

interface ArCustomerBalancesTableProps {
  rows: ArCustomerBalanceRow[];
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

function formatDateTime(value: string | undefined, locale: string) {
  if (!value) return '—';
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
 */
export function ArCustomerBalancesTable({
  rows,
  page,
  limit,
  total,
}: ArCustomerBalancesTableProps) {
  const t = useTranslations('invoices.ar.customers');
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
          key: 'open_invoices',
          header: t('columns.openInvoices'),
          render: (row) => row.open_invoice_count,
          sortable: false,
          align: 'center',
        },
        {
          key: 'outstanding',
          header: t('columns.outstanding'),
          render: (row) => formatCurrency(row.total_outstanding_amount, row.currency_code, locale),
          sortable: false,
          align: 'right',
        },
        {
          key: 'unapplied',
          header: t('columns.unappliedCredit'),
          render: (row) => formatCurrency(row.unapplied_credit_amount, row.currency_code, locale),
          sortable: false,
          align: 'right',
        },
        {
          key: 'net_balance',
          header: t('columns.netBalance'),
          render: (row) => formatCurrency(row.net_balance_amount, row.currency_code, locale),
          sortable: false,
          align: 'right',
        },
        {
          key: 'last_activity',
          header: t('columns.lastActivity'),
          render: (row) => formatDateTime(row.last_activity_at, locale),
          sortable: false,
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
