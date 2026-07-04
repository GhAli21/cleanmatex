'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { CmxDataTable } from '@ui/data-display';
import type { ArDisputeCase } from '@/lib/types/ar-invoice';

interface ArDisputesTableProps {
  rows: ArDisputeCase[];
  page: number;
  limit: number;
  total: number;
}

function formatCurrency(amount: number, locale: string) {
  return new Intl.NumberFormat(locale === 'ar' ? 'ar' : 'en', {
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
export function ArDisputesTable({ rows, page, limit, total }: ArDisputesTableProps) {
  const t = useTranslations('invoices.ar.v2.disputes');
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
        { key: 'dispute_no', header: t('columns.disputeNo'), render: (row) => row.dispute_no, sortable: false },
        { key: 'invoice_no', header: t('columns.invoiceNo'), render: (row) => row.invoice_no ?? row.invoice_id, sortable: false },
        { key: 'customer', header: t('columns.customer'), render: (row) => row.customer_name ?? row.customer_name2 ?? row.customer_id, sortable: false },
        { key: 'status_cd', header: t('columns.status'), render: (row) => row.status_cd, sortable: false },
        { key: 'reason_cd', header: t('columns.reason'), render: (row) => row.reason_cd, sortable: false },
        { key: 'disputed_amount', header: t('columns.amount'), render: (row) => formatCurrency(row.disputed_amount, locale), sortable: false, align: 'right' },
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
