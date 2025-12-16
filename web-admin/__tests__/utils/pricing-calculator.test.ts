import { calculateItemPrice, calculateOrderTotal } from '@/lib/utils/pricing-calculator';

describe('pricing-calculator', () => {
  it('calculates item price with express and tax', () => {
    const r = calculateItemPrice({
      basePrice: 1.5,
      quantity: 4,
      isExpress: true,
      expressMultiplier: 1.5,
      taxRate: 0.05,
    });
    expect(r.unitPrice).toBeCloseTo(2.25, 3);
    expect(r.total).toBeGreaterThan(0);
  });

  it('aggregates order totals across items', () => {
    const a = calculateItemPrice({ basePrice: 1, quantity: 2, isExpress: false, expressMultiplier: 1.5, taxRate: 0.05 });
    const b = calculateItemPrice({ basePrice: 3, quantity: 1, isExpress: false, expressMultiplier: 1.5, taxRate: 0.05 });
    const t = calculateOrderTotal({ items: [a, b] });
    expect(t.total).toBeCloseTo(a.total + b.total, 3);
    expect(t.totalItems).toBe(2);
  });
});

import {
  calculateItemPrice,
  calculateOrderTotal,
  TAX_RATE,
} from '@/lib/utils/pricing-calculator';
import type { OrderItemPricing, PricingRule } from '@/types/order';

describe('Pricing Calculator', () => {
  const mockPricingRule: PricingRule = {
    service_type: 'wash_iron',
    garment_type: 'shirt',
    base_price: 2.0,
    express_multiplier: 1.5,
    bulk_discount: [
      { min_quantity: 5, discount_percent: 10 },
      { min_quantity: 10, discount_percent: 15 },
    ],
  };

  describe('calculateItemPrice', () => {
    it('should calculate basic item price', () => {
      const item: OrderItemPricing = {
        service_type: 'wash_iron',
        garment_type: 'shirt',
        quantity: 1,
        is_express: false,
      };

      const result = calculateItemPrice(item, mockPricingRule);
      expect(result.unit_price).toBe(2.0);
      expect(result.total_price).toBe(2.0);
      expect(result.discount_applied).toBe(0);
    });

    it('should apply express multiplier', () => {
      const item: OrderItemPricing = {
        service_type: 'wash_iron',
        garment_type: 'shirt',
        quantity: 1,
        is_express: true,
      };

      const result = calculateItemPrice(item, mockPricingRule);
      expect(result.unit_price).toBe(3.0); // 2.0 * 1.5
      expect(result.total_price).toBe(3.0);
    });

    it('should calculate for multiple quantities', () => {
      const item: OrderItemPricing = {
        service_type: 'wash_iron',
        garment_type: 'shirt',
        quantity: 3,
        is_express: false,
      };

      const result = calculateItemPrice(item, mockPricingRule);
      expect(result.unit_price).toBe(2.0);
      expect(result.total_price).toBe(6.0);
    });

    it('should apply bulk discount (10% for 5+ items)', () => {
      const item: OrderItemPricing = {
        service_type: 'wash_iron',
        garment_type: 'shirt',
        quantity: 5,
        is_express: false,
      };

      const result = calculateItemPrice(item, mockPricingRule);
      expect(result.unit_price).toBe(1.8); // 2.0 * 0.9
      expect(result.total_price).toBe(9.0); // 1.8 * 5
      expect(result.discount_applied).toBe(10);
      expect(result.discount_amount).toBe(1.0); // 10 - 9
    });

    it('should apply bulk discount (15% for 10+ items)', () => {
      const item: OrderItemPricing = {
        service_type: 'wash_iron',
        garment_type: 'shirt',
        quantity: 10,
        is_express: false,
      };

      const result = calculateItemPrice(item, mockPricingRule);
      expect(result.unit_price).toBe(1.7); // 2.0 * 0.85
      expect(result.total_price).toBe(17.0); // 1.7 * 10
      expect(result.discount_applied).toBe(15);
    });

    it('should combine express and bulk discount', () => {
      const item: OrderItemPricing = {
        service_type: 'wash_iron',
        garment_type: 'shirt',
        quantity: 5,
        is_express: true,
      };

      const result = calculateItemPrice(item, mockPricingRule);
      // Base: 2.0, Express: 3.0, Discount: 2.7 (10% off)
      expect(result.unit_price).toBe(2.7); // 3.0 * 0.9
      expect(result.total_price).toBe(13.5); // 2.7 * 5
    });

    it('should throw error for missing pricing rule', () => {
      const item: OrderItemPricing = {
        service_type: 'wash_iron',
        garment_type: 'shirt',
        quantity: 1,
        is_express: false,
      };

      expect(() => calculateItemPrice(item, null as any)).toThrow();
    });

    it('should handle 3 decimal precision for OMR', () => {
      const customRule: PricingRule = {
        service_type: 'wash_iron',
        garment_type: 'shirt',
        base_price: 1.275,
        express_multiplier: 1.5,
      };

      const item: OrderItemPricing = {
        service_type: 'wash_iron',
        garment_type: 'shirt',
        quantity: 2,
        is_express: false,
      };

      const result = calculateItemPrice(item, customRule);
      expect(result.unit_price).toBe(1.275);
      expect(result.total_price).toBe(2.55); // 1.275 * 2
    });
  });

  describe('calculateOrderTotal', () => {
    const items: OrderItemPricing[] = [
      {
        service_type: 'wash_iron',
        garment_type: 'shirt',
        quantity: 3,
        is_express: false,
        calculated_price: 2.0,
      },
      {
        service_type: 'wash_iron',
        garment_type: 'shirt',
        quantity: 2,
        is_express: true,
        calculated_price: 3.0,
      },
    ];

    it('should calculate order subtotal', () => {
      const result = calculateOrderTotal(items);
      // (3 * 2.0) + (2 * 3.0) = 6.0 + 6.0 = 12.0
      expect(result.subtotal).toBe(12.0);
    });

    it('should calculate tax amount (5% VAT)', () => {
      const result = calculateOrderTotal(items);
      expect(result.tax_amount).toBe(0.6); // 12.0 * 0.05
      expect(TAX_RATE).toBe(0.05);
    });

    it('should calculate grand total', () => {
      const result = calculateOrderTotal(items);
      expect(result.total).toBe(12.6); // 12.0 + 0.6
    });

    it('should apply order-level discount', () => {
      const result = calculateOrderTotal(items, 1.0);
      expect(result.discount_amount).toBe(1.0);
      expect(result.subtotal_after_discount).toBe(11.0); // 12.0 - 1.0
      expect(result.tax_amount).toBe(0.55); // 11.0 * 0.05
      expect(result.total).toBe(11.55); // 11.0 + 0.55
    });

    it('should handle empty items array', () => {
      const result = calculateOrderTotal([]);
      expect(result.subtotal).toBe(0);
      expect(result.tax_amount).toBe(0);
      expect(result.total).toBe(0);
    });

    it('should handle 3 decimal precision', () => {
      const preciseItems: OrderItemPricing[] = [
        {
          service_type: 'wash_iron',
          garment_type: 'shirt',
          quantity: 1,
          is_express: false,
          calculated_price: 1.275,
        },
      ];

      const result = calculateOrderTotal(preciseItems);
      expect(result.subtotal).toBe(1.275);
      expect(result.tax_amount).toBeCloseTo(0.064, 3); // 1.275 * 0.05
      expect(result.total).toBeCloseTo(1.339, 3);
    });

    it('should calculate total items count', () => {
      const result = calculateOrderTotal(items);
      expect(result.total_items).toBe(5); // 3 + 2
    });

    it('should handle zero quantity items', () => {
      const zeroItems: OrderItemPricing[] = [
        {
          service_type: 'wash_iron',
          garment_type: 'shirt',
          quantity: 0,
          is_express: false,
          calculated_price: 2.0,
        },
      ];

      const result = calculateOrderTotal(zeroItems);
      expect(result.subtotal).toBe(0);
      expect(result.total_items).toBe(0);
    });
  });

  describe('Edge cases', () => {
    it('should handle very large quantities', () => {
      const largeQuantityRule: PricingRule = {
        service_type: 'wash_iron',
        garment_type: 'shirt',
        base_price: 2.0,
        express_multiplier: 1.5,
        bulk_discount: [{ min_quantity: 100, discount_percent: 20 }],
      };

      const item: OrderItemPricing = {
        service_type: 'wash_iron',
        garment_type: 'shirt',
        quantity: 150,
        is_express: false,
      };

      const result = calculateItemPrice(item, largeQuantityRule);
      expect(result.unit_price).toBe(1.6); // 2.0 * 0.8
      expect(result.total_price).toBe(240.0); // 1.6 * 150
    });

    it('should handle zero price edge case', () => {
      const zeroPriceRule: PricingRule = {
        service_type: 'complimentary',
        garment_type: 'shirt',
        base_price: 0,
        express_multiplier: 1.0,
      };

      const item: OrderItemPricing = {
        service_type: 'complimentary',
        garment_type: 'shirt',
        quantity: 1,
        is_express: false,
      };

      const result = calculateItemPrice(item, zeroPriceRule);
      expect(result.unit_price).toBe(0);
      expect(result.total_price).toBe(0);
    });

    it('should maintain precision in calculations', () => {
      const items: OrderItemPricing[] = [
        { service_type: 'wash_iron', garment_type: 'shirt', quantity: 3, is_express: false, calculated_price: 1.275 },
        { service_type: 'wash_iron', garment_type: 'shirt', quantity: 2, is_express: false, calculated_price: 2.450 },
      ];

      const result = calculateOrderTotal(items);
      // (3 * 1.275) + (2 * 2.450) = 3.825 + 4.900 = 8.725
      expect(result.subtotal).toBe(8.725);
      // Tax: 8.725 * 0.05 = 0.43625 ≈ 0.436
      expect(result.tax_amount).toBeCloseTo(0.436, 3);
      // Total: 8.725 + 0.436 = 9.161
      expect(result.total).toBeCloseTo(9.161, 3);
    });
  });
});
