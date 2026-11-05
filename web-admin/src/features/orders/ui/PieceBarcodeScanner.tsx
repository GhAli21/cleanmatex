/**
 * Piece Barcode Scanner Component
 * Allows scanning barcodes to update piece status
 *
 * HFC P3b: built on CmxScanInput. The server matches the piece code, a staff QR (CMX1:PEC:...) or the piece's
 * live tag on this line (POST .../pieces/scan, which uses ScanResolveService).
 */

'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { Scan } from 'lucide-react';
import { CmxScanInput, type CmxScanStatus } from '@ui/forms';
import { log } from '@/lib/utils/logger';

/**
 *
 */
export interface PieceBarcodeScannerProps {
  orderId: string;
  itemId: string;
  tenantId: string;
  onScanSuccess?: (pieceId: string) => void;
  onScanError?: (error: string) => void;
}

/**
 *
 * @param root0
 * @param root0.orderId
 * @param root0.itemId
 * @param root0.tenantId
 * @param root0.onScanSuccess
 * @param root0.onScanError
 */
export function PieceBarcodeScanner({
  orderId,
  itemId,
  onScanSuccess,
  onScanError,
}: PieceBarcodeScannerProps) {
  const t = useTranslations('orders.pieces');
  const [status, setStatus] = React.useState<CmxScanStatus | null>(null);
  const [scanning, setScanning] = React.useState(false);

  const handleScan = React.useCallback(
    async (barcode: string) => {
      setScanning(true);
      setStatus(null);
      try {
        const response = await fetch(`/api/v1/orders/${orderId}/items/${itemId}/pieces/scan`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ barcode }),
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok || !data.success) {
          const message = response.status === 404 ? t('errors.pieceNotFound') : data.error || t('errors.updateFailed');
          setStatus({ tone: 'error', message });
          onScanError?.(message);
          return;
        }

        setStatus({ tone: 'success', message: t('success.scanned', { pieceSeq: data.piece?.piece_seq }) });
        onScanSuccess?.(data.piece?.id);
      } catch (err) {
        log.error('[PieceBarcodeScanner] Scan error', err instanceof Error ? err : new Error(String(err)), {
          feature: 'order_pieces',
          action: 'scan_barcode',
          orderId,
          itemId,
        });
        const message = t('errors.updateFailed');
        setStatus({ tone: 'error', message });
        onScanError?.(message);
      } finally {
        setScanning(false);
      }
    },
    [orderId, itemId, t, onScanSuccess, onScanError]
  );

  return (
    <div className="space-y-3 rounded-lg border p-4 text-start">
      <div className="flex items-center gap-2">
        <Scan className="h-5 w-5 text-gray-500" aria-hidden="true" />
        <h4 className="text-sm font-semibold text-gray-700">{t('barcodeScanner')}</h4>
      </div>

      <CmxScanInput
        label={t('scanBarcodePlaceholder')}
        placeholder={t('scanBarcodePlaceholder')}
        hint={t('scanHint')}
        submitLabel={scanning ? t('scanning') : t('scan')}
        emptyMessage={t('errors.barcodeRequired')}
        status={status}
        busy={scanning}
        onScan={handleScan}
        autoFocus
      />
    </div>
  );
}
