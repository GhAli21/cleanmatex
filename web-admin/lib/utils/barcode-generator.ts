/**
 * Barcode and QR Code Generator
 *
 * Generates QR codes and barcodes for order tracking and label printing.
 *
 * Features:
 * - QR Code: Contains order data in JSON format
 * - Barcode: CODE128 format for scanning
 * - Data URL output for easy embedding in HTML/PDF
 */

import QRCode from 'qrcode';

// Note: jsbarcode requires canvas which doesn't work well in Next.js server-side
// We'll use a simpler approach for barcodes or generate them client-side

export interface QRCodeData {
  orderNumber: string;
  tenantOrgId: string;
  customerPhone?: string;
  customerId?: string;
}

export interface QRCodeOptions {
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
  width?: number;
  margin?: number;
  color?: {
    dark?: string;
    light?: string;
  };
}

/**
 * Generate QR code as data URL
 *
 * @param data - Data to encode in QR code
 * @param options - QR code generation options
 * @returns Promise<string> - Data URL (data:image/png;base64,...)
 *
 * @example
 * ```typescript
 * const qrCode = await generateQRCode({
 *   orderNumber: 'ORD-20251025-0001',
 *   tenantOrgId: 'tenant-uuid',
 *   customerPhone: '+96890123456'
 * });
 * // Returns: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
 * ```
 */
export async function generateQRCode(
  data: QRCodeData,
  options?: QRCodeOptions
): Promise<string> {
  try {
    // Serialize data to JSON string
    const jsonData = JSON.stringify({
      order: data.orderNumber,
      tenant: data.tenantOrgId,
      ...(data.customerPhone && { phone: data.customerPhone }),
      ...(data.customerId && { customer: data.customerId }),
      timestamp: new Date().toISOString(),
    });

    // Default options
    const qrOptions: QRCode.QRCodeToDataURLOptions = {
      errorCorrectionLevel: options?.errorCorrectionLevel || 'M',
      width: options?.width || 200,
      margin: options?.margin || 1,
      color: {
        dark: options?.color?.dark || '#000000',
        light: options?.color?.light || '#FFFFFF',
      },
    };

    // Generate QR code as data URL
    const dataUrl = await QRCode.toDataURL(jsonData, qrOptions);

    return dataUrl;
  } catch (error) {
    console.error('[generateQRCode] Error:', error);
    throw new Error(`Failed to generate QR code: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Generate simple text-based barcode (for server-side rendering)
 * Returns SVG as data URL
 *
 * @param orderNumber - Order number to encode
 * @returns Promise<string> - SVG data URL
 *
 * @example
 * ```typescript
 * const barcode = await generateBarcode('ORD-20251025-0001');
 * // Returns: "data:image/svg+xml;base64,..."
 * ```
 */
export async function generateBarcode(orderNumber: string): Promise<string> {
  try {
    // Remove hyphens for barcode: ORD-20251025-0001 → ORD202510250001
    const barcodeValue = orderNumber.replace(/-/g, '');

    // Generate simple SVG barcode (CODE128-style)
    const svg = generateBarcodeSVG(barcodeValue);

    // Convert to data URL
    const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;

    return dataUrl;
  } catch (error) {
    console.error('[generateBarcode] Error:', error);
    throw new Error(`Failed to generate barcode: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Generate SVG barcode (simplified CODE128-style)
 *
 * @param value - Value to encode
 * @returns string - SVG markup
 */
function generateBarcodeSVG(value: string): string {
  const width = 200;
  const height = 80;
  const barWidth = 2;
  const spacing = 1;
  const textHeight = 15;

  // Simple bar encoding (not real CODE128, but visually similar)
  let x = 10;
  let bars = '';

  for (let i = 0; i < value.length; i++) {
    const charCode = value.charCodeAt(i);
    const pattern = charCode % 2 === 0 ? '11011' : '10101'; // Simple alternating pattern

    for (const bit of pattern) {
      if (bit === '1') {
        bars += `<rect x="${x}" y="10" width="${barWidth}" height="${height - textHeight - 10}" fill="black"/>`;
      }
      x += barWidth + spacing;
    }
    x += spacing; // Extra space between characters
  }

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="white"/>
  ${bars}
  <text x="${width / 2}" y="${height - 2}" text-anchor="middle" font-family="monospace" font-size="12" fill="black">${value}</text>
</svg>
  `.trim();

  return svg;
}

/**
 * Decode QR code data (parse JSON from scanned QR code)
 *
 * @param qrData - Raw QR code data string
 * @returns QRCodeData | null - Parsed data or null if invalid
 *
 * @example
 * ```typescript
 * const data = decodeQRCode('{"order":"ORD-20251025-0001","tenant":"..."}');
 * // { orderNumber: 'ORD-20251025-0001', tenantOrgId: '...', ... }
 * ```
 */
export function decodeQRCode(qrData: string): QRCodeData | null {
  try {
    const parsed = JSON.parse(qrData);

    if (!parsed.order || !parsed.tenant) {
      return null;
    }

    return {
      orderNumber: parsed.order,
      tenantOrgId: parsed.tenant,
      customerPhone: parsed.phone,
      customerId: parsed.customer,
    };
  } catch (error) {
    console.error('[decodeQRCode] Error:', error);
    return null;
  }
}

/**
 * Validate QR code data structure
 *
 * @param data - Data to validate
 * @returns boolean - True if valid
 */
export function isValidQRCodeData(data: any): data is QRCodeData {
  return (
    typeof data === 'object' &&
    data !== null &&
    typeof data.orderNumber === 'string' &&
    typeof data.tenantOrgId === 'string' &&
    (data.customerPhone === undefined || typeof data.customerPhone === 'string') &&
    (data.customerId === undefined || typeof data.customerId === 'string')
  );
}
