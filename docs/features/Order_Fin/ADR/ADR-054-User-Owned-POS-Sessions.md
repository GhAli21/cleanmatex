# ADR-054: User-Owned POS Sessions

- Status: Accepted
- Date: 2026-07-04
- Owners: Order Fin / POS
- Related:
  - `docs/features/Order_Fin/POS_Session_Management_V1.md`
  - `docs/features/Order_Fin/ADR/ADR-032-Cash-Drawer-Effects.md`
  - `docs/features/Order_Fin/ADR/ADR-042-Idempotency-and-Duplicate-Prevention.md`

## Context

CleanMateX already separates:

- financial settlement rows
- cash drawer reconciliation rows
- payment terminal configuration

What is still missing is the operational session that answers:

- which cashier/user is currently operating POS
- which branch that user is operating in
- which later payment, refund, or voucher rows were created during that operating session

The earlier terminal-owned direction was rejected for v1. The approved direction is a user-owned POS session model that can exist with or without a payment terminal and can coexist with a separate cash drawer session.

## Decision

### 1. POS Session is user-owned

`POS Session` tracks the authenticated user's POS operating period.

It is not terminal-owned and it is not the cash-reconciliation source.

### 2. Only one active POS session is allowed per tenant and user

The active uniqueness rule is:

`tenant_org_id + user_id`, where status is `OPEN` or `PAUSED`

Branch does not create a second active session for the same user.

### 3. Terminal is optional session context only

`terminal_id` may be stored on the session, but:

- it is nullable
- it is not unique
- it does not define session ownership

Terminal-required payment methods still resolve terminal selection at transaction time.

### 4. Branch mismatch blocks POS entry

The behavior is locked for v1:

- no active session: allow create
- active same-branch session: return the current session
- active different-branch session: return a branch-conflict result and block POS entry

The system must not silently switch the active session to another branch.

### 5. Cash drawer remains separate

`cash_drawer_session_id` remains the physical cash-reconciliation source.

`pos_session_id` is operational lineage only.

This means:

- drawer balancing still uses cash drawer session data
- POS operational reporting can use POS session lineage
- a POS session may exist without a linked cash drawer session

### 6. Business date is fixed at open time

At session open:

- `business_date` is calculated from the effective business timezone
- the timezone snapshot is stored in `business_timezone`

For v1, if a session crosses midnight, the original `business_date` remains unchanged until the session closes.

### 7. Naming is standardized

- lifecycle action/event name: `FORCE_CLOSE`
- terminal session status name: not used
- POS session status name: `FORCE_CLOSED`

### 8. Combined close wizard is required

If the POS session is linked to an open cash drawer session:

1. the UI must require the drawer close or drawer force-close step first
2. the POS session may close only after that step succeeds
3. POS force-close must not silently force-close the drawer in the background

Drawer force-close remains a separate permission concern from POS session force-close.

### 9. Idempotency is mandatory

The following lifecycle operations must be retry-safe:

- `ensurePosSessionForOrderEntry`
- `openPosSession`
- `pausePosSession`
- `resumePosSession`
- `closePosSession`
- `forceClosePosSession`
- `autoLinkDrawer`

When available, the implementation should use `org_idempotency_keys`.

### 10. Drawer auto-link must lock the POS session row

Before attaching `cash_drawer_session_id`, `autoLinkDrawer` must lock the POS session row.

This prevents concurrent payment flows from attaching conflicting drawer sessions.

### 11. Finance summary scope is limited to active tables

Future `getPosSessionSummary` logic must compute from:

- `org_order_payments_dtl`
- `org_order_refunds_dtl`
- `org_fin_voucher_trx_lines_dtl`

`org_payments_dtl_tr` is not part of the POS session model and remains untouched.

## Consequences

### Positive

- matches cashier-first POS behavior
- works for cash-only or mixed-mode branches
- keeps terminal and drawer responsibilities separate
- allows automatic session creation when POS order entry begins
- creates clean lineage for runtime finance rows

### Tradeoffs

- same user cannot operate two active POS sessions across branches
- branch-switch UX must handle conflict explicitly
- summary/reporting logic must join across multiple active finance tables

## Phase 1 scope

Phase 1 creates only:

- ADR/spec documentation
- catalogs
- POS session tables
- finance linkage columns
- permissions and component metadata seeds

Phase 1 does not create:

- services
- APIs
- UI routes
- sidebar navigation exposure
- runtime auto-open logic

