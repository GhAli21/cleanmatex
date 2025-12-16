# Database Conventions Rules

## Overview
Naming conventions, field patterns, and database design standards.

## Rules

### Naming Patterns
- Table suffixes:
  - `*_mst` - Master tables (main entities)
  - `*_dtl` - Detail tables (line items, related records)
  - `*_tr` - Transaction tables
  - `*_cd` - Code/lookup tables
  - `*_cf` - Configuration tables
- Table prefixes:
  - `sys_*` - System/global tables (no tenant_org_id)
  - `org_*` - Organization/tenant tables (requires tenant_org_id)

### Standard Fields
- Audit fields (ALWAYS include):
  - `created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP`
  - `created_by VARCHAR(120)`
  - `created_info TEXT`
  - `updated_at TIMESTAMP`
  - `updated_by VARCHAR(120)`
  - `updated_info TEXT`
  - `rec_status SMALLINT DEFAULT 1`
  - `rec_order INTEGER`
  - `rec_notes VARCHAR(200)`
  - `is_active BOOLEAN NOT NULL DEFAULT true`

### Bilingual Support Pattern
- Use `name` and `name2` for English and Arabic names
- Use `description` and `description2` for English and Arabic descriptions
- Always include both fields for user-facing text

### Branding & UI Metadata
- Use `{entity}_color1`, `{entity}_color2`, `{entity}_color3` for colors
- Use `{entity}_icon` for icon references
- Use `{entity}_image` for image URLs/paths

### Composite Foreign Keys
- Use composite foreign keys for tenant isolation: `(tenant_org_id, entity_id)`
- Enforces tenant boundaries at database level
- Prevents accidental cross-tenant references
- Complements RLS policies

### Indexes
- Always add indexes on `tenant_org_id`
- Add composite indexes: `(tenant_org_id, rec_status)`
- Add full-text search GIN indexes on name fields
- Add date indexes: `(tenant_org_id, created_at DESC)`

## Conventions
- Always include audit fields in new tables
- Always enable RLS on org_* tables
- Always use composite foreign keys for tenant-scoped relationships
- Always add appropriate indexes for query performance
