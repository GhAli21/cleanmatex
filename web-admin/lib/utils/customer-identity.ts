/**
 * Customer Identity Normalization & Masking Utilities
 * Shared between lookup, creation, branch linking, and profile updates.
 */

import type { PhoneNormalizationResult } from '@/lib/types/customer';

export interface EmailNormalizationResult {
  normalized: string;
  isValid: boolean;
}

const E164_REGEX = /^\+\d{10,15}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Normalize a phone number into canonical E.164 format.
 * Handles spaces, hyphens, parentheses, leading "00" international prefix,
 * and local numbers without country code.
 */
export function normalizeCustomerPhone(
  phone: string,
  defaultCountryCode: string = '+968'
): PhoneNormalizationResult {
  const cleanDefault = defaultCountryCode.startsWith('+')
    ? defaultCountryCode.replace(/[^\d+]/g, '')
    : `+${defaultCountryCode.replace(/\D/g, '')}`;

  let normalized = (phone ?? '').trim().replace(/[\s\-()]/g, '');

  if (normalized.startsWith('00')) {
    normalized = `+${normalized.slice(2)}`;
  } else if (normalized && !normalized.startsWith('+')) {
    // Strip leading trunk zero if present when prepending country code
    const localDigits = normalized.replace(/^0+/, '');
    normalized = `${cleanDefault}${localDigits}`;
  }

  const countryCodeMatch = normalized.match(/^\+(\d{1,3})/);
  const countryCode = countryCodeMatch ? `+${countryCodeMatch[1]}` : cleanDefault;
  const nationalNumber = normalized.startsWith(countryCode)
    ? normalized.slice(countryCode.length)
    : normalized;

  return {
    normalized,
    countryCode,
    nationalNumber,
    isValid: E164_REGEX.test(normalized),
  };
}

/**
 * Normalize an email address (trim + lowercase) and validate basic format.
 */
export function normalizeCustomerEmail(email: string): EmailNormalizationResult {
  const normalized = (email ?? '').trim().toLowerCase();
  return {
    normalized,
    isValid: normalized.length > 0 && normalized.length <= 254 && EMAIL_REGEX.test(normalized),
  };
}

/**
 * Mask a phone number for safe global-match preview without exposing full digits.
 * Example: "+96890123456" -> "+96890****56"
 */
export function maskCustomerPhone(phone: string | null | undefined): string {
  if (!phone) return '';
  const cleaned = phone.trim();
  if (cleaned.length < 8) return cleaned;
  const visibleStart = cleaned.slice(0, Math.max(4, cleaned.length - 6));
  const visibleEnd = cleaned.slice(-2);
  return `${visibleStart}****${visibleEnd}`;
}

/**
 * Mask an email address for safe global-match preview.
 * Example: "ahmed.ali@example.com" -> "ah***@example.com"
 */
export function maskCustomerEmail(email: string | null | undefined): string {
  if (!email) return '';
  const normalized = email.trim().toLowerCase();
  const atIndex = normalized.indexOf('@');
  if (atIndex <= 0) return normalized;
  const local = normalized.slice(0, atIndex);
  const domain = normalized.slice(atIndex);
  const prefix = local.slice(0, Math.min(2, local.length));
  return `${prefix}***${domain}`;
}
