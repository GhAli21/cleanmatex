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
 */
export async function generateQRCode(
  orderNumber: string,
  tenantId: string
): Promise<string> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.cleanmatex.com';
    const trackingUrl = `${baseUrl}/track/${orderNumber}`;

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
      orderNumber,
      trackingUrl,
      feature: 'receipts',
      action: 'generate_qr',
    });

    return dataUrl;
  } catch (error) {
    logger.error('Failed to generate QR code', error as Error, {
      tenantId,
      orderNumber,
    });
    // Return URL even on error
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.cleanmatex.com';
    return `${baseUrl}/track/${orderNumber}`;
  }
}

/**
 * Generate QR code for packing list verification
 * Returns a data URL suitable for <img src={dataUrl} /> display
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

