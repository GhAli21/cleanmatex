/**
 * use-order-totals Hook
 * 
 * Memoized hook for calculating order totals including subtotal and item counts.
 * Automatically recalculates when order items change.
 * 
 * @module use-order-totals
 */

import { useMemo } from 'react';
import { useNewOrderState } from '../ui/context/new-order-context';
import { calculateOrderTotal } from '@/lib/utils/order-item-helpers';

/**
 * Hook to calculate order totals
 * 
 * @returns Object containing:
 *   - subtotal: Total price of all items
 *   - itemCount: Total quantity of all items
 *   - itemsCount: Number of distinct items in the order
 * 
 * @example
 * ```tsx
 * const { subtotal, itemCount, itemsCount } = useOrderTotals();
 * ```
 */
export function useOrderTotals() {
  const state = useNewOrderState();

  const totals = useMemo(() => {
    const subtotal = calculateOrderTotal(state.items);
    const itemCount = state.items.reduce((count, item) => count + item.quantity, 0);

    return {
      subtotal,
      itemCount,
      itemsCount: state.items.length,
    };
  }, [state.items]);

  return totals;
}

