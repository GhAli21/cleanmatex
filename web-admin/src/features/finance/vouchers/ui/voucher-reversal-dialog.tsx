'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { CmxButton } from '@ui/primitives/cmx-button';
import { CmxTextarea } from '@ui/primitives';
import { CmxDialog, CmxDialogContent, CmxDialogHeader, CmxDialogTitle, CmxDialogFooter } from '@ui/overlays';
import { CmxSummaryMessage } from '@ui/feedback';
import type { LinkedEffectsResult } from '@/lib/types/voucher-wiring';

interface VoucherReversalDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
  linkedEffects?: LinkedEffectsResult | null;
  unwindEnabled?: boolean;
}

/**
 * Reverse confirm dialog with B13 consequence preview of linked operational effects.
 */
export function VoucherReversalDialog({
  open,
  onClose,
  onConfirm,
  linkedEffects = null,
  unwindEnabled = false,
}: VoucherReversalDialogProps) {
  const t = useTranslations('finance.vouchers');
  const tCommon = useTranslations('common');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const previewItems = useMemo(() => {
    if (!linkedEffects) return [t('reversePreview.unknown')];
    const items: string[] = [];
    if (linkedEffects.orderPayments.length > 0) {
      items.push(t('reversePreview.payments', { count: linkedEffects.orderPayments.length }));
    }
    if (linkedEffects.creditApplications.length > 0) {
      items.push(t('reversePreview.credits', { count: linkedEffects.creditApplications.length }));
    }
    if (linkedEffects.cashDrawerMovements.length > 0) {
      items.push(t('reversePreview.drawer', { count: linkedEffects.cashDrawerMovements.length }));
    }
    if (linkedEffects.fundingTenders.length > 0) {
      items.push(t('reversePreview.funding', { count: linkedEffects.fundingTenders.length }));
    }
    if (items.length === 0) items.push(t('reversePreview.none'));
    return items;
  }, [linkedEffects, t]);

  const handleConfirm = async () => {
    if (!reason.trim()) return;
    setLoading(true);
    try {
      await onConfirm(reason.trim());
      onClose();
      setReason('');
    } finally {
      setLoading(false);
    }
  };

  return (
    <CmxDialog open={open} onOpenChange={onClose}>
      <CmxDialogContent>
        <CmxDialogHeader>
          <CmxDialogTitle>{t('actions.reverse')}</CmxDialogTitle>
        </CmxDialogHeader>
        <div className="space-y-3 p-4">
          <CmxSummaryMessage
            type={unwindEnabled ? 'warning' : 'info'}
            title={unwindEnabled ? t('reversePreview.unwindTitle') : t('reversePreview.documentOnlyTitle')}
            items={previewItems}
          />
          <label className="mb-1.5 block text-sm font-medium text-foreground" htmlFor="voucher-reversal-reason">
            {t('reversalReason')}
          </label>
          <CmxTextarea
            id="voucher-reversal-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t('reasonPlaceholder')}
          />
        </div>
        <CmxDialogFooter>
          <CmxButton variant="outline" onClick={onClose} disabled={loading}>
            {tCommon('cancel')}
          </CmxButton>
          <CmxButton
            variant="destructive"
            onClick={handleConfirm}
            disabled={!reason.trim() || loading}
            loading={loading}
          >
            {t('actions.reverse')}
          </CmxButton>
        </CmxDialogFooter>
      </CmxDialogContent>
    </CmxDialog>
  );
}
