Target: one unified, fast, multi-tenant auth/roles/permissions model for CleanMateX, with branch/POS scoping, per-user overrides, and RLS-friendly checks. Based on your current docs that say “we have two role systems, document and convert” and “add tenant-aware RBAC”  and on the analysis that found two parallel role concepts (app vs workflow) , this is the consolidated draft.

---

## 1. Objectives

1. One source of truth for roles and permissions.
2. Support for tenant → branch → store/POS resources.
3. Per-user allow/deny that can override role defaults.
4. RLS must call a **cheap** function (1 indexed select). No heavy joins in RLS.
5. Rebuild on change, not on read.
6. Keep “workflow roles” separate but in the same pattern (because your current system has them) .

---

## 2. Master layer (platform-wide)

```sql
-- permissions
create table sys_auth_permissions (
  permission_id uuid primary key default gen_random_uuid(),
  code text not null unique,           -- 'orders.read', 'orders.create', 'workflow.transition', ...
  name text,
  category text,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- roles
create table sys_auth_roles (
  role_id uuid primary key default gen_random_uuid(),
  code text not null unique,           -- 'admin','operator','viewer','cashier'
  name text,
  is_system boolean default false,
  created_at timestamptz default now()
);

-- role → default permissions (what you called sys_auth_role_default_permissions)
create table sys_auth_role_default_permissions (
  role_id uuid not null references sys_auth_roles(role_id) on delete cascade,
  permission_id uuid not null references sys_auth_permissions(permission_id) on delete cascade,
  primary key (role_id, permission_id)
);
```

This gives you reusable roles with default permissions. Matches your idea to separate “role defaults” from “user direct” .

---

## 3. Tenant-level assignment

```sql
-- user has a role for the whole tenant
create table org_auth_user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  tenant_org_id uuid not null,
  role_id uuid not null references sys_auth_roles(role_id),
  is_active boolean default true,
  unique (user_id, tenant_org_id, role_id)
);
```

This is the clean replacement for the inconsistent “admin/operator/viewer” spread in code and DB your analysis flagged .

---

## 4. Generic resource-based assignment (branch, store/POS, route, device)

Instead of separate tables per level, we generalize.

```sql
-- user has a ROLE on a specific resource
create table org_auth_user_resource_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  tenant_org_id uuid not null,
  resource_type text not null,          -- 'branch','store','pos','route','device'
  resource_id uuid not null,            -- PK from that resource table
  role_id uuid not null references sys_auth_roles(role_id),
  is_active boolean default true,
  unique (user_id, tenant_org_id, resource_type, resource_id, role_id)
);
```

So: “operator in branch A”, “cashier in store S1”, “driver on route R5” → same table.

---

## 5. Per-user overrides (global and resource)

```sql
-- global user overrides (no resource)  [optional, keep if you want simple grants]
create table org_auth_user_permissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  tenant_org_id uuid not null,
  permission_id uuid not null references sys_auth_permissions(permission_id),
  allow boolean not null default true,
  created_at timestamptz default now(),
  unique (user_id, tenant_org_id, permission_id)
);

-- resource-scoped overrides (the generic one)
create table org_auth_user_resource_permissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  tenant_org_id uuid not null,
  resource_type text not null,
  resource_id uuid not null,
  permission_id uuid not null references sys_auth_permissions(permission_id),
  allow boolean not null default true,  -- false = explicit deny
  created_at timestamptz default now(),
  unique (user_id, tenant_org_id, resource_type, resource_id, permission_id)
);
```

This is where you say: “this operator can create orders only in branch X” or “deny pos.close in POS Y”.

---

## 6. Workflow roles (operational)

Your current system has workflow roles separate from app roles, but they must be stored. We keep the small table:

```sql
create table org_auth_user_workflow_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  tenant_org_id uuid not null,
  workflow_role text not null,             -- 'ROLE_RECEPTION','ROLE_PROCESSING',...
  is_active boolean default true,
  created_at timestamptz default now(),
  unique (user_id, tenant_org_id, workflow_role)
);
```

Then your workflow engine can check:

* has app perm: `orders.transition`
* has workflow role: `ROLE_PROCESSING`
  This was a gap in your current design, highlighted in the analysis file .

---

## 7. Effective permissions table (for speed)

We do NOT compute on every RLS call. We precompute.

```sql
create table cmx_effective_permissions (
  user_id uuid not null,
  tenant_org_id uuid not null,
  permission_code text not null,
  resource_type text,     -- null = tenant-wide
  resource_id uuid,       -- null = tenant-wide
  allow boolean not null,
  created_at timestamptz default now(),
  primary key (
    user_id,
    tenant_org_id,
    permission_code,
    coalesce(resource_type, ''),
    coalesce(resource_id, '00000000-0000-0000-0000-000000000000')
  )
);

create index on cmx_effective_permissions (user_id, tenant_org_id, permission_code);
create index on cmx_effective_permissions (tenant_org_id, permission_code);
```

This is the table RLS and API will read. One row = final result.

---

## 8. Rebuild function (core of the model)

```sql
create or replace function cmx_rebuild_user_permissions(
  p_user_id uuid,
  p_tenant_id uuid
)
returns void
language plpgsql
as $$
begin
  -- clear old
  delete from cmx_effective_permissions
  where user_id = p_user_id
    and tenant_org_id = p_tenant_id;

  -- 1) tenant roles → perms
  insert into cmx_effective_permissions (
    user_id, tenant_org_id, permission_code,
    resource_type, resource_id, allow
  )
  select
    p_user_id,
    p_tenant_id,
    sp.code,
    null, null,
    true
  from org_auth_user_roles our
  join sys_auth_role_default_permissions srdp on srdp.role_id = our.role_id
  join sys_auth_permissions sp on sp.permission_id = srdp.permission_id
  where our.user_id = p_user_id
    and our.tenant_org_id = p_tenant_id
    and our.is_active = true;

  -- 2) resource roles → perms
  insert into cmx_effective_permissions (
    user_id, tenant_org_id, permission_code,
    resource_type, resource_id, allow
  )
  select
    p_user_id,
    p_tenant_id,
    sp.code,
    urr.resource_type,
    urr.resource_id,
    true
  from org_auth_user_resource_roles urr
  join sys_auth_role_default_permissions srdp on srdp.role_id = urr.role_id
  join sys_auth_permissions sp on sp.permission_id = srdp.permission_id
  where urr.user_id = p_user_id
    and urr.tenant_org_id = p_tenant_id
    and urr.is_active = true;

  -- 3) global user overrides (if you keep them)
  insert into cmx_effective_permissions (
    user_id, tenant_org_id, permission_code,
    resource_type, resource_id, allow
  )
  select
    p_user_id,
    p_tenant_id,
    sp.code,
    null,
    null,
    oup.allow
  from org_auth_user_permissions oup
  join sys_auth_permissions sp on sp.permission_id = oup.permission_id
  where oup.user_id = p_user_id
    and oup.tenant_org_id = p_tenant_id
  on conflict (user_id, tenant_org_id, permission_code,
               coalesce(resource_type, ''), coalesce(resource_id, '00000000-0000-0000-0000-000000000000'))
  do update set allow = excluded.allow, created_at = now();

  -- 4) resource overrides (most specific, win)
  insert into cmx_effective_permissions (
    user_id, tenant_org_id, permission_code,
    resource_type, resource_id, allow
  )
  select
    p_user_id,
    p_tenant_id,
    sp.code,
    ourp.resource_type,
    ourp.resource_id,
    ourp.allow
  from org_auth_user_resource_permissions ourp
  join sys_auth_permissions sp on sp.permission_id = ourp.permission_id
  where ourp.user_id = p_user_id
    and ourp.tenant_org_id = p_tenant_id
  on conflict (user_id, tenant_org_id, permission_code,
               coalesce(resource_type, ''), coalesce(resource_id, '00000000-0000-0000-0000-000000000000'))
  do update set allow = excluded.allow, created_at = now();
end;
$$;
```

Order = broad → specific. Last wins.

---

## 9. Fast check function (what RLS calls)

```sql
create or replace function cmx_can(
  p_perm text,
  p_resource_type text default null,
  p_resource_id uuid default null
)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from cmx_effective_permissions ep
    where ep.user_id = auth.uid()
      and ep.tenant_org_id = current_setting('app.current_tenant_id', true)::uuid
      and ep.permission_code = p_perm
      and (ep.resource_type is null or ep.resource_type = p_resource_type)
      and (ep.resource_id   is null or ep.resource_id   = p_resource_id)
      and ep.allow = true
  );
$$;
```

This is O(1) with index. So your concern about “3 selects per call will slow the system” is addressed.

---

## 10. RLS usage

Example: orders table has `tenant_org_id`, `branch_id`, `store_id`.

```sql
create policy "orders_read" on orders
for select
using (
  cmx_can('orders.read', 'branch', orders.branch_id)
  or cmx_can('orders.read', 'store', orders.store_id)
  or cmx_can('orders.read', 'tenant', orders.tenant_org_id)
);
```

You can shorten to the one your business prefers.

---

## 11. Triggers to keep it fresh

```sql
-- when tenant-level role changes
create or replace function trg_cmx_rebuild_from_org_user_roles()
returns trigger
language plpgsql
as $$
begin
  perform cmx_rebuild_user_permissions(NEW.user_id, NEW.tenant_org_id);
  return NEW;
end;
$$;

create trigger cmx_rebuild_from_org_user_roles
after insert or update or delete on org_user_roles
for each row
execute procedure trg_cmx_rebuild_from_org_user_roles();
```

Repeat same pattern for:

* `org_auth_user_resource_roles`
* `org_auth_user_permissions`
* `org_auth_user_resource_permissions`
* and if you edit `sys_auth_role_default_permissions`, you must rebuild for all users of that role (can be a job).

---

## 12. UI / API shape

**User Management screen (Next.js / Flutter admin):**

1. Tenant role: dropdown (admin, operator, viewer, …)
2. Resource roles:

   * Resource type (branch/store/pos)
   * Resource (autocomplete)
   * Role (operator/cashier/driver)
3. Overrides:

   * Permission (select from sys_auth_permissions)
   * Resource (optional)
   * Effect: allow/deny

On save:

* write to `org_auth_user_roles` or `org_auth_user_resource_roles` or `org_auth_user_resource_permissions`
* call `/api/admin/tenants/:tenantId/users/:userId/rebuild-permissions` → which calls `cmx_rebuild_user_permissions`.

---

## 13. Migration from current

1. Standardize current user roles to `admin|operator|viewer` as your evaluation suggested .
2. Insert them into `org_auth_user_roles`.
3. Seed `sys_auth_roles`, `sys_auth_permissions`, `sys_auth_role_default_permissions`.
4. For users that currently work per branch/POS, insert corresponding rows into `org_auth_user_resource_roles`.
5. Run `cmx_rebuild_user_permissions` for all users.
6. Start using `cmx_can` in RLS and APIs.
7. Gradually delete any old in-code role checks.

---

## 14. Why this matches your docs

* “Document current role systems and provide conversion plan” → this is the conversion. 
* “Two systems not connected” → now connected but still logically separate. 
* “Need tenant-aware” → every table has `tenant_org_id`. 
* “Must support future resources (routes, lockers, etc.)” → use `resource_type` text.

Done. This is the all-in-one draft. Use it as your “Auth & RBAC & Scoped Permissions v1.0” for CleanMateX.
