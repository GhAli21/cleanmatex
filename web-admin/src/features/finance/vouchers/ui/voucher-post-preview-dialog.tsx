'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { CmxButton } from '@ui/primitives/cmx-button';
import {
  CmxDialog,
  CmxDialogContent,
  CmxDialogHeader,
  CmxDialogTitle,
  CmxDialogFooter,
} from '@ui/overlays';
import { postBizVoucherAction } from '@/app/actions/finance/voucher-actions';
import { LINE_ROLE } from '@/lib/constants/voucher';
import { PAYMENT_METHODS } from '@/lib/constants/payment';
import type { VoucherLineData } from '@/lib/types/voucher';

interface VoucherPostPreviewDialogProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  voucherId: string;
  lines: VoucherLineData[];
}

function deriveExpectedEffect(line: VoucherLineData): string {
  if (line.line_role === LINE_ROLE.ORDER_PAYMENT) {
    const isCash = line.payment_method_code?.toUpperCase() === PAYMENT_METHODS.CASH;
    const isCard = line.payment_method_code?.toUpperCase() === PAYMENT_METHODS.CARD;
    if (isCash && line.cash_drawer_session_id) return '1 Order Payment + 1 Cash Movement';
    if (isCash || isCard) return '1 Order Payment (completed)';
    return '1 Order Payment (pending)';
  }
  if (line.line_role === LINE_ROLE.ORDER_CREDIT_APPLICATION) {
    return `1 Credit Application (${line.credit_application_type ?? '—'})`;
  }
  return 'No wiring (skipped)';
}

export function VoucherPostPreviewDialog({
  open,
  onClose,
  onSuccess,
  voucherId,
  lines,
}: VoucherPostPreviewDialogProps) {
  const t = useTranslations('finance.vouchers.postPreview');
  const tCommon = useTranslations('common');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const draftLines = lines.filter((l) => l.line_status === 'DRAFT');

  const handleConfirm = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await postBizVoucherAction(voucherId);
      if (!result.success) {
        setError(result.error ?? 'Failed to post voucher');
        return;
      }
      onSuccess();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post voucher');
    } finally {
      setLoading(false);
    }
  };

  return (
    <CmxDialog open={open} onOpenChange={onClose}>
      <CmxDialogContent className="max-w-2xl">
        <CmxDialogHeader>
          <CmxDialogTitle>{t('title')}</CmxDialogTitle>
        </CmxDialogHeader>

        <div className="px-4 pb-2">
          <p className="mb-3 text-sm text-muted-foreground">{t('description')}</p>

          {draftLines.length === 0 ? (
            <p className="text-sm text-muted-foreground">No draft lines to post.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-3 py-2 text-start font-medium">{t('lineNo')}</th>
                    <th className="px-3 py-2 text-start font-medium">{t('lineRole')}</th>
                    <th className="px-3 py-2 text-end font-medium">Amount</th>
                    <th className="px-3 py-2 text-start font-medium">{t('expectedEffect')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {draftLines.map((line) => (
                    <tr key={line.id}>
                      <td className="px-3 py-2 tabular-nums">{line.line_no}</td>
                      <td className="px-3 py-2 font-mono text-xs">{line.line_role}</td>
                      <td className="px-3 py-2 text-end tabular-nums">
                        {Number(line.amount).toFixed(2)}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {deriveExpectedEffect(line)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {error && (
            <p className="mt-3 text-sm font-medium text-destructive">{error}</p>
          )}
        </div>

        <CmxDialogFooter>
          <CmxButton variant="outline" onClick={onClose} disabled={loading}>
            {t('cancel')}
          </CmxButton>
          <CmxButton
            onClick={handleConfirm}
            disabled={draftLines.length === 0 || loading}
          >
            {loading ? tCommon('loading') : t('confirm')}
          </CmxButton>
        </CmxDialogFooter>
      </CmxDialogContent>
    </CmxDialog>
  );
}
