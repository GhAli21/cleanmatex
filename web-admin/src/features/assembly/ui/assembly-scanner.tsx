/**
 * Assembly Scanner Component
 * Barcode scanner for assembly items
 * PRD-009: Assembly & QA Workflow
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import { CmxButton } from '@ui/primitives/cmx-button';
import { CmxInput } from '@ui/primitives/cmx-input';
import { CmxCard, CmxCardContent, CmxCardHeader, CmxCardTitle } from '@ui/primitives/cmx-card';
import { useScanItem } from '../hooks/use-assembly';
import { useMessage } from '@ui/feedback/useMessage';
import { Scan, CheckCircle2, XCircle } from 'lucide-react';

interface AssemblyScannerProps {
  taskId: string;
  onScanSuccess?: () => void;
}

export function AssemblyScanner({ taskId, onScanSuccess }: AssemblyScannerProps) {
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
    // Auto-focus input on mount
    inputRef.current?.focus();
  }, []);

  const handleScan = () => {
    if (!barcode.trim()) {
      showError('Please enter a barcode');
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
              message: 'Item scanned successfully',
            });
            showSuccess('Item scanned successfully');
            setBarcode('');
            inputRef.current?.focus();
            onScanSuccess?.();
          } else {
            setLastScanResult({
              success: false,
              isMatch: result.isMatch || false,
              message: result.error || 'Barcode not found in expected items',
            });
            showError(result.error || 'Barcode not found');
          }
        },
        onError: (error) => {
          setLastScanResult({
            success: false,
            isMatch: false,
            message: error.message || 'Scan failed',
          });
          showError(error.message || 'Scan failed');
        },
      }
    );
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleScan();
    }
  };

  return (
    <CmxCard>
      <CmxCardHeader>
        <CmxCardTitle className="flex items-center gap-2">
          <Scan className="h-5 w-5" />
          Barcode Scanner
        </CmxCardTitle>
      </CmxCardHeader>
      <CmxCardContent className="space-y-4">
        <div className="flex gap-2">
          <CmxInput
            ref={inputRef}
            type="text"
            placeholder="Scan or enter barcode..."
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            onKeyPress={handleKeyPress}
            className="flex-1"
            autoFocus
          />
          <CmxButton onClick={handleScan} loading={isPending} disabled={isPending}>
            Scan
          </CmxButton>
        </div>

        {lastScanResult && (
          <div
            className={`p-3 rounded-lg flex items-center gap-2 ${
              lastScanResult.success
                ? 'bg-green-50 text-green-800 border border-green-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            }`}
          >
            {lastScanResult.success ? (
              <CheckCircle2 className="h-5 w-5" />
            ) : (
              <XCircle className="h-5 w-5" />
            )}
            <span className="text-sm font-medium">{lastScanResult.message}</span>
          </div>
        )}
      </CmxCardContent>
    </CmxCard>
  );
}

