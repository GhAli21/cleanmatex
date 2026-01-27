/**
 * use-order-validation Hook
 * 
 * Comprehensive order validation using Zod schemas and custom validators.
 * Validates customer, items, product IDs, and order settings.
 * 
 * @module use-order-validation
 */

import { useMemo } from 'react';
import { useNewOrderState } from '../ui/context/new-order-context';
import { newOrderFormSchema } from '../model/new-order-form-schema';
import { validateProductIds, validateOrderItem } from '@/lib/utils/validation-helpers';
import { hasDuplicateProducts } from '@/lib/utils/order-item-helpers';
import { ORDER_DEFAULTS } from '@/lib/constants/order-defaults';

/**
 * Hook to validate order
 * 
 * Performs comprehensive validation of the order including:
 * - Customer selection
 * - Item presence and validity
 * - Product ID validation
 * - Duplicate product detection
 * - Quick drop quantity validation
 * 
 * @returns Object containing:
 *   - isValid: Whether the order is valid
 *   - errors: Array of error messages
 *   - warnings: Array of warning messages
 * 
 * @example
 * ```tsx
 * const { isValid, errors, warnings } = useOrderValidation();
 * if (!isValid) {
 *   console.error('Validation errors:', errors);
 * }
 * ```
 */
export function useOrderValidation() {
  const state = useNewOrderState();

  const validation = useMemo(() => {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validate customer
    if (!state.customer || !state.customer.id) {
      errors.push('Customer is required');
    }

    // Validate items
    if (state.items.length === 0) {
      errors.push('At least one item is required');
    }

    // Validate product IDs
    const productIds = state.items.map((item) => item.productId);
    const invalidProductIds = validateProductIds(productIds);
    if (invalidProductIds.length > 0) {
      errors.push(`Invalid product IDs: ${invalidProductIds.join(', ')}`);
    }

    // Check for duplicate products
    if (hasDuplicateProducts(state.items)) {
      errors.push('Duplicate products found in order');
    }

    // Validate each item
    state.items.forEach((item, index) => {
      const itemValidation = validateOrderItem(item);
      if (!itemValidation.isValid) {
        errors.push(`Item ${index + 1}: ${itemValidation.errors.join(', ')}`);
      }
    });

    // Warnings
    if (state.items.length > ORDER_DEFAULTS.LIMITS.ITEMS_HIGH_THRESHOLD) {
      warnings.push(
        `High number of items (${state.items.length}). Consider splitting the order.`
      );
    }

    // Validate quick drop quantity if quick drop is enabled
    if (state.isQuickDrop && state.quickDropQuantity <= 0) {
      errors.push('Quick drop quantity must be greater than 0');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }, [state]);

  return validation;
}

