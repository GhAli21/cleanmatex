# Catalog & Service Management Implementation Plan

## Overview

Implement service catalog management per PRD-007 including service categories, product/service items, multi-level pricing, and bulk operations with CSV import/export.

## Database Changes

### Phase 1: Price List Tables

Create new migration `0014_catalog_pricing_tables.sql`:

**New Tables:**

- `org_price_lists_mst` - Price list headers (standard, express, VIP, seasonal)
- `org_price_list_items_dtl` - Price list line items linking to products

**Key Features:**

- Composite foreign keys for tenant isolation
- Date-based effective periods (effective_from/effective_to)
- Support for multiple pricing strategies
- Audit fields and RLS policies

**Existing Tables Used:**

- `sys_service_category_cd` (global categories)
- `org_service_category_cf` (tenant enablement)
- `org_product_data_mst` (products with default prices)

## TypeScript Types

### Phase 2: Type Definitions

Create `web-admin/lib/types/catalog.ts`:

**Types to Define:**

- `ServiceCategory` - Category with bilingual names
- `Product` - Full product with pricing and metadata
- `ProductCreateRequest` / `ProductUpdateRequest`
- `PriceList` - Price list header
- `PriceListItem` - Individual price entries
- `ProductSearchParams` - Search/filter parameters
- `BulkImportResult` - Import validation results
- `CSVTemplate` - Template types (basic/advanced)

## Backend Services

### Phase 3: Service Layer

Create `web-admin/lib/services/catalog.service.ts`:

**Functions:**

- `getServiceCategories()` - List available categories
- `enableCategories(codes[])` - Enable categories for tenant
- `createProduct(data)` - Create new product
- `updateProduct(id, data)` - Update product
- `deleteProduct(id)` - Soft delete product
- `searchProducts(params)` - Search with filters
- `getProductById(id)` - Get single product
- `createPriceList(data)` - Create price list
- `updatePriceList(id, data)` - Update price list
- `getPriceLists()` - List price lists
- `bulkImportProducts(csv, template)` - Import from CSV
- `exportProducts(template)` - Export to CSV
- `validateProductData(data)` - Validation logic

**Key Patterns:**

- Always filter by `tenant_org_id`
- Use Supabase client from server context
- Implement proper error handling
- Return typed responses

### Phase 4: API Routes

Create Next.js API routes in `web-admin/app/api/v1/`:

**Categories:**

- `GET /api/v1/categories` - List categories
- `POST /api/v1/categories/enable` - Enable categories

**Products:**

- `GET /api/v1/products` - List products (search, filter, paginate)
- `POST /api/v1/products` - Create product
- `GET /api/v1/products/:id` - Get product details
- `PATCH /api/v1/products/:id` - Update product
- `DELETE /api/v1/products/:id` - Soft delete product
- `POST /api/v1/products/import` - Bulk import CSV
- `GET /api/v1/products/export` - Export CSV

**Pricing:**

- `GET /api/v1/price-lists` - List price lists
- `POST /api/v1/price-lists` - Create price list
- `PATCH /api/v1/price-lists/:id` - Update price list
- `DELETE /api/v1/price-lists/:id` - Delete price list

**Implementation Notes:**

- Follow existing pattern from `customers/route.ts`
- Use `getAuthContext()` helper for tenant verification
- Validate all inputs with Zod schemas
- Return consistent response format

## Frontend UI

### Phase 5: Category Management UI

Create `web-admin/app/dashboard/catalog/categories/page.tsx`:

**Features:**

- Display global categories from `sys_service_category_cd`
- Toggle switches to enable/disable per tenant
- Bilingual display (EN/AR)
- Save changes with loading states
- Success/error notifications

### Phase 6: Product Management UI

Create pages in `web-admin/app/dashboard/catalog/services/`:

**Main List Page (`page.tsx`):**

- Product table with columns: code, name, category, price, status
- Search bar (by code, name)
- Filters: category, status (active/inactive)
- Sort options
- Pagination
- Action buttons: New Product, Import, Export

**Product Form (`components/product-form.tsx`):**

- Bilingual name inputs (name/name2)
- Category selection dropdown
- Product code (auto-generate option)
- Price inputs: regular, express
- Unit type selection (piece/kg)
- Min/max quantity
- Turnaround time fields
- Active/inactive toggle
- Save/Cancel buttons
- Validation with error messages

**Product Detail/Edit (`[id]/page.tsx`):**

- Reuse product form component
- Pre-populate with existing data
- Show audit info (created/updated)

### Phase 7: Pricing Management UI

Create `web-admin/app/dashboard/catalog/pricing/page.tsx`:

**Features:**

- List price lists (name, type, effective dates, status)
- Create new price list modal
- Price list types: Standard, Express, VIP, Seasonal
- Date range picker for effective periods
- Price list items editor (product selector + price input)
- Bulk price update wizard
- Apply price list to products

### Phase 8: Bulk Operations UI

Create `web-admin/app/dashboard/catalog/services/components/`:

**Import Modal (`import-modal.tsx`):**

- Template selector (Basic/Advanced)
- Download template button
- File upload dropzone
- Validation preview table
- Error display with line numbers
- Confirm import button

**Export Modal (`export-modal.tsx`):**

- Template selector (Basic/Advanced)
- Filter options (category, status)
- Export format (CSV)
- Download button

**CSV Templates:**

*Basic Template:*

```csv
product_code,product_name,product_name_ar,category_code,price,unit
```

*Advanced Template:*

```csv
product_code,product_name,product_name_ar,category_code,price_regular,price_express,unit,min_qty,turnaround_hh,turnaround_hh_express,is_active
```

## Internationalization

### Phase 9: Translation Keys

Add to `web-admin/messages/en.json` and `ar.json`:

**Keys:**

```json
{
  "catalog": {
    "title": "Catalog & Pricing",
    "categories": "Service Categories",
    "products": "Products & Services",
    "pricing": "Price Lists",
    "newProduct": "New Product",
    "editProduct": "Edit Product",
    "productCode": "Product Code",
    "productName": "Product Name",
    "category": "Category",
    "price": "Price",
    "priceRegular": "Regular Price",
    "priceExpress": "Express Price",
    "unit": "Unit",
    "unitPiece": "Per Piece",
    "unitKg": "Per Kg",
    "turnaround": "Turnaround Time",
    "turnaroundHours": "Hours",
    "minQuantity": "Min Quantity",
    "maxQuantity": "Max Quantity",
    "import": "Import Products",
    "export": "Export Products",
    "downloadTemplate": "Download Template",
    "basicTemplate": "Basic Template",
    "advancedTemplate": "Advanced Template",
    "uploadFile": "Upload CSV File",
    "validationErrors": "Validation Errors",
    "importSuccess": "Products imported successfully",
    "priceList": "Price List",
    "priceListType": "Type",
    "effectiveFrom": "Effective From",
    "effectiveTo": "Effective To",
    "seasonal": "Seasonal",
    "vip": "VIP",
    "standard": "Standard",
    "express": "Express"
  }
}
```

## Testing

### Phase 10: Unit Tests

Create tests in `web-admin/__tests__/`:

**Service Tests (`services/catalog.service.test.ts`):**

- Test product CRUD operations
- Test category enablement
- Test price list creation
- Test CSV import validation
- Test tenant isolation

**API Tests (`api/catalog.test.ts`):**

- Test all API endpoints
- Test authentication
- Test validation errors
- Test pagination

### Phase 11: Integration Tests

Create E2E tests in `web-admin/e2e/`:

**Catalog Flow (`catalog.spec.ts`):**

- Enable service categories
- Create products
- Edit products
- Import products from CSV
- Export products
- Create price lists
- Apply pricing

## Migration & Seeding

### Phase 12: Data Migration

Update seed files to include:

- Sample products for demo tenants
- Default price lists
- Category enablement for demo tenants

## Documentation

### Phase 13: Update Documentation

Update files:

- `docs/plan_cr/007_catalog_service_management_dev_prd.md` - Mark as implemented
- Add API documentation with examples
- Update navigation documentation

## Success Criteria

- All CRUD operations functional for products
- Category management working
- Multi-level pricing supported (regular, express, VIP, seasonal)
- CSV import/export with both templates working
- Validation comprehensive with clear error messages
- UI responsive and bilingual
- All tests passing
- Performance targets met:
  - Product load time < 1s for 1000 products
  - Import speed > 100 products/second
  - Search response < 300ms

## Implementation Order

1. Database migration (price tables)
2. TypeScript types
3. Service layer functions
4. API routes
5. Category management UI
6. Product list UI
7. Product form UI
8. Pricing management UI
9. Bulk import/export UI
10. Translations
11. Unit tests
12. Integration tests
13. Documentation updates