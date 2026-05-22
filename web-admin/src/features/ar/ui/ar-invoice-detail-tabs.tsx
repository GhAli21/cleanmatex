'use client';

import { useLocale, useTranslations } from 'next-intl';
import { CmxDataTable } from '@ui/data-display';
import { CmxTabsPanel } from '@ui/navigation';
import type { ArInvoiceDetail } from '@/lib/types/ar-invoice';

interface ArInvoiceDetailTabsProps {
  detail: ArInvoiceDetail;
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

export function ArInvoiceDetailTabs({ detail }: ArInvoiceDetailTabsProps) {
  const t = useTranslations('invoices.ar.detailTabs');
  const locale = useLocale();
  const currencyCode = detail.invoice.currency_code;

  return (
    <CmxTabsPanel
      defaultTab="lines"
      tabs={[
        {
          id: 'lines',
          label: t('lines'),
          content: (
            <CmxDataTable
              columns={[
                { key: 'line_no', header: '#', render: (row) => row.line_no, sortable: false },
                { key: 'description', header: t('columns.description'), render: (row) => row.description, sortable: false },
                { key: 'quantity', header: t('columns.quantity'), render: (row) => row.quantity, sortable: false, align: 'right' },
                { key: 'unit_price', header: t('columns.unitPrice'), render: (row) => formatCurrency(row.unit_price, row.currency_code, locale), sortable: false, align: 'right' },
                { key: 'total', header: t('columns.total'), render: (row) => formatCurrency(row.total_amount, row.currency_code, locale), sortable: false, align: 'right' },
              ]}
              data={detail.lines}
              emptyStateTitle={t('emptyLinesTitle')}
              emptyStateDescription={t('emptyLinesDescription')}
              paginationFooter="never"
            />
          ),
        },
        {
          id: 'orders',
          label: t('orders'),
          content: (
            <CmxDataTable
              columns={[
                { key: 'order_id', header: t('columns.orderId'), render: (row) => row.order_id, sortable: false },
                { key: 'order_total', header: t('columns.orderTotal'), render: (row) => formatCurrency(row.order_total_amount, currencyCode, locale), sortable: false, align: 'right' },
                { key: 'invoiced', header: t('columns.invoicedAmount'), render: (row) => formatCurrency(row.invoiced_amount, currencyCode, locale), sortable: false, align: 'right' },
                { key: 'outstanding', header: t('columns.outstandingAmount'), render: (row) => formatCurrency(row.outstanding_amount, currencyCode, locale), sortable: false, align: 'right' },
              ]}
              data={detail.orders}
              emptyStateTitle={t('emptyOrdersTitle')}
              emptyStateDescription={t('emptyOrdersDescription')}
              paginationFooter="never"
            />
          ),
        },
        {
          id: 'allocations',
          label: t('allocations'),
          content: (
            <CmxDataTable
              columns={[
                { key: 'allocation_no', header: '#', render: (row) => row.allocation_no, sortable: false },
                { key: 'outcome', header: t('columns.outcome'), render: (row) => row.allocation_outcome, sortable: false },
                { key: 'allocated', header: t('columns.allocatedAmount'), render: (row) => formatCurrency(row.allocated_amount, currencyCode, locale), sortable: false, align: 'right' },
                { key: 'unapplied', header: t('columns.unappliedCredit'), render: (row) => formatCurrency(row.unapplied_credit_amount, currencyCode, locale), sortable: false, align: 'right' },
                { key: 'applied_at', header: t('columns.appliedAt'), render: (row) => formatDateTime(row.applied_at, locale), sortable: false },
              ]}
              data={detail.allocations}
              emptyStateTitle={t('emptyAllocationsTitle')}
              emptyStateDescription={t('emptyAllocationsDescription')}
              paginationFooter="never"
            />
          ),
        },
        {
          id: 'adjustments',
          label: t('adjustments'),
          content: (
            <CmxDataTable
              columns={[
                { key: 'adjustment_no', header: '#', render: (row) => row.adjustment_no, sortable: false },
                { key: 'type', header: t('columns.type'), render: (row) => row.adjustment_type_cd, sortable: false },
                { key: 'status', header: t('columns.status'), render: (row) => row.status_cd, sortable: false },
                { key: 'amount', header: t('columns.amount'), render: (row) => formatCurrency(row.adjustment_amount, currencyCode, locale), sortable: false, align: 'right' },
                { key: 'reason', header: t('columns.reason'), render: (row) => row.reason ?? '—', sortable: false },
              ]}
              data={detail.adjustments}
              emptyStateTitle={t('emptyAdjustmentsTitle')}
              emptyStateDescription={t('emptyAdjustmentsDescription')}
              paginationFooter="never"
            />
          ),
        },
        {
          id: 'history',
          label: t('history'),
          content: (
            <CmxDataTable
              columns={[
                { key: 'created_at', header: t('columns.changedAt'), render: (row) => formatDateTime(row.created_at, locale), sortable: false },
                { key: 'from', header: t('columns.fromStatus'), render: (row) => row.from_status ?? '—', sortable: false },
                { key: 'to', header: t('columns.toStatus'), render: (row) => row.to_status, sortable: false },
                { key: 'action', header: t('columns.action'), render: (row) => row.action_cd ?? '—', sortable: false },
                { key: 'reason', header: t('columns.reason'), render: (row) => row.reason ?? '—', sortable: false },
              ]}
              data={detail.history}
              emptyStateTitle={t('emptyHistoryTitle')}
              emptyStateDescription={t('emptyHistoryDescription')}
              paginationFooter="never"
            />
          ),
        },
        {
          id: 'ledger',
          label: t('ledger'),
          content: (
            <CmxDataTable
              columns={[
                { key: 'event_at', header: t('columns.changedAt'), render: (row) => formatDateTime(row.event_at, locale), sortable: false },
                { key: 'movement', header: t('columns.movement'), render: (row) => row.movement_cd, sortable: false },
                { key: 'side', header: t('columns.side'), render: (row) => row.entry_side, sortable: false },
                { key: 'amount', header: t('columns.amount'), render: (row) => formatCurrency(row.amount, row.currency_code, locale), sortable: false, align: 'right' },
                { key: 'running_balance', header: t('columns.runningBalance'), render: (row) => formatCurrency(row.running_balance, row.currency_code, locale), sortable: false, align: 'right' },
              ]}
              data={detail.ledger}
              emptyStateTitle={t('emptyLedgerTitle')}
              emptyStateDescription={t('emptyLedgerDescription')}
              paginationFooter="never"
            />
          ),
        },
      ]}
    />
  );
}
