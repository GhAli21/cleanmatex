---
name: Service Category Processing Steps Configuration
overview: Make processing steps configurable per service category with system defaults and tenant overrides. Tables max 30 chars, include color/icon columns, use migration 0082, and seed all specified service categories including CARPET, CURTAIN, and LEATHER.
todos:
  - id: create_migration_0082
    content: Create migration 0082_svc_cat_proc_steps.sql with sys_svc_cat_proc_steps and org_svc_cat_proc_steps_cf tables (max 30 chars), include color/icon columns, seed all service categories (LAUNDRY, DRY_CLEAN, IRON_ONLY, WASH_AND_IRON, REPAIRS, ALTERATION, CARPET, CURTAIN, LEATHER)
    status: completed
  - id: update_constraints
    content: Update org_order_item_processing_steps table to remove/relax hardcoded CHECK constraint for step_code to allow dynamic steps
    status: completed
    dependencies:
      - create_migration_0082
  - id: create_api_service
    content: Create processing-steps-service.ts with getProcessingStepsForCategory() that checks tenant override first, then falls back to system defaults, returns steps with color/icon
    status: completed
    dependencies:
      - create_migration_0082
  - id: create_api_endpoint
    content: Create API endpoint /api/v1/processing-steps/[category]/route.ts that uses the service to return configured steps with inheritance logic
    status: completed
    dependencies:
      - create_api_service
  - id: update_processing_components
    content: Update processing-piece-row.tsx and processing-modal.tsx to load steps dynamically from API instead of hardcoded array, display color/icon for each step
    status: completed
    dependencies:
      - create_api_endpoint
  - id: update_validation
    content: Update item-processing-service.ts validation to check steps against service category configuration (tenant override → system default) instead of hardcoded list
    status: completed
    dependencies:
      - create_api_service
  - id: update_types
    content: Update TypeScript ProcessingStep type to include color and icon fields
    status: completed
    dependencies:
      - update_processing_components
  - id: test_implementation
    content: Test with different service categories (LAUNDRY, IRON_ONLY, CARPET, etc.) to ensure correct steps are displayed with colors/icons and validated properly
    status: completed
    dependencies:
      - update_validation
      - update_processing_components
---

# Service Category Processing Steps Configuration

## Problem

Currently, all service categories use the same hardcoded processing steps: `['sorting', 'pretreatment', 'washing', 'drying', 'finishing']`. Different service categories need different steps (e.g., IRON_ONLY doesn't need washing/drying).

## Solution Architecture

### Database Schema Changes

1. **Create system-level step configuration table** (`sys_svc_cat_proc_steps`)

- Table name: `sys_svc_cat_proc_steps` (30 chars)
- Links service categories to processing steps
- Defines step sequence/order per category
- Stores global defaults
- Includes color and icon columns per step

2. **Create tenant override table** (`org_svc_cat_proc_steps_cf`)

- Table name: `org_svc_cat_proc_steps_cf` (30 chars)
- Allows tenants to customize steps per category
- **Inheritance logic**: If no data in tenant table, use system defaults
- Includes color and icon columns for tenant customization

3. **Update processing steps table constraint**

- Remove or relax hardcoded CHECK constraint in `org_order_item_processing_steps`
- Validate steps dynamically based on service category

4. **Seed default configurations**

- LAUNDRY: sorting, pretreatment, washing, drying, finishing
- DRY_CLEAN: sorting, pretreatment, dry_cleaning, finishing
- IRON_ONLY: sorting, finishing
- WASH_AND_IRON: sorting, pretreatment, washing, drying, finishing
- REPAIRS: sorting, finishing
- ALTERATION: sorting, finishing
- CARPET: sorting, pretreatment, deep_cleaning, drying, finishing
- CURTAIN: sorting, pretreatment, dry_cleaning, finishing
- LEATHER: sorting, pretreatment, leather_cleaning, conditioning, finishing

### Table Structure

**sys_svc_cat_proc_steps** (System defaults):

- `id` UUID PRIMARY KEY
- `service_category_code` VARCHAR(120) NOT NULL
- `step_code` VARCHAR(50) NOT NULL
- `step_seq` INTEGER NOT NULL
- `step_name` VARCHAR(250) NOT NULL
- `step_name2` VARCHAR(250) (Arabic)
- `step_color` VARCHAR(60) (Hex color)
- `step_icon` VARCHAR(120) (Icon name)
- `is_active` BOOLEAN DEFAULT true
- `display_order` INTEGER
- Audit fields (created_at, updated_at, etc.)
- UNIQUE(service_category_code, step_code)

**org_svc_cat_proc_steps_cf** (Tenant overrides):

- `id` UUID PRIMARY KEY
- `tenant_org_id` UUID NOT NULL
- `service_category_code` VARCHAR(120) NOT NULL
- `step_code` VARCHAR(50) NOT NULL
- `step_seq` INTEGER NOT NULL
- `step_name` VARCHAR(250) NOT NULL
- `step_name2` VARCHAR(250) (Arabic)
- `step_color` VARCHAR(60) (Hex color)
- `step_icon` VARCHAR(120) (Icon name)
- `is_active` BOOLEAN DEFAULT true
- `display_order` INTEGER
- Audit fields
- UNIQUE(tenant_org_id, service_category_code, step_code)
- Composite FK to `org_service_category_cf`

**Important**: Both `sys_svc_cat_proc_steps` and `org_svc_cat_proc_steps_cf` tables include `step_color` and `step_icon` columns. This allows:

- System defaults to have default colors/icons for each step
- Tenants to override colors/icons per step in their custom configurations
- UI to display steps with appropriate visual styling

### Frontend Changes

1. **Update processing components** to dynamically load steps:

- `processing-piece-row.tsx` - Remove hardcoded `PROCESSING_STEPS` array
- `processing-modal.tsx` - Load steps from API based on service category
- `item-processing-service.ts` - Update validation to use dynamic steps

2. **Create API endpoint** to fetch processing steps for a service category

- Endpoint: `/api/v1/processing-steps/[category]`
- Logic: Check tenant override first, fall back to system defaults

3. **Update TypeScript types** to support dynamic step arrays with color/icon

### Backend Changes

1. **Update validation logic** in `item-processing-service.ts`

- Replace hardcoded step validation with dynamic lookup
- Validate against service category's configured steps

2. **Create service function** to get processing steps for a service category

- Function: `getProcessingStepsForCategory(tenantId, categoryCode)`
- Check tenant overrides first (`org_svc_cat_proc_steps_cf`)
- Fall back to system defaults (`sys_svc_cat_proc_steps`)
- Return steps with color and icon information

## Implementation Files

### Database Migrations

- `supabase/migrations/0082_svc_cat_proc_steps.sql` - New migration for step configuration tables (following sequence 0081)
- Update `org_order_item_processing_steps` CHECK constraint if needed

### Frontend Files

- `web-admin/app/dashboard/processing/components/processing-piece-row.tsx` - Remove hardcoded steps, load dynamically
- `web-admin/app/dashboard/processing/components/processing-modal.tsx` - Load steps dynamically with color/icon
- `web-admin/lib/services/item-processing-service.ts` - Update validation
- `web-admin/lib/services/processing-steps-service.ts` - New service for fetching steps (tenant override → system default)
- `web-admin/types/order.ts` - Update ProcessingStep type to include color/icon
- `web-admin/app/api/v1/processing-steps/[category]/route.ts` - New API endpoint

### Backend/API

- `web-admin/app/api/v1/processing-steps/[category]/route.ts` - Get steps for category with inheritance logic

## Default Step Configurations

Based on common laundry operations:

- **LAUNDRY**: sorting → pretreatment → washing → drying → finishing
- **DRY_CLEAN**: sorting → pretreatment → dry_cleaning → finishing
- **IRON_ONLY**: sorting → finishing
- **WASH_AND_IRON**: sorting → pretreatment → washing → drying → finishing
- **REPAIRS**: sorting → finishing
- **ALTERATION**: sorting → finishing
- **CARPET**: sorting → pretreatment → deep_cleaning → drying → finishing
- **CURTAIN**: sorting → pretreatment → dry_cleaning → finishing
- **LEATHER**: sorting → pretreatment → leather_cleaning → conditioning → finishing

## Data Flow

```javascript
Order Item (with service_category_code)
    ↓
Get Processing Steps
    ├─ Check org_svc_cat_proc_steps_cf (tenant override)
    └─ If not found → Check sys_svc_cat_proc_steps (system default)
    ↓
Display Steps in UI (with color/icon)
    ↓
Validate Step Completion (against configured steps)
    ↓
Record Step in org_order_item_processing_steps
```



## Migration Strategy

1. Create new tables with system defaults (migration 0082)
2. Seed all service categories with their default step configurations
3. Migrate existing data: assume all existing items use full 5-step process
4. Update frontend to use dynamic steps with color/icon support
5. Update validation logic
6. Test with different service categories

## Key Features

- **Table names ≤ 30 characters**: `sys_svc_cat_proc_steps`, `org_svc_cat_proc_steps_cf`
- **Color and icon columns**: Each step can have custom color and icon
- **Inheritance**: Tenant table inherits from system table if no override exists