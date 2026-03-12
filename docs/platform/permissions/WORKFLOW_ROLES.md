---
version: v1.0.0
last_updated: 2026-03-12
author: CleanMateX Team
---

# Workflow Roles

Workflow roles for order workflow screens (e.g., ROLE_RECEPTION, ROLE_PROCESSING).

**Source:** `org_auth_user_workflow_roles`, `RequireWorkflowRole`, `use-has-workflow-role.ts`

## Components & Hooks

- **RequireWorkflowRole** — `web-admin/src/features/auth/ui/RequirePermission.tsx` — Renders children only if user has specific workflow role
- **RequireAnyWorkflowRole** — Same file — Renders if user has any of specified workflow roles
- **useHasWorkflowRole** — `web-admin/lib/hooks/use-has-workflow-role.ts` — Check single workflow role
- **useHasAnyWorkflowRole** — Same file — Check any of workflow roles

## Special Role

- **ROLE_ADMIN** — Has access to all workflow roles (bypass)

## Usage

```tsx
<RequireWorkflowRole workflowRole="ROLE_RECEPTION">
  <ReceptionScreen />
</RequireWorkflowRole>

<RequireAnyWorkflowRole workflowRoles={['ROLE_RECEPTION', 'ROLE_PROCESSING']}>
  <OrderProcessingScreen />
</RequireAnyWorkflowRole>
```

## Data Source

- `get_user_workflow_roles` RPC — returns workflow roles for current user
- `org_auth_user_workflow_roles` table — user-tenant assignments

## Relation to RBAC Roles

Workflow roles are distinct from RBAC roles (super_admin, tenant_admin, operator, viewer). Workflow roles are screen/process-specific (e.g., who can work reception vs processing).

## See Also

- [docs/features/RBAC/workflow_roles_guide.md](../../features/RBAC/workflow_roles_guide.md)
- [WORKFLOW_SCREEN_CONTRACTS](WORKFLOW_SCREEN_CONTRACTS.md)
