'use client';

import { useTranslations } from 'next-intl';
import { CmxButton } from '@ui/primitives';
import { CmxDialog, CmxDialogContent, CmxDialogFooter, CmxDialogHeader, CmxDialogTitle } from '@ui/overlays';
import { LoadingButton } from '@ui/primitives';
import type { ReceiptAllocationPreviewResult } from '@/lib/types/customer-receipt-allocation';

/**
 *
 */
export type AutoAllocationPreviewDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preview: ReceiptAllocationPreviewResult | null;
  loading: boolean;
  confirming: boolean;
  currencyCode: string;
  formatAmount: (value: number) => string;
  onConfirm: () => void;
  isRTL?: boolean;
};

/**
 *
 * @param root0
 * @param root0.open
 * @param root0.onOpenChange
 * @param root0.preview
 * @param root0.loading
 * @param root0.confirming
 * @param root0.currencyCode
 * @param root0.formatAmount
 * @param root0.onConfirm
 * @param root0.isRTL
 */
export function AutoAllocationPreviewDrawer({
  open,
  onOpenChange,
  preview,
  loading,
  confirming,
  currencyCode,
  formatAmount,
  onConfirm,
  isRTL = false,
}: AutoAllocationPreviewDrawerProps) {
  const t = useTranslations('newOrder.payment.extraReceipt.allocation');
  const textAlign = isRTL ? 'text-right' : 'text-left';

  return (
    <CmxDialog open={open} onOpenChange={onOpenChange}>
      <CmxDialogContent className="max-w-lg">
        <CmxDialogHeader>
          <CmxDialogTitle className={textAlign}>{t('autoPreviewTitle')}</CmxDialogTitle>
        </CmxDialogHeader>

        {loading ? (
          <p className={`text-sm text-slate-600 ${textAlign}`}>{t('loadingPreview')}</p>
        ) : preview ? (
          <div className="space-y-3">
            <p className={`text-sm text-slate-600 ${textAlign}`}>
              {t('excessToAllocate', {
                amount: `${currencyCode} ${formatAmount(preview.excessAmount)}`,
              })}
            </p>
            <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className={`px-3 py-2 ${textAlign}`}>{t('document')}</th>
                    <th className={`px-3 py-2 ${isRTL ? 'text-left' : 'text-right'}`}>{t('amount')}</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.allocations.map((line) => (
                    <tr key={`${line.targetType}-${line.targetId}`} className="border-t border-slate-100">
                      <td className={`px-3 py-2 ${textAlign}`}>
                        <span className="font-medium text-slate-900">{line.documentNo ?? line.targetType}</span>
                        {line.dueDate ? (
                          <span className="mt-0.5 block text-xs text-slate-500">{line.dueDate}</span>
                        ) : null}
                      </td>
                      <td className={`px-3 py-2 tabular-nums ${isRTL ? 'text-left' : 'text-right'}`}>
                        {currencyCode} {formatAmount(line.allocationAmount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {preview.remainingUnallocatedAmount > 0.001 ? (
              <p className="text-sm font-medium text-rose-600">
                {t('remainingUnallocated', {
                  amount: `${currencyCode} ${formatAmount(preview.remainingUnallocatedAmount)}`,
                })}
              </p>
            ) : (
              <p className="text-sm text-emerald-700">{t('fullyAllocated')}</p>
            )}
            {preview.fallbackAllocation && preview.fallbackAllocation.allocationAmount > 0.001 ? (
              <p className={`text-sm text-amber-800 ${textAlign}`}>
                {t('autoFallbackHint', {
                  amount: `${currencyCode} ${formatAmount(preview.fallbackAllocation.allocationAmount)}`,
                  destination: preview.fallbackAllocation.targetType,
                })}
              </p>
            ) : null}
            {preview.warnings.length > 0 ? (
              <ul className="list-disc space-y-1 ps-5 text-xs text-amber-800">
                {preview.warnings.map((warning) => (
                  <li key={warning.code}>{warning.message ?? warning.code}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : (
          <p className={`text-sm text-slate-600 ${textAlign}`}>{t('noPreview')}</p>
        )}

        <CmxDialogFooter className={isRTL ? 'flex-row-reverse' : ''}>
          <CmxButton type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </CmxButton>
          <LoadingButton
            type="button"
            loading={confirming}
            disabled={
              !preview ||
              preview.remainingUnallocatedAmount > 0.001 ||
              preview.allocations.length === 0
            }
            onClick={onConfirm}
          >
            {t('confirmAllocation')}
          </LoadingButton>
        </CmxDialogFooter>
      </CmxDialogContent>
    </CmxDialog>
  );
}
