/**
 * Pure tax split shared by Create calculation, the financial snapshot, and Edit preview.
 * Rates are fractions (0.05 for five percent). This module does not load settings or profiles.
 */

import { round4 } from '@/lib/services/order-financial-aggregation';

/**
 * Extract the embedded tax from an inclusive gross amount.
 * Formula: tax = gross − round4(gross / (1 + rate)).
 */
export function extractTaxFromInclusive(
  inclusiveAmount: number,
  taxRate: number,
): { taxableAmount: number; taxAmount: number } {
  if (taxRate <= 0 || !Number.isFinite(taxRate) || !Number.isFinite(inclusiveAmount)) {
    return { taxableAmount: inclusiveAmount, taxAmount: 0 };
  }
  const taxableAmount = round4(inclusiveAmount / (1 + taxRate));
  const taxAmount = round4(inclusiveAmount - taxableAmount);
  return { taxableAmount, taxAmount };
}

/**
 * Tax added on top of an exclusive net amount. The net is not reinterpreted as gross.
 */
export function applyExclusiveTax(netAmount: number, taxRate: number): number {
  if (taxRate <= 0 || !Number.isFinite(taxRate) || !Number.isFinite(netAmount)) return 0;
  return round4(netAmount * taxRate);
}
