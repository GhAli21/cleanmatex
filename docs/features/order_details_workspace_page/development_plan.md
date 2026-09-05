# Order Workspace development plan

**Status:** Approved implementation scope  
**Canonical specification:** [README.md](README.md)  
**Package boundary:** `web-admin/src/features/orders/orderdtlworkspace/ui/`

## Objective

Add an operational **Order workspace** without replacing the current Order Details or Full Details experiences. The workspace must put the server-authorized next workflow action, blockers, work progress, customer delivery context, and collection context ahead of financial detail.

## Boundaries

In scope:

- Hidden route: `/dashboard/orders/[id]/workspace`.
- Additive entry from the existing Order Details header beside Full Details.
- Workspace UI isolated under `src/features/orders/orderdtlworkspace/ui/`.
- Reuse existing tenant-safe order resolution, workflow actions, financial read models, payment route, and delivery context.
- EN/AR messages, RTL behavior, Cmx components, accessible states, and responsive behavior.

Out of scope:

- A navigation entry, feature flag, new permission, migration, or payment workflow.
- Replacement or removal of legacy Order Details and Full Details.
- New audit-event writes for print, tracking-link copy, scans, or legacy assembly QA.
- Calculated ready-by, lateness, or SLA-risk UI until an authoritative due-time source and calendar policy exist.
- Calling, WhatsApp, or SMS integrations. Version 1 displays and copies the order contact number only.

## Delivery workstreams

| Workstream | Deliverable | Completion condition |
|---|---|---|
| Route and entry | Workspace route plus legacy-page Order workspace entry | Preserves safe return navigation and the existing route access behavior |
| Shared presentation model | Workspace-specific types, status badge, section navigation, loading skeleton | Does not duplicate legacy workflow/payment authority |
| Overview | Header, workflow action/rail, attention, work, customer, financial, activity-preview cards | Answers next action, blockers, customer needs, work progress, and collection context without tab hunting |
| Deep sections | Work, Customer, Financials, Activity, More with lazy loading as needed | Existing canonical data is reused and empty/error states are intentional |
| UX hardening | Mobile sticky primary action, Cmx feedback, EN/AR/RTL, keyboard/focus support | Meets the scenario guide and no primary action depends on tab scrolling |
| Verification | Targeted tests, lint, typecheck, build, manual responsive checks | Results recorded in `current_status.md` and changelog |

## Ownership map

| Location | Responsibility |
|---|---|
| `web-admin/app/dashboard/orders/[id]/workspace/` | App Router boundary only: route composition and loading route state |
| `web-admin/src/features/orders/orderdtlworkspace/ui/` | Every Order Workspace UI component, client composition, view types, and workspace-local state |
| Existing order/workflow/payment modules | Canonical tenant-safe reads and writes; no parallel transition/payment implementation |
| `web-admin/messages/en/orders/` and `web-admin/messages/ar/orders/` | Matching localized strings for every user-facing workspace control/state |
| This folder | Product, delivery, status, test, and changelog truth for this feature |

## Implementation rules

1. The client renders available workflow actions supplied by the existing server contract. It must send the required state version and idempotency input through the existing workflow path; it must not derive authorization from a visual status map.
2. **Collect payment** links to the existing standard payment screen. No payment amount, credit, refund, or settlement logic belongs to Workspace.
3. Customer phone comes from `org_orders_mst.customer_mobile_number`. Address and location must come from the order-level delivery context already used by delivery; do not substitute mutable customer-profile data for an order commitment.
4. Timezone display resolves branch timezone first and tenant timezone second only when a branch timezone is absent. Do not calculate SLA/ready-by until the authoritative due-time and calendar policy is supplied.
5. Activity is a safe localized read model. It cannot expose raw event codes, JSON payloads, tenant internals, or events that have no proven source.
6. All async feedback uses `cmxMessage`/`useMessage`, while confirmations use the established Cmx confirmation pattern.
7. All feature UI uses Cmx components and semantic tokens. Do not introduce raw controls, raw status colors, legacy toast APIs, or hard-coded color values.

## Source gaps to resolve separately

| Gap | Current product decision | Required future work before enabling |
|---|---|---|
| SLA / ready-by | Omit calculated SLA/late state in V1 | Confirm due-time field, working-hours calendar, holidays, pause rules, exception handling, and display policy |
| Print and tracking copy | Exclude from V1 Activity | Define audited server event writes and retention/access policy |
| Scan timeline | Show operational scan progress only | Provide an order-level aggregated event/read model |
| Rich assembly QA history | Do not imply detail in Activity | Integrate audited QA decisions into a safe aggregate/read model |
| Contact channels | Copy phone only | Confirm consent, channel integrations, audit events, and role controls |

## Definition of done

- Workspace is additive, reachable from Order Details, and retains the legacy pages unchanged.
- The default Overview is operationally useful without requiring a horizontal tab hunt.
- Loading, empty, unavailable, error, permission, stale-state, and not-found states are implemented or explicitly kept outside the release scope with no misleading UI.
- All new user-facing content exists in English and Arabic and functions in RTL.
- Workflow and money actions reuse their canonical existing contracts.
- Validation results and known runtime gaps are recorded in [current_status.md](current_status.md).
