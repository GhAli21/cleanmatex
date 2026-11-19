'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { CmxButton, CmxTextarea, Label } from '@ui/primitives';
import { CmxDialog, CmxDialogContent, CmxDialogHeader, CmxDialogTitle, CmxDialogFooter } from '@ui/overlays';

interface VoucherCancelDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}

/**
 *
 * @param root0
 * @param root0.open
 * @param root0.onClose
 * @param root0.onConfirm
 */
export function VoucherCancelDialog({ open, onClose, onConfirm }: VoucherCancelDialogProps) {
  const t = useTranslations('finance.vouchers');
  const tCommon = useTranslations('common');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (!reason.trim()) return;
    setLoading(true);
    try { await onConfirm(reason.trim()); onClose(); }
    finally { setLoading(false); }
  };

  return (
    <CmxDialog open={open} onOpenChange={onClose}>
      <CmxDialogContent>
        <CmxDialogHeader>
          <CmxDialogTitle>{t('actions.cancel')}</CmxDialogTitle>
        </CmxDialogHeader>
        <div className="p-4">
          <Label className="mb-1.5 block">
            {t('cancellationReason')}
          </Label>
          <CmxTextarea
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
          >
            {loading ? tCommon('loading') : t('actions.cancel')}
          </CmxButton>
        </CmxDialogFooter>
      </CmxDialogContent>
    </CmxDialog>
  );
}
