/**
 * use-order-warnings Hook
 * 
 * Provides validation warnings and errors for order creation.
 * Detects issues like duplicate products, high item counts, missing customer, etc.
 * 
 * @module use-order-warnings
 */

'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useNewOrderState } from '../ui/context/new-order-context';
import { hasDuplicateProducts } from '@/lib/utils/order-item-helpers';
import { ORDER_DEFAULTS } from '@/lib/constants/order-defaults';

/**
 * Order warning types
 * 
 * @interface OrderWarning
 * @property type - Type of warning
 * @property message - Human-readable warning message
 * @property severity - Whether this is a warning or error
 */
export interface OrderWarning {
  type: 'duplicate_products' | 'high_quantity' | 'no_customer' | 'no_items' | 'no_branch';
  message: string;
  severity: 'warning' | 'error';
}

/**
 * Hook to get order warnings
 * 
 * Checks for various order issues and returns warnings/errors:
 * - Duplicate products in order
 * - High number of items (suggests splitting order)
 * - Missing customer selection
 * - No items in order
 * 
 * @returns Object containing:
 *   - warnings: Array of all warnings and errors
 *   - hasWarnings: Whether any warnings exist
 *   - hasErrors: Whether any errors exist
 * 
 * @example
 * ```tsx
 * const { warnings, hasWarnings, hasErrors } = useOrderWarnings();
 * if (hasErrors) {
 *   warnings.forEach(w => console.error(w.message));
 * }
 * ```
 */
export function useOrderWarnings(options?: { hasBranches: boolean }): {
  warnings: OrderWarning[];
  hasWarnings: boolean;
  hasErrors: boolean;
} {
  const state = useNewOrderState();
  const t = useTranslations('newOrder.errors');

  const warnings = useMemo(() => {
    const result: OrderWarning[] = [];

    // Check for branch selection when branches exist
    if (options?.hasBranches && !state.branchId) {
      result.push({
        type: 'no_branch',
        message: t('selectBranch'),
        severity: 'error',
      });
    }

    // Check for duplicate products
    if (hasDuplicateProducts(state.items)) {
      result.push({
        type: 'duplicate_products',
        message: 'Duplicate products found in order. Please review your items.',
        severity: 'error',
      });
    }

    // Check for high quantity of items
    if (state.items.length > ORDER_DEFAULTS.LIMITS.ITEMS_HIGH_THRESHOLD) {
      result.push({
        type: 'high_quantity',
        message: `High number of items (${state.items.length}). Consider splitting the order for better management.`,
        severity: 'warning',
      });
    }

    // Check for no customer
    if (!state.customer) {
      result.push({
        type: 'no_customer',
        message: 'Please select a customer before submitting the order.',
        severity: 'error',
      });
    }

    // Check for no items
    if (state.items.length === 0) {
      result.push({
        type: 'no_items',
        message: 'Please add at least one item to the order.',
        severity: 'error',
      });
    }

    return result;
  }, [state.items, state.customer, state.branchId, options?.hasBranches, t]);

  const hasWarnings = warnings.some((w) => w.severity === 'warning');
  const hasErrors = warnings.some((w) => w.severity === 'error');

  return {
    warnings,
    hasWarnings,
    hasErrors,
  };
}

