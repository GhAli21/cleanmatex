/**
 * Pricing Service
 *
 * Handles price lookup using price lists, product defaults, and customer-specific pricing.
 * Integrates with TaxService for tax calculations.
 */

import { createClient } from '@/lib/supabase/server';
import { taxService } from './tax.service';
import { calculateItemPrice } from '@/lib/utils/pricing-calculator';
import type {
    PriceResult,
    PriceLookupParams,
    OrderTotals,
    OrderItemForPricing,
    PriceListType,
    PriceSource,
} from '@/lib/types/pricing';

export class PricingService {
    /**
     * Determine price list type based on order context
     * @param isExpress - Is this an express order?
     * @param customerId - Customer ID (optional)
     * @returns Promise<PriceListType> - Price list type to use
     */
    private async determinePriceListType(
        tenantId: string,
        isExpress: boolean,
        customerId: string | undefined,
        supabase: Awaited<ReturnType<typeof createClient>>
    ): Promise<PriceListType> {
        // Start with standard or express
        let priceListType: PriceListType = isExpress ? 'express' : 'standard';

        // Check customer-specific pricing if customer provided
        if (customerId) {
            try {
                const { data: customer, error } = await supabase
                    .from('org_customers_mst')
                    .select('type, preferences')
                    .eq('tenant_org_id', tenantId)
                    .eq('id', customerId)
                    .single();

                if (!error && customer) {
                    // Check customer type
                    if (customer.type === 'b2b' || customer.type === 'B2B') {
                        priceListType = 'b2b';
                    } else if (customer.type === 'vip' || customer.type === 'VIP') {
                        priceListType = 'vip';
                    }

                    // Check preferences for pricing tier (overrides type)
                    if (customer.preferences && typeof customer.preferences === 'object') {
                        const prefs = customer.preferences as Record<string, any>;
                        if (prefs.pricing_tier === 'b2b' || prefs.pricing_tier === 'B2B') {
                            priceListType = 'b2b';
                        } else if (prefs.pricing_tier === 'vip' || prefs.pricing_tier === 'VIP') {
                            priceListType = 'vip';
                        }
                    }
                }
            } catch (error) {
                console.warn(`[PricingService] Error checking customer pricing for ${customerId}:`, error);
                // Fall back to standard/express
            }
        }

        return priceListType;
    }

    /**
     * Get price for an order item
     * @param params - Price lookup parameters
     * @returns Promise<PriceResult> - Full pricing breakdown
     */
    async getPriceForOrderItem(params: PriceLookupParams): Promise<PriceResult> {
        const {
            tenantId,
            productId,
            quantity,
            isExpress,
            customerId,
            effectiveDate = new Date(),
        } = params;

        try {
            const supabase = await createClient();

            // Determine price list type
            const priceListType = await this.determinePriceListType(
                tenantId,
                isExpress,
                customerId,
                supabase
            );

            // Call database function to get price
            const { data: priceData, error: priceError } = await (supabase.rpc as any)(
                'get_product_price',
                {
                    p_tenant_org_id: tenantId,
                    p_product_id: productId,
                    p_price_list_type: priceListType,
                    p_quantity: quantity,
                    p_effective_date: effectiveDate.toISOString().split('T')[0],
                }
            );

            let basePrice: number;
            let source: PriceSource = 'product_default';
            let priceListId: string | undefined;
            let priceListItemId: string | undefined;
            let priceListName: string | undefined;
            let discountPercent = 0;
            let quantityTier: { min: number; max: number | null } | undefined;

            if (priceError || priceData === null || priceData === undefined) {
                console.warn(
                    `[PricingService] Price list lookup failed for product ${productId}, falling back to product default:`,
                    priceError
                );

                // Fallback to product default price
                const { data: product, error: productError } = await supabase
                    .from('org_product_data_mst')
                    .select('default_sell_price, default_express_sell_price')
                    .eq('tenant_org_id', tenantId)
                    .eq('id', productId)
                    .eq('is_active', true)
                    .single();

                if (productError || !product) {
                    throw new Error(`Product not found: ${productId}`);
                }

                basePrice = Number(
                    isExpress && product.default_express_sell_price
                        ? product.default_express_sell_price
                        : product.default_sell_price || 0
                );
            } else {
                // Price from price list
                basePrice = Number(priceData);
                source = 'price_list';

                // Try to get price list item details for additional info
                try {
                    const { data: priceListItems } = await supabase
                        .from('org_price_list_items_dtl')
                        .select(
                            `
              id,
              price,
              discount_percent,
              min_quantity,
              max_quantity,
              org_price_lists_mst!inner(
                id,
                name,
                name2
              )
            `
                        )
                        .eq('tenant_org_id', tenantId)
                        .eq('product_id', productId)
                        .eq('is_active', true)
                        .lte('min_quantity', quantity)
                        .or(`max_quantity.is.null,max_quantity.gte.${quantity}`)
                        .eq('org_price_lists_mst.price_list_type', priceListType)
                        .eq('org_price_lists_mst.is_active', true)
                        .order('min_quantity', { ascending: false })
                        .limit(1)
                        .single();

                    if (priceListItems) {
                        priceListItemId = priceListItems.id;
                        priceListId = priceListItems.org_price_lists_mst?.id;
                        priceListName =
                            priceListItems.org_price_lists_mst?.name ||
                            priceListItems.org_price_lists_mst?.name2 ||
                            undefined;
                        discountPercent = Number(priceListItems.discount_percent || 0);
                        quantityTier = {
                            min: priceListItems.min_quantity,
                            max: priceListItems.max_quantity,
                        };
                    }
                } catch (error) {
                    console.warn('[PricingService] Could not fetch price list item details:', error);
                }
            }

            // Get tax rate
            const taxRate = await taxService.getTaxRate(tenantId);
            const isTaxExempt = await taxService.isTaxExempt(tenantId, productId);

            // Calculate final price (after discount)
            const finalPrice = basePrice * (1 - discountPercent / 100);

            // Calculate tax
            const taxAmount = isTaxExempt ? 0 : taxService.calculateTax(finalPrice * quantity, taxRate);

            // Calculate total
            const total = finalPrice * quantity + taxAmount;

            return {
                basePrice: parseFloat(basePrice.toFixed(3)),
                discountPercent,
                finalPrice: parseFloat(finalPrice.toFixed(3)),
                taxRate,
                taxAmount: parseFloat(taxAmount.toFixed(3)),
                total: parseFloat(total.toFixed(3)),
                priceListId,
                priceListItemId,
                source,
                priceListName,
                priceListType,
                quantityTier,
                isTaxExempt,
            };
        } catch (error) {
            console.error(`[PricingService] Error getting price for item:`, error);
            throw error;
        }
    }

    /**
     * Calculate order totals from multiple items
     * @param tenantId - Tenant organization ID
     * @param items - Array of order items with pricing
     * @param options - Optional: customerId, isExpress, orderDiscountPercent, orderDiscountAmount
     * @returns Promise<OrderTotals> - Order-level totals
     */
    async calculateOrderTotals(
        tenantId: string,
        items: OrderItemForPricing[],
        options: {
            customerId?: string;
            isExpress?: boolean;
            orderDiscountPercent?: number;
            orderDiscountAmount?: number;
        } = {}
    ): Promise<OrderTotals> {
        const {
            customerId,
            isExpress = false,
            orderDiscountPercent = 0,
            orderDiscountAmount = 0,
        } = options;

        // Get price results for all items
        const priceResults = await Promise.all(
            items.map((item) =>
                this.getPriceForOrderItem({
                    tenantId,
                    productId: item.productId,
                    quantity: item.quantity,
                    isExpress,
                    customerId,
                })
            )
        );

        // Calculate item-level totals
        const itemsSubtotal = priceResults.reduce(
            (sum, result, index) => sum + result.basePrice * items[index].quantity,
            0
        );

        // Use pricing calculator for consistency
        const itemPriceResults = priceResults.map((result, index) => {
            const item = items[index];
            return calculateItemPrice({
                basePrice: result.basePrice,
                quantity: item.quantity,
                isExpress,
                expressMultiplier: 1, // Price already reflects express via price list
                taxRate: result.taxRate,
                discountPercent: result.discountPercent,
            });
        });

        // Calculate order totals using pricing calculator
        const { calculateOrderTotal } = await import('@/lib/utils/pricing-calculator');
        const orderResult = calculateOrderTotal({
            items: itemPriceResults,
            orderDiscountPercent,
            orderDiscountAmount,
        });

        // Get tax rate for the order
        const taxRate = await taxService.getTaxRate(tenantId);

        return {
            itemsSubtotal: orderResult.itemsSubtotal,
            itemsDiscount: orderResult.itemsDiscount,
            orderDiscount: orderResult.orderDiscount,
            totalDiscount: orderResult.totalDiscount,
            subtotalAfterDiscount: orderResult.subtotalAfterDiscount,
            tax: orderResult.tax,
            total: orderResult.total,
            totalItems: items.length,
            taxRate,
        };
    }
}

// Export singleton instance
export const pricingService = new PricingService();

