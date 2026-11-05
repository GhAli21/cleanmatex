/**
 * Legacy barcode helper (kept as a thin shim, HFC P4 D2).
 *
 * The old file also made JSON QR codes (generateQRCode / decodeQRCode / isValidQRCodeData) and a fake
 * "CODE128-style" SVG that did not scan. Those were removed in P4 (D3): staff QR codes use the
 * CMX1:<TYPE>:<code> payload (lib/services/scan-resolve/cmx-code-payload.ts) and barcodes are real CODE128
 * from lib/utils/barcode/code128.ts.
 */

import { renderCode128DataUrl } from '@/lib/utils/barcode/code128';

/**
 * CODE128 barcode for a code, as an SVG data URL.
 * The value is encoded as-is (hyphens kept), so it scans back to the code printed beside it.
 *
 * @deprecated Use renderCode128Svg / renderCode128DataUrl from '@/lib/utils/barcode/code128', or the
 * CmxBarcode component (@ui/print). Nothing stores the result any more (order and line rows keep the plain code).
 * @param code - Code to encode, e.g. ORD-260101-0001
 * @returns Promise<string> - data:image/svg+xml URL
 */
export async function generateBarcode(code: string): Promise<string> {
  return renderCode128DataUrl(code);
}
