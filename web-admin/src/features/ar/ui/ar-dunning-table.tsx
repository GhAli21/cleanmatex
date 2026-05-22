'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { CmxDataTable } from '@ui/data-display';
import type { ArDunningRun } from '@/lib/types/ar-invoice';

interface ArDunningTableProps {
  rows: ArDunningRun[];
  page: number;
  limit: number;
  total: number;
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

export function ArDunningTable({ rows, page, limit, total }: ArDunningTableProps) {
  const t = useTranslations('invoices.ar.v2.dunning');
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
          key: 'invoice',
          header: t('columns.invoice'),
          render: (row) => row.invoice_no ?? row.invoice_id ?? '—',
          sortable: false,
        },
        { key: 'stage_cd', header: t('columns.stage'), render: (row) => row.stage_cd, sortable: false },
        { key: 'action_cd', header: t('columns.action'), render: (row) => row.action_cd, sortable: false },
        { key: 'status_cd', header: t('columns.status'), render: (row) => row.status_cd, sortable: false },
        {
          key: 'executed_at',
          header: t('columns.executedAt'),
          render: (row) => formatDateTime(row.executed_at, locale),
          sortable: false,
        },
        {
          key: 'response_message',
          header: t('columns.response'),
          render: (row) => row.response_message ?? '—',
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
