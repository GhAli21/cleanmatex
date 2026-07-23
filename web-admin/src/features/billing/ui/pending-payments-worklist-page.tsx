'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { ColumnDef } from '@tanstack/react-table';
import { CmxDataTable } from '@ui/data-display/cmx-datatable';
import {
  CmxSelectDropdown,
  CmxSelectDropdownTrigger,
  CmxSelectDropdownContent,
  CmxSelectDropdownItem,
} from '@ui/forms/cmx-select-dropdown';
import { CmxButton } from '@ui/primitives/cmx-button';
import { CmxSummaryMessage } from '@ui/feedback/cmx-summary-message';
import Link from 'next/link';
import { useHasPermissionCode } from '@/lib/hooks/usePermissions';
import { PaymentTransitionDialog, type PaymentTransitionActionKind } from './payment-transition-dialog';

const STATUS_OPTIONS = ['', 'PENDING', 'PROCESSING'] as const;

interface WorklistRow {
  id: string;
  order_id: string;
  order_no: string | null;
  branch_name: string | null;
  customer_name: string | null;
  payment_method_code: string;
  payment_status: string;
  amount: number;
  currency_code: string;
  reference: string | null;
  created_at: string;
}

interface WorklistCounts {
  pending: number;
  processing: number;
  total: number;
}

function StatusBadge({ status }: { status: string }) {
  const style =
    status === 'PROCESSING'
      ? { bg: 'bg-blue-100', text: 'text-blue-800' }
      : { bg: 'bg-amber-100', text: 'text-amber-800' };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${style.bg} ${style.text}`}>
      {status}
    </span>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' });
}

/**
 * B30 — cross-order pending-payments back-office worklist. Health counts +
 * a filterable list with per-row VERIFY / CANCEL / FAIL-BOUNCE actions,
 * mirroring the B7 outbox-monitor-page.tsx structural pattern.
 */
export function PendingPaymentsWorklistPage() {
  const t = useTranslations('billing.pendingPayments');
  const canVerify = useHasPermissionCode('orders:verify_payment');
  const canCancel = useHasPermissionCode('orders:cancel_payment');
  const canFail = useHasPermissionCode('orders:fail_payment');

  const [counts, setCounts] = useState<WorklistCounts | null>(null);
  const [rows, setRows] = useState<WorklistRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('');
  const [dialogState, setDialogState] = useState<{
    row: WorklistRow;
    action: PaymentTransitionActionKind;
  } | null>(null);

  const fetchWorklist = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`/api/v1/finance/pending-payments?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setCounts(json.data.counts);
        setRows(json.data.rows);
        setTotalPages(json.pagination.totalPages);
      } else {
        setError(json.error ?? t('loadFailed'));
      }
    } catch {
      setError(t('loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, t]);

  useEffect(() => { void fetchWorklist(); }, [fetchWorklist]);

  const columns: ColumnDef<WorklistRow>[] = [
    {
      accessorKey: 'order_no',
      header: t('columns.order'),
      cell: ({ row }) => (
        <Link href={`/dashboard/orders/${row.original.order_id}`} className="text-xs font-medium text-blue-700 hover:underline">
          {row.original.order_no ?? row.original.order_id.slice(0, 8)}
        </Link>
      ),
    },
    {
      accessorKey: 'customer_name',
      header: t('columns.customer'),
      cell: ({ row }) => <span className="text-xs">{row.original.customer_name ?? '—'}</span>,
    },
    {
      accessorKey: 'branch_name',
      header: t('columns.branch'),
      cell: ({ row }) => <span className="text-xs text-gray-600">{row.original.branch_name ?? '—'}</span>,
    },
    {
      accessorKey: 'payment_method_code',
      header: t('columns.method'),
      cell: ({ row }) => <span className="text-xs font-mono">{row.original.payment_method_code}</span>,
    },
    {
      accessorKey: 'amount',
      header: t('columns.amount'),
      cell: ({ row }) => (
        <span className="text-xs font-medium tabular-nums">
          {row.original.amount.toFixed(2)} {row.original.currency_code}
        </span>
      ),
    },
    {
      accessorKey: 'payment_status',
      header: t('columns.status'),
      cell: ({ row }) => <StatusBadge status={row.original.payment_status} />,
    },
    {
      accessorKey: 'reference',
      header: t('columns.reference'),
      cell: ({ row }) => <span className="text-xs text-gray-600">{row.original.reference ?? '—'}</span>,
    },
    {
      accessorKey: 'created_at',
      header: t('columns.age'),
      cell: ({ row }) => <span className="whitespace-nowrap text-xs">{formatDate(row.original.created_at)}</span>,
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1.5">
          {canVerify ? (
            <CmxButton
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDialogState({ row: row.original, action: 'VERIFY' })}
            >
              {t('actions.verify')}
            </CmxButton>
          ) : null}
          {canFail ? (
            <CmxButton
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDialogState({ row: row.original, action: 'FAIL_BOUNCE' })}
            >
              {t('actions.failBounce')}
            </CmxButton>
          ) : null}
          {canCancel ? (
            <CmxButton
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => setDialogState({ row: row.original, action: 'CANCEL' })}
            >
              {t('actions.cancel')}
            </CmxButton>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div className="px-4 py-6">
      <div className="mb-4">
        <h1 className="me-auto text-xl font-semibold text-[rgb(var(--cmx-foreground-rgb,15_23_42))]">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('description')}</p>
      </div>

      {counts ? (
        <div className="mb-6 grid grid-cols-3 gap-3 sm:max-w-md">
          {(
            [
              ['pending', counts.pending, 'text-amber-800'],
              ['processing', counts.processing, 'text-blue-800'],
              ['total', counts.total, 'text-slate-800'],
            ] as const
          ).map(([key, value, colorClass]) => (
            <div key={key} className="rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2">
              <div className="text-xs text-muted-foreground">{t(`counts.${key}`)}</div>
              <div className={`text-lg font-bold tabular-nums ${colorClass}`}>{value}</div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <CmxSelectDropdown value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
          <CmxSelectDropdownTrigger className="w-44 text-sm">
            {statusFilter || t('allStatuses')}
          </CmxSelectDropdownTrigger>
          <CmxSelectDropdownContent>
            {STATUS_OPTIONS.map((st) => (
              <CmxSelectDropdownItem key={st} value={st}>
                {st || t('allStatuses')}
              </CmxSelectDropdownItem>
            ))}
          </CmxSelectDropdownContent>
        </CmxSelectDropdown>

        <CmxButton variant="outline" size="sm" onClick={() => void fetchWorklist()}>
          {t('refresh')}
        </CmxButton>
      </div>

      {error ? <CmxSummaryMessage type="error" title={error} items={[]} className="mb-4" /> : null}

      <CmxDataTable
        columns={columns}
        data={rows}
        loading={loading}
        total={totalPages * 20}
        currentPage={page}
        onPageChange={setPage}
        emptyMessage={t('empty')}
      />

      {dialogState ? (
        <PaymentTransitionDialog
          open
          onOpenChange={(next) => { if (!next) setDialogState(null); }}
          orderId={dialogState.row.order_id}
          paymentId={dialogState.row.id}
          action={dialogState.action}
          onTransitioned={() => { setDialogState(null); void fetchWorklist(); }}
        />
      ) : null}
    </div>
  );
}
