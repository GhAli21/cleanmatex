/**
 * OTP Encryption Utility
 * Encrypts and decrypts OTP codes for secure storage
 * PRD-013: Delivery Management & POD
 * @version 1.0.0
 * @last_updated 2025-01-20
 */

import { logger } from './logger';
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.OTP_ENCRYPTION_KEY || 'default-key-change-in-production';
const ALGORITHM = 'aes-256-cbc';
const IV_LENGTH = 16;

/**
 * Encrypt OTP code
 */
export function encryptOTP(otpCode: string, tenantId: string): string {
  try {
    const key = crypto
      .createHash('sha256')
      .update(ENCRYPTION_KEY + tenantId)
      .digest();
    
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(otpCode, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Return IV + encrypted data
    return iv.toString('hex') + ':' + encrypted;
  } catch (error) {
    logger.error('Failed to encrypt OTP', error as Error, {
      tenantId,
    });
    // Fallback: simple encoding (not secure, but better than plain text)
    return Buffer.from(otpCode).toString('base64');
  }
}

/**
 * Decrypt OTP code
 */
export function decryptOTP(encryptedOTP: string, tenantId: string): string {
  try {
    const key = crypto
      .createHash('sha256')
      .update(ENCRYPTION_KEY + tenantId)
      .digest();
    
    const parts = encryptedOTP.split(':');
    if (parts.length !== 2) {
      // Fallback: try base64 decode
      return Buffer.from(encryptedOTP, 'base64').toString('utf8');
    }
    
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    logger.error('Failed to decrypt OTP', error as Error, {
      tenantId,
    });
    // Fallback: try base64 decode
    try {
      return Buffer.from(encryptedOTP, 'base64').toString('utf8');
    } catch {
      throw new Error('Failed to decrypt OTP');
    }
  }
}

/**
 * Generate random 4-digit OTP
 */
export function generateOTPCode(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

