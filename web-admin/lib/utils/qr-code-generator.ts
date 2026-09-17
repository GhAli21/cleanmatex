/**
 * QR Code Generator Utility
 * Generates QR codes for order tracking and receipts
 * PRD-006: Digital Receipts
 * @version 1.0.0
 * @last_updated 2025-02-13
 */

import QRCode from 'qrcode';
import { logger } from './logger';

/**
 * Generate QR code data URL for order tracking
 * Returns a data URL suitable for <img src={dataUrl} /> display
 * @param trackingUrl
 * @param tenantId
 */
export async function generateQRCode(
  trackingUrl: string,
  tenantId: string
): Promise<string> {
  try {
    const dataUrl = await QRCode.toDataURL(trackingUrl, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
    });

    logger.info('QR code generated', {
      tenantId,
      trackingUrl,
      feature: 'receipts',
      action: 'generate_qr',
    });

    return dataUrl;
  } catch (error) {
    logger.error('Failed to generate QR code', error as Error, {
      tenantId,
      trackingUrl,
    });
    // Return URL even on error
    return trackingUrl;
  }
}

/**
 * Generate QR code for packing list verification
 * Returns a data URL suitable for <img src={dataUrl} /> display
 * @param packingListNumber
 * @param tenantId
 */
export async function generatePackingListQRCode(
  packingListNumber: string,
  tenantId: string
): Promise<string> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.cleanmatex.com';
    const verificationUrl = `${baseUrl}/verify/${packingListNumber}`;

    const dataUrl = await QRCode.toDataURL(verificationUrl, {
      width: 300,
      margin: 2,
    });

    logger.info('Packing list QR code generated', {
      tenantId,
      packingListNumber,
      feature: 'assembly',
      action: 'generate_packing_qr',
    });

    return dataUrl;
  } catch (error) {
    logger.error('Failed to generate packing list QR code', error as Error, {
      tenantId,
      packingListNumber,
    });
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.cleanmatex.com';
    return `${baseUrl}/verify/${packingListNumber}`;
  }
}

/**
 * Generate a verification QR code for a printed fiscal tax document
 * (B14 follow-up). Encodes the document's essential facts as a compact
 * pipe-delimited string — seller name, seller tax-registration number,
 * document number, issued timestamp, total, and tax amount.
 *
 * NOT a jurisdiction-specific compliance encoding (e.g. ZATCA's Base64 TLV
 * scheme) — this repo has no verified spec for one. It is an honest,
 * generic verification payload a scanner/back-office tool can parse to
 * confirm the printed document's essentials match the system record;
 * documented as a known simplification, not a compliance claim.
 * @param params
 */
export async function generateTaxDocumentVerificationQRCode(params: {
  sellerName: string;
  sellerTaxRegistrationNo: string | null;
  documentNo: string | null;
  issuedAt: string | null;
  totalAmount: number;
  taxAmount: number;
  currencyCode: string | null;
}): Promise<string> {
  const payload = [
    `SELLER:${params.sellerName}`,
    `VATNO:${params.sellerTaxRegistrationNo ?? ''}`,
    `DOC:${params.documentNo ?? ''}`,
    `DATE:${params.issuedAt ?? ''}`,
    `TOTAL:${params.totalAmount.toFixed(4)} ${params.currencyCode ?? ''}`,
    `TAX:${params.taxAmount.toFixed(4)} ${params.currencyCode ?? ''}`,
  ].join('|');

  try {
    return await QRCode.toDataURL(payload, {
      width: 220,
      margin: 1,
      color: { dark: '#000000', light: '#FFFFFF' },
    });
  } catch (error) {
    logger.error('Failed to generate tax document verification QR code', error as Error, {
      documentNo: params.documentNo,
    });
    return '';
  }
}

