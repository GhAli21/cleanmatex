# Order Details Workspace

**Status:** Proposed UX and implementation specification  
**Scope:** Additive Order Workspace screen; the existing Order Details and Full Details screens remain unchanged during rollout.  
**Audience:** Product, UX, web-admin engineering, workflow engineering, finance, QA, and operations.

## 1. Product decision

Create an operational Order Workspace at the hidden detail route:

```text
/dashboard/orders/[id]/workspace
```

This is not a reskin of the current financial-first Order Details page and must not be presented to users as “V2”. Its final product label is **Order workspace**.

The existing order detail action row adds the new action beside **View full details**:

```text
[Print label] [Order workspace] [View full details] [Edit] [Public tracking]
```

The legacy page remains the safe fallback while the workspace is evaluated. The workspace route is hidden, so it does not create a navigation entry, navigation migration, feature flag, or new permission. It inherits the existing tenant-safe order resolution and access contract from Order Details. It preserves `returnUrl`, `returnLabel`, and a selected workspace section in the URL.

## 2. Problem statement

The current screen is a detailed financial record. It shows total, payment and multiple accounting tabs before staff can efficiently answer the operational questions that matter at intake, preparation, QA, ready, pickup, and delivery:

1. Which order is this?
2. What must happen next?
3. Is anything blocking it?
4. What does the customer need?
5. What is the collection or financial consequence?
6. What happened previously?

The existing tab set mixes regular work with rare accounting and audit material, requires horizontal scrolling, and buries workflow controls under a final Actions tab. A `Preparation Status: pending` label with a distant text action is not sufficient for an operational workspace.

## 3. Experience principles

- **Workflow first:** the next valid server-authorized action is the primary decision.
- **Attention before detail:** blockers, SLA risk, customer instructions, QA failures, and collection requirements appear before tabs or tables.
- **Progressive disclosure:** show a compact operational overview first; load deep financial and audit material only when selected.
- **One source of truth:** use existing canonical order financial view models, server-derived available actions, and tenant-scoped order resolution.
- **Speed over decoration:** low-motion, high-signal patterns suit counter and floor operators.
- **Capability-driven:** role permissions shape actions and specialist sections without making different copied screens.
- **Bilingual by default:** all labels, statuses, states, and feedback are EN/AR localized and RTL-safe.

## 4. Target information architecture

| Section | Purpose | Content |
|---|---|---|
| Overview | Immediate operational decision-making | Workflow rail, attention panel, work progress, customer summary, compact money summary, recent activity |
| Work | Production and fulfillment execution | Items and pieces, scans, conditions, preferences, assignment, QA, packing, delivery proof where relevant |
| Customer | Service context | Customer identity, contact, address, pickup/delivery instructions, customer and internal notes, loyalty/credit indicators |
| Financials | Collection and accounting | Order value, paid/credits/balance, collection requirement, payments, invoices/tax, vouchers, refunds |
| Activity | Auditable narrative | Status transitions, material edits, payment events, print/share events, delivery proof, actor and timestamp |
| More | Specialist or low-frequency information | Master data, preference ledger and permission-gated financial debug |

Navigation rules:

- Default section is **Overview**.
- Show counts only where meaningful, for example `Work (4)` for four actionable units.
- Show a warning marker only for a real financial concern: balance due, failed/unverified payment, refund pending, or reconciliation issue.
- Never render a completely empty tab. Render a section-specific empty state instead.
- Support deep links such as `?section=work&pieceId=<id>`.
- Keep financial debug absent unless the existing authorized permission permits it.

## 5. Desktop layout

```text
Breadcrumb: Orders / ORD-20260904-0002                          [More]

ORD-20260904-0002     [Intake] [Pay on collection] [Balance due OMR 4.280]
Jh Test dev21 · +968 xxxx xxxx · Branch · Received 04 Sep, 12:16 PM
Ready target: Not set / Today 17:30             [Print] [Edit] [Share tracking]

┌─────────────────────────────────────────────────────────────────────┐
│ Workflow rail                                                        │
│ Received ✓ ─ Preparation ● ─ Processing ─ QA ─ Ready ─ Delivery     │
│ Current: Preparation pending · 0/4 items prepared                    │
│ [Start preparation]                              [Scan / More]      │
└─────────────────────────────────────────────────────────────────────┘

[Blocking: balance due on collection — collect OMR 4.280 at handover]
[Warning: no ready-by target set — assign commitment time]

Overview | Work (4) | Customer | Financials | Activity | More

┌───────────────────────────────┬─────────────────────────────────────┐
│ Work queue                    │ Customer and fulfillment            │
│ - Item/piece completion       │ Phone / preferred contact            │
│ - Instructions and conditions │ Pickup / delivery address            │
│ - Assigned operator           │ Customer notes / preferences         │
│ - Scan / exception status     │ Loyalty / credit warning             │
├───────────────────────────────┼─────────────────────────────────────┤
│ Financial snapshot            │ Recent activity                      │
│ Total / paid / balance        │ Last four material events            │
│ Collection requirement        │ [View all activity]                  │
└───────────────────────────────┴─────────────────────────────────────┘
```

Desktop rules:

- Use a two-column Overview grid. Operational work receives approximately 60% of available width; customer and financial context receive 40%.
- Keep top header actions visible. The workflow primary action is visually stronger than administrative actions.
- Put the workflow rail full width.
- Keep Activity a compact preview until the user opens Activity.

## 6. Header specification

The header is one compact identity surface, not a collection of detached cards.

| Area | Requirements |
|---|---|
| Breadcrumb | Back to the sanitized originating list/location, with an RTL-aware directional icon |
| Identity | Order number is the single `h1`; display a copy affordance only if it is useful and permission-safe |
| State badges | Localized workflow status, collection/payment state, and only material risk badges; no raw database codes |
| Customer line | Name, phone from `org_orders_mst.customer_mobile_number`, branch, received time, fulfillment type, and ready-by/SLA summary |
| Financial fact | Compact balance/total signal; it must distinguish settled, balance due, pay on collection, pending verification, and refund pending states |
| Actions | Print, edit, public tracking, and more-actions; the one workflow action is separate and primary |

Customer context must not require entering a secondary tab to find the contact number, delivery/pickup method, customer instructions, or a material loyalty/credit warning.

## 7. Workflow rail and action model

The rail uses the configured order workflow rather than a frontend-only static lifecycle. A typical visible progression is:

```text
Received → Preparation → Processing → QA → Ready → Pickup/Delivery → Completed
```

It shows current stage, prior completion, next stages, and relevant counts. Version 1 does not calculate or infer a ready-by/SLA target. A due-time/SLA signal may be added only after a canonical order-level source, working-hours calendar, and pause/exception policy are confirmed. Timezone resolution is branch timezone first, then tenant timezone when no branch timezone is available.

### Primary action rules

The client consumes server-derived available actions and sends the required `expectedStateVersion` and idempotency key. It must never infer a transition merely from a displayed status.

| Current context | Primary action | Secondary actions |
|---|---|---|
| Intake | Start preparation | Edit order, print label |
| Preparation | Complete preparation | Scan/add piece, report issue |
| Processing | Send to QA | Open work items |
| QA failure | Return to processing | View failed checks |
| Ready with balance due | Collect payment / begin handover | Print receipt |
| Ready and settled | Confirm pickup or hand to delivery | Print receipt |
| Delivered | Complete order | View proof |
| Completed/cancelled | No operational primary action | View activity, print records |

The primary action always states the result, prerequisites, loading state, availability reason, and outcome. Confirmation is required only for sensitive, irreversible, or money-impacting operations.

Cancel, return/reopen, refund, fix-order-data, and similar exception actions are placed in a More menu. They must not compete visually with the next workflow action.

## 8. Overview cards

### Order attention panel

Render only applicable alerts, ordered as blocking, warning, then informational:

- Cannot transition because preparation, QA, payment, or delivery prerequisite is unmet.
- Balance due at pickup/delivery.
- Missing ready-by commitment, only when the underlying business policy requires it.
- Overdue target or SLA risk, based on tenant/branch timezone and authoritative calendar logic.
- QA failure, missing delivery proof after delivery, damaged-item condition, or customer critical instruction.
- Pending payment verification, refund approval, or reconciliation mismatch.

Every alert contains a clear label, icon, non-color signal, affected value/count, and an action when the user is permitted to resolve it.

### Work progress card

Show items/pieces total, completed/current-stage/blocked counts, scan state, active exception summary, assignee where supported, and a direct Work link. Do not imply piece tracking when the tenant’s `trackByPiece` capability is disabled.

### Customer and fulfillment card

Show identity, contact, pickup/delivery method, order address/location details, address or collection point, customer notes, internal notes with appropriate permission boundary, and special-care/service preferences. Use `org_orders_mst.customer_mobile_number` as the order contact value. The address/location details stored on `org_orders_mst` must be displayed in the workspace and passed through the same canonical delivery context used by delivery screens. Version 1 provides a copy-phone affordance with safe success/failure feedback. Call, WhatsApp, and SMS integrations are deferred until their supported channels, consent rules, and audit requirements are confirmed.

### Financial snapshot card

Show order total, paid, credits applied, balance due, payment plan/collection requirement, and one context-aware financial action. For collection, **Collect payment** links to the existing standard payment screen/flow; the workspace does not create, duplicate, or own a new payment workflow. Keep the accepted separation between Order Value, Settlement, Receivable/Collection, and Tax; detailed finance remains under Financials.

### Recent activity preview

Show the latest four material events, actor, timestamp, and result. The full Activity section contains the complete audit narrative.

## 9. Responsive behavior

### Desktop (1024px and above)

- Two-column Overview grid and full-width workflow rail.
- Header actions stay right-aligned and visible.
- Detail tables may scroll only inside intentional table containers.

### Tablet (768px to 1023px)

- Header facts use a two-row grid.
- Actions may wrap, but primary workflow action remains first.
- Collapse Overview to one column before card contents become cramped.
- Navigation may horizontally scroll, with Overview and Work first.

### Mobile (320px to 767px)

```text
Back
ORD-... [Intake]
Customer · Balance due
[Start preparation] [More]

Current stage + 0/4 items
Blocking alerts

Overview / Work / Customer / Financials / Activity
```

- Use a sticky bottom bar for the current primary workflow action.
- Move secondary actions to a Cmx drawer/sheet.
- Do not rely on horizontal tab scroll to discover a primary action.
- Present detailed financial data as stacked summary rows; use intentional scroll containers for large tables.
- Do not collapse or hide blockers, customer instructions, payment due, or the workflow state.

## 10. States and recovery

| State | Required behavior |
|---|---|
| Initial load | Skeleton matching header, rail, alert region, cards, and section navigation; no isolated spinner |
| Section load | Section-local skeleton; retain the loaded header and workflow context |
| Empty items | Explain that no items are available and offer a permitted recovery action when appropriate |
| No preferences | Neutral state: no special care instructions recorded |
| No activity | Explain that no tracked activity exists yet; never use generic “No data” |
| No delivery proof | Explain whether delivery has not begun, proof is not required, or proof is missing after delivery |
| Financial unavailable | Compact warning with retry; operational workflow remains usable |
| Action unavailable | Disabled action plus exact prerequisite, for example: “Complete preparation before QA can begin” |
| Network error | Persistent safe retry panel; preserve already-loaded order context |
| Permission denied | Human explanation of the business limitation; do not expose policy internals |
| Not found/tenant mismatch | Safe route back to originating location; do not expose tenant IDs, RLS hints, raw exceptions, or debug data |
| Stale state/conflict | “This order changed by another user” with refresh and concise context/difference when available |

Copy/share tracking must show a success or failure message through `cmxMessage`; it must never fail silently.

## 11. Accessibility, theming, and i18n

- Meet WCAG 2.1 AA contrast in light and dark themes.
- Status uses icon, localized text, and semantic token color; color is never the only indicator.
- All controls, menus, drawers, dialogs, retry actions, and section navigation are keyboard accessible with visible Cmx focus treatment.
- Use one `h1` for the order number and section-level `h2` headings.
- Use `cmxMessage` / `useMessage()` for operational success, error, warning, loading, and permission feedback. Field validation stays inline; dedicated confirmation uses `CmxConfirmDialog`.
- Add matching EN and AR message keys. Use logical CSS spacing, RTL-aware layouts, and directional icon flipping.
- Respect reduced-motion preferences. Workflow progression can be subtly animated but must never delay work.
- Use Cmx components and tokenized semantic variants only. Do not add raw status-color classes, raw buttons, hardcoded hex colors, or legacy toast APIs.

## 12. Component ownership and package boundary

All Order Details Workspace V2 UI is isolated under this exact package:

```text
web-admin/src/features/orders/orderdtlworkspace/ui/
```

The App Router page only imports and composes `OrderWorkspaceScreen` from this package. Do not place V2 workspace components beside legacy order-detail UI, and do not mix them into generic `src/features/orders/ui/`. This keeps legacy Order Details, Full Details, and the new Workspace independently understandable during the additive rollout.

| Component | Ownership and responsibility |
|---|---|
| `OrderWorkspaceScreen` | `src/features/orders/orderdtlworkspace/ui`; composition, section URL state, query/mutation orchestration |
| `OrderWorkspaceHeader` | `src/features/orders/orderdtlworkspace/ui`; identity, critical statuses, contextual actions |
| `OrderWorkflowRail` | `src/features/orders/orderdtlworkspace/ui`; configured lifecycle, stage state, SLA context |
| `OrderNextActionCard` | `src/features/orders/orderdtlworkspace/ui`; server-authorized primary action, prerequisites, secondary controls |
| `OrderAttentionPanel` | `src/features/orders/orderdtlworkspace/ui`; domain blocker/warning/information aggregation |
| `OrderWorkProgressCard` | `src/features/orders/orderdtlworkspace/ui`; item/piece/scan/QA progress |
| `OrderCustomerContextCard` | `src/features/orders/orderdtlworkspace/ui`; contact, fulfillment, instructions, permission-safe notes |
| `OrderFinancialSnapshotCard` | `src/features/orders/orderdtlworkspace/ui`; compact canonical financial summary |
| `OrderActivityPreview` | `src/features/orders/orderdtlworkspace/ui`; latest material events |
| `OrderStatusBadge` | `src/features/orders/orderdtlworkspace/ui`; localized semantic order state badge |
| Generic responsive section navigation | `src/ui` only if it has no order-domain assumptions |

Reuse the existing workflow action and financial view-model contracts where they fit. Extract shared read-model and capability hooks before duplicating legacy data fetching.

## 13. Technical and business risks

1. **Screen drift:** Legacy Order Details, Full Details, and Workspace can present different totals, actions, or permissions. Share canonical read models and action capability hooks.
2. **Workflow authority:** Client-side status maps cannot authorize actions. Server-side state, policy, permissions, and expected version remain authoritative.
3. **Money safety:** Collection, refunds, credit usage, and adjustments require explicit lineage, safe confirmations, backend authorization, and no silent amount mutation.
4. **Role variation:** Counter, production, QA, driver, and finance staff must see capability-appropriate actions, not distinct copied pages.
5. **Performance:** Initial Overview must not eagerly load all invoices, vouchers, preferences, histories, and audit data. Load identity/workflow/attention first; lazy-load selected sections.
6. **Audit:** Existing activity-source coverage is under investigation. Do not promise print/share/copy, scan, QA, or transition entries until the current source inventory is confirmed; any missing event is a separate backend/audit scope.
7. **SLA truth:** Ready-by and lateness cannot be fabricated by UI. Version 1 omits SLA calculations until source, timezone, tenant calendar, and pause/exception rules are confirmed.
8. **Rollout:** The workspace is reached only from existing Order Details. It has no new feature flag or permission, while retaining the legacy route as fallback during evaluation.

## 14. Delivery sequence

1. Add the hidden workspace route and the legacy-page **Order workspace** action.
2. Implement shared header, localized semantic status badges, workflow rail, and next-action card.
3. Implement Overview: attention, work progress, customer context, financial snapshot, and activity preview.
4. Implement section-level lazy loading and the grouped navigation model.
5. Add mobile sticky primary action, state coverage, EN/AR support, RTL validation, and accessibility checks.
6. Evaluate adoption before any legacy replacement: workspace opens, primary-action completion time, transition failures, retry rate, and continued use of Full Details.

## 15. Acceptance criteria

- Workspace link is additive beside Full Details and retains safe return navigation.
- Initial page answers the next valid action, blockers, customer instructions, work progress, and balance/collection context without tab hunting.
- Only valid server-authorized workflow actions can be performed.
- All async paths have loading, success, error, and recovery states.
- No raw database status/payment codes are exposed as user-facing labels.
- Page works at 320px, 768px, 1024px, and 1440px without accidental horizontal page overflow.
- EN and AR content, RTL layout, keyboard operation, focus indicators, dark mode, and WCAG AA status treatment are verified.
- Existing financial separation and permission-controlled debug access remain intact.

## 16. Confirmed current integration points

- The existing Order Details header action row is composed in `web-admin/app/dashboard/orders/[id]/order-detail-client.tsx`.
- The current page already resolves an order through the tenant-safe order reference path and supports `returnUrl` handling.
- Existing financial details preserve the accepted separation between order value, settlement, receivable/collection, and tax; the workspace uses a compact summary rather than replacing that detailed model.
- Existing workflow controls are currently represented by `OrderActions` and `WorkflowActionBar`; V2 promotes the next valid workflow action rather than duplicating transition logic.

### Activity-source findings

The existing `OrderTimeline` is a usable starting point, but it is not yet a complete Workspace Activity feed:

- `web-admin/src/features/orders/ui/order-timeline.tsx` reads `org_order_history` and already recognizes `ORDER_CREATED`, `STATUS_CHANGE`, `FIELD_UPDATE`, `SPLIT`, `QA_DECISION`, `ITEM_STEP`, `ISSUE_CREATED`, `ISSUE_SOLVED`, `ORDER_COMPLETED`, `VOUCHER_POSTED_AND_WIRED`, and `AR_INVOICE_ISSUED`.
- Therefore, V1 Activity can safely target workflow transitions, item processing steps, issue lifecycle, completion, voucher posting, AR invoice issuance, and existing financial history events when corresponding rows are emitted. It should link to the existing Delivery Proof and Edit History surfaces rather than duplicate them.
- QA is partial: the stage-command QA pass/fail flow can appear as a workflow `STATUS_CHANGE`, but legacy assembly QA stores decision/note/photo data in `org_qa_decisions_tr` and does not reliably write `org_order_history`. Do not present rich QA pass/fail details in Activity until an aggregate/read-model integration or audited event exists.
- Scanning is not available in the current order-level Activity. Piece scans update piece state and may have per-piece history, but are not aggregated into `org_order_history`. Keep scan progress in Work and defer audited scan events to a separate source/read-model change.
- Print-label usage and public tracking-link copy/share are not audited today. The current print button only opens a browser print window, and tracking copy only calls the clipboard API. Do not promise these events in V1 Activity.
- Payment, refund, collection, and verification events have separate payment/audit surfaces and must be mapped deliberately rather than assumed to be in `org_order_history`.
- The current timeline query filters by `order_id` but does not visibly add `tenant_org_id` in the component. Any Workspace Activity data access must use the approved tenant-scoped service/API boundary before reuse; do not copy this direct query into the new package.
- The current timeline includes raw payload expansion and technical event values. Workspace Activity must use a safe localized event mapper and permission-aware detail expansion rather than displaying raw JSON.

## 17. Decision register

| Topic | Decision | Implementation consequence |
|---|---|---|
| User-facing label | **Order workspace** | Use this localized label for the legacy-page entry and workspace title. Do not expose “V2”. |
| Access | No new feature flag or permission | The hidden route is entered from Order Details and inherits its existing tenant-safe access contract. |
| SLA / ready-by | Deferred calculation; timezone fallback defined | Version 1 does not show a calculated ready-by, overdue, or SLA-risk indicator until the canonical scheduling source is confirmed. Resolve timezone from branch first, then tenant timezone when branch timezone is absent. |
| Customer contact and location | Use order-level delivery context | Display `org_orders_mst.customer_mobile_number` and the existing address/location details from `org_orders_mst`; use the same context for delivery. V1 supports copy phone only. |
| Collection | Reuse the standard payment flow | Show **Collect payment** only when applicable; it links to the existing standard payment screen and does not introduce a new payment implementation. |
| Activity coverage | Under investigation | Confirm existing source coverage for print, public tracking copy/share, scan, QA, and workflow transition events before finalizing Activity scope. |

### SLA / ready-by clarification

This is a business commitment, not a decorative timestamp. The page must not derive lateness from `received_at`, browser time, or a guessed duration. Before displaying it, the product must identify the authoritative order due/ready-by field, working-hours calendar, holidays, pause rules, and exception policy. Resolve timezone from the branch when present; otherwise use the tenant timezone. Until the due/ready-by source is confirmed, V1 should omit the SLA alert and show only known timestamps such as received time.

### Customer contact clarification

“Contact actions” means whether the operator can call, copy the phone number, start WhatsApp, send SMS, or open a customer profile. V1 displays `org_orders_mst.customer_mobile_number` and supports copying it. It also displays the order-level address/location details from `org_orders_mst`, because delivery needs the same canonical context. Call/WhatsApp/SMS require channel availability, customer consent, localization, audit expectations, and possibly an integration; they are not included in this workspace scope.
