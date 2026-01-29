# Pricing Feature Implementation - Summary & Quick Reference

**Document ID**: pricing_feature_summary  
**Version**: 1.0  
**Created**: 2025-01-27  
**Related**: `pricing_feature_implementation_plan.md`

---

## Quick Status Check

### ✅ What's Already Built

1. **Database Schema** (Complete)
   - `org_price_lists_mst` - Price list headers
   - `org_price_list_items_dtl` - Price list items with quantity tiers
   - Database function `get_product_price()` - Price lookup function
   - RLS policies configured

2. **API Endpoints** (Complete)
   - `GET /api/v1/price-lists` - List price lists
   - `POST /api/v1/price-lists` - Create price list
   - `GET /api/v1/price-lists/:id` - Get price list with items
   - `PATCH /api/v1/price-lists/:id` - Update price list
   - `DELETE /api/v1/price-lists/:id` - Delete price list

3. **Services** (Partial)
   - `catalog.service.ts` - Price list CRUD operations
   - `pricing-calculator.ts` - Price calculation utilities (tax, discounts)

4. **UI** (Basic)
   - `/dashboard/catalog/pricing` - Price list management page

### ❌ What's Missing (Critical Path)

1. **Price Lookup Service** - Integration with order creation
2. **Tax Configuration** - Tenant-level tax settings
3. **Order Integration** - Use price lists in order creation
4. **Customer-Specific Pricing** - B2B/VIP pricing support

---

## Database Schema Verification

### Existing Tables

#### `org_price_lists_mst`
```sql
- id (UUID, PK)
- tenant_org_id (UUID, FK)
- name / name2 (Bilingual)
- price_list_type: 'standard' | 'express' | 'vip' | 'seasonal' | 'b2b' | 'promotional'
- effective_from / effective_to (Date range)
- is_default (Boolean)
- priority (Integer)
- is_active (Boolean)
```

#### `org_price_list_items_dtl`
```sql
- id (UUID, PK)
- tenant_org_id (UUID, FK)
- price_list_id (UUID, FK)
- product_id (UUID, FK)
- price (NUMERIC(10,3))
- discount_percent (NUMERIC(5,2))
- min_quantity / max_quantity (Integer tiers)
- is_active (Boolean)
```

#### `org_product_data_mst`
```sql
- default_sell_price (DECIMAL(10,3))
- default_express_sell_price (DECIMAL(10,3))
- multiplier_express (NUMERIC(4,2))
- is_tax_exempt (INTEGER)
```

### Database Function

**`get_product_price()`** - Already exists and functional
- Parameters: tenant_id, product_id, price_list_type, quantity, effective_date
- Returns: Price (NUMERIC(10,3))
- Behavior: Looks up price list → falls back to product default

---

## Implementation Priority

### Phase 1: Core Integration (Week 1) - **START HERE**

**Goal**: Make order creation use price lists instead of only product defaults

**Tasks:**
1. Create `PricingService` class (`web-admin/lib/services/pricing.service.ts`)
2. Integrate into order creation (`web-admin/lib/db/orders.ts`)
3. Add tax configuration to tenant settings
4. Update pricing calculator to use tenant tax rate

**Files to Create/Modify:**
- `web-admin/lib/services/pricing.service.ts` (NEW)
- `web-admin/lib/db/orders.ts` (MODIFY - addOrderItems function)
- `web-admin/lib/services/tax.service.ts` (NEW)
- Migration: Add tax_rate to `org_tenants_mst`

**Key Code Changes:**

```typescript
// In orders.ts - addOrderItems function
// BEFORE:
const basePrice = Number(product.default_sell_price || 0);

// AFTER:
import { PricingService } from '@/lib/services/pricing.service';
const pricingService = new PricingService();
const priceResult = await pricingService.getPriceForOrderItem(
  tenantOrgId,
  item.productId,
  item.quantity,
  input.isExpressService,
  order.customer_id
);
```

---

## Database Migration Needed

### Migration 1: Tax Configuration

**File**: `supabase/migrations/XXXX_add_tax_configuration.sql`

```sql
BEGIN;

-- Add tax configuration to tenants
ALTER TABLE org_tenants_mst
  ADD COLUMN IF NOT EXISTS default_tax_rate NUMERIC(5,4) DEFAULT 0.05,
  ADD COLUMN IF NOT EXISTS tax_type VARCHAR(20) DEFAULT 'VAT';

COMMENT ON COLUMN org_tenants_mst.default_tax_rate IS 'Default tax rate (e.g., 0.05 for 5% VAT)';
COMMENT ON COLUMN org_tenants_mst.tax_type IS 'Tax type: VAT, SERVICE_TAX, CUSTOM';

COMMIT;
```

**Alternative**: Use `sys_tenant_settings_cd` system (already exists)
- Setting code: `tax_rate`
- Setting code: `tax_type`

---

## Key Integration Points

### 1. Order Creation Flow

**Current Flow:**
```
Order Creation → Product Lookup → Use default_sell_price → Calculate Tax (hardcoded 0.05)
```

**Target Flow:**
```
Order Creation → PricingService.getPriceForOrderItem() → 
  → Check Price Lists → Fallback to Product Default → 
  → Apply Tax (from tenant settings) → Return Final Price
```

### 2. Price Lookup Logic

```typescript
async getPriceForOrderItem(
  tenantId: string,
  productId: string,
  quantity: number,
  isExpress: boolean,
  customerId?: string
): Promise<PriceResult> {
  // 1. Determine price list type
  const priceListType = isExpress ? 'express' : 'standard';
  
  // 2. Check customer-specific pricing (B2B, VIP)
  if (customerId) {
    const customerType = await this.getCustomerType(customerId);
    if (customerType === 'B2B') priceListType = 'b2b';
    if (customerType === 'VIP') priceListType = 'vip';
  }
  
  // 3. Call database function
  const price = await this.db.query(
    `SELECT get_product_price($1, $2, $3, $4, $5)`,
    [tenantId, productId, priceListType, quantity, new Date()]
  );
  
  // 4. Get tax rate
  const taxRate = await this.taxService.getTaxRate(tenantId);
  
  // 5. Calculate tax
  const taxAmount = price * taxRate;
  
  // 6. Return result
  return { basePrice: price, taxRate, taxAmount, total: price + taxAmount };
}
```

---

## Testing Checklist

### Unit Tests
- [ ] Price lookup with standard price list
- [ ] Price lookup with express price list
- [ ] Fallback to product default when no price list
- [ ] Quantity tier selection
- [ ] Tax calculation
- [ ] Tax exemption handling

### Integration Tests
- [ ] Order creation with price list
- [ ] Order creation without price list (fallback)
- [ ] Express order pricing
- [ ] Tax calculation in order totals

---

## Next Steps

1. **Review the full plan**: `docs/plan/pricing_feature_implementation_plan.md`
2. **Start Phase 1**: Create PricingService and integrate with orders
3. **Create migration**: Add tax configuration to tenants
4. **Write tests**: Unit tests for pricing service
5. **Test integration**: Verify order creation uses price lists

---

## Questions to Resolve

1. **Tax Configuration Location**
   - Option A: Add columns to `org_tenants_mst` (simpler)
   - Option B: Use `sys_tenant_settings_cd` (more flexible)
   - **Recommendation**: Option A for Phase 1, migrate to Option B later if needed

2. **Price Override**
   - Should manual price override be available in order creation?
   - **Recommendation**: Yes, but with permission check (Phase 6)

3. **Customer Type Detection**
   - How to determine if customer is B2B or VIP?
   - **Recommendation**: Add `customer_type` to `org_customers_mst` or use customer groups

---

## Related Documentation

- Full Implementation Plan: `docs/plan/pricing_feature_implementation_plan.md`
- Service Catalog PRD: `docs/plan/008_catalog_service_management_dev_prd.md`
- Order Intake PRD: `docs/plan/004_order_intake_dev_prd.md`
- Master Plan: `docs/plan/master_plan_cc_01.md`

---

**Last Updated**: 2025-01-27

