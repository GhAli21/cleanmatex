/**
 * Validation Helpers
 * Consolidated validation utilities for orders
 * 
 * Provides type-safe validation functions for order-related data structures
 * including UUIDs, product IDs, customer IDs, quantities, and prices.
 */

/**
 * UUID validation regex
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validates if a string is a valid UUID
 * @param value - String to validate
 * @returns True if valid UUID, false otherwise
 */
export function isValidUUID(value: string): boolean {
  return UUID_REGEX.test(value);
}

/**
 * Validates a product ID
 * @param productId - Product ID to validate
 * @returns True if valid, false otherwise
 */
export function validateProductId(productId: string): boolean {
  if (!productId || typeof productId !== 'string') {
    return false;
  }
  return isValidUUID(productId);
}

/**
 * Validates a customer ID
 * @param customerId - Customer ID to validate
 * @returns True if valid, false otherwise
 */
export function validateCustomerId(customerId: string): boolean {
  if (!customerId || typeof customerId !== 'string') {
    return false;
  }
  return isValidUUID(customerId);
}

/**
 * Validates quantity
 * @param quantity - Quantity to validate
 * @param min - Minimum value (default: 1)
 * @param max - Maximum value (default: 999)
 * @returns True if valid, false otherwise
 */
export function validateQuantity(
  quantity: number,
  min: number = 1,
  max: number = 999
): boolean {
  if (typeof quantity !== 'number' || isNaN(quantity)) {
    return false;
  }
  return quantity >= min && quantity <= max && Number.isInteger(quantity);
}

/**
 * Validates price
 * @param price - Price to validate
 * @param min - Minimum value (default: 0)
 * @returns True if valid, false otherwise
 */
export function validatePrice(price: number, min: number = 0): boolean {
  if (typeof price !== 'number' || isNaN(price)) {
    return false;
  }
  return price >= min;
}

/**
 * Validates multiple product IDs
 * @param productIds - Array of product IDs to validate
 * @returns Array of invalid product IDs
 */
export function validateProductIds(productIds: string[]): string[] {
  return productIds.filter((id) => !validateProductId(id));
}

/**
 * Validates order item data
 * @param item - Order item to validate
 * @returns Object with validation result and errors
 */
export function validateOrderItem(item: {
  productId: string;
  quantity: number;
  pricePerUnit: number;
}): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!validateProductId(item.productId)) {
    errors.push('Invalid product ID');
  }

  if (!validateQuantity(item.quantity)) {
    errors.push('Invalid quantity');
  }

  if (!validatePrice(item.pricePerUnit)) {
    errors.push('Invalid price per unit');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

