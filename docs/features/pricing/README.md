# Pricing Feature Documentation

## Overview

The CleanMateX Pricing Feature provides a comprehensive, flexible pricing system that supports multiple price lists, quantity tiers, customer-specific pricing, tax calculation, and price overrides with full audit trails.

## Table of Contents

1. [Architecture](#architecture)
2. [Database Schema](#database-schema)
3. [API Endpoints](#api-endpoints)
4. [Frontend Components](#frontend-components)
5. [Migration Guide](#migration-guide)
6. [Integration Guide](#integration-guide)
7. [Usage Examples](#usage-examples)
8. [Troubleshooting](#troubleshooting)

## Architecture

### Core Components

1. **PricingService** (`web-admin/lib/services/pricing.service.ts`)
   - Centralized pricing logic
   - Price list type determination (standard, express, B2B, VIP)
   - Integration with database functions
   - Order total calculations

2. **TaxService** (`web-admin/lib/services/tax.service.ts`)
   - Tax rate retrieval from tenant settings
   - Tax calculation
   - Tax exemption checks

3. **Database Functions**
   - `get_product_price()` - Basic price lookup
   - `get_product_price_with_tax()` - Full pricing breakdown including tax

4. **Price History Audit**
   - Automatic tracking of price changes
   - Triggers on price list items and product defaults
   - Full audit trail with user information

## Database Schema

### Tables

#### `org_price_lists_mst`
Price list master table storing price list headers.

**Key Fields:**
- `id` (UUID, PK)
- `tenant_org_id` (UUID, FK)
- `name` / `name2` (bilingual)
- `price_list_type` (standard, express, b2b, vip, seasonal, promotional)
- `priority` (for multiple active lists)
- `effective_from` / `effective_to` (date range)
- `is_active` (boolean)

#### `org_price_list_items_dtl`
Individual product prices within a price list.

**Key Fields:**
- `id` (UUID, PK)
- `price_list_id` (UUID, FK)
- `product_id` (UUID, FK)
- `price` (NUMERIC)
- `discount_percent` (NUMERIC)
- `min_quantity` / `max_quantity` (quantity tiers)
- `is_active` (boolean)

#### `org_price_history_audit`
Audit trail for all price changes.

**Key Fields:**
- `id` (UUID, PK)
- `entity_type` (price_list_item | product_default)
- `entity_id` (UUID)
- `old_price` / `new_price` (NUMERIC)
- `old_discount_percent` / `new_discount_percent` (NUMERIC)
- `change_reason` (TEXT)
- `created_by` (UUID, FK to users)
- `created_at` (TIMESTAMP)

#### `org_order_items_dtl` (Enhanced)
Added price override fields:
- `price_override` (NUMERIC)
- `override_reason` (TEXT)
- `override_by` (UUID, FK to users)

### Indexes

- `idx_price_lists_tenant_type` on `org_price_lists_mst(tenant_org_id, price_list_type, is_active)`
- `idx_price_list_items_lookup` on `org_price_list_items_dtl(tenant_org_id, product_id, price_list_id, is_active)`
- `idx_price_history_tenant` on `org_price_history_audit(tenant_org_id)`
- `idx_price_history_product` on `org_price_history_audit(product_id)`

### Row-Level Security (RLS)

All `org_*` tables have RLS policies ensuring tenant isolation:
- Policies filter by `tenant_org_id`
- Users can only access data for their tenant
- Composite foreign keys enforce tenant consistency

## API Endpoints

### Price Lists

#### `GET /api/v1/price-lists`
List all price lists for the current tenant.

**Query Parameters:**
- `type?: string` - Filter by price list type
- `active?: boolean` - Filter by active status

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "name": "Standard Pricing",
      "name2": "التسعير القياسي",
      "price_list_type": "standard",
      "priority": 1,
      "is_active": true,
      "itemCount": 150
    }
  ]
}
```

#### `GET /api/v1/price-lists/[id]`
Get price list details with items.

#### `POST /api/v1/price-lists`
Create a new price list.

#### `PATCH /api/v1/price-lists/[id]`
Update price list settings.

#### `DELETE /api/v1/price-lists/[id]`
Soft delete a price list.

### Price List Items

#### `POST /api/v1/price-lists/[id]/items`
Add an item to a price list.

**Request Body:**
```json
{
  "productId": "uuid",
  "price": 5.500,
  "discountPercent": 10.0,
  "minQuantity": 1,
  "maxQuantity": 10
}
```

#### `PATCH /api/v1/price-lists/[id]/items/[itemId]`
Update a price list item.

#### `DELETE /api/v1/price-lists/[id]/items/[itemId]`
Remove an item from a price list.

### Bulk Operations

#### `POST /api/v1/pricing/import`
Import price list items from CSV.

**Request:**
- `Content-Type: multipart/form-data`
- `file`: CSV file
- `priceListId`: UUID

**CSV Format:**
```csv
product_code,price,discount_percent,min_quantity,max_quantity
SHIRT-001,5.500,10.0,1,10
PANTS-001,8.000,0.0,1,
```

#### `GET /api/v1/pricing/export`
Export price list items to CSV.

**Query Parameters:**
- `priceListId`: UUID (required)

#### `GET /api/v1/pricing/template`
Download CSV template for import.

### Price Calculation

#### `POST /api/v1/pricing/calculate`
Calculate price for an item or order.

**Request Body:**
```json
{
  "productId": "uuid",
  "quantity": 5,
  "priceListType": "standard",
  "customerId": "uuid",
  "express": false
}
```

**Response:**
```json
{
  "basePrice": 5.500,
  "discountPercent": 10.0,
  "finalPrice": 4.950,
  "taxRate": 0.05,
  "taxAmount": 0.248,
  "total": 5.198,
  "priceListId": "uuid",
  "priceListName": "Standard Pricing",
  "source": "price_list"
}
```

### Price History

#### `GET /api/v1/pricing/history`
Get price change history.

**Query Parameters:**
- `priceListId?: string`
- `productId?: string`
- `fromDate?: string` (ISO format)
- `toDate?: string` (ISO format)
- `userId?: string`
- `entityType?: 'price_list_item' | 'product_default'`
- `limit?: number` (default: 100)
- `offset?: number` (default: 0)

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "entity_type": "price_list_item",
      "old_price": 5.000,
      "new_price": 5.500,
      "created_at": "2026-01-27T10:00:00Z",
      "user_name": "John Doe",
      "user_email": "john@example.com",
      "price_list_name": "Standard Pricing",
      "product_name": "Shirt"
    }
  ],
  "pagination": {
    "total": 150,
    "limit": 100,
    "offset": 0,
    "hasMore": true
  }
}
```

## Frontend Components

### Price List Management

#### `PriceListDetailPage`
Location: `web-admin/app/dashboard/catalog/pricing/[id]/page.tsx`

Features:
- View and edit price list settings
- Manage price list items (add, edit, delete)
- Bulk import/export
- View price history timeline

#### `PriceListItemModal`
Location: `web-admin/app/dashboard/catalog/pricing/[id]/components/price-list-item-modal.tsx`

Features:
- Add/edit individual price list items
- Product search
- Quantity tier configuration
- Discount settings

#### `BulkImportModal`
Location: `web-admin/app/dashboard/catalog/pricing/components/bulk-import-modal.tsx`

Features:
- CSV file upload
- Validation and error reporting
- Progress tracking
- Template download

### Order Creation Integration

#### `PriceOverrideModal`
Location: `web-admin/app/dashboard/orders/new/components/price-override-modal.tsx`

Features:
- Manual price override with permission check
- Required reason field
- Price difference calculation
- Audit trail information

#### `PricingBreakdown`
Location: `web-admin/app/dashboard/orders/new/components/pricing-breakdown.tsx`

Features:
- Item-level pricing details
- Order-level totals
- Tax breakdown
- Price source indicators
- Expandable details

#### `ItemCartItem` (Enhanced)
Location: `web-admin/app/dashboard/orders/new/components/item-cart-item.tsx`

Features:
- Price override indicator badge
- Price per unit display
- Source badge (Price List, Product Default, etc.)

### Settings

#### `FinanceSettingsPage`
Location: `web-admin/app/dashboard/settings/finance/page.tsx`

Features:
- Tax rate configuration
- Tax type selection
- Real-time validation
- Integration with settings API

### Price History

#### `PriceHistoryTimeline`
Location: `web-admin/app/dashboard/catalog/pricing/[id]/components/price-history-timeline.tsx`

Features:
- Timeline view of price changes
- Filters (date range, entity type, user)
- Export to CSV
- User name resolution
- Detailed change information

## Migration Guide

### Database Migrations

The pricing feature requires the following migrations (in order):

1. **0083_add_tax_rate_setting.sql**
   - Adds `TAX_RATE` setting to `sys_tenant_settings_cd`
   - Seeds default tax rate (5%) for existing tenants

2. **0084_enhance_get_product_price_with_tax.sql**
   - Creates `get_product_price_with_tax()` function
   - Returns full pricing breakdown including tax

3. **0085_add_price_history_audit.sql**
   - Creates `org_price_history_audit` table
   - Creates triggers for automatic price change tracking

4. **0086_add_price_override_fields.sql**
   - Adds price override fields to `org_order_items_dtl`
   - Adds tax rate field to `org_orders_mst`

### Running Migrations

```bash
# Using Supabase CLI
supabase migration up

# Or apply manually via Supabase MCP
# Migrations are in supabase/migrations/
```

### Post-Migration Steps

1. **Configure Tax Rate**
   - Navigate to Settings > Finance
   - Set tax rate (default: 0.05 for 5%)
   - Select tax type (VAT, Sales Tax, GST, etc.)

2. **Create Price Lists**
   - Navigate to Catalog > Pricing
   - Create price lists for each type (standard, express, B2B, VIP)
   - Add products to price lists

3. **Set Permissions**
   - Grant `pricing:override` permission to authorized users
   - This allows manual price overrides in orders

## Integration Guide

### Using PricingService

```typescript
import { PricingService } from '@/lib/services/pricing.service'

// Get price for an order item
const priceResult = await PricingService.getPriceForOrderItem({
  tenantId: 'uuid',
  productId: 'uuid',
  quantity: 5,
  priceListType: 'standard',
  customerId: 'uuid',
  express: false,
})

// Calculate order totals
const totals = await PricingService.calculateOrderTotals({
  tenantId: 'uuid',
  items: [
    { productId: 'uuid', quantity: 5 },
    { productId: 'uuid', quantity: 3 },
  ],
  customerId: 'uuid',
  express: false,
})
```

### Using TaxService

```typescript
import { TaxService } from '@/lib/services/tax.service'

// Get tax rate
const taxRate = await TaxService.getTaxRate('tenant-uuid')

// Calculate tax
const taxAmount = TaxService.calculateTax(100.00, taxRate)

// Check if tax exempt
const isExempt = await TaxService.isTaxExempt('tenant-uuid', 'product-uuid')
```

### Order Creation Integration

The pricing system is automatically integrated into the order creation flow:

1. **Item Addition**
   - When items are added, prices are calculated using `PricingService`
   - Price list type is determined based on customer and order settings

2. **Price Override**
   - Users with `pricing:override` permission can override prices
   - Override requires a reason (minimum 10 characters)
   - Override is logged in audit trail

3. **Order Totals**
   - Subtotal, tax, discount, and total are calculated automatically
   - Breakdown is displayed in `PricingBreakdown` component

### Price History Integration

```typescript
// Fetch price history
const response = await fetch('/api/v1/pricing/history?' + new URLSearchParams({
  priceListId: 'uuid',
  fromDate: '2026-01-01',
  toDate: '2026-01-31',
}))

const { data, pagination } = await response.json()
```

## Usage Examples

### Creating a Price List

```typescript
// 1. Create price list
const priceList = await fetch('/api/v1/price-lists', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'VIP Pricing',
    name2: 'تسعير VIP',
    priceListType: 'vip',
    priority: 1,
    effectiveFrom: '2026-01-01',
  }),
})

// 2. Add items
const item = await fetch(`/api/v1/price-lists/${priceListId}/items`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    productId: 'uuid',
    price: 4.500,
    discountPercent: 15.0,
    minQuantity: 1,
  }),
})
```

### Bulk Import

```typescript
// 1. Download template
const template = await fetch('/api/v1/pricing/template')
const blob = await template.blob()
// Save blob to file

// 2. Fill template with data
// 3. Upload CSV
const formData = new FormData()
formData.append('file', csvFile)
formData.append('priceListId', priceListId)

const result = await fetch('/api/v1/pricing/import', {
  method: 'POST',
  body: formData,
})
```

### Price Override in Order

```typescript
// In order creation flow
const handlePriceOverride = (itemId: string) => {
  // Open price override modal
  state.openPriceOverrideModal(itemId)
}

// Modal saves override
const handleSave = async (override: { price: number; reason: string }) => {
  state.updateItemPriceOverride(
    itemId,
    override.price,
    override.reason,
    userId
  )
}
```

## Troubleshooting

### Common Issues

#### 1. Prices Not Calculating

**Symptoms:** Items show 0.000 or incorrect prices

**Solutions:**
- Check if price list is active and within effective date range
- Verify product has default price in `org_product_data_mst`
- Check price list type matches order settings
- Ensure quantity falls within tier range

#### 2. Tax Not Applied

**Symptoms:** Tax amount is 0 or missing

**Solutions:**
- Verify `TAX_RATE` setting exists in `sys_tenant_settings_cd`
- Check tenant has tax rate configured in `org_tenant_settings_cf`
- Ensure tax rate is between 0 and 1 (e.g., 0.05 for 5%)

#### 3. Price Override Not Working

**Symptoms:** Override modal doesn't open or save fails

**Solutions:**
- Verify user has `pricing:override` permission
- Check reason field is at least 10 characters
- Ensure price is valid number >= 0
- Check user ID is available in auth context

#### 4. Price History Not Showing

**Symptoms:** History timeline is empty

**Solutions:**
- Verify triggers are active on `org_price_list_items_dtl`
- Check `org_price_history_audit` table has data
- Ensure RLS policies allow access
- Verify date filters are correct

### Debug Queries

```sql
-- Check price list status
SELECT id, name, price_list_type, is_active, effective_from, effective_to
FROM org_price_lists_mst
WHERE tenant_org_id = 'your-tenant-id';

-- Check price list items
SELECT pli.*, pl.name as price_list_name
FROM org_price_list_items_dtl pli
JOIN org_price_lists_mst pl ON pli.price_list_id = pl.id
WHERE pli.tenant_org_id = 'your-tenant-id'
  AND pli.product_id = 'product-id';

-- Check tax rate setting
SELECT * FROM org_tenant_settings_cf
WHERE tenant_org_id = 'your-tenant-id'
  AND setting_code = 'TAX_RATE';

-- Check price history
SELECT * FROM org_price_history_audit
WHERE tenant_org_id = 'your-tenant-id'
ORDER BY created_at DESC
LIMIT 10;
```

## Additional Resources

- [Pricing Feature Implementation Plan](../plan/pricing_feature_implementation_plan.md)
- [Database Conventions](../../.claude/docs/database_conventions.md)
- [Frontend Standards](../../.claude/docs/frontend_standards.md)
- [API Documentation](../../api/README.md)

