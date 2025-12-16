/**
 * Pricing Calculator
 *
 * Calculates prices for order items and total orders including:
 * - Base price per item
 * - Express service multiplier
 * - Quantity
 * - Tax (VAT)
 * - Discounts
 *
 * Features:
 * - Precision handling (3 decimal places for OMR currency)
 * - Tax calculation
 * - Discount application
 * - Total order calculation
 */

export interface ItemPriceParams {
  /**
   * Base price per unit (before express multiplier)
   */
  basePrice: number;

  /**
   * Quantity of items
   */
  quantity: number;

  /**
   * Is this an express service order?
   */
  isExpress: boolean;

  /**
   * Express service multiplier (e.g., 1.5 for 50% increase)
   */
  expressMultiplier: number;

  /**
   * Tax rate as decimal (e.g., 0.05 for 5% VAT)
   */
  taxRate: number;

  /**
   * Discount percentage (0-100)
   */
  discountPercent?: number;

  /**
   * Fixed discount amount
   */
  discountAmount?: number;
}

export interface ItemPriceResult {
  /**
   * Price per unit (after express multiplier)
   */
  unitPrice: number;

  /**
   * Subtotal (unit price * quantity, before discount and tax)
   */
  subtotal: number;

  /**
   * Discount amount
   */
  discount: number;

  /**
   * Subtotal after discount (before tax)
   */
  subtotalAfterDiscount: number;

  /**
   * Tax amount
   */
  tax: number;

  /**
   * Total (after discount and tax)
   */
  total: number;
}

export interface OrderPriceParams {
  /**
   * Array of item price results
   */
  items: ItemPriceResult[];

  /**
   * Order-level discount percentage
   */
  orderDiscountPercent?: number;

  /**
   * Order-level fixed discount
   */
  orderDiscountAmount?: number;
}

export interface OrderPriceResult {
  /**
   * Sum of all item subtotals
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
}

/**
 * Calculate item price with tax and discount
 *
 * @param params - Item pricing parameters
 * @returns ItemPriceResult - Calculated prices
 *
 * @example
 * ```typescript
 * const result = calculateItemPrice({
 *   basePrice: 1.500,
 *   quantity: 5,
 *   isExpress: true,
 *   expressMultiplier: 1.5,
 *   taxRate: 0.05,
 *   discountPercent: 10
 * });
 *
 * console.log(result.total); // Calculated total
 * ```
 */
export function calculateItemPrice(params: ItemPriceParams): ItemPriceResult {
  const {
    basePrice,
    quantity,
    isExpress,
    expressMultiplier,
    taxRate,
    discountPercent = 0,
    discountAmount = 0,
  } = params;

  // Calculate unit price (apply express multiplier if needed)
  const unitPrice = isExpress ? basePrice * expressMultiplier : basePrice;

  // Calculate subtotal (before discount and tax)
  const subtotal = unitPrice * quantity;

  // Calculate discount
  const percentDiscount = (subtotal * discountPercent) / 100;
  const discount = percentDiscount + discountAmount;

  // Subtotal after discount
  const subtotalAfterDiscount = subtotal - discount;

  // Calculate tax on discounted amount
  const tax = subtotalAfterDiscount * taxRate;

  // Calculate total
  const total = subtotalAfterDiscount + tax;

  return {
    unitPrice: round(unitPrice),
    subtotal: round(subtotal),
    discount: round(discount),
    subtotalAfterDiscount: round(subtotalAfterDiscount),
    tax: round(tax),
    total: round(total),
  };
}

/**
 * Calculate order total from multiple items
 *
 * @param params - Order pricing parameters
 * @returns OrderPriceResult - Calculated order totals
 *
 * @example
 * ```typescript
 * const item1 = calculateItemPrice({ ... });
 * const item2 = calculateItemPrice({ ... });
 *
 * const orderTotal = calculateOrderTotal({
 *   items: [item1, item2],
 *   orderDiscountPercent: 5
 * });
 *
 * console.log(orderTotal.total); // Grand total
 * ```
 */
export function calculateOrderTotal(params: OrderPriceParams): OrderPriceResult {
  const { items, orderDiscountPercent = 0, orderDiscountAmount = 0 } = params;

  // Sum all item subtotals (before discounts)
  const itemsSubtotal = items.reduce((sum, item) => sum + item.subtotal, 0);

  // Sum all item discounts
  const itemsDiscount = items.reduce((sum, item) => sum + item.discount, 0);

  // Calculate subtotal after item discounts (before order discount)
  const subtotalBeforeOrderDiscount = itemsSubtotal - itemsDiscount;

  // Calculate order-level discount
  const percentDiscount = (subtotalBeforeOrderDiscount * orderDiscountPercent) / 100;
  const orderDiscount = percentDiscount + orderDiscountAmount;

  // Total discount
  const totalDiscount = itemsDiscount + orderDiscount;

  // Subtotal after all discounts
  const subtotalAfterDiscount = itemsSubtotal - totalDiscount;

  // Sum all taxes (already calculated on item level after item discounts)
  // Need to recalculate tax on final discounted amount
  const tax = items.reduce((sum, item) => sum + item.tax, 0);

  // Adjust tax if order discount applied
  const adjustedTax = tax - (orderDiscount * (tax / subtotalBeforeOrderDiscount));

  // Grand total
  const total = subtotalAfterDiscount + adjustedTax;

  return {
    itemsSubtotal: round(itemsSubtotal),
    itemsDiscount: round(itemsDiscount),
    orderDiscount: round(orderDiscount),
    totalDiscount: round(totalDiscount),
    subtotalAfterDiscount: round(subtotalAfterDiscount),
    tax: round(adjustedTax),
    total: round(total),
    totalItems: items.length,
  };
}

/**
 * Round number to 3 decimal places (for OMR currency precision)
 *
 * @param value - Value to round
 * @returns number - Rounded value
 */
export function round(value: number): number {
  return parseFloat(value.toFixed(3));
}

/**
 * Format price for display (with currency symbol)
 *
 * @param amount - Amount to format
 * @param currency - Currency code (default: 'OMR')
 * @param locale - Locale (default: 'en-OM')
 * @returns string - Formatted price
 *
 * @example
 * ```typescript
 * formatPrice(14.175); // "14.175 OMR"
 * formatPrice(14.175, 'USD', 'en-US'); // "$14.18"
 * ```
 */
export function formatPrice(
  amount: number,
  currency: string = 'OMR',
  locale: string = 'en-OM'
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(amount);
}

/**
 * Calculate express price increase
 *
 * @param basePrice - Base price
 * @param expressMultiplier - Express multiplier
 * @returns number - Price increase amount
 *
 * @example
 * ```typescript
 * calculateExpressIncrease(10.000, 1.5); // 5.000
 * ```
 */
export function calculateExpressIncrease(
  basePrice: number,
  expressMultiplier: number
): number {
  return round(basePrice * (expressMultiplier - 1));
}

/**
 * Calculate discount percentage from amounts
 *
 * @param originalAmount - Original amount
 * @param discountedAmount - Discounted amount
 * @returns number - Discount percentage
 *
 * @example
 * ```typescript
 * calculateDiscountPercent(100, 90); // 10
 * ```
 */
export function calculateDiscountPercent(
  originalAmount: number,
  discountedAmount: number
): number {
  if (originalAmount === 0) return 0;
  return round(((originalAmount - discountedAmount) / originalAmount) * 100);
}

/**
 * Apply discount to amount
 *
 * @param amount - Original amount
 * @param discountPercent - Discount percentage
 * @returns number - Discounted amount
 *
 * @example
 * ```typescript
 * applyDiscount(100, 10); // 90
 * ```
 */
export function applyDiscount(amount: number, discountPercent: number): number {
  return round(amount - (amount * discountPercent) / 100);
}

/**
 * Calculate tax amount
 *
 * @param amount - Amount to tax
 * @param taxRate - Tax rate as decimal
 * @returns number - Tax amount
 *
 * @example
 * ```typescript
 * calculateTax(100, 0.05); // 5.000
 * ```
 */
export function calculateTax(amount: number, taxRate: number): number {
  return round(amount * taxRate);
}
