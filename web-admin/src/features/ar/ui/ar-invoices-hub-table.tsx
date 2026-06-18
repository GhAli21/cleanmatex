'use client';

import Link from 'next/link';
import type { SortingState } from '@tanstack/react-table';
import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Badge } from '@ui/primitives/badge';
import { CmxButton } from '@ui/primitives';
import { CmxDataTable } from '@ui/data-display';
import {
  AR_STATUS_BADGE_TONES,
  AR_STATUS_TRANSLATION_KEYS,
  type ArInvoiceSummary,
} from '@/lib/types/ar-invoice';

interface ArInvoicesHubTableProps {
  invoices: ArInvoiceSummary[];
  page: number;
  limit: number;
  total: number;
  sorting: SortingState;
}

function formatCurrency(amount: number, currencyCode: string, locale: string) {
  return new Intl.NumberFormat(locale === 'ar' ? 'ar-OM' : 'en-OM', {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(amount);
}

function formatDate(value: string | undefined, locale: string) {
  if (!value) return '—';
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-OM' : 'en-OM', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(value));
}

/**
 *
 * @param root0
 * @param root0.invoices
 * @param root0.page
 * @param root0.limit
 * @param root0.total
 * @param root0.sorting
 */
export function ArInvoicesHubTable({
  invoices,
  page,
  limit,
  total,
  sorting,
}: ArInvoicesHubTableProps) {
  const t = useTranslations('invoices');
  const tHub = useTranslations('invoices.ar.hub');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const updateParams = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value == null || value === '') params.delete(key);
      else params.set(key, value);
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <CmxDataTable
      columns={[
        {
          key: 'invoice_no',
          header: tHub('columns.invoiceNo'),
          render: (row) => (
            <Link
              href={`/dashboard/internal_fin/invoices/${row.id}`}
              className="font-medium text-sky-700 hover:text-sky-900"
            >
              {row.invoice_no}
            </Link>
          ),
        },
        {
          key: 'invoice_date',
          header: tHub('columns.invoiceDate'),
          render: (row) => formatDate(row.invoice_date, locale),
        },
        {
          key: 'customer_name',
          header: tHub('columns.customer'),
          render: (row) => row.customer_name ?? row.customer_name2 ?? '—',
          sortable: false,
        },
        {
          key: 'order_no',
          header: tHub('columns.order'),
          render: (row) => row.order_no ?? '—',
          sortable: false,
        },
        {
          key: 'invoice_type_cd',
          header: tHub('columns.invoiceType'),
          render: (row) =>
            row.invoice_type_cd ? tHub(`invoiceTypeOptions.${row.invoice_type_cd}`) : '—',
          sortable: false,
        },
        {
          key: 'status',
          header: tHub('columns.status'),
          render: (row) => (
            <Badge className={AR_STATUS_BADGE_TONES[row.status]}>
              {t(`statuses.${AR_STATUS_TRANSLATION_KEYS[row.status]}`)}
            </Badge>
          ),
        },
        {
          key: 'total',
          header: tHub('columns.total'),
          render: (row) => formatCurrency(row.total, row.currency_code, locale),
          align: 'right',
        },
        {
          key: 'paid_amount',
          header: tHub('columns.paid'),
          render: (row) => formatCurrency(row.paid_amount, row.currency_code, locale),
          align: 'right',
        },
        {
          key: 'outstanding_amount',
          header: tHub('columns.outstanding'),
          render: (row) => formatCurrency(row.outstanding_amount, row.currency_code, locale),
          align: 'right',
        },
        {
          key: 'due_date',
          header: tHub('columns.dueDate'),
          render: (row) => formatDate(row.due_date, locale),
        },
        {
          key: 'issued_at',
          header: tHub('columns.issuedAt'),
          render: (row) => formatDate(row.issued_at, locale),
          sortable: false,
        },
        {
          key: 'actions',
          header: tCommon('actions'),
          render: (row) => (
            <div className="flex items-center gap-2 rtl:flex-row-reverse">
              <CmxButton asChild size="sm" variant="outline">
                <Link href={`/dashboard/internal_fin/invoices/${row.id}`}>{tCommon('view')}</Link>
              </CmxButton>
              <CmxButton asChild size="sm" variant="ghost">
                <Link href={`/dashboard/internal_fin/invoices/${row.id}/print`}>{tCommon('print')}</Link>
              </CmxButton>
            </div>
          ),
          sortable: false,
        },
      ]}
      data={invoices}
      currentPage={page}
      pageSize={limit}
      total={total}
      sorting={sorting}
      onSortingChange={(nextSorting) => {
        const firstSort = nextSorting[0];
        updateParams({
          sort_by: firstSort?.id ?? null,
          sort_order: firstSort?.desc ? 'desc' : firstSort ? 'asc' : null,
          page: '1',
        });
      }}
      onPageChange={(nextPage) => updateParams({ page: String(nextPage) })}
      emptyStateTitle={tHub('emptyTitle')}
      emptyStateDescription={tHub('emptyDescription')}
      showRowNumbers
      paginationFooter="auto"
      scrollAreaClassName="max-h-[min(72vh,46rem)] overflow-auto"
    />
  );
}
