/**
 * OTP Encryption Utility (Edge Compatible)
 * Encrypts and decrypts OTP codes for secure storage using Web Crypto API.
 * PRD-013: Delivery Management & POD
 * @version 2.0.0
 * @last_updated 2025-01-20
 */

import { logger } from './logger';

// Note: Ensure this environment variable is set in your Edge environment
const ENCRYPTION_KEY = process.env.OTP_ENCRYPTION_KEY || 'default-key-change-in-production';
const ALGORITHM = 'AES-CBC';
const IV_LENGTH = 16;

/**
 * Helper: Convert ArrayBuffer to Hex String
 */
function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Helper: Convert Hex String to Uint8Array
 */
function hexToUint8Array(hexString: string): Uint8Array {
  const match = hexString.match(/.{1,2}/g);
  if (!match) return new Uint8Array();
  return new Uint8Array(match.map(byte => parseInt(byte, 16)));
}

/**
 * Helper: Derive Key from Secret + TenantId (SHA-256)
 */
async function getKey(tenantId: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = encoder.encode(ENCRYPTION_KEY + tenantId);

  // Hash the input to get a consistent 32-byte key
  const keyBuffer = await crypto.subtle.digest('SHA-256', keyMaterial);

  return crypto.subtle.importKey(
    'raw',
    keyBuffer,
    { name: ALGORITHM },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypt OTP code
 * @returns Format: "iv_hex:ciphertext_hex"
 */
export async function encryptOTP(otpCode: string, tenantId: string): Promise<string> {
  try {
    const key = await getKey(tenantId);
    const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
    const encodedData = new TextEncoder().encode(otpCode);

    const encryptedBuffer = await crypto.subtle.encrypt(
      { name: ALGORITHM, iv },
      key,
      encodedData
    );

    return `${bufferToHex(iv.buffer)}:${bufferToHex(encryptedBuffer)}`;
  } catch (error) {
    logger.error('Failed to encrypt OTP', error as Error, { tenantId });
    // Fallback: simple encoding (using btoa for Edge compatibility)
    return btoa(otpCode);
  }
}

/**
 * Decrypt OTP code
 */
export async function decryptOTP(encryptedOTP: string, tenantId: string): Promise<string> {
  try {
    const parts = encryptedOTP.split(':');

    // Handle fallback (base64) format from legacy code or errors
    if (parts.length !== 2) {
      return atob(encryptedOTP);
    }

    const key = await getKey(tenantId);
    const iv = hexToUint8Array(parts[0]);
    const encryptedData = hexToUint8Array(parts[1]);

    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: ALGORITHM, iv },
      key,
      encryptedData
    );

    return new TextDecoder().decode(decryptedBuffer);
  } catch (error) {
    logger.error('Failed to decrypt OTP', error as Error, { tenantId });
    // Fallback attempt for base64
    try {
      return atob(encryptedOTP);
    } catch {
      throw new Error('Failed to decrypt OTP');
    }
  }
}

/**
 * Generate random 4-digit OTP
 * Uses crypto.getRandomValues for better entropy than Math.random
 */
export function generateOTPCode(): string {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  // Get a number between 0 and 8999, then add 1000 to get 1000-9999
  const randomNum = (array[0] % 9000) + 1000;
  return randomNum.toString();
}