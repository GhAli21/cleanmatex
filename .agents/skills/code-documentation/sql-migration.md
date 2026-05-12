# SQL Migration Comment Rules

Every migration file must follow these comment standards. Comments explain WHY, not WHAT.

---

## File-Level Header (Required at Top of Every Migration)

```sql
-- ============================================================
-- Migration: 0171_order_color_preferences.sql
-- Purpose:   Add colour preference columns to org_order_prefs_dtl
--            to support per-piece colour selection in new orders
-- Affected:  org_order_prefs_dtl
-- Related:   0165 (initial preferences schema)
-- ============================================================
```

Fields:
- **Migration**: the filename (helps when reading raw SQL without file context)
- **Purpose**: one or two sentences — the business reason for the change
- **Affected**: comma-separated list of tables/functions/views changed
- **Related**: prior migrations this depends on or extends (if any)

---

## CREATE TABLE Comment (Required)

```sql
-- Stores per-item laundry preferences (conditions, colours, care instructions).
-- One row per item per order. Tenant-scoped; RLS prevents cross-tenant reads.
-- Soft-delete via rec_status — never hard-delete preference history.
CREATE TABLE org_order_prefs_dtl (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id   UUID NOT NULL,
  order_id        UUID NOT NULL,
  item_id         UUID NOT NULL,
  pref_weight     DECIMAL(19,4),   -- Expected weight in kg; NULL if not yet measured
  rec_status      SMALLINT DEFAULT 1,  -- 1=active, 0=soft-deleted (never hard-delete)
  color_code      VARCHAR(30),     -- References sys_colors_cd.code; NULL = no preference
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
```

**Inline column comments — when required:**
- Non-obvious columns: explain allowed values, units, or foreign key target
- `rec_status`: always note "1=active, 0=soft-deleted"
- Money/weight fields: always note units (kg, SAR, etc.)

**Skip inline comments for:** `id`, `tenant_org_id`, `created_at/_by/_info`, `updated_at/_by/_info`, `name`, `name2` — these are project-standard, no explanation needed.

---

## CREATE INDEX Comment (Required)

Every index must have a comment explaining the query pattern it supports:

```sql
-- Supports tenant-scoped list queries in order preference screens
CREATE INDEX idx_ord_prefs_dtl_tenant ON org_order_prefs_dtl(tenant_org_id);

-- Prevents N+1 when loading all preferences for an order within a tenant
CREATE INDEX idx_ord_prefs_dtl_tenant_ord ON org_order_prefs_dtl(tenant_org_id, order_id);

-- Speeds up item-level preference lookup when rendering per-piece order detail
CREATE INDEX idx_ord_prefs_dtl_tenant_item ON org_order_prefs_dtl(tenant_org_id, item_id);
```

---

## RLS Policy Comment (Required)

```sql
-- Standard CleanMateX tenant isolation: allow all operations only when JWT tenant matches row.
-- Bypassed only by the service-role key used in server actions (never by client code).
CREATE POLICY tenant_isolation ON org_order_prefs_dtl
  FOR ALL
  USING (tenant_org_id::text = (auth.jwt() ->> 'tenant_org_id'));
```

---

## ALTER TABLE Comment

```sql
-- Add colour preference support — required for per-piece colour selection (phase 2 of preferences feature)
ALTER TABLE org_order_prefs_dtl
  ADD COLUMN color_code VARCHAR(30);  -- References sys_colors_cd.code; NULL = no preference set
```

---

## DROP ... CASCADE Comment (Required)

Before any CASCADE drop, list what will be removed and what will be recreated:

```sql
-- DROP CASCADE also removes:
--   - tenant_isolation policy on org_order_prefs_dtl
--   - idx_ord_prefs_dtl_tenant index
-- Both are recreated below after the function update.
DROP FUNCTION IF EXISTS resolve_pref_value(uuid, uuid) CASCADE;

-- Recreate policy removed by CASCADE above
CREATE POLICY tenant_isolation ON org_order_prefs_dtl ...;

-- Recreate index removed by CASCADE above
CREATE INDEX idx_ord_prefs_dtl_tenant ON ...;
```

---

## CREATE FUNCTION Comment

```sql
-- Resolves the effective preference value for an order item, falling back to tenant defaults.
-- Returns NULL if no preference is set at either level.
-- Called by the order detail query to avoid N+1 preference lookups.
CREATE OR REPLACE FUNCTION resolve_pref_value(
  p_tenant_org_id UUID,
  p_order_item_id UUID
) RETURNS TEXT AS $$
```

---

## Rollback Comment (Optional but Recommended for Destructive Migrations)

```sql
-- ROLLBACK PLAN:
-- ALTER TABLE org_order_prefs_dtl DROP COLUMN IF EXISTS color_code;
-- (Safe to run if deployment fails — column has no downstream FK dependencies)
```

---

## What NOT to Comment

Skip comments for:
- `BEGIN; ... COMMIT;` — standard transaction wrapper, no comment needed
- `SET statement_timeout = '30s';` — standard guard, no comment needed
- Standard audit field additions (`created_at`, `updated_at`) — project-standard, obvious
- `DEFAULT gen_random_uuid()` on `id` columns — project-standard
