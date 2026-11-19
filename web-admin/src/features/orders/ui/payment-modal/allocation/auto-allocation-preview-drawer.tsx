'use client';

import { useTranslations } from 'next-intl';
import { CmxButton } from '@ui/primitives';
import { CmxDialog, CmxDialogContent, CmxDialogFooter, CmxDialogHeader, CmxDialogTitle } from '@ui/overlays';

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
  const textAlign = 'text-start';

  return (
    <CmxDialog open={open} onOpenChange={onOpenChange}>
      <CmxDialogContent className="max-w-lg">
        <CmxDialogHeader>
          <CmxDialogTitle className={textAlign}>{t('autoPreviewTitle')}</CmxDialogTitle>
        </CmxDialogHeader>

        {loading ? (
          <p className={`text-sm text-muted-foreground ${textAlign}`}>{t('loadingPreview')}</p>
        ) : preview ? (
          <div className="space-y-3">
            <p className={`text-sm text-muted-foreground ${textAlign}`}>
              {t('excessToAllocate', {
                amount: `${currencyCode} ${formatAmount(preview.excessAmount)}`,
              })}
            </p>
            <div className="max-h-64 overflow-y-auto rounded-xl border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted text-muted-foreground">
                  <tr>
                    <th className={`px-3 py-2 ${textAlign}`}>{t('document')}</th>
                    <th className="px-3 py-2 text-end">{t('amount')}</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.allocations.map((line) => (
                    <tr key={`${line.targetType}-${line.targetId}`} className="border-t border-border">
                      <td className={`px-3 py-2 ${textAlign}`}>
                        <span className="font-medium text-foreground">{line.documentNo ?? line.targetType}</span>
                        {line.dueDate ? (
                          <span className="mt-0.5 block text-xs text-muted-foreground">{line.dueDate}</span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 tabular-nums text-end">
                        {currencyCode} {formatAmount(line.allocationAmount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                {/* QA C17-1.4: summary total of the previewed allocation lines. */}
                <tfoot className="border-t border-border bg-muted">
                  <tr>
                    <td className={`px-3 py-2 text-sm font-semibold text-foreground ${textAlign}`}>
                      {t('totalAllocated')}
                    </td>
                    <td
                      data-testid="auto-allocation-total"
                      className="px-3 py-2 text-sm font-semibold tabular-nums text-foreground text-end"
                    >
                      {currencyCode}{' '}
                      {formatAmount(
                        preview.allocations.reduce((sum, line) => sum + line.allocationAmount, 0)
                      )}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
            {preview.remainingUnallocatedAmount > 0.001 ? (
              <p className="text-sm font-medium text-danger-text">
                {t('remainingUnallocated', {
                  amount: `${currencyCode} ${formatAmount(preview.remainingUnallocatedAmount)}`,
                })}
              </p>
            ) : (
              <p className="text-sm text-success-text">{t('fullyAllocated')}</p>
            )}
            {preview.fallbackAllocation && preview.fallbackAllocation.allocationAmount > 0.001 ? (
              <p className={`text-sm text-warning-text ${textAlign}`}>
                {t('autoFallbackHint', {
                  amount: `${currencyCode} ${formatAmount(preview.fallbackAllocation.allocationAmount)}`,
                  destination: preview.fallbackAllocation.targetType,
                })}
              </p>
            ) : null}
            {preview.warnings.length > 0 ? (
              <ul className="list-disc space-y-1 ps-5 text-xs text-warning-text">
                {preview.warnings.map((warning) => (
                  <li key={warning.code}>{warning.message ?? warning.code}</li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : (
          <p className={`text-sm text-muted-foreground ${textAlign}`}>{t('noPreview')}</p>
        )}

        <CmxDialogFooter className="">
          <CmxButton type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </CmxButton>
          <CmxButton
            type="button"
            loading={confirming}
            disabled={
              !preview ||
              preview.remainingUnallocatedAmount > 0.001 ||
              (preview.allocations.length === 0 && !preview.fallbackAllocation)
            }
            onClick={onConfirm}
          >
            {t('confirmAllocation')}
          </CmxButton>
        </CmxDialogFooter>
      </CmxDialogContent>
    </CmxDialog>
  );
}
