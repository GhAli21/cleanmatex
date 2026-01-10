/**
 * Piece Barcode Scanner Component
 * Allows scanning barcodes to update piece status
 */

'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Scan, CheckCircle2, XCircle } from 'lucide-react';
import { log } from '@/lib/utils/logger';

export interface PieceBarcodeScannerProps {
  orderId: string;
  itemId: string;
  tenantId: string;
  onScanSuccess?: (pieceId: string) => void;
  onScanError?: (error: string) => void;
}

export function PieceBarcodeScanner({
  orderId,
  itemId,
  tenantId,
  onScanSuccess,
  onScanError,
}: PieceBarcodeScannerProps) {
  const t = useTranslations('orders.pieces');
  const isRTL = useRTL();
  const [barcode, setBarcode] = React.useState('');
  const [scanning, setScanning] = React.useState(false);
  const [lastResult, setLastResult] = React.useState<{
    success: boolean;
    message: string;
  } | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleScan = React.useCallback(async () => {
    if (!barcode.trim()) {
      setLastResult({
        success: false,
        message: t('errors.barcodeRequired') || 'Barcode is required',
      });
      return;
    }

    setScanning(true);
    setLastResult(null);

    try {
      // Lookup piece by barcode
      const response = await fetch(
        `/api/v1/orders/${orderId}/items/${itemId}/pieces/scan`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ barcode: barcode.trim() }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Piece not found');
      }

      setLastResult({
        success: true,
        message: t('success.scanned', { pieceSeq: data.piece?.piece_seq }) || `Piece ${data.piece?.piece_seq} scanned successfully`,
      });

      setBarcode('');
      inputRef.current?.focus();
      onScanSuccess?.(data.piece?.id);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Scan failed';
      log.error('[PieceBarcodeScanner] Scan error', err instanceof Error ? err : new Error(String(err)), {
        feature: 'order_pieces',
        action: 'scan_barcode',
        orderId,
        itemId,
        barcode: barcode.trim(),
      });
      setLastResult({
        success: false,
        message: errorMessage,
      });
      onScanError?.(errorMessage);
    } finally {
      setScanning(false);
    }
  }, [barcode, orderId, itemId, t, onScanSuccess, onScanError]);

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !scanning) {
      handleScan();
    }
  };

  return (
    <div className={`space-y-3 p-4 border rounded-lg ${isRTL ? 'text-right' : 'text-left'}`}>
      <div className={`flex ${isRTL ? 'flex-row-reverse' : ''} items-center gap-2`}>
        <Scan className="h-5 w-5 text-gray-500" />
        <h4 className="text-sm font-semibold text-gray-700">{t('barcodeScanner') || 'Barcode Scanner'}</h4>
      </div>

      <div className={`flex ${isRTL ? 'flex-row-reverse' : ''} gap-2`}>
        <Input
          ref={inputRef}
          type="text"
          value={barcode}
          onChange={(e) => setBarcode(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder={t('scanBarcodePlaceholder') || 'Scan or enter barcode...'}
          className="flex-1"
          disabled={scanning}
        />
        <Button
          onClick={handleScan}
          disabled={scanning || !barcode.trim()}
          className={isRTL ? 'flex-row-reverse' : ''}
        >
          <Scan className={`h-4 w-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
          {scanning ? t('scanning') || 'Scanning...' : t('scan') || 'Scan'}
        </Button>
      </div>

      {lastResult && (
        <div
          className={`p-3 rounded-lg flex ${isRTL ? 'flex-row-reverse' : ''} items-center gap-2 ${
            lastResult.success
              ? 'bg-green-50 text-green-800 border border-green-200'
              : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          {lastResult.success ? (
            <CheckCircle2 className="h-5 w-5" />
          ) : (
            <XCircle className="h-5 w-5" />
          )}
          <span className="text-sm font-medium">{lastResult.message}</span>
        </div>
      )}
    </div>
  );
}

