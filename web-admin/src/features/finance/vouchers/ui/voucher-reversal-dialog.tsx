'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { CmxButton } from '@ui/primitives/cmx-button';
import { CmxDialog, CmxDialogContent, CmxDialogHeader, CmxDialogTitle, CmxDialogFooter } from '@ui/overlays';

interface VoucherReversalDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}

export function VoucherReversalDialog({ open, onClose, onConfirm }: VoucherReversalDialogProps) {
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
          <CmxDialogTitle>{t('actions.reverse')}</CmxDialogTitle>
        </CmxDialogHeader>
        <div className="p-4">
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            {t('reversalReason')}
          </label>
          <textarea
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
            {loading ? tCommon('loading') : t('actions.reverse')}
          </CmxButton>
        </CmxDialogFooter>
      </CmxDialogContent>
    </CmxDialog>
  );
}
