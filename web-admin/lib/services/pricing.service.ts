/**
 * Pricing Service
 *
 * Handles price lookup using price lists, product defaults, and customer-specific pricing.
 * Integrates with TaxService for tax calculations.
 */

import { createClient } from '@/lib/supabase/server';
import { roundMoneyAmount } from '@/lib/money/format-money';
import { createTenantSettingsService } from './tenant-settings.service';
import { TaxService } from './tax.service';
import { calculateItemPrice } from '@/lib/utils/pricing-calculator';
import type {
    PriceResult,
    PriceLookupParams,
    OrderTotals,
    OrderItemForPricing,
    PriceListType,
    PriceSource,
} from '@/lib/types/pricing';

/**
 *
 */
export class PricingService {
    /**
     * Resolve only the rounded authoritative unit prices required by order totals.
     * Request-local deduplication never reuses a quote across tenants or submissions.
     * @param params - Authenticated tenant, shared currency precision, and complete quote inputs.
     * @returns Prices in the original line order, including duplicate lines.
     * @throws When an authoritative product price cannot be resolved.
     * @example await pricingService.getBasePricesForOrder({ tenantId, items, decimalPlaces: 2, isExpress: false });
     */
    async getBasePricesForOrder(params: {
        tenantId: string;
        items: readonly { productId: string; quantity: number }[];
        decimalPlaces: number;
        isExpress: boolean;
        customerId?: string;
        effectiveDate?: Date;
        /** New checkout quotes reject unavailable pricing facts; legacy callers preserve their fallback. */
        strictResolution?: boolean;
    }): Promise<number[]> {
        const { tenantId, items, decimalPlaces, isExpress, customerId } = params;
        const supabase = await createClient();
        const priceListType = await this.determinePriceListType(tenantId, isExpress, customerId, supabase, params.strictResolution);
        const effectiveDate = (params.effectiveDate ?? new Date()).toISOString().split('T')[0];
        const pending = new Map<string, Promise<number>>();
        const prices = new Array<number>(items.length);
        let nextIndex = 0;
        let failed = false;

        // Six concurrent scalar RPCs bound database fanout until a measured bulk RPC is justified.
        const workers = Array.from({ length: Math.min(6, items.length) }, async () => {
            while (!failed && nextIndex < items.length) {
                const index = nextIndex++;
                const item = items[index];
                const key = JSON.stringify([tenantId, item.productId, item.quantity, priceListType, isExpress, effectiveDate, decimalPlaces]);
                let quote = pending.get(key);
                if (!quote) {
                    quote = this.resolveBasePrice(supabase, {
                        tenantId, productId: item.productId, quantity: item.quantity,
                        priceListType, isExpress, effectiveDate, strictResolution: params.strictResolution,
                    }).then(({ basePrice }) => roundMoneyAmount(basePrice, decimalPlaces));
                    pending.set(key, quote);
                }
                try {
                    prices[index] = await quote;
                } catch (error) {
                    failed = true;
                    throw error;
                }
            }
        });
        await Promise.all(workers);
        return prices;
    }

    /**
     * Keep valid scalar RPC and product fallback semantics identical for both pricing consumers.
     * @param supabase - Authenticated client bound to the current request.
     * @param params - Tenant scope and the complete price-list lookup inputs.
     * @returns The unrounded authoritative unit price and its existing source classification.
     * @throws When product resolution fails, or strict quotes cannot verify pricing facts.
     */
    private async resolveBasePrice(
        supabase: Awaited<ReturnType<typeof createClient>>,
        params: { tenantId: string; productId: string; quantity: number; priceListType: PriceListType; isExpress: boolean; effectiveDate: string; strictResolution?: boolean },
    ): Promise<{ basePrice: number; source: PriceSource }> {
        const { tenantId, productId, quantity, priceListType, isExpress, effectiveDate } = params;
        const { data: priceData, error: priceError } = await supabase.rpc('get_product_price', {
            p_tenant_org_id: tenantId,
            p_product_id: productId,
            p_price_list_type: priceListType,
            p_quantity: quantity,
            p_effective_date: effectiveDate,
        });
        if (priceError && params.strictResolution) throw new Error('PRICING_UNAVAILABLE');
        if (!priceError && priceData !== null && priceData !== undefined) {
            return { basePrice: Number(priceData), source: 'price_list' };
        }
        console.warn(`[PricingService] Price list lookup failed for product ${productId}, falling back to product default:`, priceError);
        const { data: product, error: productError } = await supabase
            .from('org_product_data_mst')
            .select('default_sell_price, default_express_sell_price')
            .eq('tenant_org_id', tenantId)
            .eq('id', productId)
            .eq('is_active', true)
            .single();
        if (productError && params.strictResolution && productError.code !== 'PGRST116') {
            throw new Error('PRICING_UNAVAILABLE');
        }
        if (productError || !product) throw new Error(`Product not found: ${productId}`);
        return {
            basePrice: Number(isExpress && product.default_express_sell_price
                ? product.default_express_sell_price : product.default_sell_price || 0),
            source: 'product_default',
        };
    }

    /**
     * Determine price list type based on order context
     * @param tenantId
     * @param isExpress - Is this an express order?
     * @param customerId - Customer ID (optional)
     * @param supabase
     * @returns Promise<PriceListType> - Price list type to use
     */
    private async determinePriceListType(
        tenantId: string,
        isExpress: boolean,
        customerId: string | undefined,
        supabase: Awaited<ReturnType<typeof createClient>>,
        strictResolution = false,
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

                if (error && strictResolution) throw new Error('CUSTOMER_PRICING_UNAVAILABLE');

                if (!error && customer) {
                    // Check customer type
                    if (customer.type === 'b2b' || customer.type === 'B2B') {
                        priceListType = 'b2b';
                    } else if (customer.type === 'vip' || customer.type === 'VIP') {
                        priceListType = 'vip';
                    }

                    // Check preferences for pricing tier (overrides type)
                    if (customer.preferences && typeof customer.preferences === 'object') {
                        const prefs = customer.preferences as Record<string, unknown>;
                        if (prefs.pricing_tier === 'b2b' || prefs.pricing_tier === 'B2B') {
                            priceListType = 'b2b';
                        } else if (prefs.pricing_tier === 'vip' || prefs.pricing_tier === 'VIP') {
                            priceListType = 'vip';
                        }
                    }
                }
            } catch (error) {
                if (strictResolution) throw error;
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
            branchId,
            userId,
        } = params;

        try {
            const supabase = await createClient();
            const tenantSettings = createTenantSettingsService(supabase);
            const taxService = new TaxService({ tenantSettings });
            const { decimalPlaces } = await tenantSettings.getCurrencyConfig(
                tenantId,
                branchId,
                userId,
            );
            const roundMoney = (n: number) => roundMoneyAmount(n, decimalPlaces);

            // Determine price list type
            const priceListType = await this.determinePriceListType(
                tenantId,
                isExpress,
                customerId,
                supabase
            );

            const { basePrice, source } = await this.resolveBasePrice(supabase, {
                tenantId, productId, quantity, priceListType, isExpress,
                effectiveDate: effectiveDate.toISOString().split('T')[0],
            });
            let priceListId: string | undefined;
            let priceListItemId: string | undefined;
            let priceListName: string | undefined;
            let discountPercent = 0;
            let quantityTier: { min: number; max: number | null } | undefined;

            if (source === 'price_list') {
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
                        .eq('org_price_lists_mst.tenant_org_id', tenantId)
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

            // Get tax rate (with branch/user context for full 7-layer resolution)
            const taxRate = await taxService.getTaxRate(tenantId, branchId, userId);
            const isTaxExempt = await taxService.isTaxExempt(tenantId, productId);

            // Calculate final price (after discount)
            const finalPrice = basePrice * (1 - discountPercent / 100);

            // Calculate tax
            const taxAmount = isTaxExempt
                ? 0
                : taxService.calculateTax(finalPrice * quantity, taxRate, decimalPlaces);

            // Calculate total
            const total = finalPrice * quantity + taxAmount;

            return {
                basePrice: roundMoney(basePrice),
                discountPercent,
                finalPrice: roundMoney(finalPrice),
                taxRate,
                taxAmount: roundMoney(taxAmount),
                total: roundMoney(total),
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
     * @param options.customerId
     * @param options.isExpress
     * @param options.orderDiscountPercent
     * @param options.orderDiscountAmount
     * @param options.branchId
     * @param options.userId
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
            branchId?: string;
            userId?: string;
        } = {}
    ): Promise<OrderTotals> {
        const {
            customerId,
            isExpress = false,
            orderDiscountPercent = 0,
            orderDiscountAmount = 0,
            branchId,
            userId,
        } = options;

        const supabase = await createClient();
        const tenantSettings = createTenantSettingsService(supabase);
        const { decimalPlaces } = await tenantSettings.getCurrencyConfig(tenantId, branchId, userId);

        // Get price results for all items
        const priceResults = await Promise.all(
            items.map((item) =>
                this.getPriceForOrderItem({
                    tenantId,
                    productId: item.productId,
                    quantity: item.quantity,
                    isExpress,
                    customerId,
                    branchId,
                    userId,
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
                decimalPlaces,
            });
        });

        // Calculate order totals using pricing calculator
        const { calculateOrderTotal } = await import('@/lib/utils/pricing-calculator');
        const orderResult = calculateOrderTotal({
            items: itemPriceResults,
            orderDiscountPercent,
            orderDiscountAmount,
            decimalPlaces,
        });

        const taxService = new TaxService({ tenantSettings });
        const taxRate = await taxService.getTaxRate(tenantId, branchId, userId);

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

