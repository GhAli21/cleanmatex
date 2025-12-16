/**
 * Order Number Generator
 *
 * Generates unique order numbers per tenant per day in format: ORD-YYYYMMDD-XXXX
 * Example: ORD-20251025-0001
 *
 * Features:
 * - Unique per tenant per day
 * - Thread-safe via PostgreSQL function
 * - Resets daily at midnight
 * - Atomic generation using database sequence
 */

import { prisma } from '@/lib/db/prisma';

export interface OrderNumberResult {
  orderNumber: string;
  date: string;
  sequence: number;
}

/**
 * Generate unique order number for tenant
 *
 * @param tenantOrgId - UUID of the tenant organization
 * @returns Promise<string> - Generated order number (e.g., "ORD-20251025-0001")
 * @throws Error if generation fails after retries
 *
 * @example
 * ```typescript
 * const orderNumber = await generateOrderNumber('tenant-uuid-here');
 * console.log(orderNumber); // "ORD-20251025-0001"
 * ```
 */
export async function generateOrderNumber(tenantOrgId: string): Promise<string> {
  try {
    // Use PostgreSQL function for atomic generation
    const result = await prisma.$queryRawUnsafe<[{ generate_order_number: string }]>(
      `SELECT generate_order_number($1::uuid) as generate_order_number`,
      tenantOrgId
    );

    if (!result || result.length === 0) {
      throw new Error('Failed to generate order number: No result from database');
    }

    const orderNumber = result[0].generate_order_number;

    if (!orderNumber || !isValidOrderNumber(orderNumber)) {
      throw new Error(`Invalid order number generated: ${orderNumber}`);
    }

    return orderNumber;
  } catch (error) {
    console.error('[generateOrderNumber] Error:', error);
    throw new Error(`Failed to generate order number: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Validate order number format
 *
 * @param orderNumber - Order number to validate
 * @returns boolean - True if valid format
 *
 * @example
 * ```typescript
 * isValidOrderNumber('ORD-20251025-0001'); // true
 * isValidOrderNumber('INVALID'); // false
 * ```
 */
export function isValidOrderNumber(orderNumber: string): boolean {
  const pattern = /^ORD-\d{8}-\d{4}$/;
  return pattern.test(orderNumber);
}

/**
 * Parse order number into components
 *
 * @param orderNumber - Order number to parse
 * @returns OrderNumberResult | null - Parsed components or null if invalid
 *
 * @example
 * ```typescript
 * const parsed = parseOrderNumber('ORD-20251025-0001');
 * // { orderNumber: 'ORD-20251025-0001', date: '20251025', sequence: 1 }
 * ```
 */
export function parseOrderNumber(orderNumber: string): OrderNumberResult | null {
  if (!isValidOrderNumber(orderNumber)) {
    return null;
  }

  const parts = orderNumber.split('-');
  const date = parts[1];
  const sequence = parseInt(parts[2], 10);

  return {
    orderNumber,
    date,
    sequence,
  };
}

/**
 * Get order number prefix for current date
 *
 * @returns string - Prefix (e.g., "ORD-20251025-")
 *
 * @example
 * ```typescript
 * const prefix = getOrderNumberPrefix();
 * // "ORD-20251025-"
 * ```
 */
export function getOrderNumberPrefix(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const dateStr = `${year}${month}${day}`;

  return `ORD-${dateStr}-`;
}

/**
 * Format sequence number with leading zeros
 *
 * @param sequence - Sequence number (1-9999)
 * @returns string - Formatted sequence (e.g., "0001")
 */
export function formatSequence(sequence: number): string {
  if (sequence < 1 || sequence > 9999) {
    throw new Error('Sequence must be between 1 and 9999');
  }
  return String(sequence).padStart(4, '0');
}

/**
 * Extract sequence number from order number
 *
 * @param orderNumber - Order number
 * @returns number | null - Sequence number or null if invalid
 *
 * @example
 * ```typescript
 * extractSequence('ORD-20251025-0001'); // 1
 * extractSequence('INVALID'); // null
 * ```
 */
export function extractSequence(orderNumber: string): number | null {
  const parsed = parseOrderNumber(orderNumber);
  return parsed ? parsed.sequence : null;
}
