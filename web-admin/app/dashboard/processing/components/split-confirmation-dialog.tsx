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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/Button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, AlertTriangle } from 'lucide-react';

interface SplitConfirmationDialogProps {
  isOpen: boolean;
  pieceCount: number;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

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
      setError(t('reason') + ' is required');
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
    <Dialog open={isOpen} onOpenChange={handleCancel}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-yellow-600" />
            {t('title')}
          </DialogTitle>
          <DialogDescription>
            {t('message', { count: pieceCount })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Reason Input */}
          <div>
            <Label htmlFor="split-reason" className="text-sm font-medium">
              {t('reason')} <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="split-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t('reasonPlaceholder')}
              className="mt-1"
              rows={3}
              disabled={isLoading}
            />
            {error && (
              <p className="text-sm text-red-600 mt-1">{error}</p>
            )}
          </div>

          {/* Preview */}
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
            <p className="font-medium text-blue-900">What will happen:</p>
            <ul className="mt-2 space-y-1 text-blue-800">
              <li>• A new sub-order will be created</li>
              <li>• {pieceCount} piece{pieceCount !== 1 ? 's' : ''} will be moved to the new order</li>
              <li>• Original order will keep remaining pieces</li>
              <li>• Both orders will reference each other</li>
            </ul>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isLoading}
          >
            {tCommon('cancel')}
          </Button>
          <Button
            variant="danger"
            onClick={handleConfirm}
            disabled={isLoading || !reason.trim()}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
