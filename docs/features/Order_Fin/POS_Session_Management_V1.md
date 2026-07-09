# POS Session Management v1

## Purpose

POS Session Management v1 introduces a user-owned operational session for POS work. It gives later phases a single runtime lineage key, `pos_session_id`, without changing the existing ownership of payment terminals or cash drawer reconciliation.

Phase 1 is schema and documentation only. Migrations `0396`–`0398` were applied to local and remote DBs on 2026-07-04, and generated DB types were refreshed afterward.

Runtime lifecycle, finance lineage, order-entry auto-ensure, the POS Sessions workbench, and dashboard navigation were implemented later on 2026-07-04. Navigation migration `0399_pos_sessions_navigation.sql` was applied by the user to local and remote DBs on 2026-07-04.

## Domain Ownership Split

| Domain | What it owns | What it does not own |
|---|---|---|
| POS Session | cashier/user operating context, branch context, lifecycle state, operational lineage | physical cash balancing, terminal settlement |
| Payment Terminal | payment-device context for terminal-required methods | user session ownership, cash balancing |
| Cash Drawer Session | physical cash custody, expected cash, counted cash, variance, drawer open/close | user operating session ownership |
| Finance effect rows | payment, refund, voucher movement facts | POS lifecycle state |

The core rule is:

- `cash_drawer_session_id` is the physical cash-reconciliation source
- `pos_session_id` is the operational user-session trace

## v1 Contract

### Ownership and uniqueness

- POS session is user-owned, not terminal-owned.
- Only one active POS session may exist per `tenant_org_id + user_id`.
- Active means status in `OPEN`, `PAUSED`.
- `terminal_id` is optional and not unique.

### Branch behavior

Manual open and auto-ensure must behave consistently:

| Situation | Result |
|---|---|
| no active session | create a new session |
| active session in same branch | return current active session |
| active session in different branch | return branch-conflict result and block POS entry |

The system must not auto-switch branch on behalf of the user.

### Business date and timezone

- `business_date` is computed at open time.
- `business_timezone` stores the timezone snapshot used for that calculation.
- Phase 2 resolves the effective timezone from branch-scoped settings when available, otherwise tenant timezone.
- If the session crosses midnight, v1 keeps the original `business_date`.

### Lifecycle

Statuses:

- `OPEN`
- `PAUSED`
- `CLOSED`
- `FORCE_CLOSED`

Allowed actions:

| Current status | Action | Result |
|---|---|---|
| none | `AUTO_OPEN` | `OPEN` |
| none | `OPEN` | `OPEN` |
| `OPEN` | `PAUSE` | `PAUSED` |
| `PAUSED` | `RESUME` | `OPEN` |
| `OPEN` | `CLOSE` | `CLOSED` |
| `PAUSED` | `CLOSE` | `CLOSED` |
| `OPEN` | `FORCE_CLOSE` | `FORCE_CLOSED` |
| `PAUSED` | `FORCE_CLOSE` | `FORCE_CLOSED` |

Closed and force-closed sessions are immutable in v1. Reopen is out of scope.

### Event naming

- action/event name: `FORCE_CLOSE`
- resulting status name: `FORCE_CLOSED`

## Close and Drawer Rules

If a POS session is linked to an open cash drawer session, the close experience must use a combined close wizard:

1. user starts POS close
2. UI detects linked drawer is still open
3. UI requires drawer close or explicit drawer force-close
4. only after the drawer step succeeds may the POS session close

Important v1 rule:

- POS force-close does not silently force-close the drawer in the background

This keeps cash control explicit and auditable.

## Idempotency Requirements

All POS session lifecycle commands must be retry-safe.

Required coverage:

- `ensurePosSessionForOrderEntry`
- `openPosSession`
- `pausePosSession`
- `resumePosSession`
- `closePosSession`
- `forceClosePosSession`
- `autoLinkDrawer`

Implementation guidance for later phases:

- use `org_idempotency_keys` where appropriate
- treat double-clicks, network retries, and browser refreshes as normal
- ensure same-branch open/ensure returns the existing active session rather than creating a duplicate

## Drawer Auto-Link Rule

`autoLinkDrawer` may attach a `cash_drawer_session_id` to the POS session later, but it must:

1. lock the POS session row first
2. succeed if the same drawer session is already linked
3. reject if a different drawer session is already linked

That lock is required to prevent concurrent cash-payment flows from attaching conflicting drawer sessions.

## Phase 1 Schema Surface

Phase 1 adds:

- `sys_pos_session_status_cd`
- `sys_pos_session_event_type_cd`
- `org_pos_sessions_mst`
- `org_pos_session_events_dtl`
- nullable `pos_session_id` on:
  - `org_order_payments_dtl`
  - `org_order_refunds_dtl`
  - `org_fin_voucher_trx_lines_dtl`

Phase 1 also seeds:

- POS session permissions
- a non-visible `sys_components_cd` metadata row for discoverability

## Summary Computation Boundary

Future `getPosSessionSummary` must compute from active finance tables only:

- `org_order_payments_dtl`
- `org_order_refunds_dtl`
- `org_fin_voucher_trx_lines_dtl`

Do not use `org_payments_dtl_tr`.

## Phase 2+ Boundaries

### Phase 2 lifecycle slice implemented on 2026-07-04

- lifecycle service and API routes
- branch-conflict response contract
- idempotency handling with `org_idempotency_keys`
- event audit writes
- close/force-close drawer-open guard

Implemented routes:

- `GET /api/v1/pos-sessions/my-active`
- `GET /api/v1/pos-sessions`
- `POST /api/v1/pos-sessions/open`
- `POST /api/v1/pos-sessions/ensure-for-order-entry`
- `POST /api/v1/pos-sessions/pause`
- `POST /api/v1/pos-sessions/resume`
- `POST /api/v1/pos-sessions/close`
- `POST /api/v1/pos-sessions/force-close`
- `GET /api/v1/pos-sessions/[sessionId]/summary`

### Phase 2 finance-lineage slice implemented on 2026-07-04

- Prisma schema mirrors nullable `pos_session_id` on active finance tables.
- POS-aware order submit can carry `posSessionId` into voucher lines and wired order-payment rows.
- New order submission ensures a POS session before calling `/api/v1/orders/submit-order` and passes the resulting `posSessionId`.
- Later collection can carry `posSessionId` into direct order-payment rows.
- Refund initiation can carry `posSessionId` into order-refund rows.
- `autoLinkDrawer` locks the POS session row before linking an open drawer session.
- `getPosSessionSummary` computes from active finance tables only:
  - `org_order_payments_dtl`
  - `org_order_refunds_dtl`
  - `org_fin_voucher_trx_lines_dtl`

### Phase 3 UI/navigation slice implemented on 2026-07-04

- dashboard route: `/dashboard/internal_fin/pos-sessions`
- sidebar entry: `billing_pos_sessions`
- navigation migration: `0399_pos_sessions_navigation.sql`
- page access contract: `pos-sessions-access.ts`
- POS Sessions workbench:
  - active session card
  - manual open
  - pause/resume
  - close/force-close
  - history list
  - session summary dialog
- order-entry banner for active, paused, missing, and branch-conflict POS session states
- combined close drawer step:
  - if POS close returns `POS_SESSION_DRAWER_STILL_OPEN`, the UI prompts for the linked drawer close step
  - POS close is retried only after drawer close succeeds
  - drawer force-close remains explicit future work and is not performed silently
- later collection lineage:
  - uses an existing same-branch `OPEN` POS session when present
  - does not auto-open a POS session in back-office collection flows

### Session Hub order-entry enhancement implemented on 2026-07-09

The New Order screen now uses a compact Session Hub instead of an always-visible healthy-state POS banner.

UI behavior:

- healthy `OPEN` session renders as a compact `Session Hub` pill in the New Order header
- full-width notices are reserved for warning/blocking states only:
  - paused POS session
  - branch conflict
  - active-session API error
- no active session is shown as an informational Hub state because order submit still auto-ensures the POS session
- users with `pos_session:open` can explicitly start the POS session from the Hub before submitting an order
- the Hub opens a right-side `CmxDialog` panel on desktop and a near-full-screen panel on small screens

Hub content:

- POS session status, session number, branch, business date, timezone, opened time, and optional terminal context
- cash drawer section that only displays drawer labels/status when `cash_drawer:view` is granted
- permission-safe drawer restriction text when the user can see POS lineage but cannot view drawer reconciliation details
- drawer setup card when an `OPEN` POS session has no linked drawer:
  - lists branch cash drawers through `GET /api/v1/cash-drawers`
  - links an existing open drawer session through `POST /api/v1/pos-sessions/auto-link-drawer`
  - opens a drawer through `POST /api/v1/cash-drawers/[drawerId]/open-session`, then links it through POS auto-link
- finance summary loaded lazily from `GET /api/v1/pos-sessions/[sessionId]/summary`
- drawer close summary loaded from the cash-drawer API boundary, `GET /api/v1/cash-drawers/[drawerId]/session/[sessionId]/summary`
- drawer close summary displays drawer/session identity, currency, opening float, linked cash collected, expected cash, counted cash, payment row count, movement row count, cash-in/cash-out/net movement context, and variance
- safe lifecycle actions using existing POS session APIs:
  - pause/resume
  - close
  - force-close
  - manage sessions link

Security and drawer rules:

- `GET /api/v1/pos-sessions/my-active?includeContext=true` is backward-compatible and opt-in
- drawer context is nulled unless the caller has `cash_drawer:view`
- cash drawer reconciliation facts remain owned by cash drawer service/API; POS Session UI only orchestrates the combined close flow
- cash drawer selection/opening remains owned by cash drawer APIs; POS Session owns only the operational link (`AUTO_LINK_DRAWER`)
- drawer auto-link requires `pos_session:open` and `cash_drawer:view`; opening a drawer requires `cash_drawer:open_session`
- lifecycle commands use idempotency keys and `sourceChannel = new_order_session_hub`
- if POS close reports `POS_SESSION_DRAWER_STILL_OPEN`, the Hub requires the linked cash drawer close step before retrying POS close
- POS force-close still does not silently force-close the drawer

Access contract coverage:

- New Order documents the Hub dependencies on POS summary/lifecycle APIs
- drawer list/open from the Hub is documented with `cash_drawer:view` and `cash_drawer:open_session`
- drawer auto-link from the Hub is documented with `pos_session:open` plus `cash_drawer:view`
- drawer summary from the Hub is documented with `cash_drawer:view`
- drawer close from the Hub is documented with `cash_drawer:close_session`

### Remaining future enhancements

- optional global POS session provider if multiple pages need live state refresh
- explicit drawer force-close UX/API integration, gated separately from POS force-close
- Prisma model pull for `org_pos_sessions_mst` and `org_pos_session_events_dtl`
- richer manager reporting around session variances and terminal/card settlement references

### Phase 5 tests/docs closeout implemented on 2026-07-04

- schema tests:
  - optional terminal behavior
  - force-close reason requirement
  - list pagination/status/scope validation
  - branch query validation
- service contract tests:
  - branch mismatch returns conflict instead of switching branches
  - idempotent no-op resume when already open
  - closed sessions cannot resume
  - finance writes reject branch-mismatched sessions
  - drawer auto-link same-drawer idempotency and different-drawer rejection
  - summary aggregation from active finance tables

## Explicit Non-Goals for Phase 1

- no services or API routes
- no UI routes or pages
- no `navigation.ts` exposure
- no runtime permission wiring
- no auto-open implementation
- no summary implementation
- no migration execution
