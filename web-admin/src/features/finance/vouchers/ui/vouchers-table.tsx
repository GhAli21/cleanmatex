'use client';

import { useTranslations, useLocale } from 'next-intl';
import Link from 'next/link';
import { Eye } from 'lucide-react';
import { CmxButton } from '@ui/primitives/cmx-button';
import { VoucherStatusBadge } from './voucher-status-badge';
import { VoucherDirectionBadge } from './voucher-direction-badge';
import type { VoucherListItem } from '@/lib/types/voucher';

interface VouchersTableProps {
  items: VoucherListItem[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export function VouchersTable({ items, total, page, pageSize, onPageChange }: VouchersTableProps) {
  const t = useTranslations('finance.vouchers');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const isRtl = locale === 'ar';
  const totalPages = Math.ceil(total / pageSize);

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-start text-xs font-medium uppercase tracking-wide text-gray-500">{t('voucherNo')}</th>
              <th className="px-4 py-3 text-start text-xs font-medium uppercase tracking-wide text-gray-500">{t('voucherType')}</th>
              <th className="px-4 py-3 text-start text-xs font-medium uppercase tracking-wide text-gray-500">{t('direction')}</th>
              <th className="px-4 py-3 text-start text-xs font-medium uppercase tracking-wide text-gray-500">{t('party')}</th>
              <th className="px-4 py-3 text-end text-xs font-medium uppercase tracking-wide text-gray-500">{t('totalAmount')}</th>
              <th className="px-4 py-3 text-start text-xs font-medium uppercase tracking-wide text-gray-500">{t('voucherDate')}</th>
              <th className="px-4 py-3 text-start text-xs font-medium uppercase tracking-wide text-gray-500">{tCommon('status')}</th>
              <th className="w-16 px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((voucher) => (
              <tr key={voucher.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-mono text-sm font-medium text-blue-700">
                  {voucher.voucher_no}
                </td>
                <td className="px-4 py-3 text-gray-700">{voucher.voucher_type}</td>
                <td className="px-4 py-3">
                  <VoucherDirectionBadge direction={voucher.direction} />
                </td>
                <td className="px-4 py-3 text-gray-700">{voucher.party_name ?? '—'}</td>
                <td className="px-4 py-3 text-end font-mono font-medium text-gray-900">
                  {voucher.total_amount.toLocaleString(isRtl ? 'ar' : 'en', { minimumFractionDigits: 2 })}
                  {voucher.currency_code && <span className="ms-1 text-xs text-gray-400">{voucher.currency_code}</span>}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {voucher.voucher_date ?? voucher.created_at.toLocaleDateString()}
                </td>
                <td className="px-4 py-3">
                  <VoucherStatusBadge status={voucher.voucher_status} />
                </td>
                <td className="px-4 py-3">
                  <Link href={`/dashboard/internal_fin/vouchers/${voucher.id}`}>
                    <CmxButton variant="ghost" size="sm">
                      <Eye className="h-4 w-4" />
                    </CmxButton>
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {items.length === 0 && (
        <div className="py-16 text-center text-sm text-gray-500">{t('noVouchers')}</div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-gray-200 px-4 py-3">
          <span className="text-sm text-gray-600">
            {tCommon('pagination', { page, totalPages })}
          </span>
          <div className="flex gap-2 rtl:flex-row-reverse">
            <CmxButton variant="outline" size="sm" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
              {tCommon('previous')}
            </CmxButton>
            <CmxButton variant="outline" size="sm" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}>
              {tCommon('next')}
            </CmxButton>
          </div>
        </div>
      )}
    </div>
  );
}
