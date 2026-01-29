# Pricing Feature Integration Guide

## Overview

This guide explains how to integrate the pricing feature into existing workflows and how to extend it for custom use cases.

## Integration Points

### 1. Order Creation Flow

The pricing system is automatically integrated into the order creation flow. No additional code is required for basic usage.

**Automatic Integration:**
- Prices are calculated when items are added
- Tax is applied automatically
- Totals are calculated in real-time
- Price overrides are available (with permission)

**Customization:**

If you need to customize price calculation:

```typescript
// In order creation component
import { PricingService } from '@/lib/services/pricing.service'

// Override price calculation
const customPrice = await PricingService.getPriceForOrderItem({
  tenantId,
  productId,
  quantity,
  priceListType: 'custom_type', // Custom price list type
  customerId,
  express: false,
})
```

### 2. Product Management

When creating or updating products, prices can be set:

```typescript
// Create product with default prices
const product = await prisma.org_product_data_mst.create({
  data: {
    tenant_org_id: tenantId,
    product_code: 'SHIRT-001',
    product_name: 'Shirt',
    default_sell_price: 5.500,
    default_express_sell_price: 7.000,
    // ... other fields
  },
})

// Prices can also be set via price lists
// (recommended for flexible pricing)
```

### 3. Customer Management

Customer-specific pricing is automatically applied based on customer type:

```typescript
// Set customer type for B2B pricing
await prisma.org_customers_mst.update({
  where: { id: customerId },
  data: {
    type: 'b2b', // or 'vip'
    // B2B and VIP customers automatically get their respective price lists
  },
})
```

### 4. Reporting and Analytics

Integrate pricing data into reports:

```typescript
// Get pricing statistics
const stats = await prisma.$queryRaw`
  SELECT 
    pl.price_list_type,
    COUNT(DISTINCT pli.product_id) as product_count,
    AVG(pli.price) as avg_price,
    SUM(pli.price * oi.quantity) as total_revenue
  FROM org_price_lists_mst pl
  JOIN org_price_list_items_dtl pli ON pl.id = pli.price_list_id
  JOIN org_order_items_dtl oi ON pli.product_id = oi.product_id
  WHERE pl.tenant_org_id = ${tenantId}::uuid
    AND pl.is_active = true
  GROUP BY pl.price_list_type
`
```

### 5. Webhooks and Notifications

Set up notifications for price changes:

```typescript
// In price list item update handler
await prisma.org_price_list_items_dtl.update({
  where: { id: itemId },
  data: { price: newPrice },
})

// Trigger webhook (price history is automatically logged)
await sendWebhook({
  event: 'price.changed',
  data: {
    productId,
    oldPrice,
    newPrice,
    priceListId,
  },
})
```

## Extending the Pricing System

### Custom Price List Types

To add new price list types:

1. **Update Database Enum (if using enum):**
   ```sql
   -- Add to price_list_type check constraint
   ALTER TABLE org_price_lists_mst
   DROP CONSTRAINT IF EXISTS org_price_lists_mst_price_list_type_check;
   
   ALTER TABLE org_price_lists_mst
   ADD CONSTRAINT org_price_lists_mst_price_list_type_check
   CHECK (price_list_type IN ('standard', 'express', 'b2b', 'vip', 'seasonal', 'promotional', 'custom_type'));
   ```

2. **Update TypeScript Types:**
   ```typescript
   // In pricing.service.ts
   type PriceListType = 'standard' | 'express' | 'b2b' | 'vip' | 'seasonal' | 'promotional' | 'custom_type'
   ```

3. **Update PricingService:**
   ```typescript
   // Add logic for custom type
   determinePriceListType(customer, express, customFlag) {
     if (customFlag) return 'custom_type'
     // ... existing logic
   }
   ```

### Custom Discount Rules

Implement custom discount logic:

```typescript
// Create custom discount service
class CustomDiscountService {
  async calculateDiscount(params: {
    productId: string
    quantity: number
    customerId: string
    orderTotal: number
  }): Promise<number> {
    // Custom discount logic
    // e.g., volume discounts, loyalty discounts, etc.
    
    let discount = 0
    
    // Volume discount
    if (params.quantity >= 50) {
      discount += 15 // 15% for bulk orders
    }
    
    // Loyalty discount
    const customer = await getCustomer(params.customerId)
    if (customer.loyaltyPoints > 1000) {
      discount += 5 // 5% for loyal customers
    }
    
    return Math.min(discount, 50) // Cap at 50%
  }
}
```

### Custom Tax Rules

Extend tax calculation:

```typescript
// In tax.service.ts or custom service
class CustomTaxService extends TaxService {
  async calculateTax(amount: number, tenantId: string, productId?: string): Promise<number> {
    // Get base tax rate
    const baseRate = await this.getTaxRate(tenantId)
    
    // Check for product-specific tax exemption
    if (productId) {
      const product = await getProduct(productId)
      if (product.tax_exempt) {
        return 0
      }
    }
    
    // Apply custom tax rules
    // e.g., reduced rate for certain products
    
    return amount * baseRate
  }
}
```

### Integration with External Systems

#### ERP Integration

```typescript
// Sync prices from ERP system
async function syncPricesFromERP() {
  const erpPrices = await fetchERPData('/api/prices')
  
  for (const price of erpPrices) {
    await prisma.org_price_list_items_dtl.upsert({
      where: {
        tenant_org_id_product_id_price_list_id: {
          tenant_org_id: tenantId,
          product_id: price.productId,
          price_list_id: priceListId,
        },
      },
      update: {
        price: price.amount,
        updated_at: new Date(),
      },
      create: {
        tenant_org_id: tenantId,
        product_id: price.productId,
        price_list_id: priceListId,
        price: price.amount,
        // ... other fields
      },
    })
  }
}
```

#### Payment Gateway Integration

```typescript
// Calculate final price including payment fees
async function calculateFinalPrice(orderTotal: number, paymentMethod: string) {
  const baseTotal = orderTotal
  
  // Get payment gateway fees
  const fees = await getPaymentFees(paymentMethod, baseTotal)
  
  return {
    subtotal: baseTotal,
    tax: await TaxService.calculateTax(baseTotal, tenantId),
    paymentFees: fees,
    total: baseTotal + fees,
  }
}
```

## Testing Integration

### Unit Tests

```typescript
// pricing.service.test.ts
describe('PricingService', () => {
  it('should calculate price correctly', async () => {
    const result = await PricingService.getPriceForOrderItem({
      tenantId: 'test-tenant',
      productId: 'test-product',
      quantity: 5,
      priceListType: 'standard',
    })
    
    expect(result.finalPrice).toBeGreaterThan(0)
    expect(result.taxAmount).toBeGreaterThanOrEqual(0)
  })
})
```

### Integration Tests

```typescript
// order-creation.test.ts
describe('Order Creation with Pricing', () => {
  it('should apply correct prices when creating order', async () => {
    const order = await createOrder({
      items: [
        { productId: 'product-1', quantity: 5 },
        { productId: 'product-2', quantity: 3 },
      ],
    })
    
    expect(order.items[0].price).toBe(5.500)
    expect(order.tax_amount).toBeGreaterThan(0)
    expect(order.total_amount).toBe(order.subtotal + order.tax_amount)
  })
})
```

## Performance Optimization

### Caching

```typescript
// Cache price lookups
import { cache } from 'react'

export const getCachedPrice = cache(async (productId: string) => {
  return await PricingService.getPriceForOrderItem({
    tenantId,
    productId,
    quantity: 1,
    priceListType: 'standard',
  })
})
```

### Database Indexes

Ensure indexes are created for performance:

```sql
-- Verify indexes exist
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename IN (
  'org_price_lists_mst',
  'org_price_list_items_dtl',
  'org_price_history_audit'
);
```

### Query Optimization

```typescript
// Batch price lookups
async function getPricesForProducts(productIds: string[]) {
  // Use single query instead of multiple
  return await prisma.$queryRaw`
    SELECT 
      product_id,
      price,
      discount_percent
    FROM org_price_list_items_dtl
    WHERE tenant_org_id = ${tenantId}::uuid
      AND product_id = ANY(${productIds}::uuid[])
      AND is_active = true
  `
}
```

## Security Considerations

### Permission Checks

Always check permissions before allowing price overrides:

```typescript
import { hasPermissionServer } from '@/lib/services/permission-service-server'

async function handlePriceOverride(itemId: string, newPrice: number, reason: string) {
  // Check permission
  const canOverride = await hasPermissionServer('pricing:override', {
    tenantId,
    userId,
  })
  
  if (!canOverride) {
    throw new Error('Permission denied: pricing:override required')
  }
  
  // Proceed with override
}
```

### Input Validation

```typescript
// Validate price override input
function validatePriceOverride(price: number, reason: string) {
  if (price < 0) {
    throw new Error('Price must be >= 0')
  }
  
  if (!reason || reason.length < 10) {
    throw new Error('Reason must be at least 10 characters')
  }
  
  // Additional validation
}
```

### Audit Trail

All price changes are automatically logged. To add custom audit entries:

```typescript
await prisma.org_price_history_audit.create({
  data: {
    tenant_org_id: tenantId,
    entity_type: 'price_list_item',
    entity_id: itemId,
    old_price: oldPrice,
    new_price: newPrice,
    change_reason: 'Bulk update from ERP',
    created_by: userId,
  },
})
```

## Best Practices

1. **Always use PricingService** for price calculations (don't query database directly)
2. **Cache price lookups** when possible to improve performance
3. **Validate inputs** before price calculations
4. **Log all price changes** (automatic via triggers)
5. **Test thoroughly** with different price list types and scenarios
6. **Monitor performance** of price calculation queries
7. **Keep price lists organized** by type and priority
8. **Document custom pricing rules** clearly

## Support

For integration questions or issues:
1. Review [README.md](./README.md) for API documentation
2. Check [MIGRATION.md](./MIGRATION.md) for setup instructions
3. Review code examples in this guide
4. Contact development team for assistance

