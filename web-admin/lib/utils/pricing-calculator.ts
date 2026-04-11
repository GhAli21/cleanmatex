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
 * Money amounts are rounded with {@link roundMoneyAmount} using tenant
 * `decimalPlaces` when provided, otherwise {@link ORDER_DEFAULTS.PRICE.DECIMAL_PLACES}.
 */

import { ORDER_DEFAULTS } from '@/lib/constants/order-defaults';
import { roundMoneyAmount } from '@/lib/money/format-money';

function resolveMoneyDecimalPlaces(explicit?: number): number {
  if (explicit !== undefined && Number.isFinite(explicit) && explicit >= 0) {
    return Math.min(Math.floor(explicit), 20);
  }
  return ORDER_DEFAULTS.PRICE.DECIMAL_PLACES;
}

/** Ratios / discount percentages — not ISO currency fraction digits. */
function roundPercentRatio(value: number): number {
  return Number(Number(value).toFixed(4));
}

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

  /**
   * Tenant fraction digits for money rounding (TENANT_DECIMAL_PLACES).
   */
  decimalPlaces?: number;
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

  /**
   * Tenant fraction digits for money rounding (TENANT_DECIMAL_PLACES).
   */
  decimalPlaces?: number;
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
    decimalPlaces: decimalPlacesParam,
  } = params;

  const dp = resolveMoneyDecimalPlaces(decimalPlacesParam);
  const r = (value: number) => roundMoneyAmount(value, dp);

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
    unitPrice: r(unitPrice),
    subtotal: r(subtotal),
    discount: r(discount),
    subtotalAfterDiscount: r(subtotalAfterDiscount),
    tax: r(tax),
    total: r(total),
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
  const { items, orderDiscountPercent = 0, orderDiscountAmount = 0, decimalPlaces: decimalPlacesParam } =
    params;

  const dp = resolveMoneyDecimalPlaces(decimalPlacesParam);
  const r = (value: number) => roundMoneyAmount(value, dp);

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
  const adjustedTax =
    subtotalBeforeOrderDiscount === 0
      ? 0
      : tax - orderDiscount * (tax / subtotalBeforeOrderDiscount);

  // Grand total
  const total = subtotalAfterDiscount + adjustedTax;

  return {
    itemsSubtotal: r(itemsSubtotal),
    itemsDiscount: r(itemsDiscount),
    orderDiscount: r(orderDiscount),
    totalDiscount: r(totalDiscount),
    subtotalAfterDiscount: r(subtotalAfterDiscount),
    tax: r(adjustedTax),
    total: r(total),
    totalItems: items.length,
  };
}

/**
 * Round a money-like value to tenant (or default) fraction digits.
 *
 * @param value - Amount to round
 * @param decimalPlaces - Optional override; defaults to ORDER_DEFAULTS.PRICE.DECIMAL_PLACES
 */
export function round(value: number, decimalPlaces?: number): number {
  return roundMoneyAmount(value, resolveMoneyDecimalPlaces(decimalPlaces));
}

/**
 * Format price for display (Intl currency style).
 *
 * @param amount - Amount to format
 * @param currency - ISO currency code (default: ORDER_DEFAULTS.CURRENCY)
 * @param locale - BCP 47 locale tag for Intl (default: en-OM)
 * @param decimalPlaces - Fraction digits (default: ORDER_DEFAULTS.PRICE.DECIMAL_PLACES)
 */
export function formatPrice(
  amount: number,
  currency: string = ORDER_DEFAULTS.CURRENCY,
  locale: string = 'en-OM',
  decimalPlaces: number = ORDER_DEFAULTS.PRICE.DECIMAL_PLACES,
): string {
  const cc = (currency || ORDER_DEFAULTS.CURRENCY).trim() || ORDER_DEFAULTS.CURRENCY;
  const dp = resolveMoneyDecimalPlaces(decimalPlaces);
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: cc,
      minimumFractionDigits: dp,
      maximumFractionDigits: dp,
    }).format(amount);
  } catch {
    return `${cc} ${Number(amount).toFixed(dp)}`;
  }
}

/**
 * Calculate express price increase
 *
 * @param basePrice - Base price
 * @param expressMultiplier - Express multiplier
 * @param decimalPlaces - Money fraction digits
 */
export function calculateExpressIncrease(
  basePrice: number,
  expressMultiplier: number,
  decimalPlaces?: number,
): number {
  return round(basePrice * (expressMultiplier - 1), decimalPlaces);
}

/**
 * Calculate discount percentage from amounts (ratio × 100, 4 dp).
 */
export function calculateDiscountPercent(originalAmount: number, discountedAmount: number): number {
  if (originalAmount === 0) return 0;
  return roundPercentRatio(((originalAmount - discountedAmount) / originalAmount) * 100);
}

/**
 * Apply discount to amount
 */
export function applyDiscount(
  amount: number,
  discountPercent: number,
  decimalPlaces?: number,
): number {
  return round(amount - (amount * discountPercent) / 100, decimalPlaces);
}

/**
 * Calculate tax amount (money rounding only; rate comes from TaxService in app code).
 */
export function calculateTax(amount: number, taxRate: number, decimalPlaces?: number): number {
  return round(amount * taxRate, decimalPlaces);
}
