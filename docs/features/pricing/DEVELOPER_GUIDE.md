# Pricing Feature Developer Guide

## Overview

This guide is for developers working on or extending the pricing feature. It covers code architecture, development patterns, testing, and debugging.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Code Structure](#code-structure)
3. [Development Patterns](#development-patterns)
4. [Testing](#testing)
5. [Debugging](#debugging)
6. [Common Tasks](#common-tasks)
7. [Performance Considerations](#performance-considerations)
8. [Code Examples](#code-examples)

## Architecture Overview

### Service Layer

The pricing system follows a service-oriented architecture:

```
┌─────────────────────────────────────────┐
│         Frontend Components             │
│  (React Components, Pages, Modals)      │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│         Service Layer                   │
│  - PricingService                       │
│  - TaxService                           │
│  - PricingBulkService                   │
└──────────────┬──────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────┐
│         Database Layer                  │
│  - Prisma ORM                           │
│  - PostgreSQL Functions                 │
│  - RLS Policies                         │
└─────────────────────────────────────────┘
```

### Key Services

#### PricingService (`web-admin/lib/services/pricing.service.ts`)

**Purpose:** Centralized pricing calculation logic

**Key Methods:**
- `getPriceForOrderItem()` - Get price for a single item
- `calculateOrderTotals()` - Calculate totals for entire order
- `determinePriceListType()` - Determine which price list to use

**Usage:**
```typescript
import { PricingService } from '@/lib/services/pricing.service'

const price = await PricingService.getPriceForOrderItem({
  tenantId: 'uuid',
  productId: 'uuid',
  quantity: 5,
  priceListType: 'standard',
  customerId: 'uuid',
  express: false,
})
```

#### TaxService (`web-admin/lib/services/tax.service.ts`)

**Purpose:** Tax calculation and configuration

**Key Methods:**
- `getTaxRate()` - Get tax rate for tenant
- `calculateTax()` - Calculate tax amount
- `isTaxExempt()` - Check if tax exempt

**Usage:**
```typescript
import { TaxService } from '@/lib/services/tax.service'

const taxRate = await TaxService.getTaxRate(tenantId)
const taxAmount = TaxService.calculateTax(100.00, taxRate)
```

## Code Structure

### Directory Layout

```
web-admin/
├── lib/
│   ├── services/
│   │   ├── pricing.service.ts          # Main pricing service
│   │   ├── tax.service.ts              # Tax service
│   │   └── pricing-bulk.service.ts     # Bulk operations
│   ├── types/
│   │   └── pricing.ts                  # TypeScript types
│   └── db/
│       └── orders.ts                   # Order DB operations (uses pricing)
├── app/
│   ├── api/
│   │   └── v1/
│   │       └── pricing/
│   │           ├── calculate/route.ts   # Price calculation API
│   │           ├── history/route.ts     # Price history API
│   │           ├── import/route.ts      # Bulk import API
│   │           └── export/route.ts     # Bulk export API
│   └── dashboard/
│       ├── catalog/
│       │   └── pricing/                # Price list management UI
│       ├── orders/
│       │   └── new/                    # Order creation (uses pricing)
│       └── settings/
│           └── finance/                # Tax settings UI
└── src/
    └── features/
        └── orders/
            └── ui/
                └── new-order-modals.tsx # Price override modal
```

### Type Definitions

All pricing-related types are in `web-admin/lib/types/pricing.ts`:

```typescript
// Price result from calculation
interface PriceResult {
  basePrice: number
  discountPercent: number
  finalPrice: number
  taxRate: number
  taxAmount: number
  total: number
  priceListId?: string
  priceListName?: string
  source: 'price_list' | 'product_default'
}

// Parameters for price lookup
interface PriceLookupParams {
  tenantId: string
  productId: string
  quantity: number
  priceListType: PriceListType
  customerId?: string
  express?: boolean
}

// Order totals
interface OrderTotals {
  subtotal: number
  discount: number
  tax: number
  total: number
}
```

## Development Patterns

### 1. Always Use Services

**❌ Don't:**
```typescript
// Direct database query
const price = await prisma.org_price_list_items_dtl.findFirst({
  where: { product_id: productId },
})
```

**✅ Do:**
```typescript
// Use service
const price = await PricingService.getPriceForOrderItem({
  tenantId,
  productId,
  quantity: 1,
  priceListType: 'standard',
})
```

### 2. Tenant Isolation

**Always filter by tenant:**
```typescript
// ❌ Don't
const priceList = await prisma.org_price_lists_mst.findUnique({
  where: { id: priceListId },
})

// ✅ Do
const tenantId = await getTenantIdFromSession()
const priceList = await prisma.org_price_lists_mst.findFirst({
  where: {
    id: priceListId,
    tenant_org_id: tenantId, // Always include tenant filter
  },
})
```

### 3. Error Handling

**Use consistent error handling:**
```typescript
try {
  const price = await PricingService.getPriceForOrderItem(params)
  return price
} catch (error) {
  if (error instanceof PricingError) {
    // Handle pricing-specific errors
    console.error('Pricing error:', error.message)
    throw new Error(`Failed to calculate price: ${error.message}`)
  }
  // Handle other errors
  console.error('Unexpected error:', error)
  throw error
}
```

### 4. Permission Checks

**Always check permissions for sensitive operations:**
```typescript
import { hasPermissionServer } from '@/lib/services/permission-service-server'

async function overridePrice(itemId: string, newPrice: number) {
  const tenantId = await getTenantIdFromSession()
  const userId = await getUserIdFromSession()
  
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

### 5. Validation

**Validate inputs at service boundaries:**
```typescript
function validatePriceInput(price: number): void {
  if (price < 0) {
    throw new Error('Price must be >= 0')
  }
  if (price > 1000000) {
    throw new Error('Price exceeds maximum allowed')
  }
  if (!Number.isFinite(price)) {
    throw new Error('Price must be a valid number')
  }
}
```

## Testing

### Unit Tests

**Example test for PricingService:**
```typescript
// pricing.service.test.ts
import { PricingService } from '@/lib/services/pricing.service'
import { prisma } from '@/lib/db/prisma'

describe('PricingService', () => {
  beforeEach(() => {
    // Setup test data
  })

  afterEach(() => {
    // Cleanup
  })

  it('should calculate price from price list', async () => {
    // Arrange
    const params = {
      tenantId: 'test-tenant',
      productId: 'test-product',
      quantity: 5,
      priceListType: 'standard' as const,
    }

    // Act
    const result = await PricingService.getPriceForOrderItem(params)

    // Assert
    expect(result.finalPrice).toBeGreaterThan(0)
    expect(result.source).toBe('price_list')
    expect(result.priceListId).toBeDefined()
  })

  it('should fall back to product default price', async () => {
    // Test fallback logic
  })

  it('should apply quantity tier pricing', async () => {
    // Test quantity tiers
  })

  it('should calculate tax correctly', async () => {
    // Test tax calculation
  })
})
```

### Integration Tests

**Example integration test:**
```typescript
// order-pricing.integration.test.ts
describe('Order Creation with Pricing', () => {
  it('should apply correct prices when creating order', async () => {
    // Create test order
    const order = await createOrder({
      items: [
        { productId: 'product-1', quantity: 5 },
        { productId: 'product-2', quantity: 3 },
      ],
    })

    // Verify prices
    expect(order.items[0].price_per_unit).toBe(5.500)
    expect(order.tax_amount).toBeGreaterThan(0)
    expect(order.total_amount).toBe(
      order.subtotal + order.tax_amount - order.discount_amount
    )
  })
})
```

### API Tests

**Example API test:**
```typescript
// pricing-api.test.ts
describe('GET /api/v1/pricing/calculate', () => {
  it('should calculate price correctly', async () => {
    const response = await fetch('/api/v1/pricing/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productId: 'test-product',
        quantity: 5,
        priceListType: 'standard',
      }),
    })

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.finalPrice).toBeGreaterThan(0)
  })
})
```

## Debugging

### Common Issues and Solutions

#### 1. Prices Not Calculating

**Debug steps:**
```typescript
// Add logging
console.log('Price calculation params:', {
  tenantId,
  productId,
  quantity,
  priceListType,
})

// Check if price list exists
const priceList = await prisma.org_price_lists_mst.findFirst({
  where: {
    tenant_org_id: tenantId,
    price_list_type: priceListType,
    is_active: true,
  },
})
console.log('Price list found:', priceList)

// Check if product is in price list
const priceItem = await prisma.org_price_list_items_dtl.findFirst({
  where: {
    tenant_org_id: tenantId,
    product_id: productId,
    price_list_id: priceList?.id,
    is_active: true,
  },
})
console.log('Price item found:', priceItem)
```

#### 2. Tax Not Applied

**Debug steps:**
```typescript
// Check tax rate setting
const taxSetting = await prisma.sys_tenant_settings_cd.findFirst({
  where: { setting_code: 'TAX_RATE' },
})
console.log('Tax setting:', taxSetting)

// Check tenant override
const tenantTax = await prisma.org_tenant_settings_cf.findFirst({
  where: {
    tenant_org_id: tenantId,
    setting_code: 'TAX_RATE',
  },
})
console.log('Tenant tax rate:', tenantTax)

// Test tax calculation
const taxRate = await TaxService.getTaxRate(tenantId)
console.log('Effective tax rate:', taxRate)
```

#### 3. Price Override Not Working

**Debug steps:**
```typescript
// Check permission
const hasPermission = await hasPermissionServer('pricing:override', {
  tenantId,
  userId,
})
console.log('Has override permission:', hasPermission)

// Check item exists
const item = await prisma.org_order_items_dtl.findFirst({
  where: { id: itemId, tenant_org_id: tenantId },
})
console.log('Order item:', item)

// Verify override fields exist
const columns = await prisma.$queryRaw`
  SELECT column_name 
  FROM information_schema.columns 
  WHERE table_name = 'org_order_items_dtl' 
    AND column_name IN ('price_override', 'override_reason', 'override_by')
`
console.log('Override columns:', columns)
```

### Debug Queries

**Useful SQL queries for debugging:**
```sql
-- Check price list status
SELECT id, name, price_list_type, is_active, effective_from, effective_to
FROM org_price_lists_mst
WHERE tenant_org_id = 'your-tenant-id'
ORDER BY priority DESC;

-- Check price list items
SELECT 
  pli.*,
  pl.name as price_list_name,
  pd.product_name
FROM org_price_list_items_dtl pli
JOIN org_price_lists_mst pl ON pli.price_list_id = pl.id
JOIN org_product_data_mst pd ON pli.product_id = pd.id
WHERE pli.tenant_org_id = 'your-tenant-id'
  AND pli.product_id = 'product-id'
ORDER BY pl.priority DESC, pli.min_quantity DESC;

-- Check price history
SELECT 
  pha.*,
  pl.name as price_list_name,
  u.first_name || ' ' || u.last_name as user_name
FROM org_price_history_audit pha
LEFT JOIN org_price_lists_mst pl ON pha.price_list_id = pl.id
LEFT JOIN org_users_mst u ON pha.created_by = u.id
WHERE pha.tenant_org_id = 'your-tenant-id'
ORDER BY pha.created_at DESC
LIMIT 10;

-- Test price function
SELECT * FROM get_product_price_with_tax(
  'tenant-id'::uuid,
  'product-id'::uuid,
  'standard',
  5,
  'customer-id'::uuid,
  CURRENT_DATE
);
```

## Common Tasks

### Adding a New Price List Type

1. **Update TypeScript types:**
```typescript
// In pricing.service.ts
type PriceListType = 'standard' | 'express' | 'b2b' | 'vip' | 'seasonal' | 'promotional' | 'wholesale'
```

2. **Update database constraint (if needed):**
```sql
ALTER TABLE org_price_lists_mst
DROP CONSTRAINT IF EXISTS org_price_lists_mst_price_list_type_check;

ALTER TABLE org_price_lists_mst
ADD CONSTRAINT org_price_lists_mst_price_list_type_check
CHECK (price_list_type IN ('standard', 'express', 'b2b', 'vip', 'seasonal', 'promotional', 'wholesale'));
```

3. **Update PricingService logic:**
```typescript
determinePriceListType(customer, express, customFlag): PriceListType {
  if (customFlag) return 'wholesale'
  // ... existing logic
}
```

### Adding Custom Discount Rules

```typescript
// Create custom discount service
class CustomDiscountService {
  async calculateDiscount(params: {
    productId: string
    quantity: number
    customerId: string
    orderTotal: number
  }): Promise<number> {
    let discount = 0

    // Volume discount
    if (params.quantity >= 100) {
      discount += 20 // 20% for bulk
    } else if (params.quantity >= 50) {
      discount += 15 // 15% for medium bulk
    }

    // Customer-specific discount
    const customer = await getCustomer(params.customerId)
    if (customer.membershipLevel === 'premium') {
      discount += 10 // 10% for premium members
    }

    return Math.min(discount, 50) // Cap at 50%
  }
}

// Integrate into PricingService
const customDiscount = await customDiscountService.calculateDiscount({
  productId,
  quantity,
  customerId,
  orderTotal,
})
```

### Adding Price Validation

```typescript
// In pricing.service.ts
function validatePrice(price: number, context: string): void {
  if (price < 0) {
    throw new PricingError(`Price cannot be negative: ${price}`, context)
  }
  
  if (price > 1000000) {
    throw new PricingError(`Price exceeds maximum: ${price}`, context)
  }
  
  if (!Number.isFinite(price)) {
    throw new PricingError(`Price must be a finite number: ${price}`, context)
  }
  
  // Check precision
  const decimalPlaces = (price.toString().split('.')[1] || '').length
  if (decimalPlaces > 3) {
    throw new PricingError(`Price has too many decimal places: ${decimalPlaces}`, context)
  }
}
```

## Performance Considerations

### Caching

**Cache price lookups:**
```typescript
import { cache } from 'react'
import NodeCache from 'node-cache'

const priceCache = new NodeCache({ stdTTL: 300 }) // 5 minutes

async function getCachedPrice(params: PriceLookupParams) {
  const cacheKey = `${params.tenantId}-${params.productId}-${params.priceListType}-${params.quantity}`
  
  const cached = priceCache.get<PriceResult>(cacheKey)
  if (cached) {
    return cached
  }
  
  const price = await PricingService.getPriceForOrderItem(params)
  priceCache.set(cacheKey, price)
  
  return price
}
```

### Batch Operations

**Batch price lookups:**
```typescript
async function getPricesForProducts(
  productIds: string[],
  tenantId: string,
  priceListType: PriceListType
) {
  // Single query instead of multiple
  const prices = await prisma.$queryRaw<Array<{
    product_id: string
    price: number
    discount_percent: number
  }>>`
    SELECT 
      pli.product_id,
      pli.price,
      pli.discount_percent
    FROM org_price_list_items_dtl pli
    JOIN org_price_lists_mst pl ON pli.price_list_id = pl.id
    WHERE pli.tenant_org_id = ${tenantId}::uuid
      AND pl.price_list_type = ${priceListType}
      AND pli.product_id = ANY(${productIds}::uuid[])
      AND pli.is_active = true
      AND pl.is_active = true
    ORDER BY pl.priority DESC
  `
  
  return prices
}
```

### Database Indexes

**Ensure indexes exist:**
```sql
-- Verify indexes
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename IN (
  'org_price_lists_mst',
  'org_price_list_items_dtl',
  'org_price_history_audit'
)
ORDER BY tablename, indexname;

-- Create missing indexes if needed
CREATE INDEX IF NOT EXISTS idx_price_list_items_lookup 
ON org_price_list_items_dtl(tenant_org_id, product_id, price_list_id, is_active);

CREATE INDEX IF NOT EXISTS idx_price_history_created 
ON org_price_history_audit(created_at DESC);
```

## Code Examples

### Complete Price Calculation Flow

```typescript
// Example: Calculate price for order item
async function calculateItemPrice(
  productId: string,
  quantity: number,
  customerId: string,
  express: boolean
) {
  const tenantId = await getTenantIdFromSession()
  
  // Determine price list type
  const customer = await getCustomer(customerId)
  let priceListType: PriceListType = 'standard'
  
  if (express) {
    priceListType = 'express'
  } else if (customer?.type === 'b2b') {
    priceListType = 'b2b'
  } else if (customer?.type === 'vip') {
    priceListType = 'vip'
  }
  
  // Get price
  const priceResult = await PricingService.getPriceForOrderItem({
    tenantId,
    productId,
    quantity,
    priceListType,
    customerId,
    express,
  })
  
  // Apply custom discounts if needed
  const customDiscount = await calculateCustomDiscount({
    productId,
    quantity,
    customerId,
  })
  
  const finalPrice = priceResult.finalPrice * (1 - customDiscount / 100)
  
  return {
    ...priceResult,
    finalPrice,
    customDiscount,
  }
}
```

### Price Override Implementation

```typescript
// Example: Handle price override
async function handlePriceOverride(
  orderId: string,
  itemId: string,
  overridePrice: number, 
  reason: string
) {
  const tenantId = await getTenantIdFromSession()
  const userId = await getUserIdFromSession()
  
  // Validate permission
  const canOverride = await hasPermissionServer('pricing:override', {
    tenantId,
    userId,
  })
  
  if (!canOverride) {
    throw new Error('Permission denied')
  }
  
  // Validate input
  if (overridePrice < 0) {
    throw new Error('Price must be >= 0')
  }
  
  if (!reason || reason.length < 10) {
    throw new Error('Reason must be at least 10 characters')
  }
  
  // Update order item
  await prisma.org_order_items_dtl.update({
    where: {
      id: itemId,
      tenant_org_id: tenantId,
    },
    data: {
      price_override: overridePrice,
      override_reason: reason,
      override_by: userId,
      updated_at: new Date(),
      updated_by: userId,
    },
  })
  
  // Recalculate order totals
  await recalculateOrderTotals(orderId)
}
```

## Additional Resources

- [README.md](./README.md) - Feature overview and API documentation
- [MIGRATION.md](./MIGRATION.md) - Migration instructions
- [INTEGRATION.md](./INTEGRATION.md) - Integration examples
- [Frontend Standards](../../.claude/docs/frontend_standards.md)
- [Backend Standards](../../.claude/docs/backend_standards.md)

