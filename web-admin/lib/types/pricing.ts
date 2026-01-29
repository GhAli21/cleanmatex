/**
 * Pricing Type Definitions
 *
 * Type definitions for pricing calculations, price results, and order totals.
 */

/**
 * Price list type
 */
export type PriceListType = 'standard' | 'express' | 'vip' | 'seasonal' | 'b2b' | 'promotional';

/**
 * Price source indicator
 */
export type PriceSource = 'price_list' | 'product_default';

/**
 * Parameters for price lookup
 */
export interface PriceLookupParams {
    tenantId: string;
    productId: string;
    quantity: number;
    isExpress: boolean;
    customerId?: string;
    effectiveDate?: Date;
}

/**
 * Full pricing breakdown for a single item
 */
export interface PriceResult {
    /**
     * Base price per unit (from price list or product default)
     */
    basePrice: number;

    /**
     * Discount percentage applied (0-100)
     */
    discountPercent: number;

    /**
     * Final price per unit (after discount, before tax)
     */
    finalPrice: number;

    /**
     * Tax rate used (as decimal, e.g., 0.05 for 5%)
     */
    taxRate: number;

    /**
     * Tax amount
     */
    taxAmount: number;

    /**
     * Total price for the item (quantity * finalPrice + tax)
     */
    total: number;

    /**
     * Price list ID if price came from price list
     */
    priceListId?: string;

    /**
     * Price list item ID if price came from price list
     */
    priceListItemId?: string;

    /**
     * Source of the price
     */
    source: PriceSource;

    /**
     * Price list name (if from price list)
     */
    priceListName?: string;

    /**
     * Price list type used
     */
    priceListType?: PriceListType;

    /**
     * Quantity tier applied (if applicable)
     */
    quantityTier?: {
        min: number;
        max: number | null;
    };

    /**
     * Whether item is tax exempt
     */
    isTaxExempt: boolean;
}

/**
 * Order item for pricing calculation
 */
export interface OrderItemForPricing {
    productId: string;
    quantity: number;
    priceResult?: PriceResult;
}

/**
 * Order-level totals
 */
export interface OrderTotals {
    /**
     * Sum of all item subtotals (before discounts)
     */
    itemsSubtotal: number;

    /**
     * Sum of all item discounts
     */
    itemsDiscount: number;

    /**
     * Order-level discount
     */
    orderDiscount: number;

    /**
     * Total discount (items + order)
     */
    totalDiscount: number;

    /**
     * Subtotal after all discounts (before tax)
     */
    subtotalAfterDiscount: number;

    /**
     * Total tax
     */
    tax: number;

    /**
     * Grand total
     */
    total: number;

    /**
     * Number of items
     */
    totalItems: number;

    /**
     * Tax rate used
     */
    taxRate: number;
}

