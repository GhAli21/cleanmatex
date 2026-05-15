<!--
CleanMateX Documentation Pack
Generated: 2026-05-14
Scope: Order Financial Architecture, Migration, SaaS Governance, Finance, Accounting, Settlement, Promotions, Tax, Stored Value, Reconciliation
-->

# Database Naming Conventions

## 1. Prefixes

| Prefix | Meaning |
|---|---|
| `sys_*` | Platform/global static configuration |
| `org_*` | Tenant-owned operational/configuration/fact data |

## 2. Suffixes

| Suffix | Meaning |
|---|---|
| `_mst` | Master/header table |
| `_dtl` | Detail/child table |
| `_cd` | Code/reference table |
| `_cf` | Configurable/custom tenant data |
| `_log` | Log table |

## 3. Required Common Columns

Recommended default:

```sql
id uuid primary key default gen_random_uuid()
tenant_org_id uuid not null
created_at timestamptz default now()
created_by uuid null
updated_at timestamptz null
updated_by uuid null
metadata jsonb default '{}'
```

If existing project uses text for `created_by`, follow existing convention until a migration is planned.

## 4. Money Fields

Use:

```sql
numeric(19,4)
```

## 5. Soft Status

Use project convention:

```sql
rec_status smallint default 1
```

where applicable.
