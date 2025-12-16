/**
 * useOrderState Hook
 * Centralized state management for order creation
 * Re-Design: PRD-010 Advanced Orders
 */

'use client';

import { useState, useCallback, useEffect } from 'react';
import { OrderCreationState, OrderLineItem } from '@/lib/types/order-creation';

interface Product {
  id: string;
  product_name: string | null;
  product_name2: string | null;
  default_sell_price: number | null;
  default_express_sell_price: number | null;
  service_category_code: string | null;
}

const INITIAL_STATE: OrderCreationState = {
  customer: null,
  items: [],
  settings: {
    express: false,
    quickDrop: false,
    quickDropQuantity: 0,
    retail: false,
  },
  notes: '',
  readyByDate: null,
  readyByTime: null,
  readyByAt: '',
  totals: {
    subtotal: 0,
    discount: 0,
    tax: 0,
    total: 0,
  },
};

export function useOrderState() {
  const [state, setState] = useState<OrderCreationState>(INITIAL_STATE);

  // Calculate totals whenever items or settings change
  useEffect(() => {
    const subtotal = state.items.reduce((sum, item) => sum + item.totalPrice, 0);
    const discount = 0; // TODO: Implement discount logic
    const tax = 0; // TODO: Implement tax logic
    const total = subtotal - discount + tax;

    setState((prev) => ({
      ...prev,
      totals: { subtotal, discount, tax, total },
    }));
  }, [state.items]);

  // Customer actions
  const setCustomer = useCallback((customer: OrderCreationState['customer']) => {
    setState((prev) => ({ ...prev, customer }));
  }, []);

  // Item actions
  const addItem = useCallback((product: Product, quantity = 1) => {
    setState((prev) => {
      const pricePerUnit = prev.settings.express && product.default_express_sell_price
        ? product.default_express_sell_price
        : product.default_sell_price || 0;

      const existingItem = prev.items.find((item) => item.productId === product.id);

      if (existingItem) {
        // Update existing item quantity
        return {
          ...prev,
          items: prev.items.map((item) =>
            item.productId === product.id
              ? {
                  ...item,
                  quantity: item.quantity + quantity,
                  totalPrice: (item.quantity + quantity) * pricePerUnit,
                }
              : item
          ),
        };
      }

      // Add new item
      const newItem: OrderLineItem = {
        id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        productId: product.id,
        productName: product.product_name || 'Unknown',
        productName2: product.product_name2 || undefined,
        quantity,
        pricePerUnit,
        totalPrice: pricePerUnit * quantity,
        serviceCategoryCode: product.service_category_code || undefined,
        conditions: [],
        hasStain: false,
        hasDamage: false,
      };

      return {
        ...prev,
        items: [...prev.items, newItem],
      };
    });
  }, []);

  const updateItemQuantity = useCallback((itemId: string, quantity: number) => {
    if (quantity === 0) {
      removeItem(itemId);
      return;
    }

    setState((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.id === itemId
          ? {
              ...item,
              quantity,
              totalPrice: quantity * item.pricePerUnit,
            }
          : item
      ),
    }));
  }, []);

  const updateItem = useCallback((itemId: string, updates: Partial<OrderLineItem>) => {
    setState((prev) => ({
      ...prev,
      items: prev.items.map((item) =>
        item.id === itemId ? { ...item, ...updates } : item
      ),
    }));
  }, []);

  const removeItem = useCallback((itemId: string) => {
    setState((prev) => ({
      ...prev,
      items: prev.items.filter((item) => item.id !== itemId),
    }));
  }, []);

  const addConditionToItem = useCallback((itemId: string, condition: string) => {
    setState((prev) => ({
      ...prev,
      items: prev.items.map((item) => {
        if (item.id === itemId) {
          const conditions = item.conditions.includes(condition)
            ? item.conditions.filter((c) => c !== condition)
            : [...item.conditions, condition];

          return {
            ...item,
            conditions,
            hasStain: conditions.some((c) =>
              ['coffee', 'ink', 'grease', 'bleach', 'wine', 'blood', 'mud', 'oil', 'bubble'].includes(c)
            ),
            hasDamage: conditions.some((c) =>
              ['button_broken', 'button_missing', 'collar_torn', 'zipper_broken', 'hole', 'tear', 'seam_open'].includes(c)
            ),
          };
        }
        return item;
      }),
    }));
  }, []);

  const addCustomItem = useCallback((item: Omit<OrderLineItem, 'id' | 'conditions' | 'hasStain' | 'hasDamage'>) => {
    setState((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          ...item,
          id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          conditions: [],
          hasStain: false,
          hasDamage: false,
        },
      ],
    }));
  }, []);

  // Settings actions
  const updateSettings = useCallback((settings: Partial<OrderCreationState['settings']>) => {
    setState((prev) => ({
      ...prev,
      settings: { ...prev.settings, ...settings },
    }));

    // If express toggle changed, recalculate prices
    if (settings.express !== undefined) {
      setState((prev) => ({
        ...prev,
        items: prev.items.map((item) => {
          // Can't recalculate without product data, will need to pass express state to addItem
          return item;
        }),
      }));
    }
  }, []);

  // Notes actions
  const setNotes = useCallback((notes: string) => {
    setState((prev) => ({ ...prev, notes }));
  }, []);

  // Ready-by actions
  const setReadyBy = useCallback((date: Date | null, time: string | null) => {
    setState((prev) => ({
      ...prev,
      readyByDate: date,
      readyByTime: time,
      readyByAt: date && time ? new Date(`${date.toDateString()} ${time}`).toISOString() : '',
    }));
  }, []);

  const setReadyByAt = useCallback((readyByAt: string) => {
    setState((prev) => ({ ...prev, readyByAt }));
  }, []);

  // Get the most recently added item (for applying conditions)
  const getLastAddedItem = useCallback(() => {
    return state.items.length > 0 ? state.items[state.items.length - 1] : null;
  }, [state.items]);

  // Reset state
  const reset = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  return {
    state,
    actions: {
      setCustomer,
      addItem,
      updateItemQuantity,
      updateItem,
      removeItem,
      addConditionToItem,
      addCustomItem,
      updateSettings,
      setNotes,
      setReadyBy,
      setReadyByAt,
      getLastAddedItem,
      reset,
    },
  };
}
