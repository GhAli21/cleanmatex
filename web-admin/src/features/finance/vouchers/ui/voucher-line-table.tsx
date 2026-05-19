'use client';

import { useTranslations, useLocale } from 'next-intl';
import { Trash2 } from 'lucide-react';
import { CmxButton } from '@ui/primitives/cmx-button';
import type { VoucherLineData } from '@/lib/types/voucher';
import { VOUCHER_STATUS } from '@/lib/constants/voucher';

interface VoucherLineTableProps {
  lines: VoucherLineData[];
  voucherStatus: string;
  onDeleteLine?: (lineId: string) => void;
}

export function VoucherLineTable({ lines, voucherStatus, onDeleteLine }: VoucherLineTableProps) {
  const t = useTranslations('finance.vouchers');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const isRtl = locale === 'ar';
  const isDraft = voucherStatus === VOUCHER_STATUS.DRAFT;

  const total = lines.reduce((sum, l) => sum + l.amount, 0);

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-start text-xs font-medium uppercase tracking-wide text-gray-500">#</th>
            <th className="px-4 py-3 text-start text-xs font-medium uppercase tracking-wide text-gray-500">{t('lineRole')}</th>
            <th className="px-4 py-3 text-start text-xs font-medium uppercase tracking-wide text-gray-500">{t('paymentMethod')}</th>
            <th className="px-4 py-3 text-start text-xs font-medium uppercase tracking-wide text-gray-500">{t('direction')}</th>
            <th className="px-4 py-3 text-end text-xs font-medium uppercase tracking-wide text-gray-500">{t('amount')}</th>
            <th className="px-4 py-3 text-start text-xs font-medium uppercase tracking-wide text-gray-500">{t('description')}</th>
            <th className="px-4 py-3 text-start text-xs font-medium uppercase tracking-wide text-gray-500">{tCommon('status')}</th>
            {isDraft && <th className="w-12 px-4 py-3" />}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {lines.map((line) => (
            <tr key={line.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 text-gray-500">{line.line_no}</td>
              <td className="px-4 py-3 font-medium text-gray-900">{line.line_role}</td>
              <td className="px-4 py-3 text-gray-600">{line.payment_method_code ?? '—'}</td>
              <td className="px-4 py-3 text-gray-600">{line.direction ?? '—'}</td>
              <td className={`px-4 py-3 text-end font-mono font-medium ${line.direction === 'OUT' ? 'text-red-600' : 'text-green-700'}`}>
                {line.amount.toLocaleString(isRtl ? 'ar' : 'en', { minimumFractionDigits: 2 })}
              </td>
              <td className="px-4 py-3 text-gray-600">{line.description ?? '—'}</td>
              <td className="px-4 py-3">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  line.line_status === 'POSTED' ? 'bg-green-100 text-green-800'
                  : line.line_status === 'REVERSED' ? 'bg-yellow-100 text-yellow-800'
                  : 'bg-gray-100 text-gray-700'
                }`}>
                  {line.line_status}
                </span>
              </td>
              {isDraft && (
                <td className="px-4 py-3">
                  {onDeleteLine && (
                    <CmxButton
                      variant="ghost"
                      size="sm"
                      onClick={() => onDeleteLine(line.id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </CmxButton>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
        <tfoot className="bg-gray-50">
          <tr>
            <td colSpan={isDraft ? 4 : 4} className="px-4 py-3" />
            <td className="px-4 py-3 text-end font-mono font-semibold text-gray-900">
              {total.toLocaleString(isRtl ? 'ar' : 'en', { minimumFractionDigits: 2 })}
            </td>
            <td colSpan={isDraft ? 3 : 2} className="px-4 py-3" />
          </tr>
        </tfoot>
      </table>

      {lines.length === 0 && (
        <div className="py-12 text-center text-sm text-gray-500">
          {t('noLines')}
        </div>
      )}
    </div>
  );
}
