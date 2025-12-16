# 010 — Order Workflow Engine (Dev Plan)

## Scope

Implement a configurable workflow state machine for orders with validation, quality gates, audit logs, hooks, and minimal admin UI to configure per-tenant flows. Enforce multi-tenancy (tenant_org_id), RLS, composite FKs, and bilingual fields where user-facing.

## Data Model (DB Migrations)

- Create `org_workflow_states_log` (tenant-scoped) for audit history
- Columns: `tenant_org_id` (FK), `order_id` (FK composite), `from_status`, `to_status`, `transition_by`, `notes`, `metadata JSONB`, `created_at`
- Create `org_workflow_config_cf` (tenant-scoped) for per-tenant, per-category workflow config
- Columns: `tenant_org_id`, `service_category_id` (FK composite), `transitions JSONB`, `quality_gates JSONB`, `features JSONB`, `rec_status`, `is_active`, `created_at/_by`, `updated_at/_by`
- Indexes: `(tenant_org_id, order_id)`, `(tenant_org_id, service_category_id)`
- RLS: enable and add tenant isolation policies on both tables
- Composite FKs: enforce references to `org_orders_mst` and `org_service_category_cf`

## Backend (NestJS API)

- Module: `backend/src/modules/orders/workflow/`
- Core service: `WorkflowEngineService`
- Load effective config (tenant → category → defaults)
- Validate transition via transition matrix + config overrides
- Evaluate quality gates (pluggable, async)
- Persist transition, update order status, write audit log
- Emit hooks/events (notifications, webhooks, analytics)
- Controller endpoints (v1):
- `POST /api/v1/orders/:id/transition` (body: `toStatus`, `notes`, `metadata`) – checks role, tenant
- `GET /api/v1/orders/:id/transitions` – returns allowed next states
- `GET /api/v1/orders/:id/history` – audit trail from `org_workflow_states_log`
- `GET /api/v1/workflows/config` – current tenant configs (paginated)
- `PATCH /api/v1/workflows/config` – upsert config, validate schema
- AuthN/Z: enforce JWT with `tenant_org_id`; role guard for state changes
- Feature flags: integrate `org_tenants_mst.feature_flags` to toggle steps (assembly/qa/express)
- Observability: structured logs, metrics (transition count, latency), error tracking

## Shared Types & Rules

- Add TypeScript enums/types in shared package `packages/shared-types`:
- `OrderStatus`, `WorkflowTransition`, `QualityGateResult`
- Validation schemas (zod) for API I/O and config JSON

## Quality Gates (Pluggable)

- Built-ins: `assemblyComplete`, `qaPass`
- Interface: `QualityGate { name; check(orderId, tenantId): Promise<boolean> }`
- Registry allows per-tenant/category enablement through config JSON

## Hooks & Events

- Emit internal events: `order.workflow.transitioned`
- Integrations:
- Notifications: enqueue WhatsApp/SMS/email intent (respect feature flags)
- Webhooks: deliver signed tenant-scoped webhooks with retry/backoff
- Analytics: record metrics to time-series (even if stubbed initially)

## Web Admin (Next.js)

- Minimal admin UI under `web-admin/app/(admin)/workflows/`
- List per-category workflow config (read-only first)
- Edit form with JSON editor or guided form (v1 JSON editor acceptable)
- Order details page: show allowed transitions and transition action
- Bilingual: labels via i18n keys; no free text stored beyond notes

## Security & Multi-Tenancy

- Every query filtered by `tenant_org_id`
- RLS on new tables; composite FKs in migrations
- No service role keys on client; backend validates tenant + role

## Testing

- Unit: transition matrix, gate evaluation, config overrides
- Integration: API endpoints with RLS fixtures across two tenants
- E2E: web-admin transition action reflects in history

## Rollout

- Feature flag `advanced_workflow` at tenant level
- Backfill script to seed default workflow config per category
- Metrics dashboard: transitions/min, failure rates, gate failures