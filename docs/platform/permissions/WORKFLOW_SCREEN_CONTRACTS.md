---
version: v1.0.0
last_updated: 2026-03-12
author: CleanMateX Team
---

# Workflow Screen Contracts

Required permissions per workflow screen from `org_ord_screen_contracts_cf` and `cmx_ord_screen_pre_conditions`.

**Source:** `supabase/migrations/0075_screen_contract_functions_simplified.sql`, `0077_workflow_config_tables.sql`, `0130_cmx_ord_canceling_returning_functions.sql`

## Default required_permissions (from cmx_ord_screen_pre_conditions)

| screen_key | required_permissions |
|------------|----------------------|
| preparation | orders:preparation:complete |
| processing | orders:processing:complete |
| assembly | orders:assembly:complete |
| qa | orders:qa:approve, orders:qa:reject |
| packing | orders:packing:complete |
| ready_release | orders:ready:release |
| driver_delivery | orders:delivery:complete |
| new_order | orders:create |
| workboard | (empty) |

## Cancel & Return (from 0130)

| screen | required_permissions |
|--------|----------------------|
| cancel | orders:cancel |
| return | orders:return |

## Tenant Overrides

`org_ord_screen_contracts_cf` allows tenant-specific overrides. If `tenant_org_id` is NULL, it's the system default. Otherwise tenant-specific.

## Usage in Code

- **workflow-service-enhanced.ts:** `getScreenContract(screen)` returns `required_permissions`; checks user permissions via `getUserPermissions`
- **use-screen-contract.ts:** Hook to fetch screen contract for a given screen
- **workflow-service-enhanced.ts:** `requiredPermissions` from contract are checked before allowing transitions

## Schema

```sql
-- org_ord_screen_contracts_cf
tenant_org_id UUID,  -- NULL = system default
screen_key TEXT,    -- preparation, processing, assembly, qa, packing, ready_release, driver_delivery, new_order, workboard
pre_conditions JSONB,
required_permissions JSONB NOT NULL,  -- e.g. ["orders:preparation:complete"]
is_active BOOLEAN
```

## See Also

- [PERMISSIONS_REFERENCE](PERMISSIONS_REFERENCE.md)
- [docs/developers/workflow-system-guide.md](../../developers/workflow-system-guide.md)
- [docs/admins/workflow-configuration-guide.md](../../admins/workflow-configuration-guide.md)
