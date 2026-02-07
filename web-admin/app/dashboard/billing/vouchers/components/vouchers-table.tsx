'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { VoucherData } from '@/lib/types/voucher';
import { Printer } from 'lucide-react';

interface VouchersTableProps {
  vouchers: VoucherData[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
  };
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

export default function VouchersTable({
  vouchers,
  pagination,
  sortBy,
  sortOrder,
}: VouchersTableProps) {
  const t = useTranslations('billing.receiptVoucher');
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

  const fmtDate = (date: Date | string | null | undefined) => {
    if (!date) return '—';
    const d = typeof date === 'string' ? new Date(date) : date;
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  };

  const fmtMoney = (val: number, currency: string = 'OMR') =>
    `${val.toFixed(3)} ${currency}`;

  const statusBadge = (status: string) => {
    const cls: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-800',
      issued: 'bg-green-100 text-green-800',
      voided: 'bg-red-100 text-red-800',
    };
    return cls[status] ?? 'bg-gray-100 text-gray-800';
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (sortBy !== field) return null;
    return sortOrder === 'asc' ? '↑' : '↓';
  };

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      {vouchers.length === 0 ? (
        <div className="p-8 text-center text-gray-500">
          {t('empty') ?? 'No vouchers found'}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    className="cursor-pointer px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 hover:bg-gray-100"
                    onClick={() => handleSort('voucher_no')}
                  >
                    {t('voucherNo') ?? 'Voucher #'} <SortIcon field="voucher_no" />
                  </th>
                  <th
                    className="cursor-pointer px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 hover:bg-gray-100"
                    onClick={() => handleSort('created_at')}
                  >
                    {tCommon('date')} <SortIcon field="created_at" />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    {t('invoiceNo') ?? 'Invoice #'}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    {t('orderNo') ?? 'Order #'}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    {t('voucherCategory') ?? 'Category'}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    {t('voucherType') ?? 'Type'}
                  </th>
                  <th
                    className="cursor-pointer px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500 hover:bg-gray-100"
                    onClick={() => handleSort('total_amount')}
                  >
                    {t('amountPaid') ?? 'Amount'} <SortIcon field="total_amount" />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    {tCommon('status')}
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">
                    {tCommon('actions')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {vouchers.map((voucher) => (
                  <tr key={voucher.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className="font-mono text-sm font-medium">{voucher.voucher_no}</span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
                      {fmtDate(voucher.issued_at ?? voucher.created_at)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
                      {voucher.invoice_id ? (
                        <Link
                          href={`/dashboard/billing/invoices/${voucher.invoice_id}`}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          {voucher.invoice_id.slice(0, 8)}...
                        </Link>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
                      {voucher.order_id ? (
                        <Link
                          href={`/dashboard/orders/${voucher.order_id}`}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          {voucher.order_id.slice(0, 8)}...
                        </Link>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
                      {voucher.voucher_category}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
                      {voucher.voucher_type || '—'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-semibold text-gray-900">
                      {fmtMoney(voucher.total_amount, voucher.currency_code || 'OMR')}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge(voucher.status)}`}
                      >
                        {voucher.status}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm">
                      {voucher.status === 'issued' && (voucher as any).payment_id && (
                        <Link
                          href={`/dashboard/billing/payments/${(voucher as any).payment_id}/print/receipt-voucher`}
                          target="_blank"
                          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800"
                          title={t('printReceiptVoucher') ?? 'Print Receipt Voucher'}
                        >
                          <Printer className="h-4 w-4" />
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3">
              <div className="text-sm text-gray-700">
                {tCommon('showing')} {(pagination.page - 1) * pagination.limit + 1} to{' '}
                {Math.min(pagination.page * pagination.limit, pagination.totalCount)} of{' '}
                {pagination.totalCount} {t('vouchers') ?? 'vouchers'}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handlePageChange(pagination.page - 1)}
                  disabled={pagination.page === 1}
                  className="rounded-md border border-gray-300 px-3 py-1 text-sm disabled:opacity-50"
                >
                  {tCommon('previous')}
                </button>
                <span className="px-3 py-1 text-sm">
                  {tCommon('page')} {pagination.page} {tCommon('of')} {pagination.totalPages}
                </span>
                <button
                  onClick={() => handlePageChange(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages}
                  className="rounded-md border border-gray-300 px-3 py-1 text-sm disabled:opacity-50"
                >
                  {tCommon('next')}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
