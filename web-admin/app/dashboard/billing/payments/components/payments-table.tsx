'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { PaymentListItem } from '@/lib/types/payment';
import { RequirePermission } from '@/components/auth/RequirePermission';
import CancelPaymentDialog from './cancel-payment-dialog';
import RefundPaymentDialog from './refund-payment-dialog';

// ---------------------------------------------------------------------------
// Column definition
// ---------------------------------------------------------------------------

interface ColumnDef {
  key: string;
  labelKey: string;
  /** DB column name used for server-side sorting (undefined = not sortable) */
  sortField?: string;
  /** Minimum width in px so the table never gets cramped */
  minWidth?: number;
  align?: 'left' | 'right' | 'center';
}

const COLUMNS: ColumnDef[] = [
  { key: 'transactionId',    labelKey: 'transactionId',    sortField: 'transaction_id', minWidth: 140 },
  { key: 'date',             labelKey: 'date',             sortField: 'paid_at',        minWidth: 170 },
  { key: 'customer',         labelKey: 'customer',                                      minWidth: 150 },
  { key: 'order',            labelKey: 'order',                                         minWidth: 120 },
  { key: 'invoice',          labelKey: 'invoice',                                       minWidth: 140 },
  { key: 'method',           labelKey: 'method',           sortField: 'payment_method_code', minWidth: 100 },
  { key: 'paymentType',      labelKey: 'paymentType',                                   minWidth: 120 },
  { key: 'kind',             labelKey: 'kind',                                          minWidth: 120 },
  { key: 'currency',         labelKey: 'currency',         sortField: 'currency_code',  minWidth: 80 },
  { key: 'subtotal',         labelKey: 'subtotal',         sortField: 'subtotal',       minWidth: 110, align: 'right' },
  { key: 'discount',         labelKey: 'discount',         sortField: 'discount_amount',minWidth: 110, align: 'right' },
  { key: 'discountRate',     labelKey: 'discountRate',                                  minWidth: 100, align: 'right' },
  { key: 'manualDiscount',   labelKey: 'manualDiscount',                                minWidth: 130, align: 'right' },
  { key: 'promoDiscount',    labelKey: 'promoDiscount',                                 minWidth: 130, align: 'right' },
  { key: 'giftCard',         labelKey: 'giftCard',                                      minWidth: 110, align: 'right' },
  { key: 'tax',              labelKey: 'tax',              sortField: 'tax_amount',     minWidth: 100, align: 'right' },
  { key: 'vat',              labelKey: 'vat',              sortField: 'vat_amount',     minWidth: 100, align: 'right' },
  { key: 'vatRate',          labelKey: 'vatRate',                                       minWidth: 80,  align: 'right' },
  { key: 'amount',           labelKey: 'amount',           sortField: 'paid_amount',    minWidth: 120, align: 'right' },
  { key: 'status',           labelKey: 'status',           sortField: 'status',         minWidth: 120 },
  { key: 'exRate',           labelKey: 'exRate',                                        minWidth: 110, align: 'right' },
  { key: 'gateway',          labelKey: 'gateway',          sortField: 'gateway',        minWidth: 110 },
  { key: 'channel',          labelKey: 'channel',          sortField: 'payment_channel',minWidth: 110 },
  { key: 'paidBy',           labelKey: 'paidBy',                                        minWidth: 120 },
  { key: 'checkNumber',      labelKey: 'checkNumber',                                   minWidth: 110 },
  { key: 'checkBank',        labelKey: 'checkBank',                                     minWidth: 110 },
  { key: 'checkDate',        labelKey: 'checkDate',                                     minWidth: 110 },
  { key: 'transDesc',        labelKey: 'transDesc',                                    minWidth: 160 },
  { key: 'notes',            labelKey: 'notes',                                         minWidth: 180 },
  { key: 'createdAt',        labelKey: 'createdAt',        sortField: 'created_at',     minWidth: 170 },
  { key: 'createdBy',        labelKey: 'createdBy',                                     minWidth: 120 },
  { key: 'updatedAt',        labelKey: 'updatedAt',                                     minWidth: 170 },
  { key: 'actions',          labelKey: 'actions',                                       minWidth: 160 },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PaymentsTableProps {
  payments: PaymentListItem[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
  };
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PaymentsTable({
  payments,
  pagination,
  sortBy,
  sortOrder,
}: PaymentsTableProps) {
  const t = useTranslations('payments');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const [cancelPaymentId, setCancelPaymentId] = useState<string | null>(null);
  const [refundPaymentId, setRefundPaymentId] = useState<string | null>(null);

  // ---- Helpers ----

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
      const newOrder =
        sortBy === field && sortOrder === 'asc' ? 'desc' : 'asc';
      navigate({ sortBy: field, sortOrder: newOrder, page: '1' });
    },
    [sortBy, sortOrder, navigate],
  );

  const handlePageChange = useCallback(
    (newPage: number) => navigate({ page: newPage.toString() }),
    [navigate],
  );

  // ---- Formatters ----

  const fmtDate = (dateStr?: string) => {
    if (!dateStr) return '—';
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(dateStr));
  };

  const fmtMoney = (val?: number) =>
    val != null ? val.toFixed(3) : '—';

  const fmtPct = (val?: number) =>
    val != null ? `${val}%` : '—';

  // ---- Badge helpers ----

  const statusBadge = (status: string) => {
    const cls: Record<string, string> = {
      completed: 'bg-green-100 text-green-800',
      paid:      'bg-green-100 text-green-800',
      pending:   'bg-yellow-100 text-yellow-800',
      processing:'bg-blue-100 text-blue-800',
      failed:    'bg-red-100 text-red-800',
      cancelled: 'bg-gray-100 text-gray-800',
      refunded:  'bg-purple-100 text-purple-800',
      partially_refunded: 'bg-purple-100 text-purple-800',
    };
    return cls[status] ?? 'bg-gray-100 text-gray-800';
  };

  const kindBadge = (kind?: string) => {
    const cls: Record<string, string> = {
      invoice: 'bg-blue-100 text-blue-800',
      deposit: 'bg-green-100 text-green-800',
      advance: 'bg-purple-100 text-purple-800',
      pos:     'bg-orange-100 text-orange-800',
    };
    return kind ? cls[kind] ?? 'bg-gray-100 text-gray-800' : 'bg-gray-100 text-gray-800';
  };

  // ---- Cell renderer ----

  const renderCell = (col: ColumnDef, p: PaymentListItem) => {
    switch (col.key) {
      case 'transactionId':
        return <span className="font-mono text-xs">{p.transaction_id || p.id.slice(0, 8)}</span>;

      case 'date':
        return fmtDate(p.paid_at || p.created_at);

      case 'customer':
        if (!p.customerName) return <span className="text-gray-400">{t('table.noCustomer')}</span>;
        return p.customer_id ? (
          <Link href={`/dashboard/customers/${p.customer_id}`} className="text-blue-600 hover:text-blue-800">
            {p.customerName}
          </Link>
        ) : (
          p.customerName
        );

      case 'order':
        return p.orderReference ? (
          <Link href={`/dashboard/orders/${p.order_id}`} className="text-blue-600 hover:text-blue-800">
            {p.orderReference}
          </Link>
        ) : (
          <span className="text-gray-400">{t('table.noReference')}</span>
        );

      case 'invoice':
        return p.invoiceNumber ? (
          <Link href={`/dashboard/billing/invoices/${p.invoice_id}`} className="text-blue-600 hover:text-blue-800">
            {p.invoiceNumber}
          </Link>
        ) : (
          <span className="text-gray-400">{t('table.noReference')}</span>
        );

      case 'method':
        return <span className="uppercase">{p.paymentMethodName || p.payment_method_code}</span>;

      case 'paymentType':
        return p.paymentTypeName || p.payment_type_code || '—';

      case 'kind': {
        const kind = p.metadata?.kind as string | undefined;
        return (
          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${kindBadge(kind)}`}>
            {kind ? t(`kinds.${kind}`) : '—'}
          </span>
        );
      }

      case 'currency':
        return p.currency_code;

      case 'subtotal':
        return fmtMoney(p.subtotal);

      case 'discount':
        return fmtMoney(p.discount_amount);

      case 'discountRate':
        return fmtPct(p.discount_rate);

      case 'manualDiscount':
        return fmtMoney(p.manual_discount_amount);

      case 'promoDiscount':
        return fmtMoney(p.promo_discount_amount);

      case 'giftCard':
        return fmtMoney(p.gift_card_applied_amount);

      case 'tax':
        return fmtMoney(p.tax);

      case 'vat':
        return fmtMoney(p.vat);

      case 'vatRate':
        return fmtPct(p.vat_rate);

      case 'amount':
        return (
          <span className="font-semibold">
            {p.paid_amount.toFixed(3)} {p.currency_code}
          </span>
        );

      case 'status':
        return (
          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge(p.status)}`}>
            {t(`statuses.${p.status}`)}
          </span>
        );

      case 'exRate':
        return p.currency_ex_rate != null ? p.currency_ex_rate.toFixed(6) : '—';

      case 'gateway':
        return p.gateway || '—';

      case 'channel':
        return p.payment_channel || '—';

      case 'paidBy':
        return p.paid_by || '—';

      case 'checkNumber':
        return p.check_number || '—';

      case 'checkBank':
        return p.check_bank || '—';

      case 'checkDate':
        return p.check_date ? fmtDate(p.check_date) : '—';

      case 'transDesc':
        return p.trans_desc ? (
          <span className="block max-w-[200px] truncate" title={p.trans_desc}>
            {p.trans_desc}
          </span>
        ) : '—';

      case 'notes':
        return p.rec_notes ? (
          <span className="block max-w-[200px] truncate" title={p.rec_notes}>
            {p.rec_notes}
          </span>
        ) : '—';

      case 'createdAt':
        return fmtDate(p.created_at);

      case 'createdBy':
        return p.created_by || '—';

      case 'updatedAt':
        return fmtDate(p.updated_at);

      case 'actions':
        return (
          <div className="flex items-center gap-2">
            <Link
              href={`/dashboard/billing/payments/${p.id}`}
              className="rounded border border-gray-300 px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50"
              onClick={(e) => e.stopPropagation()}
            >
              {t('table.viewDetails')}
            </Link>
            {p.status !== 'cancelled' && p.status !== 'refunded' && !p.hasRefunds && (
              <RequirePermission resource="payments" action="cancel">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setCancelPaymentId(p.id);
                  }}
                  className="rounded border border-red-300 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                >
                  {t('table.cancel')}
                </button>
              </RequirePermission>
            )}
            {p.status === 'completed' && p.paid_amount > 0 && (
              <RequirePermission resource="payments" action="refund">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setRefundPaymentId(p.id);
                  }}
                  className="rounded border border-blue-300 px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50"
                >
                  {t('table.refund')}
                </button>
              </RequirePermission>
            )}
          </div>
        );

      default:
        return '—';
    }
  };

  // ---- Sort indicator ----

  const SortIcon = ({ field }: { field: string }) => {
    const isActive = sortBy === field;
    const isAsc = isActive && sortOrder === 'asc';
    const isDesc = isActive && sortOrder === 'desc';

    return (
      <span className="ml-1 inline-flex flex-col leading-0">
        <svg
          className={`h-3 w-3 ${isAsc ? 'text-blue-600' : 'text-gray-300'}`}
          viewBox="0 0 10 6"
          fill="currentColor"
        >
          <path d="M5 0L10 6H0z" />
        </svg>
        <svg
          className={`h-3 w-3 ${isDesc ? 'text-blue-600' : 'text-gray-300'}`}
          viewBox="0 0 10 6"
          fill="currentColor"
        >
          <path d="M5 6L0 0h10z" />
        </svg>
      </span>
    );
  };

  // ---- Empty state ----

  if (payments.length === 0) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-12 text-center">
        <div className="text-gray-400">
          <svg className="mx-auto h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
            />
          </svg>
        </div>
        <h3 className="mt-2 text-lg font-medium text-gray-900">{t('empty')}</h3>
        <p className="mt-1 text-sm text-gray-500">{t('emptyDescription')}</p>
      </div>
    );
  }

  // ---- Pagination info ----

  const fromIdx = (pagination.page - 1) * pagination.limit + 1;
  const toIdx = Math.min(pagination.page * pagination.limit, pagination.totalCount);

  // ---- Render ----

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      {/* Horizontal-scrollable wrapper */}
      <div className="overflow-x-auto">
        <table className="w-full divide-y divide-gray-200" style={{ minWidth: '2400px' }}>
          <thead className="bg-gray-50">
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
            {payments.map((payment) => (
              <tr
                key={payment.id}
                className="cursor-pointer hover:bg-gray-50"
                onClick={() => router.push(`/dashboard/billing/payments/${payment.id}`)}
              >
                {COLUMNS.map((col) => (
                  <td
                    key={col.key}
                    className={`
                      whitespace-nowrap px-4 py-3 text-sm text-gray-700
                      ${col.align === 'right' ? 'text-right' : 'text-left'}
                    `}
                  >
                    {renderCell(col, payment)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 text-sm text-gray-700">
        <div>
          {t('pagination.showing', {
            from: fromIdx,
            to: toIdx,
            total: pagination.totalCount,
          })}
        </div>
        <div className="flex items-center gap-2">
          {pagination.page > 1 && (
            <button
              onClick={() => handlePageChange(pagination.page - 1)}
              className="rounded border border-gray-300 px-3 py-1 hover:bg-gray-50"
            >
              {tCommon('previous')}
            </button>
          )}

          {/* Page numbers */}
          {Array.from({ length: pagination.totalPages }, (_, i) => i + 1)
            .filter((p) => {
              // Show first, last, current and neighbors
              return (
                p === 1 ||
                p === pagination.totalPages ||
                Math.abs(p - pagination.page) <= 1
              );
            })
            .reduce<(number | 'ellipsis')[]>((acc, p, idx, arr) => {
              if (idx > 0 && p - (arr[idx - 1] as number) > 1) {
                acc.push('ellipsis');
              }
              acc.push(p);
              return acc;
            }, [])
            .map((item, idx) =>
              item === 'ellipsis' ? (
                <span key={`e-${idx}`} className="px-1 text-gray-400">
                  ...
                </span>
              ) : (
                <button
                  key={item}
                  onClick={() => handlePageChange(item as number)}
                  className={`rounded border px-3 py-1 ${
                    item === pagination.page
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {item}
                </button>
              ),
            )}

          {pagination.page < pagination.totalPages && (
            <button
              onClick={() => handlePageChange(pagination.page + 1)}
              className="rounded border border-gray-300 px-3 py-1 hover:bg-gray-50"
            >
              {tCommon('next')}
            </button>
          )}
        </div>
      </div>

      {/* Cancel Payment Dialog */}
      {cancelPaymentId && (
        <CancelPaymentDialog
          paymentId={cancelPaymentId}
          onClose={() => setCancelPaymentId(null)}
          onSuccess={() => {
            setCancelPaymentId(null);
            router.refresh();
          }}
        />
      )}

      {/* Refund Payment Dialog */}
      {refundPaymentId && (() => {
        const payment = payments.find((x) => x.id === refundPaymentId);
        return payment ? (
          <RefundPaymentDialog
            paymentId={payment.id}
            maxAmount={payment.paid_amount}
            currencyCode={payment.currency_code}
            onClose={() => setRefundPaymentId(null)}
            onSuccess={() => {
              setRefundPaymentId(null);
              router.refresh();
            }}
          />
        ) : null;
      })()}
    </div>
  );
}
