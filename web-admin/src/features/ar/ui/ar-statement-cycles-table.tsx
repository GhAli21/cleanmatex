'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRouter, useSearchParams } from 'next/navigation';
import { CmxDataTable } from '@ui/data-display';
import type { ArStatementCycle } from '@/lib/types/ar-invoice';

interface ArStatementCyclesTableProps {
  rows: ArStatementCycle[];
  page: number;
  limit: number;
  total: number;
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
export function ArStatementCyclesTable({ rows, page, limit, total }: ArStatementCyclesTableProps) {
  const t = useTranslations('invoices.ar.v2.cycles');
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
        { key: 'cycle_code', header: t('columns.code'), render: (row) => row.cycle_code, sortable: false },
        {
          key: 'cycle_name',
          header: t('columns.name'),
          render: (row) => row.cycle_name2 ?? row.cycle_name,
          sortable: false,
        },
        { key: 'cadence_cd', header: t('columns.cadence'), render: (row) => row.cadence_cd, sortable: false },
        { key: 'customer_scope_cd', header: t('columns.scope'), render: (row) => row.customer_scope_cd, sortable: false },
        {
          key: 'due_terms_days',
          header: t('columns.terms'),
          render: (row) => row.due_terms_days,
          sortable: false,
          align: 'right',
        },
        {
          key: 'next_run_at',
          header: t('columns.nextRun'),
          render: (row) => formatDateTime(row.next_run_at, locale),
          sortable: false,
        },
        {
          key: 'is_active',
          header: t('columns.active'),
          render: (row) => (row.is_active ? t('yes') : t('no')),
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
