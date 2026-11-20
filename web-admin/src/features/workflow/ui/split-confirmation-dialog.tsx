/**
 * Split Confirmation Dialog Component
 *
 * Confirmation dialog for splitting an order.
 * Requires a reason for the split (mandatory field).
 */

'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import {
  CmxDialog,
  CmxDialogContent,
  CmxDialogHeader,
  CmxDialogTitle,
  CmxDialogFooter,
  CmxDialogDescription,
} from '@ui/overlays';
import { CmxButton } from '@ui/primitives';
import { Label } from '@ui/primitives';
import { CmxTextarea } from '@ui/primitives';
import { Loader2, AlertTriangle } from 'lucide-react';

interface SplitConfirmationDialogProps {
  isOpen: boolean;
  pieceCount: number;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

/**
 *
 * @param root0
 * @param root0.isOpen
 * @param root0.pieceCount
 * @param root0.onConfirm
 * @param root0.onCancel
 * @param root0.isLoading
 */
export function SplitConfirmationDialog({
  isOpen,
  pieceCount,
  onConfirm,
  onCancel,
  isLoading = false,
}: SplitConfirmationDialogProps) {
  const t = useTranslations('processing.splitConfirm');
  const tCommon = useTranslations('common');
  const [reason, setReason] = React.useState('');
  const [error, setError] = React.useState('');

  // Reset state when dialog opens
  React.useEffect(() => {
    if (isOpen) {
      setReason('');
      setError('');
    }
  }, [isOpen]);

  const handleConfirm = () => {
    // Validate reason is provided
    if (!reason.trim()) {
      setError(t('reasonRequired'));
      return;
    }

    setError('');
    onConfirm(reason.trim());
  };

  const handleCancel = () => {
    setReason('');
    setError('');
    onCancel();
  };

  return (
    <CmxDialog open={isOpen} onOpenChange={(open) => !open && handleCancel()}>
      <CmxDialogContent className="max-w-md">
        <CmxDialogHeader>
          <CmxDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-warning-text" />
            {t('title')}
          </CmxDialogTitle>
          <CmxDialogDescription>
            {t('message', { count: pieceCount })}
          </CmxDialogDescription>
        </CmxDialogHeader>

        <div className="space-y-4 py-4">
          {/* Reason Input */}
          <div>
            <Label htmlFor="split-reason" className="text-sm font-medium">
              {t('reason')} <span className="text-danger-text">*</span>
            </Label>
            <CmxTextarea
              id="split-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t('reasonPlaceholder')}
              className="mt-1"
              rows={3}
              disabled={isLoading}
            />
            {error && (
              <p className="text-sm text-danger-text mt-1">{error}</p>
            )}
          </div>

          {/* Preview */}
          <div className="p-3 bg-info-bg border border-info-border rounded-lg text-sm">
            <p className="font-medium text-primary-text">{t('previewHeading')}</p>
            <ul className="mt-2 space-y-1 text-primary-text">
              <li>• {t('previewLine1')}</li>
              <li>• {t('previewLine2', { count: pieceCount })}</li>
              <li>• {t('previewLine3')}</li>
              <li>• {t('previewLine4')}</li>
            </ul>
          </div>
        </div>

        <CmxDialogFooter>
          <CmxButton
            variant="outline"
            onClick={handleCancel}
            disabled={isLoading}
          >
            {tCommon('cancel')}
          </CmxButton>
          <CmxButton
            variant="destructive"
            onClick={handleConfirm}
            disabled={isLoading || !reason.trim()}
          >
            {isLoading && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
            {t('confirm')}
          </CmxButton>
        </CmxDialogFooter>
      </CmxDialogContent>
    </CmxDialog>
  );
}
