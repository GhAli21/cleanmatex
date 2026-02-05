'use client';

import { useCallback } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Invoice } from '@/lib/types/payment';

interface ColumnDef {
  key: string;
  labelKey: string;
  sortField?: string;
  minWidth?: number;
  align?: 'left' | 'right' | 'center';
}

const COLUMNS: ColumnDef[] = [
  { key: 'invoiceNo', labelKey: 'invoiceNo', sortField: 'invoice_no', minWidth: 130 },
  { key: 'invoiceDate', labelKey: 'invoiceDate', sortField: 'invoice_date', minWidth: 110 },
  { key: 'orderNo', labelKey: 'orderNo', minWidth: 120 },
  { key: 'customer', labelKey: 'customer', minWidth: 140 },
  { key: 'customerReference', labelKey: 'customerReference', minWidth: 120 },
  { key: 'transDesc', labelKey: 'transDesc', minWidth: 140 },
  { key: 'subtotal', labelKey: 'subtotal', sortField: 'subtotal', minWidth: 100, align: 'right' },
  { key: 'discount', labelKey: 'discount', sortField: 'discount', minWidth: 100, align: 'right' },
  { key: 'tax', labelKey: 'tax', sortField: 'tax', minWidth: 90, align: 'right' },
  { key: 'vatAmount', labelKey: 'vatAmount', minWidth: 100, align: 'right' },
  { key: 'total', labelKey: 'total', sortField: 'total', minWidth: 110, align: 'right' },
  { key: 'status', labelKey: 'status', sortField: 'status', minWidth: 100 },
  { key: 'dueDate', labelKey: 'dueDate', sortField: 'due_date', minWidth: 110 },
  { key: 'paymentMethod', labelKey: 'paymentMethod', minWidth: 100 },
  { key: 'paidAmount', labelKey: 'paidAmount', sortField: 'paid_amount', minWidth: 110, align: 'right' },
  { key: 'paidAt', labelKey: 'paidAt', minWidth: 140 },
  { key: 'paidByName', labelKey: 'paidByName', minWidth: 120 },
  { key: 'balance', labelKey: 'balance', minWidth: 100, align: 'right' },
  { key: 'handedToName', labelKey: 'handedToName', minWidth: 120 },
  { key: 'handedToMobileNo', labelKey: 'handedToMobileNo', minWidth: 120 },
  { key: 'currency', labelKey: 'currency', minWidth: 80 },
  { key: 'createdAt', labelKey: 'createdAt', sortField: 'created_at', minWidth: 150 },
  { key: 'actions', labelKey: 'actions', minWidth: 100 },
];

interface InvoicesTableProps {
  invoices: Invoice[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
  };
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

export default function InvoicesTable({
  invoices,
  pagination,
  sortBy,
  sortOrder,
}: InvoicesTableProps) {
  const t = useTranslations('invoices');
  const tCommon = useTranslations('common');
  const router = useRouter();

  const navigate = useCallback(
    (params: Record<string, string>) => {
      const sp = new URLSearchParams(window.location.search);
      Object.entries(params).forEach(([k, v]) => {
        if (v) sp.set(k, v);
        else sp.delete(k);
      });
      router.push(`?${sp.toString()}`);
    },
    [router],
  );

  const handleSort = useCallback(
    (field: string) => {
      const newOrder = sortBy === field && sortOrder === 'asc' ? 'desc' : 'asc';
      navigate({ sortBy: field, sortOrder: newOrder, page: '1' });
    },
    [sortBy, sortOrder, navigate],
  );

  const handlePageChange = useCallback(
    (newPage: number) => navigate({ page: newPage.toString() }),
    [navigate],
  );

  const fmtDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(new Date(dateStr));
  };

  const fmtDateTime = (dateStr?: string) => {
    if (!dateStr) return '—';
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(dateStr));
  };

  const fmtMoney = (val?: number) => (val != null ? val.toFixed(3) : '—');

  const statusBadge = (status: string) => {
    const cls: Record<string, string> = {
      paid: 'bg-green-100 text-green-800',
      pending: 'bg-yellow-100 text-yellow-800',
      partial: 'bg-blue-100 text-blue-800',
      overdue: 'bg-red-100 text-red-800',
      draft: 'bg-gray-100 text-gray-800',
      cancelled: 'bg-gray-100 text-gray-800',
      refunded: 'bg-purple-100 text-purple-800',
    };
    return cls[status] ?? 'bg-gray-100 text-gray-800';
  };

  const renderCell = (col: ColumnDef, inv: Invoice) => {
    const balance = Number(inv.total ?? 0) - Number(inv.paid_amount ?? 0);
    switch (col.key) {
      case 'invoiceNo':
        return <span className="font-medium">{inv.invoice_no}</span>;
      case 'invoiceDate':
        return fmtDate(inv.invoice_date);
      case 'orderNo':
        return inv.order_no ? (
          <Link
            href={`/dashboard/orders/${inv.order_id}`}
            className="text-blue-600 hover:text-blue-800"
            onClick={(e) => e.stopPropagation()}
          >
            {inv.order_no}
          </Link>
        ) : (
          <span className="text-gray-400">—</span>
        );
      case 'customer':
        return inv.customer_id ? (
          <Link
            href={`/dashboard/customers/${inv.customer_id}`}
            className="text-blue-600 hover:text-blue-800"
            onClick={(e) => e.stopPropagation()}
          >
            {inv.customerName ?? '—'}
          </Link>
        ) : (
          <span className="text-gray-400">{t('table.noCustomer')}</span>
        );
      case 'customerReference':
        return inv.customer_reference ?? '—';
      case 'transDesc':
        return inv.trans_desc ? (
          <span className="max-w-[160px] truncate block" title={inv.trans_desc}>
            {inv.trans_desc}
          </span>
        ) : (
          '—'
        );
      case 'subtotal':
      case 'discount':
      case 'tax':
      case 'vatAmount':
      case 'total':
      case 'paidAmount':
        return fmtMoney(
          col.key === 'subtotal'
            ? inv.subtotal
            : col.key === 'discount'
              ? inv.discount
              : col.key === 'tax'
                ? inv.tax
                : col.key === 'vatAmount'
                  ? inv.vat_amount
                  : col.key === 'total'
                    ? inv.total
                    : inv.paid_amount,
        );
      case 'status':
        return (
          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge(inv.status)}`}>
            {inv.status}
          </span>
        );
      case 'dueDate':
        return fmtDate(inv.due_date);
      case 'paymentMethod':
        return inv.payment_method_code ?? '—';
      case 'balance':
        return <span className={balance > 0 ? 'text-orange-700 font-medium' : ''}>{fmtMoney(balance)}</span>;
      case 'paidAt':
        return fmtDateTime(inv.paid_at);
      case 'paidByName':
        return inv.paid_by_name ?? inv.paid_by ?? '—';
      case 'handedToName':
        return inv.handed_to_name ?? '—';
      case 'handedToMobileNo':
        return inv.handed_to_mobile_no ?? '—';
      case 'currency':
        return inv.currency_code ?? 'OMR';
      case 'createdAt':
        return fmtDateTime(inv.created_at);
      case 'actions':
        return (
          <Link
            href={`/dashboard/billing/invoices/${inv.id}`}
            className="rounded border border-gray-300 px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50"
            onClick={(e) => e.stopPropagation()}
          >
            {tCommon('view')}
          </Link>
        );
      default:
        return '—';
    }
  };

  const SortIcon = ({ field }: { field: string }) => {
    const isActive = sortBy === field;
    const isAsc = isActive && sortOrder === 'asc';
    const isDesc = isActive && sortOrder === 'desc';
    return (
      <span className="ml-1 inline-flex flex-col leading-0">
        <svg className={`h-3 w-3 ${isAsc ? 'text-blue-600' : 'text-gray-300'}`} viewBox="0 0 10 6" fill="currentColor">
          <path d="M5 0L10 6H0z" />
        </svg>
        <svg className={`h-3 w-3 ${isDesc ? 'text-blue-600' : 'text-gray-300'}`} viewBox="0 0 10 6" fill="currentColor">
          <path d="M5 6L0 0h10z" />
        </svg>
      </span>
    );
  };

  if (invoices.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
        <div className="text-gray-400">
          <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h3 className="mt-2 text-lg font-medium text-gray-900">{t('empty')}</h3>
      </div>
    );
  }

  const fromIdx = (pagination.page - 1) * pagination.limit + 1;
  const toIdx = Math.min(pagination.page * pagination.limit, pagination.totalCount);

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="overflow-x-auto max-h-[65vh] overflow-y-auto">
        <table className="w-full divide-y divide-gray-200" style={{ minWidth: '2800px' }}>
          <thead className="bg-gray-50 sticky top-0 z-10">
            <tr>
              {COLUMNS.map((col) => {
                const sortable = !!col.sortField;
                return (
                  <th
                    key={col.key}
                    className={`
                      whitespace-nowrap px-4 py-3 text-xs font-medium uppercase tracking-wider text-gray-500
                      ${col.align === 'right' ? 'text-right' : 'text-left'}
                      ${sortable ? 'cursor-pointer select-none hover:bg-gray-100' : ''}
                    `}
                    style={{ minWidth: col.minWidth }}
                    onClick={sortable ? () => handleSort(col.sortField!) : undefined}
                  >
                    <span className="inline-flex items-center gap-0.5">
                      {t(`table.columns.${col.labelKey}`)}
                      {sortable && <SortIcon field={col.sortField!} />}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {invoices.map((inv) => (
              <tr
                key={inv.id}
                className="cursor-pointer hover:bg-gray-50"
                onClick={() => router.push(`/dashboard/billing/invoices/${inv.id}`)}
              >
                {COLUMNS.map((col) => (
                  <td
                    key={col.key}
                    className={`
                      whitespace-nowrap px-4 py-3 text-sm text-gray-700
                      ${col.align === 'right' ? 'text-right' : 'text-left'}
                    `}
                  >
                    {renderCell(col, inv)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 text-sm text-gray-700">
        <div>
          {t('pagination.showing', { from: fromIdx, to: toIdx, total: pagination.totalCount })}
        </div>
        <div className="flex items-center gap-2">
          {pagination.page > 1 && (
            <button onClick={() => handlePageChange(pagination.page - 1)} className="rounded border border-gray-300 px-3 py-1 hover:bg-gray-50">
              {tCommon('previous')}
            </button>
          )}
          {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
            .filter((p) => p === 1 || p === pagination.totalPages || Math.abs(p - pagination.page) <= 1)
            .reduce<(number | 'ellipsis')[]>((acc, p, idx, arr) => {
              if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('ellipsis');
              acc.push(p);
              return acc;
            }, [])
            .map((item, idx) =>
              item === 'ellipsis' ? (
                <span key={`e-${idx}`} className="px-1 text-gray-400">...</span>
              ) : (
                <button
                  key={item}
                  onClick={() => handlePageChange(item as number)}
                  className={`rounded border px-3 py-1 ${
                    item === pagination.page ? 'border-blue-600 bg-blue-600 text-white' : 'border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {item}
                </button>
              ),
            )}
          {pagination.page < pagination.totalPages && (
            <button onClick={() => handlePageChange(pagination.page + 1)} className="rounded border border-gray-300 px-3 py-1 hover:bg-gray-50">
              {tCommon('next')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
