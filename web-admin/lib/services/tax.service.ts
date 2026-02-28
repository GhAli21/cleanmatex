/**
 * Tax Service
 *
 * Handles tax rate retrieval and tax calculations for tenants.
 * Uses TenantSettingsService for 7-layer resolution (SYSTEM_DEFAULT → SYSTEM_PROFILE
 * → TENANT_OVERRIDE → BRANCH_OVERRIDE → USER_OVERRIDE).
 */

import {
  tenantSettingsService,
  SETTING_CODES,
  type TenantSettingsService,
} from './tenant-settings.service';

const DEFAULT_VAT_RATE = 0.05; // 5%

export interface TaxServiceOptions {
  /** Optional TenantSettingsService instance (e.g. server client). Defaults to client singleton. */
  tenantSettings?: TenantSettingsService;
}

export class TaxService {
  private readonly tenantSettings: TenantSettingsService;
  private readonly taxRateCache = new Map<string, { rate: number; timestamp: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(options: TaxServiceOptions = {}) {
    this.tenantSettings = options.tenantSettings ?? tenantSettingsService;
  }

  /**
   * Build cache key for tenant/branch/user context.
   */
  private cacheKey(tenantId: string, branchId?: string | null, userId?: string | null): string {
    return `${tenantId}|${branchId ?? ''}|${userId ?? ''}`;
  }

  /**
   * Get tax rate for a tenant (with optional branch/user context for overrides).
   * @param tenantId - Tenant organization ID
   * @param branchId - Optional branch ID for branch-level VAT override
   * @param userId - Optional user ID for user-level override
   * @returns Promise<number> - Tax rate as decimal (e.g., 0.05 for 5%)
   */
  async getTaxRate(
    tenantId: string,
    branchId?: string | null,
    userId?: string | null
  ): Promise<number> {
    const key = this.cacheKey(tenantId, branchId, userId);
    const cached = this.taxRateCache.get(key);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.rate;
    }

    try {
      const value = await this.tenantSettings.getSettingValue(
        tenantId,
        SETTING_CODES.TENANT_VAT_RATE,
        branchId ?? undefined,
        userId ?? undefined
      );

      let taxRate = DEFAULT_VAT_RATE;
      if (value !== null && value !== undefined) {
        const parsed = typeof value === 'number' ? value : parseFloat(String(value));
        if (!Number.isNaN(parsed) && parsed >= 0 && parsed <= 1) {
          taxRate = parsed;
        }
      }

      this.taxRateCache.set(key, { rate: taxRate, timestamp: Date.now() });
      return taxRate;
    } catch (error) {
      console.error(`[TaxService] Error fetching tax rate for tenant ${tenantId}:`, error);
      this.taxRateCache.set(key, { rate: DEFAULT_VAT_RATE, timestamp: Date.now() });
      return DEFAULT_VAT_RATE;
    }
  }

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
   * @returns number - Tax amount
   */
  calculateTax(amount: number, taxRate: number): number {
    return parseFloat((amount * taxRate).toFixed(3));
  }

  /**
   * Clear cache for a tenant (call after tax rate update in Finance Settings).
   * Clears all cached rates for that tenant (any branch/user combo).
   */
  clearCache(tenantId: string): void {
    const prefix = `${tenantId}|`;
    for (const key of this.taxRateCache.keys()) {
      if (key.startsWith(prefix) || key === tenantId) {
        this.taxRateCache.delete(key);
      }
    }
  }

  /** Clear all cached tax rates. */
  clearAllCache(): void {
    this.taxRateCache.clear();
  }
}

/** Default singleton (uses client-side TenantSettingsService). */
export const taxService = new TaxService();
