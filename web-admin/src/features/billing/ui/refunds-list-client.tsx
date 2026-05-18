'use client';

/**
 * Refunds List — Client Component
 *
 * Displays a paginated list of all refunds for the tenant.
 */

import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface RefundItem {
  id: string;
  refund_no: string;
  order_id: string;
  order_no: string | null;
  refund_amount: number;
  currency_code: string;
  reason_code: string | null;
  refund_method_code: string | null;
  refund_status: string;
  created_by: string | null;
  created_at: string | null;
  processed_at: string | null;
}

interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
}

interface RefundsListClientProps {
  refunds: RefundItem[];
  pagination: PaginationInfo;
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso));
}

function statusBadgeClass(status: string): string {
  const map: Record<string, string> = {
    PENDING_APPROVAL: 'bg-yellow-100 text-yellow-800',
    APPROVED:         'bg-blue-100 text-blue-800',
    PROCESSED:        'bg-green-100 text-green-800',
    REJECTED:         'bg-red-100 text-red-800',
  };
  return map[status] ?? 'bg-gray-100 text-gray-800';
}

export default function RefundsListClient({ refunds, pagination }: RefundsListClientProps) {
  const t = useTranslations('billing.refunds');
  const tCommon = useTranslations('common');
  const router = useRouter();

  const totalPages = Math.ceil(pagination.total / pagination.pageSize);

  function handlePage(page: number) {
    const sp = new URLSearchParams(window.location.search);
    sp.set('page', String(page));
    router.push(`?${sp.toString()}`);
  }

  if (refunds.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 py-16 text-center">
        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
        </svg>
        <p className="mt-4 text-sm text-gray-500">{t('noRefunds')}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{t('refundNo')}</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{t('order')}</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">{t('amount')}</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{t('method')}</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{t('status')}</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{t('reason')}</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{t('requestedAt')}</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{t('processedAt')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {refunds.map((r) => (
              <tr key={r.id} className="hover:bg-gray-50">
                <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">{r.refund_no}</td>
                <td className="whitespace-nowrap px-4 py-3">
                  {r.order_no ? (
                    <Link
                      href={`/dashboard/orders/${r.order_id}`}
                      className="text-blue-600 hover:text-blue-800"
                    >
                      {r.order_no}
                    </Link>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right font-medium">
                  {r.currency_code} {r.refund_amount.toFixed(3)}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                  {r.refund_method_code
                    ? t(`methodLabels.${r.refund_method_code}` as Parameters<typeof t>[0])
                    : '—'}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(r.refund_status)}`}>
                    {t(`statusLabels.${r.refund_status}` as Parameters<typeof t>[0])}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                  {r.reason_code
                    ? t(`reasonLabels.${r.reason_code}` as Parameters<typeof t>[0])
                    : '—'}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-gray-700">{fmtDate(r.created_at)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-gray-700">{fmtDate(r.processed_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 text-sm text-gray-700">
        <div>
          {pagination.total} total
        </div>
        <div className="flex items-center gap-2">
          {pagination.page > 1 && (
            <button
              onClick={() => handlePage(pagination.page - 1)}
              className="rounded border border-gray-300 px-3 py-1 hover:bg-gray-50"
            >
              {tCommon('previous')}
            </button>
          )}
          <span className="px-2 text-gray-600">
            {pagination.page} / {totalPages}
          </span>
          {pagination.page < totalPages && (
            <button
              onClick={() => handlePage(pagination.page + 1)}
              className="rounded border border-gray-300 px-3 py-1 hover:bg-gray-50"
            >
              {tCommon('next')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
