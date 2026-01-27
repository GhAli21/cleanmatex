/**
 * Unit Tests: Order Item Helpers
 * Tests for order item manipulation utilities
 */

import {
  addItemToOrder,
  removeItemFromOrder,
  updateItemQuantity,
  calculateItemTotal,
  calculateOrderTotal,
  hasDuplicateProducts,
  getItemCount,
} from '@/lib/utils/order-item-helpers';
import type { OrderItem } from '@/src/features/orders/model/new-order-types';

describe('Order Item Helpers', () => {
  const mockItem: OrderItem = {
    productId: 'product-1',
    productName: 'Shirt',
    productName2: null,
    quantity: 1,
    pricePerUnit: 10.0,
    totalPrice: 10.0,
    defaultSellPrice: 10.0,
    defaultExpressSellPrice: null,
  };

  const mockItem2: OrderItem = {
    productId: 'product-2',
    productName: 'Pants',
    productName2: null,
    quantity: 2,
    pricePerUnit: 20.0,
    totalPrice: 40.0,
    defaultSellPrice: 20.0,
    defaultExpressSellPrice: null,
  };

  describe('addItemToOrder', () => {
    it('should add new item to empty array', () => {
      const result = addItemToOrder([], mockItem);
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockItem);
    });

    it('should increment quantity for existing item', () => {
      const existingItems = [mockItem];
      const result = addItemToOrder(existingItems, mockItem);

      expect(result).toHaveLength(1);
      expect(result[0].quantity).toBe(2);
      expect(result[0].totalPrice).toBe(20.0);
    });

    it('should add different item to existing items', () => {
      const existingItems = [mockItem];
      const result = addItemToOrder(existingItems, mockItem2);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(mockItem);
      expect(result[1]).toEqual(mockItem2);
    });
  });

  describe('removeItemFromOrder', () => {
    it('should remove item by productId', () => {
      const items = [mockItem, mockItem2];
      const result = removeItemFromOrder(items, 'product-1');

      expect(result).toHaveLength(1);
      expect(result[0].productId).toBe('product-2');
    });

    it('should return empty array when removing last item', () => {
      const items = [mockItem];
      const result = removeItemFromOrder(items, 'product-1');

      expect(result).toHaveLength(0);
    });

    it('should return same array if productId not found', () => {
      const items = [mockItem];
      const result = removeItemFromOrder(items, 'non-existent');

      expect(result).toEqual(items);
    });
  });

  describe('updateItemQuantity', () => {
    it('should update item quantity', () => {
      const items = [mockItem];
      const result = updateItemQuantity(items, 'product-1', 5);

      expect(result[0].quantity).toBe(5);
      expect(result[0].totalPrice).toBe(50.0);
    });

    it('should remove item when quantity is 0', () => {
      const items = [mockItem];
      const result = updateItemQuantity(items, 'product-1', 0);

      expect(result).toHaveLength(0);
    });

    it('should not update if quantity is invalid', () => {
      const items = [mockItem];
      const result = updateItemQuantity(items, 'product-1', 1000); // exceeds max

      expect(result).toEqual(items); // unchanged
    });
  });

  describe('calculateItemTotal', () => {
    it('should calculate total for single item', () => {
      expect(calculateItemTotal(mockItem)).toBe(10.0);
    });

    it('should calculate total for item with quantity > 1', () => {
      expect(calculateItemTotal(mockItem2)).toBe(40.0);
    });
  });

  describe('calculateOrderTotal', () => {
    it('should calculate total for empty order', () => {
      expect(calculateOrderTotal([])).toBe(0);
    });

    it('should calculate total for single item', () => {
      expect(calculateOrderTotal([mockItem])).toBe(10.0);
    });

    it('should calculate total for multiple items', () => {
      expect(calculateOrderTotal([mockItem, mockItem2])).toBe(50.0);
    });
  });

  describe('hasDuplicateProducts', () => {
    it('should return false for no duplicates', () => {
      expect(hasDuplicateProducts([mockItem, mockItem2])).toBe(false);
    });

    it('should return true for duplicate product IDs', () => {
      const duplicateItem: OrderItem = {
        ...mockItem,
        quantity: 2,
      };
      expect(hasDuplicateProducts([mockItem, duplicateItem])).toBe(true);
    });
  });

  describe('getItemCount', () => {
    it('should return 0 for empty order', () => {
      expect(getItemCount([])).toBe(0);
    });

    it('should return total quantity of all items', () => {
      expect(getItemCount([mockItem, mockItem2])).toBe(3); // 1 + 2
    });
  });
});

