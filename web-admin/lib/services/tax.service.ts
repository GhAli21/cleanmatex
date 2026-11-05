/**
 * Tax Service: tax amount helpers for the legacy price lookups.
 */

import { ORDER_DEFAULTS } from '@/lib/constants/order-defaults';
import { roundMoneyAmount } from '@/lib/money/format-money';

/**
 * Tax amount helpers. The tax rate comes from tax profiles only
 * (`getDefaultVatRate` in tax-engine.service); the `TENANT_VAT_RATE`
 * setting, its rate cache and `getTaxRate` were retired in P6-03.
 */
export class TaxService {
  /**
   * Check if a product is tax exempt
   * @param tenantId - Tenant organization ID
   * @param productId - Product ID
   * @returns Promise<boolean> - true if tax exempt, false otherwise
   */
  async isTaxExempt(tenantId: string, productId: string): Promise<boolean> {
    try {
      // TODO: Implement product-level tax exemption check
      return false;
    } catch (error) {
      console.error(`[TaxService] Error checking tax exemption for product ${productId}:`, error);
      return false;
    }
  }

  /**
   * Calculate tax amount
   * @param amount - Amount to calculate tax on
   * @param taxRate - Tax rate as decimal (e.g., 0.05 for 5%)
   * @param decimalPlaces - Tenant fraction digits (defaults to ORDER_DEFAULTS)
   * @returns number - Tax amount
   */
  calculateTax(
    amount: number,
    taxRate: number,
    decimalPlaces: number = ORDER_DEFAULTS.PRICE.DECIMAL_PLACES,
  ): number {
    return roundMoneyAmount(amount * taxRate, decimalPlaces);
  }
}

/** Default singleton. */
export const taxService = new TaxService();
