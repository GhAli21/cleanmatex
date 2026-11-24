---
version: v1.2.0
last_updated: 2026-11-24
author: CleanMateX Team
---

# 🛡️ Supabase Usage Guidelines

**CRITICAL**: Follow these rules for all Supabase database operations and RLS policies.

Schema authority is `.claude/skills/database/` (`SKILL.md`, `conventions.md`, `reference-original.md`) plus `CLAUDE.md`. This file is the Supabase client, RLS, and migration usage guide. When they disagree, the database skill wins.

---

## Schema rules

These rules apply to every new migration, function, and `org_*` / `sys_*` query.

- **Names:** at most 30 characters for every database object (tables, functions, views, indexes, constraints, policies, triggers). `sys_` is global (no `tenant_org_id`). `org_` is tenant-scoped. New objects use `{scope}_{feature}_{object}_{suffix}` (`_mst`, `_dtl`, `_tr`, `_cd`, `_cf`). Existing objects keep their live names.
- **ERP Lite:** new ERP Lite objects insert `erplt` immediately after the scope prefix: `org_erplt_{sub_feature}_{object}_{suffix}` (example: `org_erplt_fin_acct_mst`). Do not bulk-rename grandfathered `org_fin_*` objects.
- **Strings:** `TEXT`. Do not add `VARCHAR` / `CHAR`.
- **Time:** instants, including `created_at` and `updated_at`, are `timestamptz` (UTC). A business date is `date`, written once with the location zone, else the organization zone, and that IANA name is stored with it. Local times of day are `time`. Do not compare `timestamp without time zone` to `now()`, and do not convert with `utc_offset_hours`. Full rule: `docs/dev/rules/time-and-timezone.md`.
- **Numbers:** pick the class (`docs/dev/rules/numeric-precision.md`) and comment it on the column. `AMOUNT` `DECIMAL(19,4)` · `UNIT_PRICE` `(21,6)` · `UNIT_COST` `(23,8)` · `QUANTITY` `(21,6)` · `RATE` `(28,12)`. Piece counts stay `INTEGER`. Never `FLOAT` / `REAL` / `DOUBLE PRECISION` for money or FX.
- **Money:** `currency_code TEXT NOT NULL` FK → `sys_currency_cd(code)`, no default, plus `amount DECIMAL(19,4) NOT NULL`. Base-currency valuation also stores `base_currency_code`, `base_amount DECIMAL(19,4)`, `fx_rate DECIMAL(22,10)`, `fx_rate_date DATE`, `fx_rate_source`, `fx_rate_id`. Direction is `base_amount = amount × fx_rate`. Same currency means `base_amount = amount` and the FX columns are `NULL`. No default on currency, country, city, timezone, or locale columns.
- **Composite FKs (Prisma 6):** child FK, 1:1 UNIQUE, and the referenced parent key use the same columns in the same order. Parent `(id, tenant_org_id)` → child `(parent_id, tenant_org_id)` (tenant second; this is `0553`). Parent `(tenant_org_id, id)` → child `(tenant_org_id, parent_id)`. List indexes stay tenant-first. Do not `ON DELETE SET NULL` on a composite that includes required `tenant_org_id`. After a pull, from the repo root run `npm run prisma:pull` (no `cd web-admin`).
- **Tenant predicate:** every queried or joined `org_*` table has an explicit `tenant_org_id` predicate. Writes set it and filter it. RLS, a parent lookup, and the Prisma guard do not replace that predicate.
- **Public-key grants:** migrations run as `postgres`. New tables, sequences, and functions in `public` do not grant `anon`, `authenticated`, or `PUBLIC`. Grant only what the caller needs in the same migration. `org_*` user-JWT access: `GRANT` to `authenticated` plus RLS; do not grant `anon`. `sys_*` and `hq_*` stay closed to `anon` and `authenticated`; the app reads them with the service role after its own authorization check (`catalogReadClient`). A user-JWT function `GRANT EXECUTE` to `authenticated` only, and the body rejects a caller who is not the session user. `current_tenant_id()` and `is_admin()` stay executable by `anon` and `authenticated`. `SECURITY DEFINER` is only for work the caller cannot do. `search_path` is `pg_catalog, public`, then only schemas the body names (`auth`, `extensions`, `net`, `storage`, `cron`, `vault`), and `pg_temp` is last. Catalog views set `security_invoker = true` and are not granted to `anon` or `authenticated`. Detail: `conventions.md` → Public-key grants.
- **Document every object** in the migration: concise English comments for purpose and invariants, including audit and identity columns, plus PostgreSQL `COMMENT ON` for every created or altered object that supports it. Explain grants, revokes, and removals beside their statements. Do not rewrite an applied migration to add comments; a deployed catalog-comment change is a new migration.
- **Human-friendly codes:** codes people see are generated only by the database and are immutable. One row in `sys_doc_seq_type_cd` per code type. GENERAL types use `fn_doc_seq_assign_code`. Never `MAX()+1` in app code. Never expose a UUID as a business id. A new coded table has `NOT NULL` + `UNIQUE (tenant_org_id, <code>)`, the config row, assign and guard triggers, and backfill plus counter seed in the same migration. Full rule: `conventions.md`.

---

## Row-Level Security (RLS)

### Enable RLS on All Tenant Tables

**CRITICAL**: Enable RLS on ALL `org_*` tables (tenant tables).

```sql
-- ✅ Good: Enable RLS
CREATE TABLE org_orders_mst (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL REFERENCES org_tenants_mst(id),
  -- ... other columns
  constraint PK_org_orders_mst primary key (id, tenant_org_id)
);

ALTER TABLE org_orders_mst ENABLE ROW LEVEL SECURITY;

-- ❌ Bad: Missing RLS
CREATE TABLE org_orders_mst (
  -- No RLS enabled - security risk!
);
```

### RLS Policy Patterns

#### Tenant Isolation Policy

Policy name is `tenant_isolation_<table_name>` when that name is at most 30 characters. Always include both `USING` and `WITH CHECK`. The tenant predicate is `current_tenant_id()`. Do not read the tenant from `auth.jwt()`, and do not look it up from a user row inside the policy.

```sql
DROP POLICY IF EXISTS tenant_isolation_org_orders_mst ON org_orders_mst;
CREATE POLICY tenant_isolation_org_orders_mst ON org_orders_mst
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

COMMENT ON POLICY tenant_isolation_org_orders_mst ON org_orders_mst IS
  'Authenticated session may access rows of its current tenant only.';
```

#### Role-Based Policies

```sql
-- Admin can see all orders in their tenant
CREATE POLICY admin_full_access ON org_orders_mst
  FOR ALL
  USING (tenant_org_id = current_tenant_id() AND is_admin())
  WITH CHECK (tenant_org_id = current_tenant_id() AND is_admin());

-- Staff can only see assigned orders
CREATE POLICY staff_assigned_access ON org_orders_mst
  FOR SELECT
  USING (
    tenant_org_id = current_tenant_id()
    AND (
      assigned_to = auth.uid()
      OR created_by = auth.uid()
    )
  );
```

#### Testing RLS Policies

```sql
-- Test policy as specific user
SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claim.sub TO 'user-uuid';
SET LOCAL request.jwt.claim.tenant_org_id TO 'tenant-uuid';

-- Test query
SELECT * FROM org_orders_mst;

-- Should only return orders for the specified tenant
```

---

## Client Usage Patterns

### Always Filter by Tenant

```typescript
// ✅ Good: Always include tenant filter
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(url, key);

const { data, error } = await supabase
  .from("org_orders_mst")
  .select("*")
  .eq("tenant_org_id", tenantId) // CRITICAL: Always filter
  .eq("status", "PENDING");

// ❌ Bad: Missing tenant filter
const { data } = await supabase
  .from("org_orders_mst")
  .select("*")
  .eq("status", "PENDING");
```

### Use Select to Limit Columns

```typescript
// ✅ Good: Select only needed columns
const { data } = await supabase
  .from("org_orders_mst")
  .select("id, order_number, status, total_amount")
  .eq("tenant_org_id", tenantId);

// ❌ Bad: Selecting all columns
const { data } = await supabase
  .from("org_orders_mst")
  .select("*")
  .eq("tenant_org_id", tenantId);
```

### Pagination

```typescript
// ✅ Good: Always paginate large datasets
const { data, error } = await supabase
  .from("org_orders_mst")
  .select("*")
  .eq("tenant_org_id", tenantId)
  .range(page * limit, (page + 1) * limit - 1)
  .order("created_at", { ascending: false });

// Get total count separately
const { count } = await supabase
  .from("org_orders_mst")
  .select("*", { count: "exact", head: true })
  .eq("tenant_org_id", tenantId);
```

### Avoid N+1 Queries

```typescript
// ✅ Good: Use joins/select with relations
const { data } = await supabase
  .from("org_orders_mst")
  .select(
    `
    *,
    customer:org_customers_mst(*),
    items:org_order_items_dtl(*)
  `,
  )
  .eq("tenant_org_id", tenantId);

// ❌ Bad: N+1 query problem
const { data: orders } = await supabase
  .from("org_orders_mst")
  .select("*")
  .eq("tenant_org_id", tenantId);

for (const order of orders) {
  const { data: customer } = await supabase
    .from("org_customers_mst")
    .select("*")
    .eq("id", order.customer_id)
    .single();
}
```

---

## Migrations

### Migration Naming Convention

List `supabase/migrations/` (skip `archive/`, `seeds/`, and `x_*` / `xproduction/`). Take the highest numeric `NNNN` prefix and add 1, zero-padded to 4 digits. Do not use a timestamp prefix.

```
{next_NNNN}_{descriptive_snake_case}.sql

Examples:
0083_org_ord_orders_mst.sql
0084_org_ord_orders_status_idx.sql
0085_org_ord_orders_rls.sql
```

### Migration Best Practices

```sql
-- 0083_org_ord_orders_mst.sql
-- One logical change. Write the file, then stop for review. Do not apply it here.

BEGIN;

CREATE TABLE org_ord_orders_mst (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL,
  order_no TEXT NOT NULL,
  status_code TEXT NOT NULL,
  total_amount DECIMAL(19, 4) NOT NULL, -- AMOUNT
  currency_code TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by TEXT,
  created_info TEXT,
  updated_at TIMESTAMPTZ,
  updated_by TEXT,
  updated_info TEXT,
  updated_count INTEGER NOT NULL DEFAULT 0,
  deleted_at TIMESTAMPTZ,
  deleted_by TEXT,
  deleted_info TEXT,
  rec_status SMALLINT NOT NULL DEFAULT 1, -- 0 = soft delete
  rec_order INTEGER,
  rec_notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT pk_org_ord_orders_mst PRIMARY KEY (id, tenant_org_id),
  CONSTRAINT uq_org_ord_orders_no UNIQUE (tenant_org_id, order_no),
  CONSTRAINT fk_org_ord_orders_tenant FOREIGN KEY (tenant_org_id) REFERENCES org_tenants_mst (id),
  CONSTRAINT fk_org_ord_orders_ccy FOREIGN KEY (currency_code) REFERENCES sys_currency_cd (code)
);

COMMENT ON TABLE org_ord_orders_mst IS
  'Tenant orders. order_no is the human-friendly code; id is the only join key.';
COMMENT ON COLUMN org_ord_orders_mst.total_amount IS 'AMOUNT. DECIMAL(19,4).';
COMMENT ON COLUMN org_ord_orders_mst.currency_code IS
  'Currency code. No default. FK to sys_currency_cd(code).';
-- Comment every remaining column the same way, including audit and identity columns.
-- Child FKs copy this primary key order: (order_id, tenant_org_id).

CREATE INDEX idx_ord_orders_tenant ON org_ord_orders_mst (tenant_org_id);
CREATE INDEX idx_ord_orders_active ON org_ord_orders_mst (tenant_org_id, is_active);
CREATE INDEX idx_ord_orders_created ON org_ord_orders_mst (tenant_org_id, created_at DESC);

ALTER TABLE org_ord_orders_mst ENABLE ROW LEVEL SECURITY;

-- tenant_isolation_org_ord_orders_mst is 35 characters, so the policy name is shortened.
CREATE POLICY tenant_isolation_ord_orders ON org_ord_orders_mst
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

COMMENT ON POLICY tenant_isolation_ord_orders ON org_ord_orders_mst IS
  'Session may access org_ord_orders_mst rows of its current tenant only.';

REVOKE ALL ON TABLE org_ord_orders_mst FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE org_ord_orders_mst TO authenticated;

COMMIT;

-- Rollback (comment only; a fix is a new migration, not an edit of this file):
-- DROP POLICY tenant_isolation_ord_orders ON org_ord_orders_mst;
-- DROP TABLE org_ord_orders_mst RESTRICT;
```

### Migration Rules

1. **Next numeric sequence only** — `{NNNN}_{descriptive_snake_case}.sql`. Never a `YYYYMMDDHHMMSS` prefix. Never reuse or skip a number.
2. **One logical change per migration.**
3. **Wrap the migration in `BEGIN` / `COMMIT`.**
4. **Never modify an existing migration.** A fix is a new file.
5. **Never apply a migration and never run `supabase db reset`.** Write the SQL file, then stop for review.
6. **`DROP ... RESTRICT`.** `DROP ... CASCADE` is banned unless there is no safer alternative, a full dependency manifest, and recreate plus rollback in the same file, and the user has confirmed. See `docs/dev/drop-cascade-migration-workflow.md`.
7. **Comment rollback with `RESTRICT`.** Do not put a destructive reset in the guide or the migration.
8. **Index after the table, tenant-first, names ≤ 30 characters.** Index column order and Prisma 1:1 unique order are different rules.
9. **Document every object and add `COMMENT ON`.** Grants and revokes sit next to the object they change.
10. **A coded column** also gets its `sys_doc_seq_type_cd` row, assign trigger, and guard trigger in that migration (`conventions.md`).

---

## Database Functions

### Creating Functions

```sql
-- Invoker is the default. The caller must already be allowed to read the rows.
-- search_path: pg_catalog, public, then only schemas the body names, pg_temp last.
CREATE FUNCTION org_ord_user_fn()
RETURNS void
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  NULL;
END;
$$;

-- SECURITY DEFINER only when the body must do work the caller cannot.
-- This body calls auth.uid(), so auth is on the path. pg_temp stays last.
-- New functions are not granted to anon or authenticated until this migration says so.
CREATE FUNCTION org_ord_admin_fn()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.org_ord_admin_fn() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.org_ord_admin_fn() TO service_role;
```

A new function is not callable with the public key until the migration grants `EXECUTE`. See **Public-key grants** in `.claude/skills/database/conventions.md`. `org_*` function bodies still filter `tenant_org_id` in the SQL itself.

### Using Functions via RPC

```typescript
// Call PostgreSQL function via Supabase RPC
const { data, error } = await supabase.rpc("org_ord_calc_total", {
  p_order_id: orderId,
  p_tenant_org_id: tenantId,
});
```

### Function Security

Use the invoker and definer examples above. `search_path` is `pg_catalog, public`, then only schemas the body names (`auth`, `extensions`, `net`, `storage`, `cron`, `vault`). `pg_temp` is last.

---

## Validation

### Database-Level Validation

```sql
-- Constraints use TEXT and the amount class. Codes are unique per tenant, not globally.
CREATE TABLE org_ord_orders_mst (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL,
  order_no TEXT NOT NULL,
  status_code TEXT NOT NULL CHECK (status_code IN ('PENDING', 'PROCESSING', 'READY', 'DELIVERED')),
  total_amount DECIMAL(19, 4) NOT NULL CHECK (total_amount >= 0), -- AMOUNT
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT pk_org_ord_orders_mst PRIMARY KEY (id, tenant_org_id),
  CONSTRAINT uq_org_ord_orders_no UNIQUE (tenant_org_id, order_no)
);
```

### Application-Level Validation

```typescript
// ✅ Good: Validate before insert/update
import { z } from "zod";

const orderSchema = z.object({
  tenant_org_id: z.string().uuid(),
  order_number: z.string().min(1).max(50),
  status: z.enum(["PENDING", "PROCESSING", "READY", "DELIVERED"]),
  total_amount: z.number().min(0),
});

const validatedData = orderSchema.parse(orderData);

const { data, error } = await supabase
  .from("org_orders_mst")
  .insert(validatedData)
  .select()
  .single();
```

---

## Logging Database Operations

### Log Mutations

```typescript
import { logger } from "@/lib/utils/logger";

async function createOrder(
  orderData: CreateOrderDto,
  tenantId: string,
  userId: string,
) {
  const startTime = Date.now();

  try {
    logger.info("Creating order", {
      tenantId,
      userId,
      feature: "orders",
      action: "create",
    });

    const { data, error } = await supabase
      .from("org_orders_mst")
      .insert({
        ...orderData,
        tenant_org_id: tenantId,
        created_by: userId,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    const duration = Date.now() - startTime;
    logger.info("Order created successfully", {
      tenantId,
      userId,
      orderId: data.id,
      duration: `${duration}ms`,
      feature: "orders",
      action: "create",
    });

    return data;
  } catch (error) {
    logger.error("Order creation failed", error as Error, {
      tenantId,
      userId,
      feature: "orders",
      action: "create",
    });
    throw error;
  }
}
```

---

## Service Role Key Usage

### When to Use Service Role Key

**CRITICAL**: Only use service role key for:

- Admin operations (tenant management)
- Background jobs
- System-level operations
- Never use in client-side code
- `sys_*` and `hq_*` catalog reads on the server, via `catalogReadClient`. Do not switch the whole client when the same function also reads `org_*`.

```typescript
// ✅ Good: Server-side admin operation
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!, // Server-side only
);

// Admin operation
const { data } = await supabaseAdmin.from("org_tenants_mst").select("*");

// ❌ Bad: Using service role key in client
// Never expose service role key to client!
```

---

## Naming Conventions

### Function Naming

New functions carry the scope prefix and stay within 30 characters: `org_ord_calc_total`, `sys_auth_validate_token`. A `validate_` or helper name still needs that prefix. Grandfathered functions keep the name already in the database.

### Policy Naming

`tenant_isolation_<table_name>`, with both `USING` and `WITH CHECK`. If that name exceeds 30 characters, shorten it and put the table name in `COMMENT ON POLICY`.

### Migration Naming

`{NNNN}_{descriptive_snake_case}.sql`, where `NNNN` is the next 4-digit sequence in `supabase/migrations/`. Do not use a timestamp prefix.

### Examples

```sql
-- Clear, scoped, and within 30 characters
CREATE FUNCTION org_ord_calc_total(p_order_id UUID, p_tenant_org_id UUID) ...
CREATE FUNCTION org_ord_list_active(p_tenant_org_id UUID) ...

-- Too vague, and missing the scope prefix
CREATE FUNCTION calc(o_id UUID) ...
CREATE FUNCTION get_ord(t_id UUID) ...
```

---

## Code Reuse Patterns

### 1. Extract Common Query Helpers

```typescript
// ✅ Good: Reusable query helper
// lib/utils/supabase-helpers.ts
export async function queryWithTenant<T>(
  supabase: SupabaseClient,
  table: string,
  tenantId: string,
  options?: {
    select?: string;
    filters?: Record<string, unknown>;
    orderBy?: { column: string; ascending?: boolean };
    limit?: number;
  },
) {
  let query = supabase
    .from(table)
    .select(options?.select || "*")
    .eq("tenant_org_id", tenantId);

  if (options?.filters) {
    Object.entries(options.filters).forEach(([key, value]) => {
      query = query.eq(key, value);
    });
  }

  if (options?.orderBy) {
    query = query.order(options.orderBy.column, {
      ascending: options.orderBy.ascending ?? true,
    });
  }

  if (options?.limit) {
    query = query.limit(options.limit);
  }

  return query;
}

// Usage
const { data } = await queryWithTenant(supabase, "org_orders_mst", tenantId, {
  filters: { status: "PENDING" },
  orderBy: { column: "created_at", ascending: false },
  limit: 20,
});

// ❌ Bad: Duplicate query logic
const { data } = await supabase
  .from("org_orders_mst")
  .select("*")
  .eq("tenant_org_id", tenantId)
  .eq("status", "PENDING")
  .order("created_at", { ascending: false })
  .limit(20);
// Repeated in multiple places
```

### 2. Extract Common RPC Wrappers

```typescript
// ✅ Good: Reusable RPC wrapper
// lib/utils/rpc-helpers.ts
export async function callRPC<T>(
  supabase: SupabaseClient,
  functionName: string,
  params: Record<string, unknown>,
  tenantId: string
): Promise<T> {
  const { data, error } = await supabase.rpc(functionName, {
    ...params,
    tenant_id: tenantId,
  });

  if (error) {
    logger.error(`RPC ${functionName} failed`, error, { tenantId, params });
    throw error;
  }

  return data as T;
}

// Usage
const total = await callRPC<number>(
  supabase,
  'calculate_order_total',
  { order_id: orderId },
  tenantId
);

// ❌ Bad: Duplicate RPC error handling
const { data, error } = await supabase.rpc('calculate_order_total', {...});
if (error) { /* duplicate error handling */ }
```

### 3. Extract Common Insert Patterns

```typescript
// ✅ Good: Reusable insert helper
// lib/utils/supabase-helpers.ts
export async function insertWithAudit<T>(
  supabase: SupabaseClient,
  table: string,
  data: Partial<T>,
  tenantId: string,
  userId: string,
) {
  const { data: result, error } = await supabase
    .from(table)
    .insert({
      ...data,
      tenant_org_id: tenantId,
      created_by: userId,
      created_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    logger.error(`Insert into ${table} failed`, error, {
      tenantId,
      userId,
      table,
    });
    throw error;
  }

  return result;
}

// Usage
const order = await insertWithAudit(
  supabase,
  "org_orders_mst",
  orderData,
  tenantId,
  userId,
);

// ❌ Bad: Duplicate insert logic
const { data } = await supabase.from("org_orders_mst").insert({
  ...orderData,
  tenant_org_id: tenantId,
  created_by: userId,
  created_at: new Date().toISOString(),
});
// Repeated everywhere
```

### 4. Extract Common Update Patterns

```typescript
// ✅ Good: Reusable update helper
export async function updateWithAudit<T>(
  supabase: SupabaseClient,
  table: string,
  id: string,
  updates: Partial<T>,
  tenantId: string,
  userId: string,
) {
  const { data: result, error } = await supabase
    .from(table)
    .update({
      ...updates,
      updated_by: userId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("tenant_org_id", tenantId) // Always filter by tenant
    .select()
    .single();

  if (error) {
    logger.error(`Update ${table} failed`, error, {
      tenantId,
      userId,
      table,
      id,
    });
    throw error;
  }

  return result;
}

// Usage
const updatedOrder = await updateWithAudit(
  supabase,
  "org_orders_mst",
  orderId,
  { status: "PROCESSING" },
  tenantId,
  userId,
);
```

### 5. Extract Common Soft Delete Pattern

```typescript
// ✅ Good: Reusable soft delete helper
export async function softDelete(
  supabase: SupabaseClient,
  table: string,
  id: string,
  tenantId: string,
  userId: string,
) {
  return await updateWithAudit(
    supabase,
    table,
    id,
    {
      is_active: false,
      rec_status: 0,
    } as any,
    tenantId,
    userId,
  );
}

// Usage
await softDelete(supabase, "org_orders_mst", orderId, tenantId, userId);
```

---

## Best Practices

### ✅ DO

- Always enable RLS on `org_*` tables, with `USING` and `WITH CHECK` against `current_tenant_id()`
- Always filter by `tenant_org_id` in queries — Applies to Prisma, Supabase client, raw SQL, SQL functions, joins and INSERT/UPDATE/DELETE writes: `tenant_org_id` MUST appear directly in the query whenever the table has that column. RLS / Prisma guard / prior parent lookup are defense in depth only, never a substitute; by-`id`-only access is a violation.
- Match composite FK and 1:1 UNIQUE column order to the parent key that already exists
- Store instants as `timestamptz`, amounts as `DECIMAL(19,4)`, and strings as `TEXT`
- Grant `authenticated` only where the user JWT must touch an `org_*` object; leave `sys_*` / `hq_*` closed
- Add `COMMENT ON` for every new or altered object
- Test RLS policies with different user roles
- Use transactions for multi-step operations
- Validate data before insert/update
- Log all mutations with context (UTC instants; no secrets)
- Use pagination for large datasets
- Select only needed columns
- Extract common query patterns to helper functions
- Use reusable RPC wrappers
- Follow naming conventions consistently, including the 30-character limit

### ❌ DON'T

- Don't disable RLS on tenant tables
- Don't query without a tenant filter
- Don't use the service role key in client code
- Don't modify an existing migration, apply a migration, or run `supabase db reset`
- Don't `DROP ... CASCADE` unless the user confirmed the full dependency workflow
- Don't use `VARCHAR`, `DECIMAL(10,2)`, or `FLOAT` for new columns
- Don't grant `anon` on new tables, sequences, or functions
- Don't use `auth.jwt() ->> 'tenant_org_id'` as the RLS tenant predicate
- Don't skip validation
- Don't forget indexes, and don't treat index order as the Prisma unique order
- Don't expose sensitive data in logs
- Don't use N+1 query patterns
- Don't duplicate query logic — extract to helpers
- Don't repeat error handling — use wrapper functions

---

## Troubleshooting

### RLS Blocking Queries

```sql
-- Check if RLS is enabled
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
AND tablename = 'org_orders_mst';

-- Check existing policies
SELECT * FROM pg_policies
WHERE tablename = 'org_orders_mst';

-- Test policy
SET LOCAL role TO authenticated;
SET LOCAL request.jwt.claim.sub TO 'user-uuid';
SET LOCAL request.jwt.claim.tenant_org_id TO 'tenant-uuid';
SELECT * FROM org_orders_mst;
```

### Migration Issues

Do not reset the database and do not apply a migration from this guide. A fix is a new `{NNNN}_*.sql` file. Stop after writing it so the user can review.

Read-only check of what is already on disk or recorded as applied:

```bash
supabase migration list
```

---

## Related Documentation

- Database skill (authority): `.claude/skills/database/SKILL.md`, `conventions.md`, `reference-original.md`
- [Database Conventions](./database_conventions.md) - Database schema standards
- [Multi-Tenancy](./multitenancy.md) - Multi-tenant security patterns
- [Logging Rules](./logging-rules.md) - Logging database operations

---

## Return to [Main Documentation](../CLAUDE.md)
