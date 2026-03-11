# Pricing Feature Implementation Plan

**Document ID**: pricing_feature_implementation_plan  
**Version**: 1.0  
**Status**: Planning  
**Owner**: Backend + Frontend Team  
**Dependencies**: PRD-008 (Service Catalog Management)  
**Related PRDs**: PRD-004 (Order Intake), PRD-012 (Payment Processing)  
**Created**: 2025-01-27

---

## Executive Summary

This document outlines the comprehensive implementation plan for the pricing feature in CleanMateX. The pricing system will support flexible pricing strategies including standard, express, VIP, seasonal, B2B, and promotional pricing with quantity tiers, discounts, and tax calculations.

### Current State (Verified via Supabase MCP - 2025-01-27)

✅ **Completed:**
- Database schema for price lists (`org_price_lists_mst`, `org_price_list_items_dtl`) - **Verified**
- Database function `get_product_price()` for price lookup - **Verified & Functional**
- Basic pricing calculator utility (`pricing-calculator.ts`) - **Exists**
- Price list API endpoints (CRUD operations) - **Exists**
- Price list management UI (basic) - **Exists**
- RLS policies configured - **Verified**
- Indexes optimized for performance - **Verified**

**Database Statistics:**
- Price lists: 0 active (tables ready, no data yet)
- Price list items: 0 active
- Function: `get_product_price()` - **Working**

❌ **Missing:**
- Integration of price lists into order creation flow
- Price lookup service using price lists
- Customer-specific pricing (B2B/VIP) - requires function enhancement
- Seasonal pricing automation (tables support it, but no automation)
- Price history tracking (audit table needed)
- Bulk pricing operations (CSV import/export)
- Tax rate configuration per tenant
- Price override permissions

---

## 1. Database Schema Review (Verified via Supabase MCP)

### Existing Tables (✅ Verified)

#### `org_price_lists_mst`
**Columns:**
- `id` (UUID, PK)
- `tenant_org_id` (UUID, FK → org_tenants_mst)
- `name` / `name2` (VARCHAR(255) - Bilingual support)
- `description` / `description2` (TEXT - Bilingual)
- `price_list_type` (VARCHAR(50)) - CHECK constraint: 'standard', 'express', 'vip', 'seasonal', 'b2b', 'promotional'
- `effective_from` / `effective_to` (DATE) - Date range support
- `is_default` (BOOLEAN) - Default price list for type
- `priority` (INTEGER, default 0) - Higher priority wins
- `is_active` (BOOLEAN, default true)
- Standard audit fields: `created_at`, `created_by`, `created_info`, `updated_at`, `updated_by`, `updated_info`, `rec_status`, `rec_order`, `rec_notes`

**Constraints:**
- `valid_price_list_type` - CHECK constraint on price_list_type
- `valid_date_range` - CHECK constraint ensuring effective_from <= effective_to
- Foreign key to `org_tenants_mst`

**Indexes:**
- `idx_price_lists_tenant` - (tenant_org_id)
- `idx_price_lists_tenant_active` - (tenant_org_id, is_active)
- `idx_price_lists_type` - (tenant_org_id, price_list_type, is_active)
- `idx_price_lists_dates` - (tenant_org_id, effective_from, effective_to) WHERE is_active = true
- `idx_price_lists_default` - (tenant_org_id, price_list_type, is_default) WHERE is_active = true AND is_default = true

#### `org_price_list_items_dtl`
**Columns:**
- `id` (UUID, PK)
- `tenant_org_id` (UUID, FK → org_tenants_mst)
- `price_list_id` (UUID, FK → org_price_lists_mst)
- `product_id` (UUID, FK → org_product_data_mst via composite FK)
- `price` (NUMERIC(10,3)) - CHECK: price >= 0
- `discount_percent` (NUMERIC(5,2), default 0) - CHECK: 0-100
- `min_quantity` (INTEGER, default 1) - Minimum quantity for this tier
- `max_quantity` (INTEGER, nullable) - Maximum quantity (NULL = unlimited)
- `is_active` (BOOLEAN, default true)
- Standard audit fields

**Constraints:**
- `positive_price` - CHECK: price >= 0
- `valid_discount` - CHECK: discount_percent 0-100
- `valid_quantity_range` - CHECK: min_quantity > 0 AND (max_quantity IS NULL OR max_quantity >= min_quantity)
- `unique_price_list_product` - UNIQUE (price_list_id, product_id, min_quantity)
- Composite FK: (tenant_org_id, product_id) → org_product_data_mst(tenant_org_id, id)

**Indexes:**
- `idx_price_list_items_tenant` - (tenant_org_id)
- `idx_price_list_items_list` - (price_list_id)
- `idx_price_list_items_product` - (tenant_org_id, product_id)
- `idx_price_list_items_active` - (price_list_id, is_active)

#### `org_product_data_mst`
**Relevant Columns:**
- `default_sell_price` (NUMERIC(10,3))
- `default_express_sell_price` (NUMERIC(10,3))
- `multiplier_express` (NUMERIC(4,2))
- `is_tax_exempt` (INTEGER)

### Database Function (✅ Verified)

```sql
get_product_price(
  p_tenant_org_id UUID,
  p_product_id UUID,
  p_price_list_type VARCHAR(50) DEFAULT 'standard',
  p_quantity INTEGER DEFAULT 1,
  p_effective_date DATE DEFAULT CURRENT_DATE
) RETURNS NUMERIC(10,3)
```

**Current Implementation (Verified):**
1. Queries `org_price_list_items_dtl` joined with `org_price_lists_mst`
2. Filters by:
   - tenant_org_id, product_id
   - is_active = true (both tables)
   - price_list_type match
   - Date range (effective_from/effective_to)
   - Quantity tiers (min_quantity <= quantity AND (max_quantity IS NULL OR max_quantity >= quantity))
3. Orders by: `priority DESC, min_quantity DESC` (highest priority and quantity tier first)
4. Applies discount: `price * (1 - COALESCE(discount_percent, 0) / 100)`
5. **Fallback:** If no price list match, uses product default:
   - For 'express': `COALESCE(default_express_sell_price, default_sell_price)`
   - For others: `default_sell_price`

**Current Status:**
- ✅ Function exists and is fully functional
- ✅ Supports quantity tiers
- ✅ Supports date ranges (seasonal pricing)
- ✅ Supports discount percentage
- ✅ Supports priority system
- ✅ Falls back to product defaults

**Enhancements Needed:**
- ❌ Add customer_id parameter for B2B/VIP customer-specific pricing
- ❌ Add tax rate calculation (currently returns base price only)
- ❌ Return additional metadata (price_list_id, discount_applied, etc.)

---

## 2. Functional Requirements

### FR-PRICE-001: Price Lookup Service

**Priority**: P0 (Critical)

- Integrate price list lookup into order creation
- Support multiple price list types (standard, express, vip, seasonal, b2b, promotional)
- Fallback to product default prices when no price list match
- Consider quantity tiers for bulk pricing
- Apply date-based price list selection (seasonal pricing)

**Acceptance Criteria:**
- [ ] Price lookup service uses `get_product_price()` function
- [ ] Order creation uses price lists instead of only product defaults
- [ ] Express orders use express price lists
- [ ] Quantity-based pricing tiers work correctly
- [ ] Seasonal pricing activates based on date ranges

### FR-PRICE-002: Tax Configuration

**Priority**: P0 (Critical)

- Tenant-level tax rate configuration
- Product-level tax exemption
- Tax calculation in pricing service
- Support for multiple tax types (VAT, service tax, etc.)

**Acceptance Criteria:**
- [ ] Tenant settings include tax rate configuration
- [ ] Tax-exempt products skip tax calculation
- [ ] Tax is calculated correctly in order totals
- [ ] Tax breakdown shown in receipts

### FR-PRICE-003: Customer-Specific Pricing

**Priority**: P1 (High)

- B2B customer pricing support
- VIP customer pricing tiers
- Customer group pricing
- Contract-based pricing

**Acceptance Criteria:**
- [ ] B2B customers use B2B price lists
- [ ] VIP customers use VIP price lists
- [ ] Customer groups can have custom pricing
- [ ] Contract pricing overrides standard pricing

### FR-PRICE-004: Discount Management

**Priority**: P1 (High)

- Item-level discounts
- Order-level discounts
- Promo code integration
- Percentage and fixed amount discounts
- Discount stacking rules

**Acceptance Criteria:**
- [ ] Discounts can be applied at item level
- [ ] Order-level discounts work correctly
- [ ] Promo codes integrate with pricing
- [ ] Discount stacking rules are enforced
- [ ] Discount history is tracked

### FR-PRICE-005: Price History & Audit

**Priority**: P2 (Medium)

- Track price changes over time
- Price change audit log
- Historical price queries
- Price change notifications

**Acceptance Criteria:**
- [ ] Price changes are logged
- [ ] Historical prices can be queried
- [ ] Audit trail shows who changed prices and when
- [ ] Price change notifications sent to relevant users

### FR-PRICE-006: Bulk Pricing Operations

**Priority**: P2 (Medium)

- Bulk price updates via CSV
- Price import/export
- Price update templates
- Validation and error handling

**Acceptance Criteria:**
- [ ] CSV import for bulk price updates
- [ ] Export current prices to CSV
- [ ] Import validation with error reporting
- [ ] Template download available

### FR-PRICE-007: Price Override Permissions

**Priority**: P2 (Medium)

- Role-based price override permissions
- Manual price override in order creation
- Override reason tracking
- Override approval workflow (optional)

**Acceptance Criteria:**
- [ ] Only authorized roles can override prices
- [ ] Manual overrides require reason
- [ ] Override history is tracked
- [ ] Override approval workflow works (if enabled)

### FR-PRICE-008: Seasonal Pricing Automation

**Priority**: P3 (Low)

- Automatic activation of seasonal price lists
- Calendar-based pricing rules
- Peak season pricing
- Holiday pricing

**Acceptance Criteria:**
- [ ] Seasonal price lists activate automatically
- [ ] Calendar rules work correctly
- [ ] Peak season pricing applies
- [ ] Holiday pricing activates on specified dates

---

## 3. Technical Design

### 3.1 Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Order Creation Flow                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Price Lookup Service (New)                      │
│  - getPriceForProduct()                                      │
│  - getPriceForOrderItem()                                    │
│  - calculateOrderTotals()                                    │
└─────────────────────────────────────────────────────────────┘
                              │
                ┌─────────────┴─────────────┐
                ▼                           ▼
┌──────────────────────────┐   ┌──────────────────────────┐
│   Price List Service     │   │   Pricing Calculator     │
│   - Query price lists    │   │   - Tax calculation      │
│   - Apply quantity tiers │   │   - Discount application  │
│   - Date range checks   │   │   - Total calculation    │
└──────────────────────────┘   └──────────────────────────┘
                │                           │
                └─────────────┬─────────────┘
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Database Layer                                  │
│  - get_product_price() function                              │
│  - org_price_lists_mst                                       │
│  - org_price_list_items_dtl                                  │
│  - org_product_data_mst                                      │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Service Layer Design

#### Price Lookup Service

**File**: `web-admin/lib/services/pricing.service.ts`

```typescript
interface PriceLookupParams {
  tenantId: string;
  productId: string;
  priceListType: 'standard' | 'express' | 'vip' | 'seasonal' | 'b2b' | 'promotional';
  quantity: number;
  customerId?: string;
  effectiveDate?: Date;
}

interface PriceResult {
  basePrice: number;
  priceListId: string | null;
  priceListItemId: string | null;
  discountPercent: number;
  finalPrice: number;
  taxRate: number;
  taxAmount: number;
  total: number;
}

class PricingService {
  /**
   * Get price for a product considering price lists
   */
  async getPriceForProduct(params: PriceLookupParams): Promise<PriceResult>;

  /**
   * Get price for an order item (includes tax calculation)
   */
  async getPriceForOrderItem(
    tenantId: string,
    productId: string,
    quantity: number,
    isExpress: boolean,
    customerId?: string
  ): Promise<PriceResult>;

  /**
   * Calculate order totals from items
   */
  async calculateOrderTotals(
    tenantId: string,
    items: OrderItem[],
    customerId?: string
  ): Promise<OrderTotals>;

  /**
   * Get applicable price list for customer
   */
  async getPriceListForCustomer(
    tenantId: string,
    customerId: string
  ): Promise<string | null>;
}
```

#### Tax Configuration Service

**File**: `web-admin/lib/services/tax.service.ts`

```typescript
interface TaxConfig {
  tenantId: string;
  defaultTaxRate: number;
  taxType: 'VAT' | 'SERVICE_TAX' | 'CUSTOM';
  taxExemptProducts: string[];
}

class TaxService {
  /**
   * Get tax rate for tenant
   */
  async getTaxRate(tenantId: string): Promise<number>;

  /**
   * Check if product is tax exempt
   */
  async isTaxExempt(tenantId: string, productId: string): Promise<boolean>;

  /**
   * Calculate tax amount
   */
  calculateTax(amount: number, taxRate: number): number;
}
```

### 3.3 Database Enhancements

#### New Table: `org_price_history_audit`

```sql
CREATE TABLE org_price_history_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL,
  price_list_id UUID,
  price_list_item_id UUID,
  product_id UUID NOT NULL,
  old_price NUMERIC(10,3),
  new_price NUMERIC(10,3),
  changed_by VARCHAR(120),
  changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  change_reason TEXT,
  FOREIGN KEY (tenant_org_id) REFERENCES org_tenants_mst(id),
  FOREIGN KEY (price_list_id) REFERENCES org_price_lists_mst(id),
  FOREIGN KEY (price_list_item_id) REFERENCES org_price_list_items_dtl(id),
  FOREIGN KEY (tenant_org_id, product_id) REFERENCES org_product_data_mst(tenant_org_id, id)
);
```

#### Enhanced Function: `get_product_price_with_tax`

**Note:** Current `get_product_price()` function returns only the price. We need an enhanced version that returns full pricing breakdown.

```sql
CREATE OR REPLACE FUNCTION get_product_price_with_tax(
  p_tenant_org_id UUID,
  p_product_id UUID,
  p_price_list_type VARCHAR(50) DEFAULT 'standard',
  p_quantity INTEGER DEFAULT 1,
  p_customer_id UUID DEFAULT NULL,
  p_effective_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
  base_price NUMERIC(10,3),
  discount_percent NUMERIC(5,2),
  final_price NUMERIC(10,3),
  tax_rate NUMERIC(5,4),
  tax_amount NUMERIC(10,3),
  total NUMERIC(10,3),
  price_list_id UUID,
  price_list_item_id UUID,
  source VARCHAR(20) -- 'price_list' or 'product_default'
)
```

**Implementation Notes:**
- Extend existing `get_product_price()` logic
- Add customer_id parameter for B2B/VIP detection
- Join with tenant settings for tax rate
- Check product `is_tax_exempt` flag
- Return full pricing breakdown instead of just price

#### Tenant Tax Configuration

Add to `org_tenants_mst`:
```sql
ALTER TABLE org_tenants_mst
  ADD COLUMN default_tax_rate NUMERIC(5,4) DEFAULT 0.05,
  ADD COLUMN tax_type VARCHAR(20) DEFAULT 'VAT';
```

### 3.4 API Endpoints

#### Existing Endpoints (Enhance)

- `GET /api/v1/price-lists` - List price lists
- `POST /api/v1/price-lists` - Create price list
- `GET /api/v1/price-lists/:id` - Get price list with items
- `PATCH /api/v1/price-lists/:id` - Update price list
- `DELETE /api/v1/price-lists/:id` - Delete price list

#### New Endpoints

- `POST /api/v1/pricing/calculate` - Calculate price for product/item
- `GET /api/v1/pricing/history/:productId` - Get price history
- `POST /api/v1/pricing/bulk-update` - Bulk price update
- `GET /api/v1/pricing/export` - Export prices to CSV
- `POST /api/v1/pricing/import` - Import prices from CSV
- `GET /api/v1/tax/config` - Get tax configuration
- `PATCH /api/v1/tax/config` - Update tax configuration

### 3.5 Integration Points

#### Order Creation Integration

**File**: `web-admin/lib/db/orders.ts`

```typescript
// Update addOrderItems function
import { PricingService } from '@/lib/services/pricing.service';

const pricingService = new PricingService();

// Replace current pricing logic with:
const priceResult = await pricingService.getPriceForOrderItem(
  tenantOrgId,
  item.productId,
  item.quantity,
  input.isExpressService,
  order.customer_id
);
```

#### Order Service Integration

**File**: `web-admin/lib/services/order-service.ts`

```typescript
// Update order calculation methods
async function recalculateOrderTotals(
  tenantId: string,
  orderId: string
): Promise<void> {
  const pricingService = new PricingService();
  // Use pricing service for recalculation
}
```

---

## 4. Implementation Phases

### Phase 1: Core Price Lookup Integration (Week 1)

**Duration**: 5 days  
**Priority**: P0

**Tasks:**
1. Create `PricingService` class
2. Integrate price lookup into order creation
3. Update order item creation to use price lists
4. Add tax configuration to tenant settings
5. Update pricing calculator to use tax from tenant settings
6. Test price lookup with different price list types

**Deliverables:**
- ✅ Pricing service implementation
- ✅ Order creation uses price lists
- ✅ Tax configuration working
- ✅ Unit tests for pricing service

### Phase 2: Customer-Specific Pricing (Week 2)

**Duration**: 5 days  
**Priority**: P1

**Tasks:**
1. Add customer type detection (B2B, VIP)
2. Implement customer-specific price list selection
3. Add customer group pricing support
4. Update order creation to pass customer context
5. Test B2B and VIP pricing scenarios

**Deliverables:**
- ✅ Customer-specific pricing working
- ✅ B2B price lists applied correctly
- ✅ VIP pricing tiers functional
- ✅ Integration tests

### Phase 3: Discount Management (Week 2-3)

**Duration**: 5 days  
**Priority**: P1

**Tasks:**
1. Enhance discount application in pricing service
2. Integrate with promo code system
3. Add discount stacking rules
4. Update order totals calculation
5. Add discount breakdown to receipts

**Deliverables:**
- ✅ Discount system integrated
- ✅ Promo codes work with pricing
- ✅ Discount stacking rules enforced
- ✅ Receipts show discount breakdown

### Phase 4: Price History & Audit (Week 3)

**Duration**: 3 days  
**Priority**: P2

**Tasks:**
1. Create price history audit table
2. Add audit triggers on price changes
3. Implement price history API
4. Add price history UI component
5. Test audit logging

**Deliverables:**
- ✅ Price history table created
- ✅ Audit logging working
- ✅ Price history API endpoints
- ✅ Price history UI

### Phase 5: Bulk Operations (Week 3-4)

**Duration**: 4 days  
**Priority**: P2

**Tasks:**
1. Implement CSV export functionality
2. Create CSV import with validation
3. Add bulk update API endpoint
4. Create bulk update UI
5. Add error handling and reporting

**Deliverables:**
- ✅ CSV export working
- ✅ CSV import with validation
- ✅ Bulk update API
- ✅ Bulk update UI

### Phase 6: Price Override & Permissions (Week 4)

**Duration**: 3 days  
**Priority**: P2

**Tasks:**
1. Add price override permission check
2. Implement manual price override in order creation
3. Add override reason tracking
4. Create override history UI
5. Test permission enforcement

**Deliverables:**
- ✅ Price override permissions
- ✅ Manual override in orders
- ✅ Override tracking
- ✅ Override history UI

### Phase 7: Seasonal Pricing Automation (Week 4-5)

**Duration**: 3 days  
**Priority**: P3

**Tasks:**
1. Create seasonal pricing scheduler
2. Implement calendar-based activation
3. Add peak season detection
4. Test automatic activation
5. Add seasonal pricing UI indicators

**Deliverables:**
- ✅ Seasonal pricing scheduler
- ✅ Automatic activation working
- ✅ Peak season detection
- ✅ UI indicators

---

## 5. Database Migration Plan

### Migration 1: Tax Configuration

**File**: `supabase/migrations/XXXX_add_tax_configuration.sql`

```sql
-- Add tax configuration to tenants
ALTER TABLE org_tenants_mst
  ADD COLUMN IF NOT EXISTS default_tax_rate NUMERIC(5,4) DEFAULT 0.05,
  ADD COLUMN IF NOT EXISTS tax_type VARCHAR(20) DEFAULT 'VAT';

-- Add tax rate to price list items (optional override)
ALTER TABLE org_price_list_items_dtl
  ADD COLUMN IF NOT EXISTS tax_rate_override NUMERIC(5,4);
```

### Migration 2: Price History Audit

**File**: `supabase/migrations/XXXX_add_price_history_audit.sql`

```sql
-- Create price history audit table
CREATE TABLE IF NOT EXISTS org_price_history_audit (
  -- See schema in section 3.3
);

-- Create trigger for price changes
CREATE OR REPLACE FUNCTION log_price_change()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO org_price_history_audit (
    tenant_org_id,
    price_list_item_id,
    product_id,
    old_price,
    new_price,
    changed_by,
    change_reason
  ) VALUES (
    NEW.tenant_org_id,
    NEW.id,
    NEW.product_id,
    OLD.price,
    NEW.price,
    current_setting('app.current_user_id', true),
    current_setting('app.price_change_reason', true)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER price_change_audit
  AFTER UPDATE OF price ON org_price_list_items_dtl
  FOR EACH ROW
  WHEN (OLD.price IS DISTINCT FROM NEW.price)
  EXECUTE FUNCTION log_price_change();
```

### Migration 3: Enhanced Price Function

**File**: `supabase/migrations/XXXX_enhance_get_product_price.sql`

```sql
-- Enhance get_product_price function to include tax and customer context
-- See function definition in section 3.3
```

---

## 6. Testing Strategy

### Unit Tests

**File**: `web-admin/__tests__/services/pricing.service.test.ts`

- Test price lookup with different price list types
- Test quantity tier selection
- Test date range filtering
- Test fallback to product defaults
- Test tax calculation
- Test discount application
- Test customer-specific pricing

### Integration Tests

**File**: `web-admin/__tests__/integration/pricing-integration.test.ts`

- Test order creation with price lists
- Test price recalculation
- Test B2B pricing flow
- Test seasonal pricing activation
- Test bulk price updates

### E2E Tests

**File**: `web-admin/__tests__/e2e/pricing-flow.test.ts`

- Complete order creation flow with price lists
- Price override workflow
- Bulk price import/export
- Price history viewing

---

## 7. UI/UX Requirements

### Price List Management UI

**File**: `web-admin/app/dashboard/catalog/pricing/page.tsx`

**Enhancements:**
- [ ] Price list type filter
- [ ] Active/inactive toggle
- [ ] Date range indicators
- [ ] Priority display
- [ ] Quick price edit
- [ ] Bulk price update button

### Order Creation UI

**File**: `web-admin/app/dashboard/orders/new/page.tsx`

**Enhancements:**
- [ ] Show price source (price list vs default)
- [ ] Price breakdown tooltip
- [ ] Manual price override button (with permission check)
- [ ] Discount input fields
- [ ] Tax breakdown display

### Price History UI

**New File**: `web-admin/app/dashboard/catalog/pricing/history/page.tsx`

- [ ] Product price history timeline
- [ ] Price change details
- [ ] Filter by date range
- [ ] Export price history

### Bulk Price Update UI

**New File**: `web-admin/app/dashboard/catalog/pricing/bulk-update/page.tsx`

- [ ] CSV template download
- [ ] CSV file upload
- [ ] Validation error display
- [ ] Preview before apply
- [ ] Progress indicator

---

## 8. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Price lookup performance | < 100ms | API response time |
| Price list coverage | 80%+ products | Products with price lists |
| Tax accuracy | 100% | Correct tax calculation |
| B2B pricing adoption | 50%+ B2B customers | Customers using B2B pricing |
| Bulk update speed | > 100 products/second | Import throughput |
| Price history queries | < 500ms | Response time |

---

## 9. Risk Management

### Technical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Price lookup performance degradation | Medium | High | Add caching, optimize queries |
| Complex price list conflicts | Medium | Medium | Clear priority rules, validation |
| Tax calculation errors | Low | Critical | Comprehensive testing, validation |
| Bulk update data corruption | Low | High | Validation, rollback capability |

### Business Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Incorrect pricing in orders | Medium | Critical | Testing, validation, audit trail |
| Price override abuse | Low | Medium | Permission controls, audit logging |
| Seasonal pricing misconfiguration | Low | Medium | Validation, testing, clear UI |

---

## 10. Acceptance Checklist

### Phase 1: Core Integration
- [ ] Price lookup service implemented
- [ ] Order creation uses price lists
- [ ] Tax configuration working
- [ ] Unit tests passing
- [ ] Integration tests passing

### Phase 2: Customer Pricing
- [ ] B2B pricing working
- [ ] VIP pricing working
- [ ] Customer group pricing functional
- [ ] Tests passing

### Phase 3: Discounts
- [ ] Discount system integrated
- [ ] Promo codes working
- [ ] Discount stacking rules enforced
- [ ] Receipts show discounts

### Phase 4: History & Audit
- [ ] Price history table created
- [ ] Audit logging working
- [ ] Price history API functional
- [ ] Price history UI complete

### Phase 5: Bulk Operations
- [ ] CSV export working
- [ ] CSV import with validation
- [ ] Bulk update API functional
- [ ] Bulk update UI complete

### Phase 6: Override & Permissions
- [ ] Price override permissions working
- [ ] Manual override in orders
- [ ] Override tracking functional
- [ ] Override history UI complete

### Phase 7: Seasonal Pricing
- [ ] Seasonal pricing scheduler working
- [ ] Automatic activation functional
- [ ] Peak season detection working
- [ ] UI indicators complete

---

## 11. Dependencies

### Internal Dependencies
- PRD-008: Service Catalog Management (completed)
- PRD-004: Order Intake (in progress)
- PRD-003: Customer Management (completed)
- PRD-012: Payment Processing (planned)

### External Dependencies
- Supabase database access
- Prisma ORM
- Next.js API routes

---

## 12. Documentation Requirements

### Technical Documentation
- [ ] Pricing service API documentation
- [ ] Database schema documentation updates
- [ ] Price lookup algorithm documentation
- [ ] Tax calculation rules documentation

### User Documentation
- [ ] Price list management guide
- [ ] Bulk price update guide
- [ ] Price override guide
- [ ] Seasonal pricing setup guide

---

## 13. Rollout Plan

### Phase 1: Internal Testing (Week 1)
- Deploy to staging environment
- Internal team testing
- Fix critical issues

### Phase 2: Beta Testing (Week 2)
- Deploy to select tenants
- Gather feedback
- Iterate on issues

### Phase 3: Gradual Rollout (Week 3-4)
- Deploy to 25% of tenants
- Monitor performance
- Fix issues

### Phase 4: Full Rollout (Week 5)
- Deploy to all tenants
- Monitor and support
- Documentation updates

---

## 14. Post-Implementation

### Monitoring
- Price lookup performance metrics
- Error rates
- Usage statistics
- Customer feedback

### Optimization
- Query performance tuning
- Caching strategies
- Bulk operation improvements

### Future Enhancements
- AI-powered pricing suggestions
- Dynamic pricing based on demand
- Competitor price tracking
- Price optimization algorithms

---

## Appendix A: Database Schema Reference

### Price List Types
- `standard`: Regular pricing
- `express`: Express service pricing (premium)
- `vip`: VIP customer pricing
- `seasonal`: Seasonal/date-based pricing
- `b2b`: Business-to-business pricing
- `promotional`: Promotional/special pricing

### Price Calculation Flow
1. Determine price list type (standard/express/vip/b2b)
2. Check customer-specific price lists
3. Query price list items with quantity tiers
4. Apply date range filtering (seasonal pricing)
5. Select highest priority matching price list
6. Apply discount if applicable
7. Calculate tax (if not exempt)
8. Return final price

---

**Document Version**: 1.0  
**Last Updated**: 2025-01-27  
**Next Review**: After Phase 1 completion

