'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { CmxButton } from '@ui/primitives/cmx-button';
import { CmxTextarea } from '@ui/primitives';
import { CmxDialog, CmxDialogContent, CmxDialogHeader, CmxDialogTitle, CmxDialogFooter } from '@ui/overlays';

interface FxReasonDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
}

/** Shared reject/void confirm-with-reason dialog for the FX rate lifecycle (Rates tab). */
export function FxReasonDialog({ open, title, description, confirmLabel, destructive, onClose, onConfirm }: FxReasonDialogProps) {
  const tCommon = useTranslations('common');
  const t = useTranslations('currencyFx');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const handleClose = () => {
    setReason('');
    onClose();
  };

  const handleConfirm = async () => {
    if (!reason.trim()) return;
    setLoading(true);
    try {
      await onConfirm(reason.trim());
      handleClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <CmxDialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <CmxDialogContent>
        <CmxDialogHeader>
          <CmxDialogTitle>{title}</CmxDialogTitle>
        </CmxDialogHeader>
        <div className="space-y-3 p-4">
          <p className="text-sm text-muted-foreground">{description}</p>
          <label className="mb-1.5 block text-sm font-medium text-foreground" htmlFor="fx-reason">
            {t('common.reason')}
          </label>
          <CmxTextarea id="fx-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <CmxDialogFooter>
          <CmxButton variant="outline" onClick={handleClose} disabled={loading}>
            {tCommon('cancel')}
          </CmxButton>
          <CmxButton
            variant={destructive ? 'destructive' : 'primary'}
            onClick={handleConfirm}
            disabled={!reason.trim() || loading}
            loading={loading}
          >
            {confirmLabel}
          </CmxButton>
        </CmxDialogFooter>
      </CmxDialogContent>
    </CmxDialog>
  );
}
