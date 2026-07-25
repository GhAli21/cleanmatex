/**
 * Assembly Scanner Component
 * Barcode scanner for assembly items
 * PRD-009: Assembly & QA Workflow
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { CmxButton, CmxInput } from '@ui/primitives';
import { CmxCard, CmxCardContent, CmxCardHeader, CmxCardTitle } from '@ui/primitives/cmx-card';
import { useScanItem } from '../hooks/use-assembly';
import { useMessage } from '@ui/feedback/useMessage';
import { Scan, CheckCircle2, XCircle } from 'lucide-react';

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
  const [barcode, setBarcode] = useState('');
  const [lastScanResult, setLastScanResult] = useState<{
    success: boolean;
    isMatch: boolean;
    message: string;
  } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { mutate: scanItem, isPending } = useScanItem();
  const { showSuccess, showError } = useMessage();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleScan = () => {
    if (!barcode.trim()) {
      showError(t('messages.barcodeRequired'));
      return;
    }

    scanItem(
      { taskId, barcode: barcode.trim() },
      {
        onSuccess: (result) => {
          if (result.success && result.isMatch) {
            setLastScanResult({
              success: true,
              isMatch: true,
              message: t('messages.scanSuccess'),
            });
            showSuccess(t('messages.scanSuccess'));
            setBarcode('');
            inputRef.current?.focus();
            onScanSuccess?.();
          } else {
            setLastScanResult({
              success: false,
              isMatch: result.isMatch || false,
              message: t('messages.scanNotFound'),
            });
            showError(t('messages.scanNotFound'));
          }
        },
        onError: (error) => {
          setLastScanResult({
            success: false,
            isMatch: false,
            message: error.message || t('messages.scanFailed'),
          });
          showError(error.message || t('messages.scanFailed'));
        },
      }
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleScan();
    }
  };

  return (
    <CmxCard>
      <CmxCardHeader>
        <CmxCardTitle className="flex items-center gap-2">
          <Scan className="h-5 w-5" />
          {t('scannerTitle')}
        </CmxCardTitle>
      </CmxCardHeader>
      <CmxCardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{t('scannerHint')}</p>
        <div className="flex gap-2">
          <CmxInput
            ref={inputRef}
            type="text"
            placeholder={t('scannerPlaceholder')}
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1"
            autoFocus
          />
          <CmxButton onClick={handleScan} loading={isPending} disabled={isPending}>
            {t('actions.scan')}
          </CmxButton>
        </div>

        {lastScanResult ? (
          <div
            className={`flex items-center gap-2 rounded-lg border p-3 ${
              lastScanResult.success
                ? 'border-green-200 bg-green-50 text-green-800'
                : 'border-red-200 bg-red-50 text-red-800'
            }`}
          >
            {lastScanResult.success ? (
              <CheckCircle2 className="h-5 w-5 shrink-0" />
            ) : (
              <XCircle className="h-5 w-5 shrink-0" />
            )}
            <span className="text-sm font-medium">{lastScanResult.message}</span>
          </div>
        ) : null}
      </CmxCardContent>
    </CmxCard>
  );
}

