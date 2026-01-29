/**
 * Tax Service
 *
 * Handles tax rate retrieval and tax calculations for tenants.
 * Uses sys_tenant_settings_cd for tax rate configuration.
 */

import { createClient } from '@/lib/supabase/client';
import { getTenantIdFromSession } from '@/lib/db/tenant-context';

export class TaxService {
    private supabase = createClient();
    private taxRateCache: Map<string, { rate: number; timestamp: number }> = new Map();
    private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

    /**
     * Get tax rate for a tenant
     * @param tenantId - Tenant organization ID
     * @returns Promise<number> - Tax rate as decimal (e.g., 0.05 for 5%)
     */
    async getTaxRate(tenantId: string): Promise<number> {
        // Check cache first
        const cached = this.taxRateCache.get(tenantId);
        if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
            return cached.rate;
        }

        try {
            // Try to get from tenant settings
            // @ts-expect-error - RPC function exists but types not regenerated
            const { data, error } = await this.supabase.rpc('fn_get_setting_value', {
                p_tenant_org_id: tenantId,
                p_setting_code: 'TAX_RATE',
            });

            if (error) {
                console.warn(`[TaxService] Error fetching tax rate for tenant ${tenantId}:`, error);
                // Fallback to default
                const defaultRate = 0.05;
                this.taxRateCache.set(tenantId, { rate: defaultRate, timestamp: Date.now() });
                return defaultRate;
            }

            // Parse the setting value
            let taxRate = 0.05; // Default 5% VAT
            if (data?.value !== null && data?.value !== undefined) {
                const parsed = parseFloat(data.value);
                if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
                    taxRate = parsed;
                }
            }

            // Cache the result
            this.taxRateCache.set(tenantId, { rate: taxRate, timestamp: Date.now() });
            return taxRate;
        } catch (error) {
            console.error(`[TaxService] Exception fetching tax rate for tenant ${tenantId}:`, error);
            // Fallback to default
            const defaultRate = 0.05;
            this.taxRateCache.set(tenantId, { rate: defaultRate, timestamp: Date.now() });
            return defaultRate;
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
            // Check if product has tax exemption flag
            // This could be stored in org_product_data_mst or a separate tax exemption table
            // For now, return false (no exemptions) - can be enhanced later
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
     * Clear cache for a tenant (useful after tax rate update)
     * @param tenantId - Tenant organization ID
     */
    clearCache(tenantId: string): void {
        this.taxRateCache.delete(tenantId);
    }

    /**
     * Clear all cache
     */
    clearAllCache(): void {
        this.taxRateCache.clear();
    }
}

// Export singleton instance
export const taxService = new TaxService();

