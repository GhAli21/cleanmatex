'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { CmxButton, CmxInput, LoadingButton } from '@ui/primitives';
import { CmxDialog, CmxDialogContent, CmxDialogFooter, CmxDialogHeader, CmxDialogTitle } from '@ui/overlays';
import { Label } from '@ui/primitives';
import type { OpenBalanceTarget } from '@/lib/types/customer-receipt-allocation';
import {
  CUSTOMER_RECEIPT_ALLOCATION_LINE_ROLES,
  CUSTOMER_RECEIPT_ALLOCATION_TARGET_TYPES,
} from '@/lib/types/customer-receipt-allocation';

/**
 *
 */
export type ManualAllocationDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targets: OpenBalanceTarget[];
  excessAmount: number;
  currencyCode: string;
  formatAmount: (value: number) => string;
  loading: boolean;
  submitting: boolean;
  onSubmit: (allocations: Array<{ targetType: string; targetId: string; lineRole: string; amount: number }>) => void;
  isRTL?: boolean;
};

/**
 *
 * @param root0
 * @param root0.open
 * @param root0.onOpenChange
 * @param root0.targets
 * @param root0.excessAmount
 * @param root0.currencyCode
 * @param root0.formatAmount
 * @param root0.loading
 * @param root0.submitting
 * @param root0.onSubmit
 * @param root0.isRTL
 */
export function ManualAllocationDrawer({
  open,
  onOpenChange,
  targets,
  excessAmount,
  currencyCode,
  formatAmount,
  loading,
  submitting,
  onSubmit,
  isRTL = false,
}: ManualAllocationDrawerProps) {
  const t = useTranslations('newOrder.payment.extraReceipt.allocation');
  const textAlign = isRTL ? 'text-right' : 'text-left';
  const [amounts, setAmounts] = useState<Record<string, string>>({});

  const allocatedSum = useMemo(
    () =>
      Object.values(amounts).reduce((sum, raw) => {
        const n = Number(raw);
        return sum + (Number.isFinite(n) ? n : 0);
      }, 0),
    [amounts]
  );
  const remaining = Math.max(0, excessAmount - allocatedSum);

  const handleSubmit = () => {
    const allocations = targets
      .map((target) => {
        const raw = amounts[target.targetId];
        const amount = Number(raw);
        if (!Number.isFinite(amount) || amount <= 0) return null;
        return {
          targetType: target.targetType,
          targetId: target.targetId,
          lineRole: target.lineRole,
          amount,
        };
      })
      .filter(Boolean) as Array<{ targetType: string; targetId: string; lineRole: string; amount: number }>;

    if (allocations.length === 0) return;
    onSubmit(allocations);
  };

  return (
    <CmxDialog open={open} onOpenChange={onOpenChange}>
      <CmxDialogContent className="max-w-lg">
        <CmxDialogHeader>
          <CmxDialogTitle className={textAlign}>{t('manualTitle')}</CmxDialogTitle>
        </CmxDialogHeader>

        {loading ? (
          <p className={`text-sm text-slate-600 ${textAlign}`}>{t('loadingBalances')}</p>
        ) : targets.length === 0 ? (
          <p className={`text-sm text-slate-600 ${textAlign}`}>{t('noOpenBalances')}</p>
        ) : (
          <div className="space-y-3">
            <p className={`text-sm text-slate-600 ${textAlign}`}>
              {t('manualHint', {
                excess: `${currencyCode} ${formatAmount(excessAmount)}`,
                remaining: `${currencyCode} ${formatAmount(remaining)}`,
              })}
            </p>
            <div className="max-h-72 space-y-2 overflow-y-auto">
              {targets.map((target) => (
                <div
                  key={target.targetId}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2"
                >
                  <div className={`flex items-start justify-between gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                    <div className={textAlign}>
                      <p className="text-sm font-semibold text-slate-900">{target.documentNo}</p>
                      <p className="text-xs text-slate-500">
                        {target.targetType} · {t('outstanding')}{' '}
                        {currencyCode} {formatAmount(target.outstandingAmount)}
                      </p>
                    </div>
                    <div className="w-28 shrink-0">
                      <Label htmlFor={`alloc-${target.targetId}`} className="sr-only">
                        {target.documentNo}
                      </Label>
                      <CmxInput
                        id={`alloc-${target.targetId}`}
                        type="number"
                        min={0}
                        step="0.001"
                        inputMode="decimal"
                        value={amounts[target.targetId] ?? ''}
                        onChange={(event) =>
                          setAmounts((prev) => ({ ...prev, [target.targetId]: event.target.value }))
                        }
                        placeholder="0.000"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {remaining > 0.001 ? (
              <p className={`text-sm font-medium text-amber-800 ${textAlign}`}>
                {t('manualRemaining', {
                  amount: `${currencyCode} ${formatAmount(remaining)}`,
                })}
              </p>
            ) : null}
          </div>
        )}

        <CmxDialogFooter className={isRTL ? 'flex-row-reverse' : ''}>
          <CmxButton type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('cancel')}
          </CmxButton>
          <LoadingButton
            type="button"
            loading={submitting}
            disabled={remaining > 0.001 || allocatedSum <= 0}
            onClick={handleSubmit}
          >
            {t('confirmAllocation')}
          </LoadingButton>
        </CmxDialogFooter>
      </CmxDialogContent>
    </CmxDialog>
  );
}

export { CUSTOMER_RECEIPT_ALLOCATION_LINE_ROLES, CUSTOMER_RECEIPT_ALLOCATION_TARGET_TYPES };
