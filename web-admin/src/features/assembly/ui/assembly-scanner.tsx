/**
 * Assembly Scanner Component
 * Barcode scanner for assembly items
 * PRD-009: Assembly & QA Workflow
 *
 * HFC P3b: built on CmxScanInput (normalised scans, Arabic digits, double-scan guard, focus kept for the next scan).
 */

'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { CmxCard, CmxCardContent, CmxCardHeader, CmxCardTitle } from '@ui/primitives/cmx-card';
import { CmxScanInput, type CmxScanStatus } from '@ui/forms';
import { useScanItem } from '../hooks/use-assembly';
import { useMessage } from '@ui/feedback/useMessage';
import { Scan } from 'lucide-react';

interface AssemblyScannerProps {
  taskId: string;
  onScanSuccess?: () => void;
}

/**
 * @param root0
 * @param root0.taskId
 * @param root0.onScanSuccess
 */
export function AssemblyScanner({ taskId, onScanSuccess }: AssemblyScannerProps) {
  const t = useTranslations('workflow.assembly.task');
  const [status, setStatus] = useState<CmxScanStatus | null>(null);
  const { mutate: scanItem, isPending } = useScanItem();
  const { showSuccess, showError } = useMessage();

  const handleScan = (barcode: string) => {
    scanItem(
      { taskId, barcode },
      {
        onSuccess: (result) => {
          if (result.success && result.isMatch) {
            setStatus({ tone: 'success', message: t('messages.scanSuccess') });
            showSuccess(t('messages.scanSuccess'));
            onScanSuccess?.();
          } else {
            setStatus({ tone: 'error', message: t('messages.scanNotFound') });
            showError(t('messages.scanNotFound'));
          }
        },
        onError: (error) => {
          const message = error.message || t('messages.scanFailed');
          setStatus({ tone: 'error', message });
          showError(message);
        },
      }
    );
  };

  return (
    <CmxCard>
      <CmxCardHeader>
        <CmxCardTitle className="flex items-center gap-2">
          <Scan className="h-5 w-5" aria-hidden="true" />
          {t('scannerTitle')}
        </CmxCardTitle>
      </CmxCardHeader>
      <CmxCardContent className="space-y-4">
        <CmxScanInput
          label={t('scannerHint')}
          placeholder={t('scannerPlaceholder')}
          submitLabel={t('actions.scan')}
          emptyMessage={t('messages.barcodeRequired')}
          status={status}
          busy={isPending}
          onScan={handleScan}
          autoFocus
        />
      </CmxCardContent>
    </CmxCard>
  );
}
