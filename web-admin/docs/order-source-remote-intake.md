# Order source and physical intake (remote vs shop)

## Concepts

- **Order channel** — `org_orders_mst.order_source_code` → `sys_order_sources_cd` (POS, customer mobile app, etc.).
- **Physical intake** — `physical_intake_status` (`pending_dropoff` | `received`), timestamps, and optional `physical_intake_info` / `received_info` text.
- **Remote booking** — Sources with `requires_remote_intake_confirm = true` start as `draft` on screen `new_order`, `physical_intake_status = pending_dropoff`, and `received_at` stays **NULL** until staff confirm.

## Database

- Migration: `supabase/migrations/0245_order_sources_physical_intake.sql` (global catalog, tenant allowlist, `org_orders_mst` columns, `received_at` **default dropped**).
- Migration: `supabase/migrations/0246_workflow_template_draft_to_intake_transitions.sql` seeds **`draft` → `intake`** (manual, active) on default PRD-010 templates so `cmx_order_transition` allows confirm-intake without per-tenant JSON edits.
- HQ catalog CRUD for `sys_order_sources_cd` is intended for the separate **CleanMateX SaaS** repo (`cleanmatexsaas`), not web-admin.

## APIs (web-admin)

| Method | Path | Notes |
|--------|------|--------|
| POST | `/api/v1/orders/[id]/confirm-physical-intake` | **Auth:** `orders:transition`. Validates source flag + `pending_dropoff` + `draft`, runs workflow `draft → intake`, sets intake columns and `received_at`. Idempotent when already `received`. |
| GET | `/api/v1/orders` | Optional filters: `order_source_code`, `physical_intake_status` (comma-separated supported). |
| GET | `/api/v1/public/customer/orders` | Returns `orderSourceCode`, intake fields, and nested `orderSource` for the customer app. |
| GET/PUT | `/api/v1/catalog/order-sources` | Tenant allowlist UI; **Auth:** `config:preferences_manage`. |

## Permissions

- **Confirm physical intake** reuses **`orders:transition`** (same permission as the generic transition endpoint). No separate permission key was added.

## Operations

- **Awaiting drop-off queue:** Orders list with `status=draft` and `physical_intake_status=pending_dropoff` (link from the orders dashboard header).
- **`draft` → `intake`** is enforced by **`sys_workflow_template_transitions`** for the order’s workflow template (see `0023_workflow_transition_function.sql`). Custom templates need the same transition row; legacy `org_workflow_settings_cf` transition JSON is not the gate for `cmx_order_transition`.
