---
name: update-rbac-role
description: Create or update RBAC roles with intelligently suggested permissions. Use when adding a new role (cashier, driver, accountant, QA inspector, etc.) or refreshing permissions on an existing role. Generates the DB migration and flags the navigation.ts UserRole type update.
user-invocable: true
---

# RBAC Role Create / Update Skill

**Use this skill when:**
- Creating a new system or custom role ("add a cashier role", "create a QA inspector role")
- Refreshing permissions on an existing role ("refresh cashier permissions", "what should the driver role have?")
- Auditing what a role currently has vs. what it should have
- Generating the migration SQL for any role change

---

## Quick Reference — Tables Involved

| Table | Purpose |
|---|---|
| `sys_auth_roles` | Role registry (code, name, is_system) |
| `sys_auth_permissions` | All permission codes in the system |
| `sys_auth_role_default_permissions` | Mapping of role → permissions |

**Key constraint:** `sys_auth_role_default_permissions` uses `role_code` + `permission_code` (text FKs). Do **NOT** include `role_id` / `permission_id` UUID columns in new migrations — they are not populated by the canonical migration pattern.

**Canonical INSERT pattern (always use):**
```sql
INSERT INTO public.sys_auth_role_default_permissions (
  role_code, permission_code, is_enabled, is_active, rec_status, created_at, created_by
)
SELECT r.code, p.code, true, true, 1, CURRENT_TIMESTAMP, 'system_admin'
FROM public.sys_auth_roles r
CROSS JOIN public.sys_auth_permissions p
WHERE r.code IN ('role_code')
  AND p.code IN ('perm:code', ...)
  AND NOT EXISTS (
    SELECT 1 FROM public.sys_auth_role_default_permissions e
    WHERE e.role_code = r.code AND e.permission_code = p.code
  );
```

---

## Skill Modes

Detect mode from the user's request:

| Signal | Mode |
|---|---|
| "create a X role", "add a X role", "new role for X" | **CREATE** |
| "refresh X role", "update X role permissions", "what should X have" | **REFRESH** |
| "what permissions does X have", "show me X role" | **QUERY** |

---

## Step 1 — Classify the Role

Match the requested role to an archetype from the library below. If no match, use the **custom role** path and reason from the role description.

---

## Role Archetype Library

### Front-Desk / Reception

**`cashier`** — Payment collection & order intake  
`is_system: false` · Arabic: كاشير

**Core permissions:**
```
orders:create, orders:read, orders:update, orders:print, orders:notes,
orders:history, orders:transition, orders:cancel, orders:urgent,
orders:collect_payment, orders:view_financial_breakdown,
customers:create, customers:read, customers:history, customers:tags,
payments:create, payments:read,
invoices:create, invoices:read, invoices:print,
cash_drawer:view, cash_drawer:open_session, cash_drawer:close_session, cash_drawer:record_movement,
stored_value:view_balances, stored_value:view_ledger,
loyalty:view_customer_points,
promotions:view,
products:read,
pricing:read
```

---

**`receptionist`** — Order intake, customer service, no payments  
`is_system: false` · Arabic: موظف استقبال

```
orders:create, orders:read, orders:update, orders:print, orders:notes,
orders:history, orders:transition, orders:urgent,
customers:create, customers:read, customers:update, customers:history, customers:tags,
products:read, pricing:read,
invoices:read,
reports:view_operational, reports:dashboard
```

---

### Operations / Production

**`laundry_worker`** — Processing / washing floor worker  
`is_system: false` · Arabic: عامل مغسلة

```
orders:read, orders:transition, orders:notes, orders:history, orders:urgent
```

---

**`presser`** — Ironing / finishing worker  
`is_system: false` · Arabic: مكوي

```
orders:read, orders:transition, orders:notes, orders:history
```

---

**`qa_inspector`** — Quality assurance inspector  
`is_system: false` · Arabic: مفتش جودة

```
orders:read, orders:transition, orders:notes, orders:history, orders:urgent,
customers:read
```

---

**`store_keeper`** — Inventory / stock management only  
`is_system: false` · Arabic: أمين المستودع

```
products:read, products:stock, products:update,
orders:read
```

---

### Delivery / Field

**`driver`** — Pickup & delivery operations  
`is_system: false` · Arabic: سائق

```
orders:read, orders:notes, orders:history,
delivery:track, delivery:pod, delivery:assign,
customers:read
```

---

**`route_supervisor`** — Supervises drivers and routes  
`is_system: false` · Arabic: مشرف التوصيل

```
orders:read, orders:history,
delivery:assign, delivery:track, delivery:routes, delivery:pod,
drivers:read, drivers:update,
customers:read,
reports:view_operational, reports:dashboard
```

---

### Finance / Accounting

**`accountant`** — Financial reporting, invoices, reconciliation  
`is_system: false` · Arabic: محاسب

```
invoices:read, invoices:print, invoices:export,
payments:read, payments:reconcile, payments:export,
cash_drawer:view, cash_drawer:view_reports,
finance_reports:view, finance_reports:export,
reports:view_financial, reports:export,
reconciliation:view,
stored_value:view_balances, stored_value:view_ledger,
tax:view_reports, tax:view_config,
audit:read
```

---

**`finance_manager`** — Full financial operations + approvals  
`is_system: false` · Arabic: مدير مالي

```
invoices:create, invoices:read, invoices:update, invoices:void, invoices:send, invoices:print, invoices:export,
payments:create, payments:read, payments:refund, payments:reconcile, payments:export,
orders:view_financial_breakdown, orders:process_refund, orders:approve_refund, orders:collect_payment,
cash_drawer:view, cash_drawer:open_session, cash_drawer:close_session, cash_drawer:record_movement, cash_drawer:view_reports,
stored_value:view_balances, stored_value:view_ledger, stored_value:top_up_wallet, stored_value:issue_advance, stored_value:issue_credit_note,
loyalty:view_customer_points,
gift_cards:view_ledger,
tax:view_config, tax:view_reports,
reconciliation:view, reconciliation:run, reconciliation:acknowledge_issues,
payment_config:view,
finance_reports:view, finance_reports:export,
reports:view_financial, reports:export,
audit:read
```

---

### Management

**`admin`** — Mid-level admin (above branch_manager, below tenant_admin)  
`is_system: true` · Arabic: مدير

```
-- Everything branch_manager has, PLUS:
users:create, users:read, users:update, users:activate, users:assign_roles,
roles:create, roles:update,
settings:read, settings:update, settings:workflow, settings:notifications, settings:branding,
integrations:read,
audit:read, audit:export,
branches:create, branches:read, branches:update, branches:settings,
products:create, products:read, products:update, products:publish,
pricing:create, pricing:read, pricing:update, pricing:history,
promotions:create, promotions:edit, promotions:view, promotions:activate_deactivate,
loyalty:manage_config, loyalty:view_config, loyalty:view_customer_points,
tax:view_config, tax:view_reports,
payment_config:view
```

**Note:** `admin` already exists in navigation.ts `UserRole` — check if it exists in `sys_auth_roles` before inserting.

---

**`supervisor`** — Floor supervisor, no admin functions  
`is_system: false` · Arabic: مشرف

```
orders:create, orders:read, orders:update, orders:cancel, orders:assign,
orders:transition, orders:notes, orders:history, orders:urgent, orders:print, orders:discount,
customers:create, customers:read, customers:update, customers:history, customers:tags,
products:read, pricing:read,
invoices:read, invoices:print,
payments:read,
reports:view_operational, reports:view_customer, reports:dashboard,
drivers:read, delivery:track, delivery:assign,
branches:read
```

---

**`branch_manager`** — Existing system role (already seeded in 0035).  
Use this archetype only when **refreshing** the role with new permissions.  
`is_system: true` · Arabic: مدير الفرع

See migration 0035 for the baseline. When refreshing, focus on financial platform permissions from 0294 that may not have been applied to this role.

---

### Customer / B2B

**`b2b_customer`** — B2B corporate customer portal access  
`is_system: false` · Arabic: عميل أعمال

```
orders:read, orders:history, orders:print,
invoices:read, invoices:print,
payments:read,
reports:view_customer,
customers:read
```

---

### IT / Technical

**`it_support`** — Internal technical support  
`is_system: false` · Arabic: دعم تقني

```
users:read, users:activate, users:reset_password,
settings:read,
integrations:read, integrations:test, integrations:logs,
audit:read, logs:view,
branches:read
```

---

## Step 2 — Gather Information

For **CREATE** mode, confirm with the user:
1. **Role code** — propose based on archetype name (e.g., `cashier`, `qa_inspector`). Must be lowercase + underscores only.
2. **Role label EN/AR** — propose from archetype, let user correct.
3. **Description EN/AR** — brief description of role purpose.
4. **is_system** — `true` for platform-standard roles, `false` for tenant-custom roles. Default: `false` for new roles, `true` for standard roles like `admin`.
5. **Permission set** — present the archetype's permissions as a checklist. Ask if any should be added or removed.

For **REFRESH** mode:
1. Look up or ask: what is the current role code?
2. Identify the archetype (or ask the user what the role is supposed to do).
3. Generate a diagnostic query (see Step 3 REFRESH path).

For **QUERY** mode:
- Provide the diagnostic query below and interpret results for the user.

---

## Step 3 — Diagnostic Queries (REFRESH / QUERY modes)

Run these to understand the current state:

```sql
-- What permissions does this role currently have?
SELECT p.code, p.name, p.category, p.category_main
FROM sys_auth_role_default_permissions rdp
JOIN sys_auth_permissions p ON p.code = rdp.permission_code
WHERE rdp.role_code = 'ROLE_CODE_HERE'
  AND rdp.is_active = true
ORDER BY p.category_main, p.code;

-- What permissions exist in the system but are NOT assigned to this role?
SELECT p.code, p.name, p.category, p.category_main
FROM sys_auth_permissions p
WHERE p.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM sys_auth_role_default_permissions rdp
    WHERE rdp.role_code = 'ROLE_CODE_HERE' AND rdp.permission_code = p.code
  )
ORDER BY p.category_main, p.code;

-- Does this role exist at all?
SELECT role_id, code, name, name2, is_system, is_active
FROM sys_auth_roles
WHERE code = 'ROLE_CODE_HERE';
```

For **REFRESH** mode: compare the diagnostic results with the archetype permission list. Report:
- ✅ Permissions already assigned (in both)  
- ➕ Permissions to ADD (in archetype, not in DB)  
- ⚠️ Permissions to REVIEW (in DB, not in archetype — present for user decision, don't auto-remove)

---

## Step 4 — Generate Migration SQL

### Finding the next migration sequence

```powershell
Get-ChildItem f:/jhapp/cleanmatex/supabase/migrations/ -Filter "*.sql" |
  Where-Object { $_.Name -match "^\d{4}_" } |
  Sort-Object Name | Select-Object -Last 3
```

Take the last number + 1. Format as 4-digit zero-padded: `0374`, `0375`, etc.

### Migration filename pattern

```
{seq}_rbac_role_{role_code}.sql           # CREATE new role
{seq}_rbac_role_{role_code}_refresh.sql   # REFRESH existing role permissions
```

---

### Migration template — CREATE new role

```sql
-- ============================================================
-- Migration {SEQ}: RBAC Role — {ROLE_NAME_EN}
-- Role code: {ROLE_CODE}
-- Purpose: {BRIEF_PURPOSE}
-- Archetype: {ARCHETYPE_NAME}
-- Created: {DATE}
-- ============================================================

BEGIN;

-- ── 1. Create role in sys_auth_roles ────────────────────────

INSERT INTO public.sys_auth_roles (
  code, name, name2, description, description2,
  is_system, is_active,
  created_at, created_by
) VALUES (
  '{ROLE_CODE}',
  '{ROLE_NAME_EN}',
  '{ROLE_NAME_AR}',
  '{ROLE_DESC_EN}',
  '{ROLE_DESC_AR}',
  {IS_SYSTEM},   -- true for platform-standard roles, false for tenant-custom
  true,
  CURRENT_TIMESTAMP,
  'system_admin'
) ON CONFLICT (code) DO NOTHING;

-- ── 2. Assign permissions to role ───────────────────────────

INSERT INTO public.sys_auth_role_default_permissions (
  role_code, permission_code, is_enabled, is_active, rec_status, created_at, created_by
)
SELECT r.code, p.code, true, true, 1, CURRENT_TIMESTAMP, 'system_admin'
FROM public.sys_auth_roles r
CROSS JOIN public.sys_auth_permissions p
WHERE r.code = '{ROLE_CODE}'
  AND p.code IN (
    -- Orders
    'orders:create',
    'orders:read',
    -- ... all permission codes for this role ...
    'promotions:view'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.sys_auth_role_default_permissions e
    WHERE e.role_code = r.code AND e.permission_code = p.code
  );

-- ── 3. Verification ─────────────────────────────────────────

DO $$
DECLARE
  v_role_exists BOOLEAN;
  v_perm_count  INTEGER;
BEGIN
  SELECT EXISTS(SELECT 1 FROM sys_auth_roles WHERE code = '{ROLE_CODE}')
  INTO v_role_exists;

  SELECT COUNT(*) INTO v_perm_count
  FROM sys_auth_role_default_permissions
  WHERE role_code = '{ROLE_CODE}' AND is_active = true;

  RAISE NOTICE '═══════════════════════════════════════';
  RAISE NOTICE '✅ RBAC Role Migration Complete';
  RAISE NOTICE 'Role: %', '{ROLE_CODE}';
  RAISE NOTICE 'Role exists: %', v_role_exists;
  RAISE NOTICE 'Permissions assigned: %', v_perm_count;
  RAISE NOTICE '═══════════════════════════════════════';

  IF NOT v_role_exists THEN
    RAISE EXCEPTION 'Role not created: {ROLE_CODE}';
  END IF;
END $$;

COMMIT;
```

---

### Migration template — REFRESH (add missing permissions to existing role)

```sql
-- ============================================================
-- Migration {SEQ}: RBAC Refresh — {ROLE_CODE} permissions
-- Purpose: Add missing permissions identified by archetype audit
-- Created: {DATE}
-- ============================================================

BEGIN;

-- Guard: role must exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM sys_auth_roles WHERE code = '{ROLE_CODE}') THEN
    RAISE EXCEPTION 'Role does not exist: {ROLE_CODE}. Create it first.';
  END IF;
END $$;

-- ── Add missing permissions ──────────────────────────────────

INSERT INTO public.sys_auth_role_default_permissions (
  role_code, permission_code, is_enabled, is_active, rec_status, created_at, created_by
)
SELECT r.code, p.code, true, true, 1, CURRENT_TIMESTAMP, 'system_admin'
FROM public.sys_auth_roles r
CROSS JOIN public.sys_auth_permissions p
WHERE r.code = '{ROLE_CODE}'
  AND p.code IN (
    -- Permissions being added in this refresh:
    'perm:code_1',
    'perm:code_2'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.sys_auth_role_default_permissions e
    WHERE e.role_code = r.code AND e.permission_code = p.code
  );

-- ── Verification ─────────────────────────────────────────────

DO $$
DECLARE
  v_perm_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_perm_count
  FROM sys_auth_role_default_permissions
  WHERE role_code = '{ROLE_CODE}' AND is_active = true;

  RAISE NOTICE '✅ {ROLE_CODE} now has % active permissions', v_perm_count;
END $$;

COMMIT;
```

---

## Step 5 — Update navigation.ts UserRole type

After creating a **new** role, update the `UserRole` union type in [web-admin/config/navigation.ts](web-admin/config/navigation.ts):

```ts
// Before
export type UserRole = 'super_admin' | 'tenant_admin' | 'admin' | 'branch_manager' | 'operator' | 'cashier' | 'viewer' | 'none'

// After (example adding qa_inspector)
export type UserRole = 'super_admin' | 'tenant_admin' | 'admin' | 'branch_manager' | 'operator' | 'cashier' | 'qa_inspector' | 'viewer' | 'none'
```

**Rules:**
- Add the role code in alphabetical order among the operational roles.
- Keep `'super_admin'` and `'tenant_admin'` first.
- Keep `'none'` last always.
- This is a frontend-only type; the authoritative list is `sys_auth_roles` in the DB.

---

## Step 6 — Output Checklist

After generating the migration, provide this summary:

```
## RBAC Role: {ROLE_CODE} — {MODE}

### Migration
- File: supabase/migrations/{SEQ}_rbac_role_{ROLE_CODE}.sql
- Action: STOP — do NOT apply. Wait for user review.

### Permissions Assigned ({COUNT})
[List permissions grouped by category_main]

### navigation.ts
- Add '{ROLE_CODE}' to UserRole in web-admin/config/navigation.ts
- Line: 43

### Next Steps
1. Review the migration SQL
2. Apply: supabase migration up
3. Verify with diagnostic query in Step 3
4. If new role should appear in nav sections, update navigation.ts roles arrays
```

---

## Permission Catalog Reference

Organized by `category_main` — use these codes in migrations.

### Orders
`orders:create` `orders:read` `orders:update` `orders:delete` `orders:cancel`  
`orders:split` `orders:merge` `orders:transition` `orders:assign` `orders:export`  
`orders:print` `orders:refund` `orders:discount` `orders:notes` `orders:history`  
`orders:urgent` `orders:processing`  
`orders:view_financial_breakdown` `orders:process_refund` `orders:approve_refund` `orders:collect_payment`

### Customers
`customers:create` `customers:read` `customers:update` `customers:delete`  
`customers:export` `customers:merge` `customers:upgrade` `customers:loyalty`  
`customers:tags` `customers:history`

### Products / Catalog
`products:create` `products:read` `products:update` `products:delete`  
`products:categories` `products:publish` `products:stock` `products:export`

### Pricing
`pricing:create` `pricing:read` `pricing:update` `pricing:delete`  
`pricing:tiers` `pricing:bulk` `pricing:history`

### Invoices
`invoices:create` `invoices:read` `invoices:update` `invoices:void`  
`invoices:send` `invoices:print` `invoices:export` `invoices:credit_note` `invoices:recurring`

### Payments
`payments:create` `payments:read` `payments:refund` `payments:void`  
`payments:reconcile` `payments:export` `payments:methods`

### Cash Drawer
`cash_drawer:view` `cash_drawer:open_session` `cash_drawer:close_session`  
`cash_drawer:record_movement` `cash_drawer:view_reports`

### Stored Value
`stored_value:view_balances` `stored_value:top_up_wallet` `stored_value:issue_advance`  
`stored_value:issue_credit_note` `stored_value:view_ledger` `stored_value:adjust_balance`

### Gift Cards
`gift_cards:cancel` `gift_cards:view_ledger`

### Loyalty
`loyalty:view_config` `loyalty:manage_config` `loyalty:view_customer_points` `loyalty:adjust_points`

### Promotions
`promotions:view` `promotions:create` `promotions:edit` `promotions:delete`  
`promotions:activate_deactivate`

### Tax
`tax:view_config` `tax:manage_config` `tax:view_reports`

### Finance Reports
`finance_reports:view` `finance_reports:export`

### Reconciliation
`reconciliation:view` `reconciliation:run` `reconciliation:acknowledge_issues`

### Payment Config
`payment_config:view` `payment_config:manage`

### Reports / Analytics
`reports:view_financial` `reports:view_operational` `reports:view_customer`  
`reports:view_staff` `reports:export` `reports:schedule` `reports:custom` `reports:dashboard`  
`analytics:view` `analytics:export` `analytics:kpi` `analytics:trends`

### Users & Roles
`users:create` `users:read` `users:update` `users:delete` `users:activate`  
`users:assign_roles` `users:reset_password`  
`roles:create` `roles:update` `roles:delete`

### Settings
`settings:read` `settings:update` `settings:organization` `settings:billing`  
`settings:workflow` `settings:notifications` `settings:integrations` `settings:branding`  
`settings:security` `settings:api` `settings:webhooks` `settings:subscription`  
`settings:features` `settings:localization` `settings:tax`

### Branches
`branches:create` `branches:read` `branches:update` `branches:delete`  
`branches:transfer` `branches:settings`

### Drivers & Delivery
`drivers:create` `drivers:read` `drivers:update` `drivers:delete`  
`delivery:assign` `delivery:track` `delivery:routes` `delivery:pod`

### Integrations
`integrations:read` `integrations:create` `integrations:update` `integrations:delete`  
`integrations:test` `integrations:logs`

### Audit & Logs
`audit:read` `audit:export` `logs:view` `logs:export`

---

## Hard Rules

1. **Never apply migrations** — create the `.sql` file, then STOP and say "Please review and apply."
2. **Permission codes are 2-part only** — `resource:action`. Never 3 parts.
3. **Check permission exists** before adding to a role — if a permission code is not in the catalog above, verify it exists in `sys_auth_permissions` first (it may have been added by a newer migration not reflected here).
4. **is_system: false** for tenant-custom roles. Only platform-standard roles (super_admin, tenant_admin, branch_manager, operator, viewer, admin) use `is_system: true`.
5. **Always bilingual** — name2 and description2 in Arabic are mandatory.
6. **NOT EXISTS pattern** for sys_auth_role_default_permissions — never ON CONFLICT DO NOTHING.
7. **Wrap in BEGIN/COMMIT** — all migrations are transactional.
8. **Admin role caution** — the `admin` role code is referenced in migrations but was not in the 0035 seed. Before creating it, run: `SELECT code FROM sys_auth_roles WHERE code = 'admin';` to check if it already exists.

---

## Custom Role Path (no archetype match)

If the role doesn't match any archetype:

1. Ask: "What does this role do day-to-day? Which modules do they access?"
2. Map answer to permission categories: e.g., "they take orders and collect cash" → cashier archetype
3. If truly novel: build permission list bottom-up from the permission catalog, grouping by what the role can **read**, **act on**, and **manage**
4. Apply the principle of least privilege: start minimal, add only what is explicitly needed
5. Suggest `is_system: false` unless it's a platform-wide standard role

---

## Example — Full Cashier Role Migration

**User says:** "Create a cashier role"

**Propose (and confirm with user):**
- Role code: `cashier`
- Name EN: `Cashier`
- Name AR: `كاشير`
- Description EN: `Front-desk cashier — order intake, payment collection, cash drawer`
- Description AR: `كاشير المنطقة الأمامية — استقبال الطلبات وتحصيل المدفوعات وإدارة صندوق النقدية`
- is_system: `false`

**Check:** Does `cashier` exist in `sys_auth_roles`? (run diagnostic query first)

**Check:** Is `cashier` already in `UserRole` type in navigation.ts? (it is — line 43)

**Migration generated:**
```sql
-- ============================================================
-- Migration 0374: RBAC Role — Cashier
-- Role code: cashier
-- Purpose: Front-desk cashier role for payment collection and order intake
-- Created: 2026-06-16
-- ============================================================

BEGIN;

-- 1. Create role
INSERT INTO public.sys_auth_roles (
  code, name, name2, description, description2,
  is_system, is_active, created_at, created_by
) VALUES (
  'cashier',
  'Cashier',
  'كاشير',
  'Front-desk cashier — order intake, payment collection, cash drawer',
  'كاشير المنطقة الأمامية — استقبال الطلبات وتحصيل المدفوعات وإدارة صندوق النقدية',
  false,
  true,
  CURRENT_TIMESTAMP,
  'system_admin'
) ON CONFLICT (code) DO NOTHING;

-- 2. Assign permissions
INSERT INTO public.sys_auth_role_default_permissions (
  role_code, permission_code, is_enabled, is_active, rec_status, created_at, created_by
)
SELECT r.code, p.code, true, true, 1, CURRENT_TIMESTAMP, 'system_admin'
FROM public.sys_auth_roles r
CROSS JOIN public.sys_auth_permissions p
WHERE r.code = 'cashier'
  AND p.code IN (
    -- Orders
    'orders:create', 'orders:read', 'orders:update', 'orders:print',
    'orders:notes', 'orders:history', 'orders:transition', 'orders:cancel', 'orders:urgent',
    'orders:collect_payment', 'orders:view_financial_breakdown',
    -- Customers
    'customers:create', 'customers:read', 'customers:history', 'customers:tags',
    -- Payments
    'payments:create', 'payments:read',
    -- Invoices
    'invoices:create', 'invoices:read', 'invoices:print',
    -- Cash Drawer
    'cash_drawer:view', 'cash_drawer:open_session', 'cash_drawer:close_session', 'cash_drawer:record_movement',
    -- Stored Value
    'stored_value:view_balances', 'stored_value:view_ledger',
    -- Loyalty & Promotions
    'loyalty:view_customer_points', 'promotions:view',
    -- Catalog (read-only)
    'products:read', 'pricing:read'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.sys_auth_role_default_permissions e
    WHERE e.role_code = r.code AND e.permission_code = p.code
  );

-- 3. Verification
DO $$
DECLARE
  v_role_exists BOOLEAN;
  v_perm_count  INTEGER;
BEGIN
  SELECT EXISTS(SELECT 1 FROM sys_auth_roles WHERE code = 'cashier') INTO v_role_exists;
  SELECT COUNT(*) INTO v_perm_count
  FROM sys_auth_role_default_permissions WHERE role_code = 'cashier' AND is_active = true;

  RAISE NOTICE '═══════════════════════════════════════';
  RAISE NOTICE '✅ RBAC Role Migration Complete';
  RAISE NOTICE 'Role: cashier';
  RAISE NOTICE 'Role exists: %', v_role_exists;
  RAISE NOTICE 'Permissions assigned: %', v_perm_count;
  RAISE NOTICE '═══════════════════════════════════════';

  IF NOT v_role_exists THEN
    RAISE EXCEPTION 'Role not created: cashier';
  END IF;
END $$;

COMMIT;
```

**navigation.ts:** `cashier` is already in the `UserRole` type (line 43) — no change needed.

**STOP — do not apply the migration. Show it to the user for review.**
